"""What the conductor reads: an effort's frontier as open threads.

A thread is one thing still open: a ticket, a PR, the fog, a closed map's
leftovers, the hand-over, the retro, or, before an effort has any ticket,
spec or map, its own first stage (an idea's grill, an issue's intake, a huge
effort's shape). Each says which KiPo stage handles it,
who holds it (HITL, Agent, Running, Stalled, Blocked) and the one next action.
A ticket whose session has stalled (kipo/stalls.py: idle, or its blocker
cleared, and not woken back) is ``Stalled`` instead of ``Running`` or ``Agent``,
with the reason; KiPo's page wakes it. It is
computed from the effort's detail (GitHub, through KiPo's own frontier code),
never remembered, so the conductor and the screen can't disagree.
"""

from . import stalls

# The KiPo skill each stage runs.
STAGE_SKILL = {
    "intake": "kipo-intake", "shape": "kipo-shape", "grill": "kipo-grill", "plan": "kipo-plan",
    "build": "kipo-build", "review": "kipo-review", "done": "kipo-done",
}


def stage_of(tile):
    """The stage that handles a ticket now: the same rule as the board's columns."""
    if tile["state"] == "done":
        return "done"
    if tile.get("source"):
        return "intake"
    if tile["state"] == "review":
        return "review"
    if tile["type"] == "build":
        return "build"
    if tile["type"] == "grilling":
        return "grill"
    return "shape"


_STALL_ACTION = {
    "stalled": "{key} stalled ({why}); KiPo's page wakes it",
    "woken": "{key} was woken ({why}); wait for it to answer",
    "stuck": "{key} is stuck ({why}); put it to the human (its card: dispatch a fresh session, open it or close it)",
}


def _ticket_thread(t, stalled=None):
    stage = stage_of(t)
    base = {"id": f"t{t['number']}", "kind": "ticket", "ticket": t["number"], "stage": stage,
            "skill": STAGE_SKILL[stage], "label": f"#{t['number']} {t['title']}", "type": t["type"]}
    state = t["state"]
    if stalled and state in ("building", "review", "afk"):
        s = stalled["stall"]
        return {**base, "owner": "Stalled", "session": stalled["key"], "stall": s["state"], "why": s["why"],
                "action": _STALL_ACTION[s["state"]].format(key=stalled["key"], why=s["why"])}
    if state == "blocked":
        waits = t.get("blockedBy") or []
        return {**base, "owner": "Blocked", "waitsOn": waits,
                "action": "waits on " + ", ".join(f"#{n}" for n in waits)}
    if state == "building":
        return {**base, "owner": "Running", "action": "an agent is building it; watch for its PR"}
    if state == "review":
        return {**base, "owner": "Agent", "action": "dispatch kipo-review: review, fix, merge if a two-way door"}
    if state == "you":
        verb = {"grill": "grill it with you", "build": "build it with you"}.get(stage, "work it with you")
        return {**base, "owner": "HITL", "action": f"{verb} ({STAGE_SKILL[stage]}); ask in one batched message"}
    # afk: an agent can take it now
    return {**base, "owner": "Agent", "action": f"dispatch {STAGE_SKILL[stage]}"}


def _ref_pr_thread(p, t, detail):
    """An open PR that names effort ticket ``t`` (``#t`` in its title or body)
    without closing it: a review thread for that ticket, even once ``t`` closed.
    Its review is ``review-t<t>``; while that doesn't exist, an open effort
    review conversation (``review``) holds it."""
    base = {"id": f"pr{p['number']}", "kind": "pr", "pr": p["number"], "ticket": t, "refs": list(p.get("refs") or []),
            "stage": "review", "skill": "kipo-review", "label": f"PR #{p['number']} {p.get('title') or ''}".strip()}
    sessions = detail.get("sessions") or {}
    rows = {r.get("key"): r for r in detail.get("closing") or []}
    key = f"review-t{t}" if f"review-t{t}" in sessions else "review" if "review" in sessions else None
    row = rows.get(key) or {}
    if key and row.get("status") == "open" and row.get("started") is not False:
        again = f"--ticket {t} --skill kipo-review" if key != "review" else "--stage review"
        s = row.get("stall")
        if s:
            action = _STALL_ACTION[s["state"]].format(key=key, why=s["why"])
            if s["state"] == "stuck":
                action += f"; on the human's say-so, dispatch {again} for a fresh session"
            return {**base, "owner": "Stalled", "session": key, "stall": s["state"], "why": s["why"], "action": action}
        return {**base, "owner": "Running", "session": key,
                "action": f"{key} is reviewing it; wait for its report"}
    return {**base, "owner": "Agent",
            "action": f"names #{t} without closing it: dispatch --ticket {t} --skill kipo-review "
                      "(review, fix, merge if a two-way door)"}


