"""When KiPo closes a stage session it opened: one pure rule, no I/O.

A session is **closable** when both hold:

1. **It finished.** It reported ``finished`` or ``nothing-to-do``, or it reported
   ``failed`` and a later report on the same thread (``started``, ``finished``,
   ``nothing-to-do``, ``pr-merged``) shows another try took over. A session that
   never reported at all predates ``kipo_cli.py report`` (its seed had no
   Report line) and counts as finished once its thread is settled.
2. **Its thread is settled.**
   - ``shape-t<t>`` (a Decide ticket): the ticket is closed.
   - ``build-t<t>``: the ticket is closed, or its PR is open or merged and the
     ticket's review session (``review-t<t>``) owns it now.
   - ``review-t<t>``: the ticket is closed, or every PR for it is merged or closed.
   - ``review`` (the effort's review): every effort PR it named in its reports is
     merged or closed; naming none, every effort PR is (the frontier has landed).
   - ``shape``, ``grill``, ``intake``: the Decide half is clear (no open decision
     ticket, no fog).
   - ``plan`` (the hand-over): build tickets are cut.
   - ``build-spec`` and ``done``: everything delivered is merged or closed.

It is never closable while its state file has an unanswered decision card, and
the conductor (the effort's own conversation) is never closed. The page closes
closable sessions through Kiro Crew (``DELETE /api/chat/slots/<slot>``: stopped,
history kept, resumable) and records them here as ``closed``.

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


def thread_reports(key, reports):
    """The reports a session made, oldest first. Reports run through
    ``attribute`` carry their session; a bare older ``t<t>`` report (not
    attributed) counts for every conversation of ticket ``t``."""
    _, t = _ticket_of(key)
    out = []
    for r in reports or []:
        if not isinstance(r, dict):
            continue
        if "session" in r:
            if r["session"] == key:
                out.append(r)
        elif r.get("from") == key or (t is not None and r.get("from") == f"t{t}"):
            out.append(r)
    return out


def finished(rs):
    """``(yes, why)``: has this session finished, from its own reports?"""
    if not rs:
        return True, "never reported (started before reporting)"
    for i, r in enumerate(rs):
        if r.get("event") in FINISHED:
            return True, f"reported {r['event']}"
        if r.get("event") == "failed" and any(x.get("event") in SUPERSEDES for x in rs[i + 1:]):
            return True, "reported failed, then superseded"
    return False, f"last reported {rs[-1].get('event')}, not finished"


def _open_cards(state):
    if not isinstance(state, dict):
        return 0
    return sum(1 for d in state.get("decisions") or [] if isinstance(d, dict) and d.get("answer") in (None, ""))


def open_cards(detail, key):
    """How many unanswered decision cards hold this session. A ticket's
    conversation (and build-spec) has its own state file; the stage ones share
    state.json."""
    states = detail.get("sessionStates") or {}
    own = _ticket_of(key)[0] or key == "build-spec"
    return _open_cards(states.get(key) if own else detail.get("state"))


def settled(key, detail, rs, closed_tickets, prs):
    """``(yes, why)``: is the work this session's thread exists for done?"""
    kind, t = _ticket_of(key)
    front = detail.get("frontier") or {}
    sessions = detail.get("sessions") or {}
    if t is not None:
        if t in closed_tickets:
            return True, f"#{t} is closed"
        mine = [p for p in prs if t in (p.get("tickets") or [])]
        if kind == "build":
            if mine and f"review-t{t}" in sessions:
                return True, f"PR {', '.join('#%d' % p['number'] for p in mine)} is with review-t{t}"
            return False, f"#{t} is open" + ("" if mine else " with no PR")
        if kind == "review":
            if mine and all(p.get("state") in ("MERGED", "CLOSED") for p in mine):
                return True, f"PR {', '.join('#%d' % p['number'] for p in mine)} merged"
            return False, f"#{t}'s PR is open" if mine else f"#{t} is open with no PR"
        return False, f"#{t} is open"
    if key == "review":
        effort_prs = {p["number"]: p for p in prs}
        named = sorted({int(n) for r in rs for s in [r.get("text") or ""] + list(r.get("items") or [])
                        for n in _REF.findall(s) if int(n) in effort_prs})
        if named:
            still = [n for n in named if effort_prs[n].get("state") == "OPEN"]
            if still:
                return False, f"PR {', '.join('#%d' % n for n in still)} still open"
            return True, f"PR {', '.join('#%d' % n for n in named)} merged"
        return (True, "every PR landed") if front.get("landed") else (False, "PRs still open")
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


def sessions(detail, reports, closed=None):
    """Every session KiPo recorded for the effort, each
    ``{key, slot, status, reason}``; ``status`` is ``open`` (it stays),
    ``closable`` (the page closes it) or ``closed`` (KiPo closed it already).

    ``detail`` is the effort detail (``sessions``, ``state``, ``sessionStates``,
    ``tickets``, ``prs``, ``frontier``); ``reports`` every report in reports.json;
    ``closed`` ``{key: when}`` for the sessions KiPo has closed.
    """
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
        # A ticket's conversation has its own state file; the stage ones share state.json.
        cards = open_cards(detail, key)
        if cards:
            out.append({**row, "status": "open", "reason": f"{cards} unanswered decision card{'s' if cards > 1 else ''}"})
            continue
        rs = thread_reports(key, reports)
        done, why_done = finished(rs)
        ok, why_settled = settled(key, detail, rs, closed_tickets, prs)
        status = "closable" if done and ok else "open"
        out.append({**row, "status": status, "reason": f"{why_done}; {why_settled}"})
    return out
