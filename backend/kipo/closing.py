"""When KiPo closes a stage session it opened: one pure rule, no I/O.

A session is **closable** when both hold:

1. **It finished.** It reported ``finished`` or ``nothing-to-do``, or it reported
   ``failed`` and a later report on the same thread (``started``, ``finished``,
   ``nothing-to-do``, ``pr-merged``) shows another try took over. A session that
   never reported at all either predates ``kipo_cli.py report`` (no dispatch
   entry opens it, KiPo recorded no start, and its transcript's seed has no
   Report line: it counts as finished), or was seeded to report
   (``expects_reports``: dispatched, opened by KiPo since it records starts, or
   its seed has a Report line) and is "never reported": not finished, a stall candidate
   (kipo/stalls.py), closable only once its thread settled without it.
2. **Its thread is settled.**
   - ``shape-t<t>`` (a Decide ticket): the ticket is closed.
   - ``build-t<t>``: the ticket is closed, or its PR is open or merged and the
     ticket's review session (``review-t<t>``) owns it now.
   - ``review-t<t>``: the ticket is closed, or every PR for it is merged or closed.
   - ``review`` (the effort's review): every effort PR it named in its reports is
     merged or closed; naming none, no effort PR is open. Effort PRs are the
     detail's ``prs`` and ``refPrs`` (open PRs naming an effort ticket), never
     the repo's others.
   - ``review-t<t>`` also holds while an open PR names ``#t`` (``refPrs``),
     even with ``#t`` closed.
   - ``shape``, ``grill``, ``intake``: the Decide half is clear (no open decision
     ticket, no fog).
   - ``plan`` (the hand-over): build tickets are cut.
   - ``build-spec`` and ``done``: everything delivered is merged or closed.

It is never closable while its own state file has an unanswered decision card
(every conversation has its own; the effort's older shared state.json is
attributed to its stage sessions in the detail, ``state.route_stage_decisions``),
nor while another session on the same slot stays open: the hand-over (``plan``)
continues the grilling's conversation, so closing a finished ``grill`` would
close ``plan`` too. The conductor (the effort's own conversation) is never closed. The page closes
closable sessions through Kiro Crew (``DELETE /api/chat/slots/<slot>``: stopped,
history kept, resumable) and records them here as ``closed``.

A session for a ticket that is the effort's spec (``specIssues``: the parent
of its tickets) is ``closable``: a spec is not work, so its thread doesn't exist.

A recorded session that **never started** (its seed never went out after
``SEED_GRACE_S``, or Kiro Crew has no such slot) is ``open`` with ``started:
false``: nothing to wake or close; the page starts it again. A session whose
slot a dispatch entry ``replace``s is ``closable``: the page closes it before
the fresh one starts. A replacing slot's session ignores reports made before
it started (``since``).

Reports name their session: ``build-t<t>``, ``review-t<t>``, ``shape-t<t>``, or
a stage key. Older seeds reported a ticket's conversations as ``t<t>``; such a
report is attributed (``attribute``) to the session that was the ticket's only
open conversation at that time, or else to ``build-t<t>``, so a build's
``finished`` never makes the ticket's review look finished.
"""
import re

FINISHED = ("finished", "nothing-to-do")
SUPERSEDES = ("started", "finished", "nothing-to-do", "pr-merged")
NEVER = ("conductor",)
DECIDE_STAGES = ("shape", "grill", "intake")
_TICKET_KEY = re.compile(r"^(shape|build|review)-t(\d+)$")
_REF = re.compile(r"#(\d+)\b")


def _ticket_of(key):
    m = _TICKET_KEY.match(key or "")
    return (m.group(1), int(m.group(2))) if m else (None, None)


_OLD_TICKET_SOURCE = re.compile(r"^t(\d+)$")


