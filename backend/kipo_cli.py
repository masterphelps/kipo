"""KiPo's command line, for the conductor agent.

  python3 kipo_cli.py frontier OWNER/REPO N
      The effort's open threads as JSON, from GitHub through KiPo's own
      frontier code: each thread's stage, owner (HITL, Agent, Running,
      Blocked) and next action. Read-only. Run it on every wake; never
      work from memory.

  python3 kipo_cli.py dispatch OWNER/REPO N (--ticket T | --stage grill|intake|shape|plan|review|done) [--skill S]
      Ask KiPo to start a stage-skill session: a ticket's conversation, or
      the effort's Grill (an idea grilled, before any ticket), Intake (an
      issue read in), Shape (chart the fog, or map a new effort), Plan
      (hand-over), Review or Done (retro) conversation. --skill names the KiPo skill when it isn't the
      ticket's build: --ticket T --skill kipo-review opens the ticket's
      review conversation (its PR reviewed, fixed, merged). One entry per
      (ticket or stage, skill): the same again is "already queued".
      It's queued in the conductor's state file; the KiPo page starts it
      (once) while it's open.

  python3 kipo_cli.py report OWNER/REPO N --from SESSION --event KIND --text "..." [--item "..."]... [--checkout PATH]
      For stage sessions: tell the effort's conductor what happened. SESSION
      is build-t<ticket>, review-t<ticket> or shape-t<ticket> (older seeds:
      t<ticket>), shape, plan, review or done (also intake, grill,
      build-spec). KIND is one of: started, asked, answered, pr-opened,
      pr-merged, issue-created, issue-closed, finished, nothing-to-do,
      blocked, failed. --item lists things (one per question asked, PR or
      issue). Appended to .kipo/N/reports.json in the effort's checkout; the
      KiPo page wakes the conductor with it while it's open, and the
      conductor's next frontier shows it either way.

  python3 kipo_cli.py reports OWNER/REPO N [--checkout PATH] [--peek]
      The reports the conductor hasn't seen yet, without GitHub (the
      frontier carries them too). Marks them seen unless --peek.

  python3 kipo_cli.py sessions OWNER/REPO N
      Every session KiPo opened for the effort, each with its status: open
      (it stays), closable (finished and its thread is settled: the KiPo
      page closes it on its next refresh) or closed (KiPo closed it), and
      why. The rule is in kipo/closing.py. An open session that has stalled
      also carries "stall": {state, why}: stalled (idle 15 min or more, or
      its blocker cleared: the KiPo page wakes it), woken (woken, waiting for
      it to answer) or stuck (woken twice with no answer: put it to the
      human). The rule is in kipo/stalls.py. Read-only.

The frontier's JSON also carries "reports" (unread session reports, marked
seen once printed; --peek keeps them unread), "waiting" (every stage
session's unanswered decision cards, plus one card per stuck session) and
"sessionsBlocking" (what each stage session says it waits on). A ticket whose
session stalled has owner "Stalled" and the reason.
"""
import argparse
import datetime
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from kipo import conductor  # noqa: E402
from kipo import reports  # noqa: E402
from kipo import stalls  # noqa: E402
from kipo import state as col_state  # noqa: E402
from kipo.gh import Gh  # noqa: E402
from kipo.initiatives import Initiatives  # noqa: E402
from kipo.storage import Storage  # noqa: E402

STAGES = ("grill", "intake", "shape", "plan", "review", "done")


