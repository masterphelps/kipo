"""The I/O around the stall rule (kipo/stalls.py): when each session last
moved, and the wakes KiPo sent.

**Activity.** KiPo's page reads Kiro Crew's own ``GET /api/chat/slots/<slot>?limit=1``
for each open session (``running``, and the last message's ``ts`` and ``role``)
and posts it to ``…/sessions/activity``; it is kept in the data folder's
``activity.json`` with the time it was seen. An observation older than
``FRESH_S`` (the page is closed) falls back to the session's transcript mtime:
``session_map.json`` maps ``dashboard:<slot>`` to the session id, and the
transcript is ``~/.claude/projects/<cwd as a folder name>/<sid>.jsonl``.

**Wakes.** ``<checkout>/.kipo/<n>/wakes.json``: ``{"wakes": {key: [{at, stall, why}]}}``,
appended under a lock, the last ``KEEP`` per session.
"""
import datetime
import json
import os
import re

from . import reports as col_reports
from . import state as col_state

FRESH_S = 120
KEEP = 20


def _now():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _iso(ts):
    return datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# -- wakes -------------------------------------------------------------------

def wakes_path(repo_path, number):
    return os.path.join(col_state.state_dir(repo_path, number), "wakes.json")


def _load_wakes(p):
    try:
        with open(p, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return {}
    wakes = data.get("wakes") if isinstance(data, dict) else None
    if not isinstance(wakes, dict):
        return {}
    return {k: [w for w in v if isinstance(w, dict)] for k, v in wakes.items() if isinstance(v, list)}


def read_wakes(repo_path, number):
    """``{key: [{at, stall, why}]}``, oldest first."""
    return _load_wakes(wakes_path(repo_path, number)) if repo_path else {}


def record_wake(repo_path, number, key, stall, why, clock=_now):
    """Record one wake of ``key`` for stall ``stall``; returns the entry. The
    same stall is recorded once."""
    p = wakes_path(repo_path, number)
    with col_reports._locked(p):
        wakes = _load_wakes(p)
        mine = wakes.setdefault(key, [])
        same = next((w for w in mine if w.get("stall") == stall), None)
        if same:
            return same
        entry = {"at": clock(), "stall": stall, "why": why}
        wakes[key] = (mine + [entry])[-KEEP:]
        tmp = p + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump({"wakes": wakes}, fh, indent=1)
        os.replace(tmp, p)
    return entry


# -- activity ----------------------------------------------------------------

def clean_observation(value):
    """One posted observation, ``{at, running, agent}``, or ``None``."""
    if not isinstance(value, dict):
        return None
    at = value.get("at")
    out = {"at": at if isinstance(at, str) and at else None}
    for k in ("running", "agent"):
        out[k] = value[k] if isinstance(value.get(k), bool) else None
    return out


def _folder(cwd):
    """Claude Code's project folder name for a cwd: every / and . becomes -."""
    return re.sub(r"[/.]", "-", cwd)


def transcript_activity(slots, home=None, claude_home=None):
    """``{key: {at, running: None, agent: None}}`` from each session's
    transcript mtime; sessions without one are left out. ``slots`` is
    ``{key: slot}``."""
    home = home or os.environ.get("KIROCREW_HOME") or os.path.expanduser("~/.kiro/crew")
    claude_home = claude_home or os.path.expanduser("~/.claude")
    try:
        with open(os.path.join(home, "session_map.json"), encoding="utf-8") as fh:
            smap = json.load(fh)
    except (OSError, ValueError):
        return {}
    if not isinstance(smap, dict):
        return {}
    out = {}
    for key, slot in (slots or {}).items():
        entry = smap.get(f"dashboard:{slot}")
        if not isinstance(entry, dict) or not entry.get("sid"):
            continue
        cwd = entry.get("cwd") or os.path.join(home, "workspace")
        p = os.path.join(claude_home, "projects", _folder(cwd), f"{entry['sid']}.jsonl")
        try:
            out[key] = {"at": _iso(os.path.getmtime(p)), "running": None, "agent": None}
        except OSError:
            continue
    return out


_REPORT_LINE = re.compile(r"^Report: .*kipo_cli\.py report ", re.M)
# The seed is the transcript's first user message, a few lines in.
SEED_SCAN_LINES = 50
_seed_cache = {}


def _text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(c.get("text") or "" for c in content if isinstance(c, dict))
    return ""


def _first_user_message(p):
    """``{at, reports}`` from a transcript's first user message (the seed), or
    ``None``. A seed never changes: cached per transcript once found."""
    if p in _seed_cache:
        return _seed_cache[p]
    try:
        with open(p, encoding="utf-8") as fh:
            for i, line in enumerate(fh):
                if i >= SEED_SCAN_LINES:
                    break
                try:
                    row = json.loads(line)
                except ValueError:
                    continue
                if not isinstance(row, dict) or row.get("type") != "user":
                    continue
                text = _text((row.get("message") or {}).get("content"))
                seed = {"at": row.get("timestamp"), "reports": bool(_REPORT_LINE.search(text))}
                _seed_cache[p] = seed
                return seed
    except OSError:
        pass
    return None


def transcript_seeds(slots, home=None, claude_home=None):
    """``{key: {at, reports}}``: each session's seed, its transcript's first
    user message: when it was sent (the session's opening) and whether it
    carried a ``Report:`` line (``kipo_cli.py report``), i.e. the session was
    seeded to report. Sessions without a transcript are left out. This tells a
    session opened before KiPo kept starts (``data/starts.json``) from one
    opened before reporting existed."""
    home = home or os.environ.get("KIROCREW_HOME") or os.path.expanduser("~/.kiro/crew")
    claude_home = claude_home or os.path.expanduser("~/.claude")
    try:
        with open(os.path.join(home, "session_map.json"), encoding="utf-8") as fh:
            smap = json.load(fh)
    except (OSError, ValueError):
        return {}
    if not isinstance(smap, dict):
        return {}
    out = {}
    for key, slot in (slots or {}).items():
        entry = smap.get(f"dashboard:{slot}")
        if not isinstance(entry, dict) or not entry.get("sid"):
            continue
        cwd = entry.get("cwd") or os.path.join(home, "workspace")
        seed = _first_user_message(os.path.join(claude_home, "projects", _folder(cwd), f"{entry['sid']}.jsonl"))
        if seed:
            out[key] = dict(seed)
    return out


def known_slots(home=None):
    """Every slot Kiro Crew has created a session for (``dashboard:<slot>`` in
    its session map), or ``None`` when the map can't be read (then assume
    every slot exists)."""
    home = home or os.environ.get("KIROCREW_HOME") or os.path.expanduser("~/.kiro/crew")
    try:
        with open(os.path.join(home, "session_map.json"), encoding="utf-8") as fh:
            smap = json.load(fh)
    except (OSError, ValueError):
        return None
    if not isinstance(smap, dict):
        return None
    return {k.split(":", 1)[1] for k in smap if isinstance(k, str) and k.startswith("dashboard:")}


def indexed_slots(home=None):
    """Every slot Kiro Crew has rendered as a chat PAGE (a page-index file
    exists), or ``None`` when the directory can't be read. A live slot that is
    NOT here — a background session the dashboard never opened — renders empty
    in the embedded popout; KiPo shows its transcript instead. The index file
    is ``sessions/.page-index/dashboard_<slot>.jsonl.json``."""
    home = home or os.environ.get("KIROCREW_HOME") or os.path.expanduser("~/.kiro/crew")
    d = os.path.join(home, "sessions", ".page-index")
    try:
        names = os.listdir(d)
    except OSError:
        return None
    out = set()
    for n in names:
        if n.startswith("dashboard_") and n.endswith(".jsonl.json"):
            out.add(n[len("dashboard_"):-len(".jsonl.json")])
    return out


def _transcript_path(slot, home, claude_home):
    try:
        with open(os.path.join(home, "session_map.json"), encoding="utf-8") as fh:
            smap = json.load(fh)
    except (OSError, ValueError):
        return None
    entry = smap.get(f"dashboard:{slot}") if isinstance(smap, dict) else None
    if not isinstance(entry, dict) or not entry.get("sid"):
        return None
    cwd = entry.get("cwd") or os.path.join(home, "workspace")
    return os.path.join(claude_home, "projects", _folder(cwd), f"{entry['sid']}.jsonl")


def _block_text(block):
    """A readable line for one content block: its text, or a short note of the
    tool it ran."""
    if not isinstance(block, dict):
        return None
    t = block.get("type")
    if t == "text":
        return (block.get("text") or "").strip() or None
    if t == "tool_use":
        name = block.get("name") or "tool"
        inp = block.get("input") if isinstance(block.get("input"), dict) else {}
        hint = inp.get("command") or inp.get("file_path") or inp.get("path") or inp.get("pattern") or inp.get("description") or ""
        hint = re.sub(r"\s+", " ", str(hint)).strip()
        return f"↳ {name}" + (f": {hint[:120]}" if hint else "")
    return None  # thinking, tool_result: skipped — noise for a progress view


def transcript_tail(slot, limit=40, home=None, claude_home=None):
    """The last ``limit`` readable events of a session's transcript, oldest
    first: ``[{role, text, ts, tool}]``. The agent writes this file as it
    works, so polling it shows a background session's progress even when the
    dashboard never opened it as a page."""
    home = home or os.environ.get("KIROCREW_HOME") or os.path.expanduser("~/.kiro/crew")
    claude_home = claude_home or os.path.expanduser("~/.claude")
    p = _transcript_path(slot, home, claude_home)
    if not p:
        return None
    try:
        with open(p, encoding="utf-8") as fh:
            lines = fh.read().splitlines()
    except OSError:
        return None
    events = []
    for ln in lines:
        try:
            d = json.loads(ln)
        except ValueError:
            continue
        if d.get("type") not in ("user", "assistant"):
            continue
        msg = d.get("message") or {}
        content = msg.get("content")
        ts = d.get("timestamp")
        role = d.get("type")
        if isinstance(content, str):
            text = content.strip()
            if text:
                events.append({"role": role, "text": text, "ts": ts, "tool": False})
            continue
        if isinstance(content, list):
            for block in content:
                # Skip a tool_result echo (the user turn that only feeds a tool
                # answer back): it's machine chatter, not progress.
                if isinstance(block, dict) and block.get("type") == "tool_result":
                    continue
                line = _block_text(block)
                if line:
                    events.append({
                        "role": role, "text": line, "ts": ts,
                        "tool": isinstance(block, dict) and block.get("type") == "tool_use",
                    })
    return events[-limit:]


def merge(observed, fallback, now, fresh_s=FRESH_S):
    """Per session: the page's observation (from Kiro Crew's API) while it is
    fresh, else the transcript's mtime."""
    from .stalls import parse_time
    out = dict(fallback or {})
    for key, obs in (observed or {}).items():
        seen = parse_time((obs or {}).get("seen"))
        if seen and (now - seen).total_seconds() <= fresh_s:
            out[key] = {k: obs.get(k) for k in ("at", "running", "agent")}
    return out
