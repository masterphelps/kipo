"""When a stage session KiPo opened has stalled, and what to do about it: one
pure rule, no I/O.

A session is a candidate when it is not the conductor, is open (not closable,
not closed), has no unanswered decision card (a session waiting on the human's
cards is never stalled), is not mid-turn, and its thread isn't settled
(``closing.settled``). A candidate is **stalled** when either holds:

(a) **idle**: its last activity is ``IDLE_MINUTES`` or more ago, and its last
    report isn't ``finished`` or ``nothing-to-do``. A session that never reported
    predates reporting and is left alone (as the close rule does).
(b) **blocker cleared**: its last report is ``blocked`` and something later
    clears it: a ``finished`` or ``pr-opened`` from another session on the same
    ticket, or a merged PR or closed issue that the blocked report's text names
    (by ``#<n>``), from a later ``pr-merged`` / ``issue-closed`` report or from
    GitHub (the effort's tickets and PRs). The session's own ticket and its PRs
    don't count: they are what it is working on.

Each stall has an id: ``blocked#<report id>`` for (b), ``idle@<last activity>``
for (a). KiPo's page wakes a stalled session once per stall id and records the
wake (``.kipo/<n>/wakes.json``). A wake is answered when the session reports, or
acts, after it. After ``MAX_WAKES`` unanswered wakes in a row the session is
**stuck**: no more wakes, and the conductor puts it to the human as a card.

``stall`` on a session row is ``{state, why, id, wakes}``, ``state`` being:
``stalled`` (the page wakes it), ``woken`` (woken for this stall, or its last
wake is unanswered: wait) or ``stuck``. Rows without a stall carry no ``stall``.

Activity is ``{key: {at, running, agent}}``: ``at`` the time of its last
message, ``running`` whether it is mid-turn (``None``: unknown), ``agent``
whether that last message was the agent's (``None``: unknown). It comes from
Kiro Crew's ``GET /api/chat/slots/<slot>?limit=1`` through the page, else from
the transcript's mtime.
"""
import datetime
import re

from . import closing

IDLE_MINUTES = 15
MAX_WAKES = 2
# Without knowing who wrote the last message (a transcript's mtime), activity
# this soon after a wake is the wake itself, not an answer.
ANSWER_GRACE_S = 30
QUIET = ("finished", "nothing-to-do")
STALL_STATES = ("stalled", "woken", "stuck")
_REF = re.compile(r"#(\d+)\b")


def parse_time(value):
    """An ISO-8601 time (``Z``, an offset, or naive meaning UTC) as an aware
    datetime, else ``None``."""
    if isinstance(value, datetime.datetime):
        return value if value.tzinfo else value.replace(tzinfo=datetime.timezone.utc)
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip().replace("Z", "+00:00").replace("z", "+00:00")
    try:
        when = datetime.datetime.fromisoformat(text)
    except ValueError:
        return None
    return when if when.tzinfo else when.replace(tzinfo=datetime.timezone.utc)


def _ticket(key):
    return closing._ticket_of(key)[1]


def blocker_cleared(key, rs, reports, detail):
    """``(report, what)`` when the session's last report is ``blocked`` and a
    later report or GitHub fact clears it; ``(blocked report or None, None)``
    otherwise. ``rs`` is the session's own reports, ``reports`` every report
    (attributed: each carries ``session``)."""
    if not rs or rs[-1].get("event") != "blocked":
        return None, None
    blocked = rs[-1]
    t = _ticket(key)
    later = [r for r in reports if r.get("id", 0) > blocked.get("id", 0) and r.get("session") != key]
    if t is not None:
        for r in reversed(later):
            if _ticket(r.get("session") or "") == t and r.get("event") in ("finished", "pr-opened"):
                return blocked, f"{r['session']} reported {r['event']} ({_short(r.get('text'))})"
    own_prs = {p["number"] for p in detail.get("prs") or [] if t is not None and t in (p.get("tickets") or [])}
    named = [n for n in (int(x) for x in _REF.findall(blocked.get("text") or "")) if n != t and n not in own_prs]
    if not named:
        return blocked, None
    for r in later:
        if r.get("event") in ("pr-merged", "issue-closed"):
            said = {int(x) for s in [r.get("text") or ""] + list(r.get("items") or []) for x in _REF.findall(s)}
            hit = [n for n in named if n in said]
            if hit:
                return blocked, f"#{hit[0]} {'merged' if r['event'] == 'pr-merged' else 'closed'} ({r.get('session')} reported it)"
    prs = {p["number"]: p for p in detail.get("prs") or [] if isinstance(p, dict) and "number" in p}
    closed_tickets = {x["number"] for x in detail.get("tickets") or [] if x.get("state") not in (None, "OPEN")}
    closed_tickets |= {x["number"] for x in (detail.get("frontier") or {}).get("tiles") or [] if x.get("state") == "done"}
    for n in named:
        if n in prs and prs[n].get("state") == "MERGED":
            return blocked, f"PR #{n} merged"
        if n in closed_tickets:
            return blocked, f"#{n} closed"
    return blocked, None


