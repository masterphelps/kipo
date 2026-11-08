"""The column state file the agent writes: <repoPath>/.kipo/<n>/state.json."""
import json
import os
import re


def state_dir(repo_path, number):
    return os.path.join(repo_path, ".kipo", str(number))


def state_path(repo_path, number):
    return os.path.join(state_dir(repo_path, number), "state.json")


def session_state_path(repo_path, number, key):
    """A ticket conversation's own state file: <repoPath>/.kipo/<n>/<key>.json
    (``build-t22``, ``shape-t24``, ``build-spec``). The effort's own conversation
    keeps state.json, so conversations running side by side don't overwrite
    each other's decisions or skills."""
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
