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


LANES = ("decide", "deliver")

# Matt's two halves. The front half (grill, wayfinder, /to-spec, /to-tickets)
# decides; the back half (implement, /pr, review, /retro) delivers. A ticket is
# in Deliver when it ends in a PR: a build ticket, anything with a PR, or a
# task or issue an agent can take (ready-for-agent). Everything else decides.
LEGACY_STAGE = {
    "intake": "intake", "shape": "decide", "grill": "decide", "plan": "decide",
    "build": "deliver", "review": "deliver", "done": "done",
}


def lane_for(kind, labels, has_pr):
    if kind == "build" or has_pr:
        return "deliver"
    if kind in ("task", "issue") and "ready-for-agent" in set(labels):
        return "deliver"
    return "decide"


def _counts(tiles):
    return {s: sum(1 for t in tiles if t["state"] == s) for s in STATES}


def build(build_nodes, map_nodes, prs, sessions, map_body=None, source_node=None):
    """``{tiles, counts, lanes, fog}`` for an effort.

    ``build_nodes`` are its ``kipo:<n>`` tickets and ``map_nodes`` its map's
    children, each ``{number, title, url, state, labels, blockers, assigned}``;
    ``source_node`` is the issue an ``issue`` effort started from. A ticket in
    several lists is counted once (build first). ``prs`` are the effort's PRs
    (``{number, state, tickets}``); ``sessions`` maps session keys
    (``build-t<t>`` for Deliver, ``shape-t<t>`` for Decide) to session names.
    """
    tiles, seen = [], set()
    sources = ((build_nodes, True, False), (map_nodes, False, False), ([source_node] if source_node else [], False, True))
    for nodes, is_build, is_source in sources:
        for node in nodes:
            number = node["number"]
            if number in seen:
                continue
            seen.add(number)
            labels = node.get("labels") or []
            kind = "issue" if is_source else ticket_type(labels, is_build)
            who = who_for(kind, labels)
            mine = [p for p in prs if number in p.get("tickets", [])]
            lane = lane_for(kind, labels, bool(mine))
            key = f"build-t{number}" if lane == "deliver" else f"shape-t{number}"
            # A session started under the other lane's key still counts.
            other = f"shape-t{number}" if lane == "deliver" else f"build-t{number}"
            has = key if key in sessions else other if other in sessions else None
            state = state_for(node, who, mine, has is not None)
            tiles.append({
                "number": number,
                "title": node.get("title") or "",
                "url": node.get("url") or "",
                "type": kind,
                "code": CODES[kind],
                "who": who,
                "lane": lane,
                "state": state,
                "source": is_source,
                "blockedBy": [b["number"] for b in node.get("blockers") or [] if b.get("state") == "OPEN" and "number" in b],
                "sessionKey": has,
                "prs": [p["number"] for p in mine],
            })
    tiles.sort(key=lambda t: (STATES.index(t["state"]), t["number"]))
    return {
        "tiles": tiles,
        "counts": _counts(tiles),
        "lanes": {lane: _counts([t for t in tiles if t["lane"] == lane]) for lane in LANES},
        "fog": fog_count(map_body),
    }


def _open(counts):
    return sum(n for s, n in counts.items() if s != "done")


def stage_of(front, legacy_column, effort_prs=()):
    """Where the effort is, read from its tickets rather than moved by hand.

    Returns ``{stage, active: {decide, deliver}, handover, landed}``:

    - ``active``: which halves still have work. Both can be on at once.
    - ``stage``: the earliest active half; ``done`` once nothing is open and
      something was delivered (or the effort was finished); efforts with no
      tickets and no PRs fall back to their legacy column.
    - ``handover``: the map is clear (every decision closed, no fog) but no
      tickets are cut yet: time for /to-spec and /to-tickets.
    - ``landed``: everything delivered is merged or closed: time for /retro.
    """
    lanes, fog = front["lanes"], front["fog"]
    decide_any = sum(lanes["decide"].values()) > 0 or fog > 0
    deliver_any = sum(lanes["deliver"].values()) > 0
    open_pr = any(p.get("state") == "OPEN" for p in effort_prs)
    any_pr = bool(effort_prs)
    decide_open = _open(lanes["decide"]) > 0 or fog > 0
    deliver_open = _open(lanes["deliver"]) > 0 or open_pr
    active = {"decide": decide_open, "deliver": deliver_open}
    handover = decide_any and not decide_open and not deliver_any
    landed = (deliver_any or any_pr) and not deliver_open and not decide_open

    if legacy_column == "done":
        stage = "done"
    elif not decide_any and not deliver_any and not any_pr:
        stage = LEGACY_STAGE.get(legacy_column, "intake")
        active = {"decide": stage == "decide", "deliver": stage == "deliver"}
    elif decide_open:
        stage = "decide"
    elif deliver_open:
        stage = "deliver"
    elif landed:
        stage = "done"
    else:
        stage = "decide"  # decisions all made, tickets not cut yet: the hand-over
    return {"stage": stage, "active": active, "handover": handover, "landed": landed}
