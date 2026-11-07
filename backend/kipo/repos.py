"""Find local git checkouts and the GitHub repo each one tracks.

Settings never asks for a slug or a path by hand: the page lists what
``discover`` finds, and ``browse`` walks folders for anything it missed. The
GitHub slug always comes from the checkout's ``origin`` remote.
"""
import configparser
import os
import re

from . import KipoError

# Where checkouts usually live. Missing roots are skipped; ~/repos and ~/Repos
# are the same folder on a case-insensitive disk, so roots are deduped by inode.
DEFAULT_ROOTS = (
    "~/repos", "~/Repos", "~/workspace", "~/workspaces", "~/Developer",
    "~/code", "~/src", "~/Projects", "~/projects", "~/GitHub", "~/Documents/GitHub",
)
MAX_DEPTH = 2
MAX_RESULTS = 400
SKIP_DIRS = {"node_modules", "vendor", "dist", "build", "target", "__pycache__", "venv"}

_GITHUB_RE = re.compile(
    r"^(?:git@github\.com:|ssh://git@github\.com/|https?://(?:[^@/]+@)?github\.com/)"
    r"([^/\s]+)/([^/\s]+?)(?:\.git)?/?$"
)


def github_slug(url):
    """``owner/name`` for a GitHub remote URL, else None."""
    m = _GITHUB_RE.match((url or "").strip())
    return f"{m.group(1)}/{m.group(2)}" if m else None


def _git_dir(path):
    """The checkout's git directory and whether it is a linked worktree."""
    dot_git = os.path.join(path, ".git")
    if os.path.isdir(dot_git):
        return dot_git, False
    if os.path.isfile(dot_git):
        try:
            with open(dot_git, encoding="utf-8") as f:
                line = f.read().strip()
        except OSError:
            return None, False
        if line.startswith("gitdir:"):
            gitdir = os.path.normpath(os.path.join(path, line[len("gitdir:"):].strip()))
            return gitdir, "/worktrees/" in gitdir.replace(os.sep, "/")
    return None, False


def origin_url(path):
    """Read the origin URL straight from the git config: no subprocess per repo."""
    gitdir, is_worktree = _git_dir(path)
    if not gitdir:
        return None
    if is_worktree:
        # A linked worktree shares its main checkout's config.
        commondir = os.path.join(gitdir, "commondir")
        try:
            with open(commondir, encoding="utf-8") as f:
                gitdir = os.path.normpath(os.path.join(gitdir, f.read().strip()))
        except OSError:
            return None
    parser = configparser.RawConfigParser(strict=False)
    try:
        parser.read(os.path.join(gitdir, "config"), encoding="utf-8")
    except (configparser.Error, OSError, UnicodeDecodeError):
        return None
    section = 'remote "origin"'
    return parser.get(section, "url", fallback=None) if parser.has_section(section) else None


def describe(path):
    """What Settings shows for one folder, or None when it isn't a checkout."""
    gitdir, is_worktree = _git_dir(path)
    if not gitdir:
        return None
    url = origin_url(path)
    return {
        "path": path,
        "name": os.path.basename(path),
        "slug": github_slug(url),
        "remote": url,
        "worktree": is_worktree,
    }


def _visible(name):
    return not name.startswith((".", "_")) and name not in SKIP_DIRS


def _roots(roots):
    seen, out = set(), []
    for root in roots:
        path = os.path.realpath(os.path.expanduser(root))
        try:
            st = os.stat(path)
        except OSError:
            continue
        key = (st.st_dev, st.st_ino)
        if key not in seen and os.path.isdir(path):
            seen.add(key)
            out.append(os.path.expanduser(root).rstrip("/"))
    return out


def discover(roots=DEFAULT_ROOTS, configured=()):
    """Every checkout up to MAX_DEPTH below the roots, main checkouts first."""
    configured = {os.path.normpath(p) for p in configured}
    found, seen = [], set()

    def walk(path, depth):
        if len(found) >= MAX_RESULTS:
            return
        info = describe(path)
        if info:
            try:
                st = os.stat(path)
                key = (st.st_dev, st.st_ino)
            except OSError:
                return
            if key not in seen:
                seen.add(key)
                info["configured"] = os.path.normpath(path) in configured
                found.append(info)
            return  # don't look for checkouts inside a checkout
        if depth >= MAX_DEPTH:
            return
        try:
            entries = sorted(os.scandir(path), key=lambda e: e.name.lower())
        except OSError:
            return
        for entry in entries:
            if _visible(entry.name) and entry.is_dir(follow_symlinks=False):
                walk(entry.path, depth + 1)

    for root in _roots(roots):
        walk(root, 0)
    found.sort(key=lambda r: (r["worktree"], r["slug"] is None, r["name"].lower()))
    return found


def browse(path=None, home=None):
    """One folder's subfolders for the picker, each marked when it is a checkout."""
    home = os.path.realpath(home or os.path.expanduser("~"))
    target = os.path.realpath(os.path.expanduser(path)) if path else home
    if target != home and not target.startswith(home + os.sep):
        raise KipoError("Folders outside your home folder can't be browsed.", "outside_home", 400)
    if not os.path.isdir(target):
        raise KipoError(f"{target} is not a folder.", "not_a_folder", 400)
    folders = []
    try:
        entries = sorted(os.scandir(target), key=lambda e: e.name.lower())
    except OSError:
        raise KipoError(f"{target} can't be read.", "unreadable_folder", 400)
    for entry in entries:
        if entry.name.startswith(".") or not entry.is_dir(follow_symlinks=False):
            continue
        info = describe(entry.path)
        folders.append({
            "path": entry.path,
            "name": entry.name,
            "repo": info is not None,
            "slug": info["slug"] if info else None,
        })
    parent = os.path.dirname(target) if target != home else None
    return {"path": target, "parent": parent, "home": home, "folders": folders, "here": describe(target)}
