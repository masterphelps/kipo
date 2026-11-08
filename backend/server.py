"""KiPo backend — a KiroCrew app.

Run with: python backend/server.py
Or let KiroCrew manage it via the app manifest backend section.

Routing and HTTP only; the logic lives in the ``kipo`` package. The API is
specified in CONTRACT.md.
"""
import hashlib
import hmac
import json
import os
import re
import sys
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlsplit

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from kipo import KipoError, repos  # noqa: E402
from kipo.gh import Gh  # noqa: E402
from kipo.initiatives import EFFORT_LABEL, Initiatives, parse_body, validate_repo_slug  # noqa: E402
from kipo.storage import Storage  # noqa: E402

PORT = int(os.environ.get("PORT", 9100))
APP_NAME = os.environ.get("KIROCREW_APP_NAME", "kipo")
MAX_BODY = 1 << 20

# Longest first, so /api/apps/kipo is not read as /api + /apps/kipo.
PREFIXES = ("/apps/kipo/api", "/api/apps/kipo", "/api")

try:
    from kiro_crew.apps.proxy_auth import verify_proxy_request
except ImportError:  # no kiro_crew in this Python: the same check with stdlib

    def verify_proxy_request(header_value, *, method, target, body, secret=None, now=None):
        key = os.environ.get("KIROCREW_PROXY_SECRET", "") if secret is None else secret
        if not key or not header_value or ":" not in header_value:
            return False
        ts_str, _, sig = header_value.partition(":")
        if not ts_str.isdigit() or not sig:
            return False
        clock = time.time() if now is None else now
        if abs(clock - int(ts_str)) > 60:
            return False
        msg = f"{ts_str}:{method}:{target}:{hashlib.sha256(body or b'').hexdigest()}"
        expected = hmac.new(key.encode(), msg.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(
            expected.encode("utf-8", "surrogatepass"), sig.encode("utf-8", "surrogatepass")
        )


def strip_prefix(path):
    """Drop any accepted API prefix, at a segment boundary, and the query string."""
    path = urlsplit(path).path or "/"
    for prefix in PREFIXES:
        if path == prefix or path.startswith(prefix + "/"):
            path = path[len(prefix):] or "/"
            break
    if len(path) > 1:
        path = path.rstrip("/")
    return path


_ISSUE = r"^/initiatives/([^/]+)/([^/]+)/(\d+)"
ROUTES = [
    ("GET", re.compile(r"^/health$"), "health"),
    ("GET", re.compile(r"^/status$"), "status"),
    ("GET", re.compile(r"^/config$"), "get_config"),
    ("PUT", re.compile(r"^/config$"), "put_config"),
    ("GET", re.compile(r"^/repos/discover$"), "discover_repos"),
    ("POST", re.compile(r"^/repos$"), "add_repo"),
    ("POST", re.compile(r"^/repos/remove$"), "remove_repo"),
    ("GET", re.compile(r"^/browse$"), "browse"),
    ("GET", re.compile(r"^/sessions$"), "list_sessions"),
    ("GET", re.compile(r"^/initiatives$"), "list_initiatives"),
    ("POST", re.compile(r"^/initiatives$"), "create_initiative"),
    ("GET", re.compile(_ISSUE + r"$"), "detail"),
    ("POST", re.compile(_ISSUE + r"/advance$"), "advance"),
    ("POST", re.compile(_ISSUE + r"/session$"), "session"),
    ("POST", re.compile(_ISSUE + r"/skill$"), "skill"),
    ("POST", re.compile(_ISSUE + r"/remove$"), "remove"),
    ("POST", re.compile(_ISSUE + r"/hide$"), "hide"),
    ("POST", re.compile(_ISSUE + r"/unhide$"), "unhide"),
    ("GET", re.compile(r"^/tree$"), "tree"),
    ("POST", re.compile(r"^/sidebar$"), "sidebar"),
    ("GET", re.compile(_ISSUE + r"/frontier$"), "frontier"),
    ("GET", re.compile(_ISSUE + r"/doc$"), "doc"),
    ("GET", re.compile(_ISSUE + r"/tickets/(\d+)$"), "ticket"),
]


class App:
    """The endpoint implementations, independent of the HTTP plumbing."""

    def __init__(self, gh=None, storage=None, clock=None, repo_roots=repos.DEFAULT_ROOTS, home=None):
        self.gh = gh or Gh()
        self.storage = storage or Storage()
        self.repo_roots = repo_roots
        self.home = home
        kwargs = {"clock": clock} if clock else {}
        self.initiatives = Initiatives(self.gh, self.storage, **kwargs)

    def health(self, body):
        return {"status": "ok"}

    def status(self, body):
        return {"app": APP_NAME, "version": "0.1.0"}

    def get_config(self, body):
        return self.storage.get_config()

    def put_config(self, body):
        repos = body.get("repos") if isinstance(body, dict) else None
        if not isinstance(repos, list):
            raise KipoError('The config needs a "repos" list.', "invalid_config", 400)
        clean, seen = [], set()
        for entry in repos:
            if not isinstance(entry, dict):
                raise KipoError("Each repo needs a slug and a path.", "invalid_config", 400)
            slug, path = entry.get("slug"), entry.get("path")
            try:
                validate_repo_slug(slug)
            except KipoError:
                raise KipoError(f"{slug!r} is not an owner/name repo slug.", "invalid_config", 400)
            if slug.lower() in seen:
                raise KipoError(f"{slug} is listed twice.", "invalid_config", 400)
            seen.add(slug.lower())
            if not isinstance(path, str) or not os.path.isabs(path):
                raise KipoError(f"The path for {slug} must be absolute.", "invalid_config", 400)
            path = os.path.normpath(path)
            if not os.path.isdir(path):
                raise KipoError(f"{path} does not exist.", "invalid_config", 400)
            if not self.gh.is_git_checkout(path):
                raise KipoError(f"{path} is not a git checkout.", "invalid_config", 400)
            clean.append({"slug": slug, "path": path})
        return self.storage.save_config({"repos": clean})

    def _configured_paths(self):
        return [r.get("path", "") for r in self.storage.get_config()["repos"]]

    def discover_repos(self, body):
        found = repos.discover(roots=self.repo_roots, configured=self._configured_paths())
        # How many open wayfinder maps each repo has, so a repo with live maps
        # stands out. Best effort: without it the list still works.
        owners = {r["slug"].split("/")[0] for r in found if r.get("slug")}
        if owners:
            try:
                counts = self.gh.open_map_counts(owners)
            except KipoError:
                counts = None
            if counts is not None:
                for r in found:
                    if r.get("slug"):
                        r["maps"] = counts.get(r["slug"].lower(), 0)
        return {"repos": found}

    def browse(self, body):
        return repos.browse(body.get("path") or None, home=self.home)

    def add_repo(self, body):
        """Add a checkout by its folder alone; the slug comes from its origin remote."""
        path = body.get("path") if isinstance(body, dict) else None
        if not isinstance(path, str) or not os.path.isabs(path):
            raise KipoError("Pick a folder to add.", "invalid_request", 400)
        path = os.path.normpath(path)
        info = repos.describe(path)
        if not info:
            raise KipoError(f"{os.path.basename(path)} isn't a git checkout.", "not_a_checkout", 400)
        if not info["slug"]:
            raise KipoError(
                f"{info['name']} has no GitHub remote named origin, so KiPo can't file its efforts anywhere.",
                "no_github_remote",
                400,
            )
        current = self.storage.get_config()["repos"]
        for entry in current:
            if entry.get("slug", "").lower() == info["slug"].lower():
                if os.path.normpath(entry.get("path", "")) == path:
                    return {"repos": current}
                raise KipoError(
                    f"{info['slug']} is already added from {entry.get('path')}. Remove that one first.",
                    "duplicate_repo",
                    409,
                )
        return self.storage.save_config({"repos": current + [{"slug": info["slug"], "path": path}]})

    def remove_repo(self, body):
        slug = body.get("slug") if isinstance(body, dict) else None
        current = self.storage.get_config()["repos"]
        kept = [r for r in current if r.get("slug", "").lower() != str(slug or "").lower()]
        return self.storage.save_config({"repos": kept})

    def list_sessions(self, body):
        return {"sessions": self.storage.all_sessions(), "byRepo": self.storage.sessions_by_repo()}

    def list_initiatives(self, body):
        return self.initiatives.list()

    def create_initiative(self, body):
        """Start an effort from the start form.

        The form sends a project folder, not a slug: the folder is added to the
        config on first use, the same way the Settings picker adds it.
        """
        body = body if isinstance(body, dict) else {}
        repo = body.get("repo")
        if body.get("path"):
            config = self.add_repo({"path": body["path"]})
            path = os.path.normpath(body["path"])
            repo = next(r["slug"] for r in config["repos"] if os.path.normpath(r["path"]) == path)
        return self.initiatives.create(
            repo,
            body.get("title"),
            body.get("description") or body.get("destination"),
            start=body.get("start") or None,
            worktree=bool(body.get("worktree")),
            source_issue=body.get("sourceIssue"),
        )

    def detail(self, body, owner, repo, n):
        return self.initiatives.detail(f"{owner}/{repo}", int(n))

    def advance(self, body, owner, repo, n):
        body = body if isinstance(body, dict) else {}
        return self.initiatives.advance(
            f"{owner}/{repo}", int(n), force=bool(body.get("force")), to=body.get("to") or None
        )

    def session(self, body, owner, repo, n):
        body = body if isinstance(body, dict) else {}
        return self.initiatives.session(
            f"{owner}/{repo}", int(n),
            column=body.get("column") or None,
            skill=body.get("skill") or None,
            ticket=body.get("ticket"),
            mode=body.get("mode") or None,
        )

    def skill(self, body, owner, repo, n):
        body = body if isinstance(body, dict) else {}
        return self.initiatives.skill(body.get("skill"))

    def remove(self, body, owner, repo, n):
        return self.initiatives.remove(f"{owner}/{repo}", int(n))

    def hide(self, body, owner, repo, n):
        return self.initiatives.hide(f"{owner}/{repo}", int(n))

    def unhide(self, body, owner, repo, n):
        return self.initiatives.unhide(f"{owner}/{repo}", int(n))

    def _checkouts(self):
        """``{slug (lower case): path}``: KiPo's repos first, then main checkouts on this Mac."""
        paths = {}
        for r in self.storage.get_config()["repos"]:
            paths[r["slug"].lower()] = r["path"]
        found = repos.discover(roots=self.repo_roots, configured=self._configured_paths())
        for r in found:
            if r.get("slug") and not r.get("worktree"):
                paths.setdefault(r["slug"].lower(), r["path"])
        return paths

    def tree(self, body):
        """Your repos, each with everything in it KiPo can show: its efforts and
        its open wayfinder maps, each marked on the sidebar or not. Plus the
        checkouts on this Mac you could add, with how many open maps each has."""
        config = self.storage.get_config()["repos"]
        found = repos.discover(roots=self.repo_roots, configured=self._configured_paths())
        owners = {r["slug"].split("/")[0] for r in config} | {r["slug"].split("/")[0] for r in found if r.get("slug")}
        search_error = None
        try:
            hits = self.gh.search_open_maps(owners) if owners else []
        except KipoError as e:
            hits, search_error = [], e.message
        by_repo = {}
        for h in hits:
            by_repo.setdefault(h["repo"].lower(), []).append(h)

        out = []
        for entry in config:
            slug = entry["slug"]
            hidden = self.storage.hidden(slug)
            opened = self.storage.opened_maps(slug)
            items, wrapped, error = [], set(), None
            try:
                efforts = self.gh.list_issues(slug, EFFORT_LABEL)
            except KipoError as e:
                efforts, error = [], e.message
            for issue in efforts:
                m = self.initiatives._map_of(slug, issue["number"], parse_body(issue.get("body")))
                if m:
                    wrapped.add(m)
                items.append({
                    "kind": "effort", "number": issue["number"], "title": issue.get("title") or "",
                    "url": issue.get("url") or "", "updatedAt": issue.get("updatedAt") or "",
                    "onSidebar": issue["number"] not in hidden, "map": m,
                })
            for h in by_repo.get(slug.lower(), []):
                if h["number"] in wrapped:
                    continue  # it's on the board as the effort that points at it
                items.append({
                    "kind": "map", "number": h["number"], "title": h["title"], "url": h["url"],
                    "updatedAt": h["updatedAt"], "onSidebar": h["number"] in opened and h["number"] not in hidden, "map": None,
                })
            items.sort(key=lambda i: i["updatedAt"], reverse=True)
            repo = {"slug": slug, "path": entry.get("path"), "items": items}
            if error:
                repo["error"] = error
            out.append(repo)

        configured = {r["slug"].lower() for r in config}
        available = [
            {"slug": r["slug"], "path": r["path"], "name": r["name"], "maps": len(by_repo.get(r["slug"].lower(), []))}
            for r in found
            if r.get("slug") and not r.get("worktree") and r["slug"].lower() not in configured
        ]
        available.sort(key=lambda r: (-r["maps"], r["name"].lower()))
        result = {"repos": out, "available": available}
        if search_error:
            result["searchError"] = search_error
        return result

    def sidebar(self, body):
        """Put an effort or a map on the sidebar, or take it off. Local to KiPo."""
        body = body if isinstance(body, dict) else {}
        repo, number, kind, on = body.get("repo"), body.get("number"), body.get("kind"), body.get("on")
        validate_repo_slug(repo)
        if isinstance(number, bool) or not isinstance(number, int) or number <= 0:
            raise KipoError("Say which issue.", "invalid_request", 400)
        if kind not in ("effort", "map") or not isinstance(on, bool):
            raise KipoError("Say whether it's an effort or a map, and on or off.", "invalid_request", 400)
        if not self.storage.repo_path(repo):
            raise KipoError(f"{repo} isn't one of your KiPo repos.", "unknown_repo", 404)
        if kind == "map":
            if on:
                self.storage.open_map(repo, number)
                self.storage.unhide(repo, number)
            else:
                self.storage.close_map(repo, number)
        elif on:
            self.storage.unhide(repo, number)
        else:
            self.storage.hide(repo, number)
        return {"repo": repo, "number": number, "kind": kind, "onSidebar": on}

    def frontier(self, body, owner, repo, n):
        return self.initiatives.frontier(f"{owner}/{repo}", int(n))

    def ticket(self, body, owner, repo, n, t):
        return self.initiatives.ticket(f"{owner}/{repo}", int(n), int(t))

    def doc(self, body, owner, repo, n):
        return self.initiatives.doc(f"{owner}/{repo}", int(n), body.get("href"))

    def dispatch(self, method, path, raw_body):
        """Return ``(status, payload)`` for an already-authenticated request."""
        route = strip_prefix(path)
        # A GET handler receives the query string as its body (/browse and /doc read it).
        query = {k: v[-1] for k, v in parse_qs(urlsplit(path).query).items()}
        allowed = False
        for verb, pattern, name in ROUTES:
            m = pattern.match(route)
            if not m:
                continue
            allowed = True
            if verb != method:
                continue
            try:
                body = json.loads(raw_body) if raw_body.strip() else {}
            except ValueError:
                return 400, {"error": "The request body is not valid JSON.", "code": "invalid_json"}
            if method == "GET":
                body = query
            try:
                args = [unquote(g) for g in m.groups()]
                return 200, getattr(self, name)(body, *args)
            except KipoError as e:
                return e.status, {**e.extra, "error": e.message, "code": e.code}
            except Exception:
                traceback.print_exc()
                return 500, {"error": "The KiPo backend hit an unexpected error.", "code": "internal_error"}
        if allowed:
            return 405, {"error": f"{method} is not allowed on {route}.", "code": "method_not_allowed"}
        return 404, {"error": f"No KiPo endpoint at {route}.", "code": "not_found"}


class Handler(BaseHTTPRequestHandler):
    app = None  # set by make_server

    def _handle(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            return self._json(413, {"error": "The request body is too large.", "code": "body_too_large"})
        raw = self.rfile.read(length) if length else b""
        is_health = self.command == "GET" and strip_prefix(self.path) == "/health"
        if os.environ.get("KIROCREW_PROXY_SECRET") and not is_health:
            if not verify_proxy_request(
                self.headers.get("X-KiroCrew-Proxy", ""),
                method=self.command,
                target=self.path,
                body=raw,
            ):
                return self._json(401, {"error": "The request was not signed by the gateway.", "code": "unauthorized"})
        status, payload = self.app.dispatch(self.command, self.path, raw.decode("utf-8", "replace"))
        self._json(status, payload)

    do_GET = do_PUT = do_POST = do_DELETE = do_PATCH = _handle

    def _json(self, code, data):
        payload = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args):
        pass


class Server(ThreadingHTTPServer):
    """The listener, with the address-reuse flag bound to the platform.

    ``HTTPServer`` hardcodes ``allow_reuse_address = 1``. On POSIX that only
    waives TIME_WAIT, but on Windows ``SO_REUSEADDR`` also lets a socket bind a
    port that already has a LIVE listener, so a second copy of this backend
    would start successfully and the two would split incoming requests.
    Kiro Crew decides a port collision happened by seeing the child die on its
    initial bind, so that bind has to be allowed to fail.
    """

    allow_reuse_address = not sys.platform.startswith("win")
    daemon_threads = True


def make_server(app=None, port=PORT):
    handler = type("KiPoHandler", (Handler,), {"app": app or App()})
    return Server(("127.0.0.1", port), handler)


if __name__ == "__main__":
    print(f"{APP_NAME} backend on port {PORT}", flush=True)
    make_server().serve_forever()
