"""KiPo's command line, for the conductor agent.

  python3 kipo_cli.py frontier OWNER/REPO N
      The effort's open threads as JSON, from GitHub through KiPo's own
      frontier code: each thread's stage, owner (HITL, Agent, Running,
      Blocked) and next action. Read-only. Run it on every wake; never
      work from memory.

  python3 kipo_cli.py dispatch OWNER/REPO N (--ticket T | --stage shape|plan|review|done) [--skill S]
      Ask KiPo to start a stage-skill session: a ticket's conversation, or
      the effort's Shape (chart the fog), Plan (hand-over), Review or Done
      (retro) conversation.
      It's queued in the conductor's state file; the KiPo page starts it
      (once) while it's open.
"""
import argparse
import datetime
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from kipo import conductor  # noqa: E402
from kipo import state as col_state  # noqa: E402
from kipo.gh import Gh  # noqa: E402
from kipo.initiatives import Initiatives  # noqa: E402
from kipo.storage import Storage  # noqa: E402

STAGES = ("shape", "plan", "review", "done")


def main(argv=None):
    ap = argparse.ArgumentParser(prog="kipo_cli.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("frontier")
    f.add_argument("repo")
    f.add_argument("number", type=int)
    d = sub.add_parser("dispatch")
    d.add_argument("repo")
    d.add_argument("number", type=int)
    g = d.add_mutually_exclusive_group(required=True)
    g.add_argument("--ticket", type=int)
    g.add_argument("--stage", choices=STAGES)
    d.add_argument("--skill")
    args = ap.parse_args(argv)

    detail = Initiatives(Gh(), Storage()).detail(args.repo, args.number)
    if args.cmd == "frontier":
        print(json.dumps({"effort": args.number, "repo": args.repo, **conductor.threads(detail)}, indent=1))
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
    same = lambda e: e.get("ticket") == entry.get("ticket") and e.get("stage") == entry.get("stage")  # noqa: E731
    if any(same(e) for e in queue):
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


if __name__ == "__main__":
    sys.exit(main())
