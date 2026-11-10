"""What stage sessions tell the conductor: <repoPath>/.kipo/<n>/reports.json.

Every stage-skill session reports to the effort's conductor with
``kipo_cli.py report``: it started, it asked the human something, it got
answers, it opened or merged a PR, it created or closed an issue, it finished
or found nothing to do, it is blocked or failed. Each report is appended here,
in its own file (not conductor.json, which the conductor agent rewrites), under
a lock, so reports from sessions running side by side are never lost.

``read`` is the conductor's cursor: the highest report id it has been shown by
``kipo_cli.py frontier``. Reports above it are unread. KiPo's page wakes the
conductor for unread reports while it's open; when it isn't, they wait here
for the conductor's next wake (the human, or its cron check).
"""
import contextlib
import datetime
import json
import os
import re

from . import state as col_state

try:  # stdlib, POSIX only; without it writes are still atomic, just unlocked
    import fcntl
except ImportError:  # pragma: no cover
    fcntl = None

EVENTS = (
    "started",        # the session began its job
    "asked",          # it put questions to the human (decision cards); list them
    "answered",       # the human answered; say what was decided
    "pr-opened", "pr-merged",
    "issue-created", "issue-closed",
    "finished",       # its job is done
    "nothing-to-do",  # it found nothing to do; say why
    "blocked",        # it can't go on until something happens; say what
    "failed",         # something broke; say what
)

# Who reports: a ticket's conversation (t<ticket>) or a stage conversation.
SOURCE_RE = re.compile(r"^(t\d+|intake|shape|grill|plan|build|build-spec|review|done)$")

KEEP = 500        # reports kept in the file
SHOWN = 50        # reports the effort detail carries for the page


def path(repo_path, number):
    return os.path.join(col_state.state_dir(repo_path, number), "reports.json")


def _now():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _load(p):
    try:
        with open(p, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return {"reports": [], "read": 0}
    if not isinstance(data, dict):
        return {"reports": [], "read": 0}
    reports = [r for r in data.get("reports") or [] if isinstance(r, dict) and isinstance(r.get("id"), int)]
    read = data.get("read") if isinstance(data.get("read"), int) else 0
    return {"reports": reports, "read": read}


def _save(p, data):
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=1)
    os.replace(tmp, p)


@contextlib.contextmanager
def _locked(p):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p + ".lock", "a", encoding="utf-8") as lock:
        if fcntl:
            fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            yield
        finally:
            if fcntl:
                fcntl.flock(lock, fcntl.LOCK_UN)


def append(repo_path, number, source, event, text, items=(), clock=_now):
    """Append one report and return it (with its id)."""
    if not SOURCE_RE.match(source or ""):
        raise ValueError(f"{source!r} isn't a session id: t<ticket>, shape, plan, review, done (or intake, grill, build-spec).")
    if event not in EVENTS:
        raise ValueError(f"{event!r} isn't a report event: {', '.join(EVENTS)}.")
    text = (text or "").strip()
    if not text:
        raise ValueError("Say what happened in --text.")
    p = path(repo_path, number)
    with _locked(p):
        data = _load(p)
        last = max((r["id"] for r in data["reports"]), default=data["read"])
        entry = {"id": last + 1, "at": clock(), "from": source, "event": event, "text": text}
        items = [str(i).strip() for i in items or () if str(i).strip()]
        if items:
            entry["items"] = items
        data["reports"] = (data["reports"] + [entry])[-KEEP:]
        _save(p, data)
    return entry


def read(repo_path, number):
    """``{"reports": [the last SHOWN], "read": cursor}`` without changing anything."""
    if not repo_path:
        return {"reports": [], "read": 0}
    data = _load(path(repo_path, number))
    return {"reports": data["reports"][-SHOWN:], "read": data["read"]}


def take_unread(repo_path, number, mark=True):
    """The reports the conductor hasn't been shown, oldest first; marks them read."""
    p = path(repo_path, number)
    if not os.path.exists(p):
        return []
    with _locked(p):
        data = _load(p)
        unread = [r for r in data["reports"] if r["id"] > data["read"]]
        if unread and mark:
            data["read"] = unread[-1]["id"]
            _save(p, data)
    return unread


# The effort's own state.json is shared by its stage conversations; it is named
# by the latest of them that exists.
_STAGE_ORDER = ("done", "review", "plan", "shape", "grill", "intake", "build")
_KEY_RE = re.compile(r"^(?:shape|build|review)-t(\d+)$")


def source_of_key(key):
    """The report id of a session-state key: shape-t24 / build-t22 / review-t22 -> t24 / t22 / t22."""
    m = _KEY_RE.match(key)
    return f"t{m.group(1)}" if m else key


def _sources(detail):
    """``[(report id, state)]`` for every stage session's state file, minus the
    conductor's own and a done ticket's (settled history, never open questions)."""
    sessions = detail.get("sessions") or {}
    tiles = (detail.get("frontier") or {}).get("tiles") or []
    done = {f"t{t['number']}" for t in tiles if t.get("state") == "done"}
    out = []
    if detail.get("state"):
        own = next((k for k in _STAGE_ORDER if k in sessions), "effort")
        out.append((own, detail["state"]))
    for key, st in sorted((detail.get("sessionStates") or {}).items()):
        if key != "conductor":
            out.append((source_of_key(key), st))
    return [(s, st) for s, st in out if s not in done and isinstance(st, dict)]


def session_blocking(detail):
    """``[{from, blocking}]``: what each open stage session says it's waiting on."""
    return [{"from": s, "blocking": st["blocking"]} for s, st in _sources(detail) if st.get("blocking")]


def open_decisions(detail):
    """Every stage session's unanswered decision cards, for the conductor's
    "Waiting on you": ``[{from, id, title, options, recommended}]``."""
    out = []
    for source, st in _sources(detail):
        for d in st.get("decisions") or []:
            if not isinstance(d, dict) or d.get("answer") not in (None, ""):
                continue
            out.append({"from": source, "id": d.get("id"), "title": d.get("title"),
                        "options": d.get("options") or [], "recommended": d.get("recommended")})
    return out
