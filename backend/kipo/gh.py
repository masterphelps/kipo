"""A thin wrapper over the ``gh`` and ``git`` CLIs.

Every call goes through an injectable runner so tests can swap in a fake. The
runner takes an argument list (never a shell string) and returns
``(returncode, stdout, stderr)``.
"""
import json
import os
import shutil
import subprocess
import threading

from . import KipoError

# Each call stays well under the gateway proxy's 30 s limit.
GH_TIMEOUT = 15
GIT_TIMEOUT = 5

ISSUE_FIELDS = "number,title,url,labels,body,updatedAt,state"

PR_FIELDS = "number,title,url,state,isDraft,headRefName,body"

# First matching prefix wins, so the specific ones come first.
LABEL_COLORS = {
    "kipo:col:": "1d76db",
    "kipo:start:": "fbca04",
    "kipo:effort": "5319e7",
    "kipo:": "0e8a16",
}


# The gateway starts this backend with the PATH it was launched with. A desktop
# app opened from the Dock gets the bare system PATH, which leaves out Homebrew
# and the other places gh lives, so look there too.
EXTRA_BIN_DIRS = (
    "/opt/homebrew/bin",
    "/usr/local/bin",
    os.path.expanduser("~/.local/bin"),
    os.path.expanduser("~/bin"),
)


def tool_env():
    parts = [p for p in os.environ.get("PATH", "").split(os.pathsep) if p]
    parts += [d for d in EXTRA_BIN_DIRS if d not in parts and os.path.isdir(d)]
    return {**os.environ, "PATH": os.pathsep.join(parts)}


def subprocess_runner(args, input_text=None, timeout=GH_TIMEOUT):
    env = tool_env()
    exe = shutil.which(args[0], path=env["PATH"])
    if not exe:
        return 127, "", (
            f"{args[0]} isn't installed where KiPo can find it "
            f"(looked in {env['PATH']})"
        )
    try:
        proc = subprocess.run(
            [exe, *args[1:]],
            input=input_text,
            capture_output=True,
            text=True,
            timeout=timeout,
            env=env,
        )
    except FileNotFoundError:
        return 127, "", f"{args[0]} is not installed"
    except subprocess.TimeoutExpired:
        return 124, "", f"{args[0]} timed out after {timeout} s"
    return proc.returncode, proc.stdout, proc.stderr