def attribute(reports, sessions, closed=None):
    """Each report with ``session``: the session that made it. A report names
    its session, except an older seed's shared ``t<t>``: that one goes to the
    ticket's only conversation open at the time (it existed and KiPo hadn't
    closed it before then), or else to ``build-t<t>``."""
    closed = closed or {}
    out = []
    for r in reports or []:
        if not isinstance(r, dict):
            continue
        source = r.get("from") or ""
        m = _OLD_TICKET_SOURCE.match(source)
        if m:
            t = m.group(1)
            at = r.get("at") or ""
            live = [k for k in (f"build-t{t}", f"review-t{t}", f"shape-t{t}")
                    if k in (sessions or {}) and not (k in closed and str(closed[k]) < at)]
            source = live[0] if len(live) == 1 else f"build-t{t}"
        out.append({**r, "session": source})
    return out


def thread_reports(key, reports, since=None):
    """The reports a session made, oldest first. Reports run through
    ``attribute`` carry their session; a bare older ``t<t>`` report (not
    attributed) counts for every conversation of ticket ``t``. ``since``: only
    those at or after it (an earlier session on the key made the rest)."""
    _, t = _ticket_of(key)
    out = []
    for r in reports or []:
        if not isinstance(r, dict):
            continue
        if since and str(r.get("at") or "") < since:
            continue
        if "session" in r:
            if r["session"] == key:
                out.append(r)
        elif r.get("from") == key or (t is not None and r.get("from") == f"t{t}"):
            out.append(r)
    return out


def finished(rs, expected=False):
    """``(yes, why)``: has this session finished, from its own reports?
    ``expected``: it was seeded to report (``expects_reports``), so silence is
    not "finished" but "never reported"."""
    if not rs:
        if expected:
            return False, f"never reported since {expected}"
        return True, "never reported (started before reporting)"
    for i, r in enumerate(rs):
        if r.get("event") in FINISHED:
            return True, f"reported {r['event']}"
        if r.get("event") == "failed" and any(x.get("event") in SUPERSEDES for x in rs[i + 1:]):
            return True, "reported failed, then superseded"
    return False, f"last reported {rs[-1].get('event')}, not finished"


# -- what KiPo knows of how a session started ---------------------------

# A seed that hasn't gone out this long after KiPo recorded the session never will.
SEED_GRACE_S = 120


def dispatch_entries(detail):
    """The conductor's dispatch queue (``kipo_cli.py dispatch``)."""
    queue = ((detail.get("sessionStates") or {}).get("conductor") or {}).get("dispatch")
    return [e for e in queue or [] if isinstance(e, dict)]


def entry_keys(entry):
    """The session keys a dispatch entry opens: a stage's own; a ticket's
    review (kipo-review), else its build or decision."""
    if entry.get("stage"):
        return (entry["stage"],)
    t = entry.get("ticket")
    if t is None:
        return ()
    if entry.get("skill") == "kipo-review":
        return (f"review-t{t}",)
    return (f"build-t{t}", f"shape-t{t}")


def start_of(detail, key):
    start = (detail.get("starts") or {}).get(key)
    return start if isinstance(start, dict) else None


def seed_of(detail, key):
    """The session's seed as its transcript shows it (``seeds``: ``{at,
    reports}``), else ``None``."""
    seed = (detail.get("seeds") or {}).get(key)
    return seed if isinstance(seed, dict) else None


def expects_reports(key, detail):
    """Why this session is seeded to report (every session KiPo opens today
    is): ``"it was dispatched"`` (a dispatch entry opens it), ``"KiPo opened
    it"`` (KiPo recorded its start) or ``"its seed asked it to report"`` (its
    transcript's seed has a ``Report:`` line: a session the page opened before
    KiPo kept starts); ``None`` for a session from before reporting (its seed
    has no Report line, or nothing is known of it), which may stay silent."""
    if any(key in entry_keys(e) for e in dispatch_entries(detail)):
        return "it was dispatched"
    if start_of(detail, key):
        return "KiPo opened it"
    if (seed_of(detail, key) or {}).get("reports"):
        return "its seed asked it to report"
    return None


def since(key, detail):
    """When the session on this key's current slot started, when that slot
    replaced another (a re-dispatch): what came before belongs to the old
    session. ``None`` otherwise."""
    start = start_of(detail, key)
    return start.get("at") if start and start.get("replaced") else None


