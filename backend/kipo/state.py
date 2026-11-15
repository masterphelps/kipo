"""The state files the agents write, one per conversation: <repoPath>/.kipo/<n>/<key>.json
(``conductor``, ``grill``, ``plan``, ``review``, ``build-t22``…). state.json is the
effort's older shared file: stage conversations seeded before each had its own
wrote there, and ``route_stage_decisions`` attributes what's in it."""
import json
import os
import re

from . import COLUMNS


def state_dir(repo_path, number):
    return os.path.join(repo_path, ".kipo", str(number))


def state_path(repo_path, number):
    return os.path.join(state_dir(repo_path, number), "state.json")


def session_state_path(repo_path, number, key):
    """A conversation's own state file: <repoPath>/.kipo/<n>/<key>.json
    (``build-t22``, ``shape-t24``, ``build-spec``, ``conductor``, and the stage
    conversations ``grill``, ``plan``, ``review``, ``done``…), so conversations
    running side by side don't overwrite each other's decisions or skills, and
    each card holds only the conversation that asked it."""
    return os.path.join(state_dir(repo_path, number), f"{key}.json")


def read_session_state(repo_path, number, key):
    if not repo_path:
        return None
    try:
        with open(session_state_path(repo_path, number, key), encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


_TICKET_DECISION_RE = re.compile(r"^t(\d+)-")


def route_ticket_decisions(state, session_states, sessions):
    """Move decisions a ticket conversation wrote into the effort's state.json
    (``t<N>-…`` ids, from conversations seeded before each had its own file)
    to that ticket's conversation, when it has one. Read-time only: the file
    stays as written, since such a conversation may still be writing to it.

    Returns ``(state, session_states)`` without changing the inputs."""
    if not state or not state.get("decisions"):
        return state, session_states
    by_ticket = {}
    for key in sessions:
        m = re.match(r"^(?:shape|build)-t(\d+)$", key)
        if m:
            by_ticket.setdefault(int(m.group(1)), key)
    kept, moved = [], {}
    for d in state["decisions"]:
        m = _TICKET_DECISION_RE.match(str(d.get("id") or ""))
        key = by_ticket.get(int(m.group(1))) if m else None
        if key:
            moved.setdefault(key, []).append(d)
        else:
            kept.append(d)
    if not moved:
        return state, session_states
    states = dict(session_states)
    for key, decisions in moved.items():
        own = dict(states.get(key) or {"summary": None, "blocking": None, "gate": [], "artifacts": [], "skillsUsed": []})
        seen = {x.get("id") for x in own.get("decisions") or []}
        own["decisions"] = list(own.get("decisions") or []) + [d for d in decisions if d.get("id") not in seen]
        states[key] = own
    return {**state, "decisions": kept}, states


# The latest stage first: with nothing else to go on, state.json is named by
# the latest stage conversation that exists.
STAGE_ORDER = ("done", "review", "plan", "shape", "grill", "intake", "build")
_FINISHED = ("finished", "nothing-to-do")
_ITEM_ID_RE = re.compile(r"^\s*([A-Za-z0-9][\w.-]*)\s*:")


def _legacy_owner(stages, reports, closed):
    """The stage conversation now writing the shared state.json: of those
    KiPo hasn't closed, the one that reported last while still working (its
    last report isn't finished/nothing-to-do); else the one that reported
    last; else the latest stage that exists."""
    last = {}
    for r in reports:
        if r.get("from") in stages:
            last[r["from"]] = r
    live = [k for k in stages if k not in closed]
    for pool in ([k for k in live if k in last and last[k].get("event") not in _FINISHED],
                 [k for k in live if k in last]):
        if pool:
            return max(pool, key=lambda k: last[k].get("id") or 0)
    return next((k for k in STAGE_ORDER if k in live), None) or next((k for k in STAGE_ORDER if k in stages), None)


def _askers(stages, reports):
    """``{decision id: stage key}`` from the stage sessions' ``asked`` reports,
    whose items read ``<id>: <title>`` (the latest asker wins)."""
    out = {}
    for r in reports:
        if r.get("from") in stages and r.get("event") == "asked":
            for item in r.get("items") or []:
                m = _ITEM_ID_RE.match(str(item))
                if m:
                    out[m.group(1)] = r["from"]
    return out


def route_stage_decisions(state, session_states, sessions, reports=(), closed=None):
    """Attribute the shared state.json to the stage conversations that wrote it.

    Stage conversations (``grill``, ``plan``, ``review``…) seeded before each
    had its own file all wrote state.json. Each decision goes to the stage
    session whose ``asked`` report listed its id; any other decision, and the
    file's ``skillsUsed``, go to the file's current writer (``_legacy_owner``).
    Its ``blocking`` and ``summary`` go with its open cards when they are all
    one session's (a blocking line beside open cards is waiting on their
    answers), else to the current writer too. A session's own file keeps its
    fields and its decisions first. Read-time only: the file stays as written, since
    such a conversation may still be writing to it. Without a stage session
    the file stays the effort's.

    Returns ``(state, session_states)`` without changing the inputs."""
    stages = [k for k in (sessions or {}) if k in COLUMNS]
    if not state or not stages:
        return state, session_states
    reports = [r for r in reports or () if isinstance(r, dict)]
    owner = _legacy_owner(stages, reports, closed or {})
    askers = _askers(stages, reports)
    moved = {}
    for d in state.get("decisions") or []:
        key = askers.get(str(d.get("id") or "")) if isinstance(d, dict) else None
        moved.setdefault(key or owner, []).append(d)
    asking = {k for k, ds in moved.items()
              if any(isinstance(d, dict) and d.get("answer") in (None, "") for d in ds)}
    waiter = next(iter(asking)) if len(asking) == 1 else owner
    fields = {owner: ("skillsUsed",)}
    fields[waiter] = fields.get(waiter, ()) + ("summary", "blocking")
    states = dict(session_states)
    blank = {"summary": None, "blocking": None, "decisions": [], "artifacts": [], "skillsUsed": []}
    for key in set(moved) | {owner, waiter}:
        own = dict(states.get(key) or blank)
        seen = {x.get("id") for x in own.get("decisions") or [] if isinstance(x, dict)}
        own["decisions"] = list(own.get("decisions") or []) + [
            d for d in moved.get(key, []) if not (isinstance(d, dict) and d.get("id") in seen)]
        for field in fields.get(key, ()):
            if not own.get(field) and state.get(field):
                own[field] = state[field]
        states[key] = own
    rest = {k: v for k, v in state.items() if k != "blocking"}
    rest["decisions"] = []
    return rest, states


def read_state(repo_path, number):
    """The parsed state.json, or None when it is missing or unreadable."""
    if not repo_path:
        return None
    try:
        with open(state_path(repo_path, number), encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def effort_artifacts(repo_path, number):
    """The documents in state.json and every stage conversation's own file
    (a map charted by the shape conversation is in shape.json)."""
    out = state_artifacts(read_state(repo_path, number))
    for key in COLUMNS:
        out += state_artifacts(read_session_state(repo_path, number, key))
    return out


def gate_passed(state):
    """Passed when the gate list is non-empty and every item is done."""
    if not state:
        return False
    gate = state.get("gate")
    if not isinstance(gate, list) or not gate:
        return False
    return all(isinstance(item, dict) and item.get("done") is True for item in gate)


def state_artifacts(state):
    artifacts = []
    for item in (state or {}).get("artifacts") or []:
        if isinstance(item, dict) and item.get("href"):
            artifacts.append({"label": str(item.get("label") or item["href"]), "href": str(item["href"])})
    return artifacts


def read_archived(repo_path, number, columns):
    """``{column: state}`` for each column whose archived state.<column>.json exists."""
    out = {}
    if not repo_path:
        return out
    for column in columns:
        try:
            with open(os.path.join(state_dir(repo_path, number), f"state.{column}.json"), encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, ValueError):
            continue
        if isinstance(data, dict):
            out[column] = data
    return out


def archive_state(repo_path, number, column):
    """Move state.json to state.<column>.json so the next column starts clean."""
    src = state_path(repo_path, number)
    if not os.path.exists(src):
        return None
    dst = os.path.join(state_dir(repo_path, number), f"state.{column}.json")
    os.replace(src, dst)
    return dst