# An effort's own first stage, while it has no ticket, spec or map yet: the
# work is the stage's conversation (--stage <stage>), not a ticket.
_EARLY_ACTION = {
    "grill": "dispatch kipo-grill: grill the idea with the human",
    "intake": "dispatch kipo-intake: read the issue in, then cut its tickets",
    "shape": "dispatch kipo-shape: map the effort with the human",
}
_EARLY_LABEL = {"grill": "Grill the idea", "intake": "Intake the issue", "shape": "Shape the effort"}

_HANDOVER = {"id": "handover", "kind": "handover", "stage": "plan", "skill": "kipo-plan",
             "label": "Every decision is made", "owner": "HITL",
             "action": "the hand-over: write the spec (/to-spec), then the tickets (/to-tickets)"}


def _early_threads(detail):
    """The threads of an effort with no ticket, spec, map or open PR yet: its column's own
    stage conversation, by whether that session exists, runs or finished.
    ``None`` once the effort has any of them (the ticket rules apply)."""
    front = detail.get("frontier") or {}
    if (front.get("tiles") or front.get("fogItems") or front.get("fogLeft")
            or detail.get("specPath") or detail.get("mapIssue")
            or any(p.get("state") == "OPEN" for p in detail.get("prs") or [])):
        return None
    column = detail.get("column") or (detail.get("path") or [None])[0]
    if column == "plan":
        return [dict(_HANDOVER, label="Nothing is specified yet")]
    if column not in _EARLY_ACTION:
        return None
    base = {"id": column, "kind": "stage", "stage": column, "skill": STAGE_SKILL[column],
            "label": _EARLY_LABEL[column]}
    if not (detail.get("sessions") or {}).get(column):
        return [{**base, "owner": "Agent", "action": _EARLY_ACTION[column]}]
    row = next((r for r in detail.get("closing") or [] if r.get("key") == column), {})
    if row.get("status") in ("closable", "closed"):
        if column == "grill" and "plan" in (detail.get("path") or []):
            return [dict(_HANDOVER, label="Nothing is specified yet")]
        return [{**base, "owner": "HITL",
                 "action": f"the {column} conversation finished with no tickets; ask the human what's next"}]
    s = row.get("stall")
    if s:
        return [{**base, "owner": "Stalled", "session": column, "stall": s["state"], "why": s["why"],
                 "action": _STALL_ACTION[s["state"]].format(key=column, why=s["why"])}]
    return [{**base, "owner": "Running", "session": column,
             "action": f"the {column} conversation is running; wait for its report"}]


