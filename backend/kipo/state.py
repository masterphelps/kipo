"""The column state file the agent writes: <repoPath>/.kipo/<n>/state.json."""
import json
import os


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