def _short(text, n=80):
    text = " ".join((text or "").split())
    return text if len(text) <= n else text[: n - 1] + "…"


def unanswered(wakes, rs, activity):
    """How many of the session's wakes, counting back from the latest, got no
    answer: no report after it, and no activity of the agent's after it (when
    who wrote the last message is unknown, activity more than
    ``ANSWER_GRACE_S`` after it)."""
    times = [t for t in (parse_time(r.get("at")) for r in rs or []) if t]
    last_report = max(times) if times else None
    act = parse_time((activity or {}).get("at"))
    agent = (activity or {}).get("agent")
    count = 0
    for w in reversed(wakes or []):
        at = parse_time(w.get("at"))
        if at is None:
            continue
        if last_report and last_report > at:
            break
        if act and ((agent is True and act > at)
                    or (agent is None and (act - at).total_seconds() > ANSWER_GRACE_S)):
            break
        count += 1
    return count


def stall(key, rs, reports, detail, activity, wakes, now):
    """The stall state of one candidate session (open, not the conductor, no
    open card, thread not settled): ``{state, why, id, wakes}`` or ``None``."""
    activity = activity or {}
    if activity.get("running") is True:
        return None
    misses = unanswered(wakes, rs, activity)
    woken_ids = {w.get("stall") for w in wakes or []}
    if misses >= MAX_WAKES:
        last = (wakes or [{}])[-1]
        return {"state": "stuck", "why": f"woken {misses} times with no answer (last: {last.get('why') or 'idle'})",
                "id": last.get("stall"), "wakes": len(wakes or [])}
    found = []
    blocked, cleared = blocker_cleared(key, rs, reports, detail)
    if cleared:
        found.append((f"blocked#{blocked.get('id')}", f"your blocker cleared: {cleared}"))
    at = parse_time(activity.get("at"))
    if rs and at and rs[-1].get("event") not in QUIET:
        idle = int((now - at).total_seconds() // 60)
        if idle >= IDLE_MINUTES:
            found.append((f"idle@{activity.get('at')}", f"idle {idle} min"))
    fresh = [(i, why) for i, why in found if i not in woken_ids]
    if fresh:
        # Both reasons, if both hold: the first fresh one is the stall's id.
        why = "; ".join(w for _, w in found)
        return {"state": "stalled", "why": why, "id": fresh[0][0], "wakes": len(wakes or [])}
    if found or misses:
        last = (wakes or [{}])[-1]
        why = "; ".join(w for _, w in found) or last.get("why") or "woken"
        return {"state": "woken", "why": why, "id": (found[0][0] if found else last.get("stall")),
                "wakes": len(wakes or [])}
    return None


def sessions(detail, reports, closed=None, activity=None, wakes=None, now=None):
    """The close rule's rows (``closing.sessions``), each candidate with its
    ``stall`` when it has one. ``activity`` ``{key: {at, running, agent}}``,
    ``wakes`` ``{key: [{at, stall, why}]}``, ``now`` an aware datetime."""
    now = now or datetime.datetime.now(datetime.timezone.utc)
    activity = activity or {}
    wakes = wakes or {}
    rows = closing.sessions(detail, reports, closed)
    attributed = closing.attribute(reports, detail.get("sessions") or {}, closed)
    prs = [p for p in detail.get("prs") or [] if isinstance(p, dict) and "number" in p]
    closed_tickets = {t["number"] for t in detail.get("tickets") or [] if t.get("state") not in (None, "OPEN")}
    closed_tickets |= {t["number"] for t in (detail.get("frontier") or {}).get("tiles") or [] if t.get("state") == "done"}
    out = []
    for row in rows:
        key = row["key"]
        if row["status"] != "open" or key in closing.NEVER or closing.open_cards(detail, key):
            out.append(row)
            continue
        rs = closing.thread_reports(key, attributed)
        ok, _ = closing.settled(key, detail, rs, closed_tickets, prs)
        s = None if ok else stall(key, rs, attributed, detail, activity.get(key), wakes.get(key), now)
        out.append({**row, "stall": s} if s else row)
    return out


def stalled_by_ticket(rows):
    """``{ticket: row}`` for each ticket with a stalled, woken or stuck session
    (the worst one: stuck, then stalled, then woken)."""
    rank = {"stuck": 0, "stalled": 1, "woken": 2}
    out = {}
    for row in rows or []:
        s = row.get("stall")
        t = _ticket(row["key"])
        if not s or t is None:
            continue
        if t not in out or rank[s["state"]] < rank[out[t]["stall"]["state"]]:
            out[t] = row
    return out


def stuck_cards(rows):
    """A decision card for the human per stuck session, for the frontier's
    ``waiting``: ``{from, id, title, options, recommended, stuck}``."""
    return [{"from": r["key"], "id": f"stuck-{r['key']}",
             "title": f"{r['key']} is stuck: {r['stall']['why']}. Open it and see what it needs?",
             "options": ["Open it", "Close it"], "recommended": "Open it", "stuck": True}
            for r in rows or [] if (r.get("stall") or {}).get("state") == "stuck"]