def main(argv=None):
    ap = argparse.ArgumentParser(prog="kipo_cli.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("frontier")
    f.add_argument("repo")
    f.add_argument("number", type=int)
    f.add_argument("--peek", action="store_true")
    r = sub.add_parser("report")
    r.add_argument("repo")
    r.add_argument("number", type=int)
    r.add_argument("--from", dest="source", required=True)
    r.add_argument("--event", required=True, choices=reports.EVENTS)
    r.add_argument("--text", required=True)
    r.add_argument("--item", action="append", default=[])
    r.add_argument("--checkout")
    u = sub.add_parser("reports")
    u.add_argument("repo")
    u.add_argument("number", type=int)
    u.add_argument("--checkout")
    u.add_argument("--peek", action="store_true")
    d = sub.add_parser("dispatch")
    d.add_argument("repo")
    d.add_argument("number", type=int)
    g = d.add_mutually_exclusive_group(required=True)
    g.add_argument("--ticket", type=int)
    g.add_argument("--stage", choices=STAGES)
    d.add_argument("--skill")
    s = sub.add_parser("sessions")
    s.add_argument("repo")
    s.add_argument("number", type=int)
    args = ap.parse_args(argv)

    if args.cmd in ("report", "reports"):
        return _reports(args)

    detail = Initiatives(Gh(), Storage()).detail(args.repo, args.number)
    if args.cmd == "frontier":
        out = {"effort": args.number, "repo": args.repo, **conductor.threads(detail)}
        repo_path = detail.get("repoPath")
        out["reports"] = reports.take_unread(repo_path, args.number, mark=not args.peek) if repo_path else []
        out["waiting"] = reports.open_decisions(detail) + stalls.stuck_cards(detail.get("closing"))
        out["sessionsBlocking"] = reports.session_blocking(detail)
        print(json.dumps(out, indent=1))
        return 0

    if args.cmd == "sessions":
        rows = detail.get("closing") or []
        counts = {k: sum(1 for r in rows if r["status"] == k) for k in ("open", "closable", "closed")}
        counts.update({k: sum(1 for r in rows if (r.get("stall") or {}).get("state") == k)
                       for k in stalls.STALL_STATES})
        print(json.dumps({"effort": args.number, "repo": args.repo, **counts, "sessions": rows}, indent=1))
        return 0

    repo_path = detail.get("repoPath")
    if not repo_path:
        print("No repo checkout is known for this effort; dispatch needs one for the state file.", file=sys.stderr)
        return 2
    if args.ticket is not None:
        tile = next((t for t in (detail.get("frontier") or {}).get("tiles") or [] if t["number"] == args.ticket), None)
        if not tile:
            print(f"#{args.ticket} isn't one of this effort's tickets.", file=sys.stderr)
            return 2
        if tile["state"] in ("done", "blocked"):
            print(f"#{args.ticket} is {tile['state']}; nothing to start.", file=sys.stderr)
            return 2
    entry = {k: v for k, v in (("ticket", args.ticket), ("stage", args.stage), ("skill", args.skill)) if v is not None}
    entry["at"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    path = col_state.session_state_path(repo_path, args.number, "conductor")
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        data = {}
    if not isinstance(data, dict):
        data = {}
    queue = data.setdefault("dispatch", [])
    # One entry per (ticket, stage, skill). No skill means the stage's default
    # skill and is its own entry, so a ticket's build and then its kipo-review
    # each queue once.
    key = lambda e: (e.get("ticket"), e.get("stage"), e.get("skill"))  # noqa: E731
    if any(key(e) == key(entry) for e in queue):
        print(json.dumps({"queued": False, "reason": "already queued", "entry": entry}))
        return 0
    queue.append(entry)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=1)
    os.replace(tmp, path)
    print(json.dumps({"queued": True, "entry": entry, "stateFile": path}))
    return 0


def _reports(args):
    """report and reports: the effort's checkout from --checkout (the seed's
    Report line carries it), else from the effort issue's meta or the repo's
    configured path."""
    repo_path = args.checkout or Initiatives(Gh(), Storage()).repo_path(args.repo, args.number)
    if not repo_path:
        print("No repo checkout is known for this effort; pass --checkout.", file=sys.stderr)
        return 2
    if args.cmd == "reports":
        print(json.dumps({"reports": reports.take_unread(repo_path, args.number, mark=not args.peek)}, indent=1))
        return 0
    try:
        entry = reports.append(repo_path, args.number, args.source, args.event, args.text, args.item)
    except ValueError as e:
        print(str(e), file=sys.stderr)
        return 2
    print(json.dumps({"reported": True, "entry": entry}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
