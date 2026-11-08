"""What the conductor reads: an effort's frontier as open threads.

A thread is one thing still open: a ticket, a PR, the fog, a closed map's
leftovers, the hand-over, the retro. Each says which KiPo stage handles it,
who holds it (HITL, Agent, Running, Blocked) and the one next action. It is
computed from the effort's detail (GitHub, through KiPo's own frontier code),
never remembered, so the conductor and the screen can't disagree.
"""

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


def _ticket_thread(t):
    stage = stage_of(t)
    base = {"id": f"t{t['number']}", "kind": "ticket", "ticket": t["number"], "stage": stage,
            "skill": STAGE_SKILL[stage], "label": f"#{t['number']} {t['title']}", "type": t["type"]}
    state = t["state"]
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


def threads(detail):
    """``{"where": str, "threads": [...], "done": {...}}`` for one effort's detail."""
    front = detail.get("frontier") or {}
    tiles = front.get("tiles") or []
    prs = detail.get("prs") or []
    fog_items = front.get("fogItems") or []
    fog_left = front.get("fogLeft") or []
    known = {t["number"] for t in tiles}

    out = [_ticket_thread(t) for t in tiles if t["state"] != "done"]

    for p in prs:
        if p.get("state") == "OPEN" and not any(n in known for n in p.get("tickets") or []):
            out.append({"id": f"pr{p['number']}", "kind": "pr", "pr": p["number"], "stage": "review",
                        "skill": "kipo-review", "label": f"PR #{p['number']} {p.get('title') or ''}".strip(),
                        "owner": "Agent", "action": "closes no ticket: find what it's for, link or flag it, then review"})
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
        out.append({"id": "handover", "kind": "handover", "stage": "plan", "skill": "kipo-plan",
                    "label": "Every decision is made", "owner": "HITL",
                    "action": "the hand-over: write the spec (/to-spec), then the tickets (/to-tickets)"})

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
        return f"Every ticket is done ({done}/{total}). Next: the retro, then close the effort."
    hitl = [t for t in live if t["owner"] == "HITL"]
    agent = [t for t in live if t["owner"] == "Agent"]
    running = [t for t in live if t["owner"] == "Running"]
    blocked = [t for t in live if t["owner"] == "Blocked"]
    bits = []
    if hitl:
        bits.append(f"{len(hitl)} need{'s' if len(hitl) == 1 else ''} the human")
    if agent:
        bits.append(f"{len(agent)} ready for an agent")
    if running:
        bits.append(f"{len(running)} running")
    if blocked:
        bits.append(f"{len(blocked)} blocked")
    return f"{done}/{total} tickets done. Open: " + ", ".join(bits) + "."