def opened_at(key, detail):
    """The latest known time the session was opened: its recorded start, its
    latest dispatch entry or its seed's time, else ``None``."""
    times = [e.get("at") for e in dispatch_entries(detail) if key in entry_keys(e) and e.get("at")]
    start = start_of(detail, key)
    if start and start.get("at"):
        times.append(start["at"])
    seed = seed_of(detail, key)
    if seed and seed.get("at"):
        times.append(seed["at"])
    good = [t for t in times if _time(t)]
    return max(good, key=_time) if good else None


def not_started(key, slot, detail, now=None):
    """Why a recorded session never started (the page recorded its slot, but
    its seed never went out, or Kiro Crew has no such session), else ``None``.
    A start younger than ``SEED_GRACE_S`` may still be on its way."""
    start = start_of(detail, key)
    if start and start.get("seeded"):
        return None
    if start and now is not None:
        at = _time(start.get("at"))
        if at and (now - at).total_seconds() < SEED_GRACE_S:
            return None
    if start and start.get("seeded") is False:
        return "never started: its seed never went out"
    if slot in (detail.get("missingSlots") or ()):
        return "never started: Kiro Crew has no such session"
    return None


def pending_replacement(key, slot, detail):
    """A dispatch entry queued to replace this slot (the thread's session was
    stuck, closed or never started): ``(entry)`` or ``None``."""
    for e in dispatch_entries(detail):
        if e.get("replace") == slot and key in entry_keys(e):
            return e
    return None


def _time(value):
    import datetime
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        when = datetime.datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return when if when.tzinfo else when.replace(tzinfo=datetime.timezone.utc)


def ref_prs(detail):
    """Open or not, the PRs that name an effort ticket without closing one
    (``refPrs``: ``{number, state, refs}``)."""
    return [p for p in detail.get("refPrs") or [] if isinstance(p, dict) and "number" in p]


def _open_cards(state):
    if not isinstance(state, dict):
        return 0
    # Only a titled, unanswered entry is an open question. Sessions also record
    # settled views ({id, view}, no title) in the same array; those are history
    # and must not block closing or count as waiting on the human.
    return sum(
        1 for d in state.get("decisions") or []
        if isinstance(d, dict) and d.get("answer") in (None, "") and str(d.get("title") or "").strip()
    )


def open_cards(detail, key):
    """How many unanswered decision cards hold this session: those in its own
    state (``sessionStates[key]``: its own file, plus what the detail
    attributed to it from the older shared state.json)."""
    return _open_cards((detail.get("sessionStates") or {}).get(key))


def settled(key, detail, rs, closed_tickets, prs):
    """``(yes, why)``: is the work this session's thread exists for done?"""
    kind, t = _ticket_of(key)
    front = detail.get("frontier") or {}
    sessions = detail.get("sessions") or {}
    if t is not None:
        mine = [p for p in prs if t in (p.get("tickets") or [])]
        if kind == "review":
            # A PR naming the ticket (no closing keyword) is the review's too,
            # even once the ticket closed.
            mine += [p for p in ref_prs(detail) if t in (p.get("refs") or [])]
            still = [p for p in mine if p.get("state") == "OPEN"]
            if t in closed_tickets and not still:
                return True, f"#{t} is closed"
        elif t in closed_tickets:
            return True, f"#{t} is closed"
        if kind == "build":
            if mine and f"review-t{t}" in sessions:
                return True, f"PR {', '.join('#%d' % p['number'] for p in mine)} is with review-t{t}"
            return False, f"#{t} is open" + ("" if mine else " with no PR")
        if kind == "review":
            if mine and not still:
                return True, f"PR {', '.join('#%d' % p['number'] for p in mine)} merged"
            if still:
                return False, f"PR {', '.join('#%d' % p['number'] for p in still)} still open"
            return False, f"#{t} is open with no PR"
        return False, f"#{t} is open"
    if key == "review":
        # Only the effort's own PRs (``prs``, and ``refPrs`` naming its tickets):
        # never the repo's others.
        effort_prs = {p["number"]: p for p in prs + ref_prs(detail)}
        named = sorted({int(n) for r in rs for s in [r.get("text") or ""] + list(r.get("items") or [])
                        for n in _REF.findall(s) if int(n) in effort_prs})
        if named:
            still = [n for n in named if effort_prs[n].get("state") == "OPEN"]
            if still:
                return False, f"PR {', '.join('#%d' % n for n in still)} still open"
            return True, f"PR {', '.join('#%d' % n for n in named)} merged"
        still = sorted(n for n, p in effort_prs.items() if p.get("state") == "OPEN")
        if still:
            return False, f"PR {', '.join('#%d' % n for n in still)} still open"
        return True, "no effort PR open"
    if key in DECIDE_STAGES:
        active = (front.get("active") or {}).get("decide")
        if active is None:
            return False, "no frontier"
        return (False, "decisions still open") if active or front.get("fog") else (True, "every decision made")
    if key == "plan":
        deliver = sum(((front.get("lanes") or {}).get("deliver") or {}).values())
        return (True, f"{deliver} build tickets cut") if deliver else (False, "no build tickets yet")
    if key in ("build-spec", "done"):
        return (True, "everything landed") if front.get("landed") else (False, "not landed yet")
    return False, "not a KiPo stage session"


