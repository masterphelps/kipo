"""The frontier: every ticket of an effort, in the state it is really in.

An effort with tickets is not in one column. Its build tickets (``kipo:<n>``) and
its wayfinder map's children each sit somewhere: done, in review, being built,
waiting on the human (HITL), ready for an agent (AFK), or blocked. The map's
"Not yet specified" section is the fog: questions not sharp enough to ticket.

Pure functions only: the caller fetches from GitHub and passes plain dicts in.
"""
import re

# The order the bar draws them in: finished work fills from the left.
STATES = ("done", "review", "building", "you", "afk", "blocked")

# Two-letter codes for the tiles, by wayfinder type (plus "build").
CODES = {"grilling": "Gr", "prototype": "Pr", "research": "Rs", "task": "Tk", "build": "Bd", "issue": "Is"}

# Matt's triage labels: a map child carrying one of these but no wayfinder type
# is a plain issue (a follow-up filed on the map), not a grill.
TRIAGE_LABELS = {"needs-triage", "needs-info", "ready-for-agent", "ready-for-human", "wontfix"}


def ticket_type(labels, is_build):
    """``grilling | prototype | research | task | build`` from the labels."""
    for label in labels:
        if label.startswith("wayfinder:"):
            kind = label.split(":", 1)[1]
            if kind in CODES and kind not in ("build", "issue"):
                return kind
    if is_build:
        return "build"  # from /to-tickets
    # An untyped map child is a grill (wayfinder's default case), unless it's a
    # triaged issue someone filed on the map.
    return "issue" if TRIAGE_LABELS & set(labels) else "grilling"


def who_for(kind, labels):
    """``you`` (HITL) or ``afk`` (the agent alone), after Matt's ticket types."""
    names = set(labels)
    if "ready-for-human" in names:
        return "you"
    if kind in ("grilling", "prototype"):
        return "you"
    if kind == "research":
        return "afk"
    if kind in ("task", "issue"):
        return "afk" if "ready-for-agent" in names else "you"
    return "afk"  # build: /to-tickets marks them ready-for-agent


def state_for(ticket, who, prs, has_session):
    """One of STATES for an open or closed ticket."""
    if (ticket.get("state") or "OPEN").upper() != "OPEN":
        return "done"
    if any(p["state"] == "OPEN" for p in prs):
        return "review"
    if any(b.get("state") == "OPEN" for b in ticket.get("blockers") or []):
        return "blocked"
    if who == "afk" and (has_session or ticket.get("assigned")):
        return "building"
    return who


def fog_count(map_body):
    """How many questions the map's "Not yet specified" section holds.

    Counts its list items; a section of prose with no list counts as one.
    """
    if not map_body:
        return 0
    m = re.search(r"^#{1,6}\s*Not yet specified\s*$(.*?)(?=^#{1,6}\s|\Z)", map_body, re.M | re.S | re.I)
    if not m:
        return 0
    text = re.sub(r"<!--.*?-->", "", m.group(1), flags=re.S).strip()
    if not text:
        return 0
    items = re.findall(r"^\s*(?:[-*+]|\d+[.)])\s+\S", text, re.M)
    return len(items) or 1


def build(build_nodes, map_nodes, prs, sessions, map_body=None):
    """``{tiles, counts, fog}`` for an effort.

    ``build_nodes`` are its ``kipo:<n>`` tickets and ``map_nodes`` its map's
    children, each ``{number, title, url, state, labels, blockers, assigned}``.
    A ticket in both lists is counted once, as a build ticket. ``prs`` are the
    effort's PRs (``{number, state, tickets}``); ``sessions`` maps session keys
    (``build-t<t>``, ``shape-t<t>``) to session names.
    """
    tiles, seen = [], set()
    for nodes, is_build in ((build_nodes, True), (map_nodes, False)):
        for node in nodes:
            number = node["number"]
            if number in seen:
                continue
            seen.add(number)
            labels = node.get("labels") or []
            kind = ticket_type(labels, is_build)
            who = who_for(kind, labels)
            key = f"build-t{number}" if kind == "build" else f"shape-t{number}"
            mine = [p for p in prs if number in p.get("tickets", [])]
            state = state_for(node, who, mine, key in sessions)
            tiles.append({
                "number": number,
                "title": node.get("title") or "",
                "url": node.get("url") or "",
                "type": kind,
                "code": CODES[kind],
                "who": who,
                "state": state,
                "blockedBy": [b["number"] for b in node.get("blockers") or [] if b.get("state") == "OPEN" and "number" in b],
                "sessionKey": key if key in sessions else None,
                "prs": [p["number"] for p in mine],
            })
    tiles.sort(key=lambda t: (STATES.index(t["state"]), t["number"]))
    counts = {s: sum(1 for t in tiles if t["state"] == s) for s in STATES}
    return {"tiles": tiles, "counts": counts, "fog": fog_count(map_body)}
