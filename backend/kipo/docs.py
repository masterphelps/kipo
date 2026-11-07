"""GET .../doc?href=: a phase document to render, from the checkout or GitHub."""
import os
import re
from urllib.parse import unquote

from . import KipoError

MAX_DOC_BYTES = 200 * 1024
TRUNCATED_NOTE = "\n\n… (cut at 200 KB)"

_GITHUB_RE = re.compile(r"^https?://github\.com/([^/]+)/([^/]+)/(issues|pull)/(\d+)(?:[/?#].*)?$", re.IGNORECASE)
_BLOB_RE = re.compile(r"^https?://github\.com/([^/]+)/([^/]+)/blob/([^?#]+)(?:[?#].*)?$", re.IGNORECASE)
_MAP_LABEL = "wayfinder:map"

_SUB_ISSUES_QUERY = (
    "query($owner: String!, $name: String!, $number: Int!) {"
    " repository(owner: $owner, name: $name) { issue(number: $number) {"
    " subIssues(first: 100) { nodes { number title state labels(first: 20) { nodes { name } } } } } } }"
)


def cap(text):
    data = text.encode("utf-8")
    if len(data) <= MAX_DOC_BYTES:
        return text
    return data[:MAX_DOC_BYTES].decode("utf-8", "ignore") + TRUNCATED_NOTE


def _labels(issue):
    return [l["name"] if isinstance(l, dict) else str(l) for l in issue.get("labels") or []]


def read_doc(gh, repo, repo_path, href):
    if not isinstance(href, str) or not href.strip():
        raise KipoError("Say which document to open.", "invalid_request", 400)
    href = href.strip()
    m = _GITHUB_RE.match(href)
    if m:
        owner, name, kind, number = m.groups()
        if f"{owner}/{name}".lower() != repo.lower():
            raise KipoError(f"{href} is not in {repo}.", "unsupported_href", 400)
        return _github_doc(gh, repo, kind.lower(), int(number), href)
    b = _BLOB_RE.match(href)
    if b:
        owner, name, rest = b.groups()
        if f"{owner}/{name}".lower() != repo.lower():
            raise KipoError(f"{href} is not in {repo}.", "unsupported_href", 400)
        return _blob_doc(gh, repo, repo_path, unquote(rest), href)
    if re.match(r"^[a-z][a-z0-9+.-]*://", href, re.IGNORECASE):
        raise KipoError("Only checkout files and this repo's issues, pull requests and files can be opened.", "unsupported_href", 400)
    return _file_doc(repo_path, href)


def _blob_doc(gh, repo, repo_path, rest, href):
    """A file on a branch, e.g. a research note on its research/<name> branch.

    The ref may itself contain slashes, so try each split of ``<ref>/<path>``:
    first from the local checkout (fast, works offline once fetched), then
    through the GitHub API.
    """
    parts = [p for p in rest.split("/") if p]
    splits = [("/".join(parts[:k]), "/".join(parts[k:])) for k in range(1, len(parts))]
    if repo_path:
        for ref, path in splits:
            for candidate in (f"origin/{ref}", ref):
                code, out, _ = gh.runner(
                    ["git", "-C", repo_path, "show", f"{candidate}:{path}"], input_text=None, timeout=5
                )
                if code == 0:
                    return _text_doc(href, path, out, _blob_url(repo, ref, path))
    for ref, path in splits:
        try:
            out = gh.run(["api", "-H", "Accept: application/vnd.github.raw", f"repos/{repo}/contents/{path}?ref={ref}"])
        except KipoError:
            continue
        return _text_doc(href, path, out, _blob_url(repo, ref, path))
    raise KipoError(f"{href} couldn't be found on GitHub or in the checkout.", "doc_missing", 404)


def _blob_url(repo, ref, path):
    return f"https://github.com/{repo}/blob/{ref}/{path}"


def _text_doc(href, path, text, url):
    text = text.replace("\r\n", "\n")
    title = next(
        (line[2:].strip() for line in text.splitlines() if line.startswith("# ") and line[2:].strip()),
        os.path.basename(path),
    )
    return {"href": href, "title": title, "kind": "markdown", "text": cap(text), "url": url}


def _file_doc(repo_path, href):
    if not repo_path:
        raise KipoError("This initiative has no checkout to read from.", "doc_missing", 404)
    root = os.path.realpath(repo_path)
    path = os.path.realpath(href if os.path.isabs(href) else os.path.join(root, href))
    if path != root and not path.startswith(root + os.sep):
        raise KipoError(f"{href} is outside the checkout.", "outside_checkout", 400)
    if not os.path.isfile(path):
        raise KipoError(f"{href} doesn't exist in the checkout.", "doc_missing", 404)
    try:
        with open(path, "rb") as f:
            raw = f.read(MAX_DOC_BYTES + 1)
    except OSError:
        raise KipoError(f"{href} couldn't be read.", "doc_missing", 404)
    if len(raw) > MAX_DOC_BYTES:
        text = raw[:MAX_DOC_BYTES].decode("utf-8", "ignore") + TRUNCATED_NOTE
    else:
        text = raw.decode("utf-8", "replace")
    title = next(
        (line[2:].strip() for line in text.splitlines() if line.startswith("# ") and line[2:].strip()),
        os.path.basename(path),
    )
    return {"href": href, "title": title, "kind": "markdown", "text": text, "url": None}


def _github_doc(gh, repo, kind, number, href):
    if kind == "pull":
        item = gh.view_pr(repo, number)
    else:
        item = gh.view_issue(repo, number)
    if not item:
        raise KipoError(f"#{number} was not found in {repo}.", "doc_missing", 404)
    text = (item.get("body") or "").replace("\r\n", "\n").rstrip()
    if kind == "issues" and _MAP_LABEL in _labels(item):
        text = (text + "\n\n" if text else "") + _map_tickets(gh, repo, number)
    return {
        "href": href,
        "title": item.get("title") or f"#{number}",
        "kind": "markdown",
        "text": cap(text),
        "url": item.get("url") or href,
    }


def _map_tickets(gh, repo, number):
    owner, name = repo.split("/", 1)
    data = gh.graphql(_SUB_ISSUES_QUERY, owner=owner, name=name, number=number)
    issue = (((data or {}).get("data") or {}).get("repository") or {}).get("issue") or {}
    lines = ["## Tickets", ""]
    nodes = (issue.get("subIssues") or {}).get("nodes") or []
    for node in nodes:
        box = "☑" if node.get("state") == "CLOSED" else "☐"
        labels = [l["name"] for l in (node.get("labels") or {}).get("nodes") or []]
        kind = next((l.split(":", 1)[1] for l in labels if l.startswith("wayfinder:") and l != _MAP_LABEL), None)
        suffix = f" ({kind})" if kind else ""
        lines.append(f"- {box} #{node['number']} {node.get('title') or ''}{suffix}")
    if not nodes:
        lines.append("No tickets yet.")
    return "\n".join(lines)