def sessions(detail, reports, closed=None, now=None):
    """Every session KiPo recorded for the effort, each
    ``{key, slot, status, reason}``; ``status`` is ``open`` (it stays),
    ``closable`` (the page closes it) or ``closed`` (KiPo closed it already).

    ``detail`` is the effort detail (``sessions``, ``state``, ``sessionStates``,
    ``tickets``, ``prs``, ``frontier``); ``reports`` every report in reports.json;
    ``closed`` ``{key: when}`` for the sessions KiPo has closed; ``now`` an
    aware datetime (for the seed's grace). A session that never started also
    carries ``started: false``.
    """
    import datetime
    now = now or datetime.datetime.now(datetime.timezone.utc)
    closed = closed or {}
    prs = [p for p in detail.get("prs") or [] if isinstance(p, dict) and "number" in p]
    closed_tickets = {t["number"] for t in detail.get("tickets") or [] if t.get("state") not in (None, "OPEN")}
    closed_tickets |= {t["number"] for t in (detail.get("frontier") or {}).get("tiles") or [] if t.get("state") == "done"}
    reports = attribute(reports, detail.get("sessions") or {}, closed)
    out = []
    for key, slot in sorted((detail.get("sessions") or {}).items()):
        row = {"key": key, "slot": slot}
        if key in NEVER:
            out.append({**row, "status": "open", "reason": "the conductor is never closed"})
            continue
        if key in closed:
            out.append({**row, "status": "closed", "reason": f"closed by KiPo {closed[key]}"})
            continue
        if _ticket_of(key)[1] in (detail.get("specIssues") or ()):
            # Opened for the spec issue before KiPo told it from a ticket: no thread.
            out.append({**row, "status": "closable",
                        "reason": f"#{_ticket_of(key)[1]} is the effort's spec, not a ticket: its thread doesn't exist"})
            continue
        if pending_replacement(key, slot, detail):
            out.append({**row, "status": "closable", "reason": "replaced: a fresh session is queued for its thread"})
            continue
        why_not = not_started(key, slot, detail, now)
        if why_not:
            out.append({**row, "status": "open", "started": False, "reason": why_not})
            continue
        cards = open_cards(detail, key)
        if cards:
            out.append({**row, "status": "open", "reason": f"{cards} unanswered decision card{'s' if cards > 1 else ''}"})
            continue
        rs = thread_reports(key, reports, since(key, detail))
        expected = expects_reports(key, detail)
        done, why_done = finished(rs, expected)
        ok, why_settled = settled(key, detail, rs, closed_tickets, prs)
        if ok and not rs and expected:
            # Seeded to report and silent, but its thread settled without it.
            done, why_done = True, f"never reported since {expected}, but its thread settled"
        status = "closable" if done and ok else "open"
        out.append({**row, "status": status, "reason": f"{why_done}; {why_settled}"})
    # One conversation, two keys (grill, then plan in the same slot): close the
    # slot only once every key on it is closable.
    for row in out:
        if row["status"] != "closable":
            continue
        holding = [r["key"] for r in out if r is not row and r["slot"] == row["slot"] and r["status"] == "open"]
        if holding:
            row["status"] = "open"
            row["reason"] += f"; its conversation carries on as {', '.join(holding)}"
    return out