def threads(detail):
    """``{"where": str, "threads": [...], "done": {...}}`` for one effort's detail."""
    front = detail.get("frontier") or {}
    tiles = front.get("tiles") or []
    prs = detail.get("prs") or []
    fog_items = front.get("fogItems") or []
    fog_left = front.get("fogLeft") or []
    known = {t["number"] for t in tiles}

    early = _early_threads(detail)
    if early is not None:
        # No ticket yet: nothing is done, so no retro either.
        return {"where": where(early, 0, 0), "threads": early,
                "done": {"tickets": 0, "of": 0, "prsMerged": sum(1 for p in prs if p.get("state") == "MERGED")}}

    stalled = stalls.stalled_by_ticket(detail.get("closing"))
    out = [_ticket_thread(t, stalled.get(t["number"])) for t in tiles if t["state"] != "done"]

    for p in prs:
        if p.get("state") == "OPEN" and not any(n in known for n in p.get("tickets") or []):
            out.append({"id": f"pr{p['number']}", "kind": "pr", "pr": p["number"], "stage": "review",
                        "skill": "kipo-review", "label": f"PR #{p['number']} {p.get('title') or ''}".strip(),
                        "owner": "Agent", "action": "closes no ticket: find what it's for, link or flag it, then review"})
    seen = {t.get("pr") for t in out}
    for p in detail.get("refPrs") or []:
        t = next((n for n in p.get("refs") or [] if n in known), None)
        if p.get("state") == "OPEN" and t is not None and p["number"] not in seen:
            out.append(_ref_pr_thread(p, t, detail))
    if fog_items:
        out.append({"id": "fog", "kind": "fog", "stage": "shape", "skill": "kipo-shape", "items": fog_items,
                    "label": f"{len(fog_items)} not yet specified on the map", "owner": "HITL",
                    "action": "chart into tickets (kipo-shape), on the human's say-so"})
    if fog_left:
        out.append({"id": "leftover", "kind": "leftover", "stage": "shape", "skill": "kipo-shape", "items": fog_left,
                    "label": f"{len(fog_left)} left unspecified when the map closed", "owner": "HITL",
                    "action": "ask: file each as an issue, or drop it"})

    decide = [t for t in tiles if not t.get("source") and t.get("lane") == "decide"]
    # The hand-over is due when every decision is made and no delivery work exists
    # yet: not once the spec is cut, nor when the map delivered its own work and
    # closed (a closed map's leftovers are `fog_left`).
    delivering = [t for t in tiles if t["type"] == "build" or t.get("lane") == "deliver"]
    if (decide and not delivering and not fog_items and not fog_left
            and all(t["state"] == "done" for t in decide) and not detail.get("specPath")):
        out.append(dict(_HANDOVER))

    open_count = len(out)
    out.append({"id": "retro", "kind": "retro", "stage": "done", "skill": "kipo-done",
                "label": "Retro, then close the effort",
                "owner": "Blocked" if open_count else "Agent",
                "action": f"after the {open_count} open thread{'s' if open_count != 1 else ''} above" if open_count
                else "dispatch kipo-done: the retro, then close the effort"})

    done_tickets = sum(1 for t in tiles if t["state"] == "done")
    merged = sum(1 for p in prs if p.get("state") == "MERGED")
    return {"where": where(out, done_tickets, len(tiles)), "threads": out,
            "done": {"tickets": done_tickets, "of": len(tiles), "prsMerged": merged}}


def where(out, done, total):
    """One sentence: where the effort stands."""
    live = [t for t in out if t["id"] != "retro"]
    if not live:
        if not total:  # zero tickets is never "every ticket is done"
            return "No tickets in this effort. Next: the retro, then close the effort."
        return f"Every ticket is done ({done}/{total}). Next: the retro, then close the effort."
    hitl = [t for t in live if t["owner"] == "HITL"]
    agent = [t for t in live if t["owner"] == "Agent"]
    running = [t for t in live if t["owner"] == "Running"]
    stalled = [t for t in live if t["owner"] == "Stalled"]
    blocked = [t for t in live if t["owner"] == "Blocked"]
    bits = []
    if hitl:
        bits.append(f"{len(hitl)} need{'s' if len(hitl) == 1 else ''} the human")
    if agent:
        bits.append(f"{len(agent)} ready for an agent")
    if running:
        bits.append(f"{len(running)} running")
    if stalled:
        bits.append(f"{len(stalled)} stalled")
    if blocked:
        bits.append(f"{len(blocked)} blocked")
    head = f"{done}/{total} tickets done." if total else "No tickets yet."
    return f"{head} Open: " + ", ".join(bits) + "."
