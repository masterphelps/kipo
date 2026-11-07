"""The phase state file the agent writes: <repoPath>/.kipo/<n>/state.json."""
import json
import os


def state_dir(repo_path, number):
    return os.path.join(repo_path, ".kipo", str(number))


def state_path(repo_path, number):
    return os.path.join(state_dir(repo_path, number), "state.json")


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


def read_archived(repo_path, number, phases):
    """``{phase: state}`` for each earlier phase whose archived state.<phase>.json exists."""
    out = {}
    if not repo_path:
        return out
    for phase in phases:
        try:
            with open(os.path.join(state_dir(repo_path, number), f"state.{phase}.json"), encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, ValueError):
            continue
        if isinstance(data, dict):
            out[phase] = data
    return out


def archive_state(repo_path, number, phase):
    """Move state.json to state.<phase>.json so the next phase starts clean."""
    src = state_path(repo_path, number)
    if not os.path.exists(src):
        return None
    dst = os.path.join(state_dir(repo_path, number), f"state.{phase}.json")
    os.replace(src, dst)
    return dst


# -- ticket state: <repoPath>/.kipo/<n>/t<ticket>/state.json ----------

def ticket_dir(repo_path, number, ticket):
    return os.path.join(state_dir(repo_path, number), f"t{ticket}")


def ticket_state_path(repo_path, number, ticket):
    return os.path.join(ticket_dir(repo_path, number, ticket), "state.json")


def read_ticket_state(repo_path, number, ticket):
    if not repo_path:
        return None
    try:
        with open(ticket_state_path(repo_path, number, ticket), encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def archive_ticket_state(repo_path, number, ticket, stage):
    """Move t<ticket>/state.json to t<ticket>/state.<stage>.json."""
    src = ticket_state_path(repo_path, number, ticket)
    if not os.path.exists(src):
        return None
    dst = os.path.join(ticket_dir(repo_path, number, ticket), f"state.{stage}.json")
    os.replace(src, dst)
    return dst