class Gh:
    def __init__(self, runner=None):
        self.runner = runner or subprocess_runner
        self._labels = set()
        self._labels_lock = threading.Lock()

    # -- plumbing -------------------------------------------------------

    def run(self, args, input_text=None):
        code, out, err = self.runner(["gh", *args], input_text=input_text, timeout=GH_TIMEOUT)
        if code != 0:
            detail = (err or out or "").strip().splitlines()
            detail = detail[0] if detail else f"exit code {code}"
            raise KipoError(f"gh {args[0]} failed: {detail}", "gh_failed", 502)
        return out

    def run_json(self, args, input_text=None):
        out = self.run(args, input_text=input_text)
        try:
            return json.loads(out or "null")
        except json.JSONDecodeError:
            raise KipoError(f"gh {args[0]} returned output that is not JSON", "gh_failed", 502)

    def is_git_checkout(self, path):
        code, out, _ = self.runner(
            ["git", "-C", path, "rev-parse", "--is-inside-work-tree"],
            input_text=None,
            timeout=GIT_TIMEOUT,
        )
        return code == 0 and out.strip() == "true"

    def add_worktree(self, path, new_path, branch):
        """A fresh worktree of ``path`` at ``new_path`` on a new ``branch`` from HEAD."""
        code, out, err = self.runner(
            ["git", "-C", path, "worktree", "add", "-b", branch, new_path],
            input_text=None,
            timeout=GH_TIMEOUT,
        )
        if code != 0:
            detail = (err or out or "").strip().splitlines()
            raise KipoError(
                f"Couldn't create the worktree: {detail[-1] if detail else f'exit code {code}'}",
                "worktree_failed",
                502,
            )

    # -- labels ---------------------------------------------------------

    def ensure_label(self, repo, name):
        key = (repo, name)
        with self._labels_lock:
            if key in self._labels:
                return
        color = next((c for p, c in LABEL_COLORS.items() if name.startswith(p)), "ededed")
        self.run(["label", "create", name, "--force", "--color", color, "-R", repo])
        with self._labels_lock:
            self._labels.add(key)

    # -- issues ---------------------------------------------------------

    def list_issues(self, repo, label, state="open", fields=ISSUE_FIELDS, limit=200):
        return self.run_json([
            "issue", "list", "-R", repo, "--label", label, "--state", state,
            "--limit", str(limit), "--json", fields,
        ]) or []

    def search_open_maps(self, owners):
        """Every open wayfinder map in these owners' repos, from one search:
        ``[{repo, number, title, url, updatedAt}]``."""
        args = ["search", "issues", "--label", "wayfinder:map", "--state", "open",
                "--json", "repository,number,title,url,updatedAt", "--limit", "500"]
        for owner in sorted(set(owners)):
            args += ["--owner", owner]
        maps = []
        for hit in self.run_json(args) or []:
            slug = (hit.get("repository") or {}).get("nameWithOwner") or ""
            if slug:
                maps.append({"repo": slug, "number": hit["number"], "title": hit.get("title") or "",
                             "url": hit.get("url") or "", "updatedAt": hit.get("updatedAt") or ""})
        return maps

    def open_map_counts(self, owners):
        """``{"owner/name" (lower case): open wayfinder maps}``."""
        counts = {}
        for m in self.search_open_maps(owners):
            counts[m["repo"].lower()] = counts.get(m["repo"].lower(), 0) + 1
        return counts

    def view_issue(self, repo, number):
        try:
            return self.run_json(["issue", "view", str(number), "-R", repo, "--json", ISSUE_FIELDS])
        except KipoError as e:
            if "Could not resolve" in e.message:
                raise KipoError(f"Issue #{number} was not found in {repo}.", "not_found", 404)
            raise

    def view_issue_comments(self, repo, number):
        """An issue with its body and comments, for a ticket's card."""
        try:
            return self.run_json(["issue", "view", str(number), "-R", repo, "--json", ISSUE_FIELDS + ",comments"])
        except KipoError as e:
            if "Could not resolve" in e.message:
                raise KipoError(f"Issue #{number} was not found in {repo}.", "not_found", 404)
            raise

    def view_pr(self, repo, number):
        try:
            return self.run_json(["pr", "view", str(number), "-R", repo, "--json", "number,title,url,body,state"])
        except KipoError as e:
            if "Could not resolve" in e.message:
                raise KipoError(f"Pull request #{number} was not found in {repo}.", "not_found", 404)
            raise

    def list_prs(self, repo, limit=100):
        return self.run_json([
            "pr", "list", "-R", repo, "--state", "all", "--limit", str(limit), "--json", PR_FIELDS,
        ]) or []

    def create_issue(self, repo, title, body, labels):
        args = ["issue", "create", "-R", repo, "--title", title, "--body-file", "-"]
        for label in labels:
            args += ["--label", label]
        out = self.run(args, input_text=body).strip()
        url = out.splitlines()[-1] if out else ""
        try:
            return int(url.rstrip("/").rsplit("/", 1)[-1])
        except ValueError:
            raise KipoError("gh issue create did not return an issue URL", "gh_failed", 502)

    def edit_issue(self, repo, number, body=None, add_labels=(), remove_labels=()):
        args = ["issue", "edit", str(number), "-R", repo]
        if body is not None:
            args += ["--body-file", "-"]
        for label in add_labels:
            args += ["--add-label", label]
        for label in remove_labels:
            args += ["--remove-label", label]
        self.run(args, input_text=body)

    def close_issue(self, repo, number, reason=None, comment=None):
        args = ["issue", "close", str(number), "-R", repo]
        if reason:
            args += ["--reason", reason]
        if comment:
            args += ["--comment", comment]
        self.run(args)

    def graphql(self, query, **variables):
        args = ["api", "graphql", "-f", f"query={query}"]
        for key, value in variables.items():
            flag = "-F" if isinstance(value, int) else "-f"
            args += [flag, f"{key}={value}"]
        return self.run_json(args)
