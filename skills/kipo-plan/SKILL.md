---
name: kipo-plan
description: KiPo Plan column. Loaded by a KiPo column session seed ("Load the skill `kipo-plan`") or by the "moving to Plan" message in the shared Grill session; writes the spec with /to-spec and splits it into labelled, natively blocked tickets with /to-tickets.
---

# Column 4 of 7: Plan

A spec issue exists and tickets with blocking links hang off it. Plan collapses the grilling (or the wayfinder map) into a buildable spec, then into tracer-bullet tickets.

## Ground rules

- The seed gives the effort (number, title, issue URL), `Column:`, `Start:`, the repo checkout and the state file. Work in that checkout with absolute paths. The authority for everything here is `/Users/masterphelps/repos/kipo/CONTRACT.md`.
- **State file**: the path on the seed's `State file:` line. The effort's own conversation uses `<checkout>/.kipo/<n>/state.json`; a ticket's conversation has its own, such as `<checkout>/.kipo/<n>/build-t22.json` or `shape-t24.json`, so conversations running side by side never overwrite each other. Write only your own. Shape: `{"phase": "<column id>", "summary", "blocking", "decisions": [{id, title, options, recommended, answer}], "gate": [{id, label, done}], "artifacts": [{label, href}], "skillsUsed": []}`. Create its directory if missing; if it already holds this column, resume from it. Rewrite it on every decision asked or answered, gate item done, artifact produced and skill loaded. It is plumbing: never mention it in chat.
- `.kipo/` stays out of commits: if `git status` shows it, add `.kipo/` to `<checkout>/.git/info/exclude`.
- **Decisions are cards.** Write the `decisions` entry first (stable `id`, 2-4 short `options`, your `recommended`), then ask in one line pointing at it; 1-3 at a time. Answers arrive together in one message, one numbered line each: `<n>. <title> (<id>): <answer>`. Put each in its decision's `answer` and act on all of them in the same turn; any listed as still open stay open. (An older single answer may arrive as `<title>: <answer>`.) Never use the `ask_question` tool.
- Facts are your job: read, run and look them up. Decisions are the human's.
- **Load a skill by reading** `/Users/masterphelps/.agents/skills/<name>/SKILL.md` (and any file it links to), never through the Skill tool: most refuse model invocation. When a loaded skill says "call the Skill tool with X", read X's file the same way.
- **Record every skill** (button, chip or session control) by appending its name to `skillsUsed` the moment you load it.
- The tracker is this repo's GitHub Issues, through `gh`. If a skill finds no tracker config (`docs/agents/issue-tracker.md`), tell the human to run `setup-matt-pocock-skills` (Intake's first button).
- Session controls (`handoff`, `wait-what`, `teach`, `writing-for-agents`) can arrive in any column as "Run /<skill>: …": follow and record them, then resume.
- Never edit the effort's `kipo:` labels or its `kipo:meta` comment: the backend owns them. There is no Next: KiPo reads the effort's stage (Intake, Decide, Deliver, Done) from its tickets and PRs. When every gate item is done, say so in one line and stop.

## Buttons

`to-spec`, `to-tickets`. The human may press either at any time; it arrives as "Run /<skill>: …". Follow that skill for this effort and record it.

If no button has been pressed yet, recommend one as decision `button` (options: the two buttons) and wait. Choose by:

- **`to-spec`**: no spec issue exists yet. Always first.
- **`to-tickets`**: the spec exists (artifact "Spec") and the human has approved it.

## Chips

- **`codebase-design`**: when the spec or a ticket has to say where a seam goes or what a module's interface is. Use its words (module, interface, depth, seam, adapter) so `/tdd` in Build picks them up.

## Path

Read `Start:` and the `Column:` line.

- **`idea`**: this is the Grill session, continued. The grilling is already in context: write the spec from it with no new interview, then the tickets. Don't compact or clear before `/to-tickets` is done.
- **`huge`**: Plan has its own session. Read the wayfinder map (artifact "Wayfinder map" in the archived Shape state, or the effort's `mapIssue`) and its closed decision tickets, and let `/to-spec` collapse them into the spec. Link the map from the spec.
- `small`, `issue` and `bug` usually skip Plan. If the human presses `/to-spec` on one anyway, start from the effort issue and any archived states.

## Tickets

- Every ticket gets the label `kipo:<n>` (the effort's number). Create it if missing: `gh label create kipo:<n> --color BFD4F2 --description "KiPo effort #<n>"`, ignoring "already exists".
- Blocking edges are GitHub's native blocking links (per `/to-tickets` and `docs/agents/issue-tracker.md`), not "Blocked by" text. Check each with `gh` after publishing.
- Make each ticket a sub-issue of the spec issue where the tracker supports it, and apply `ready-for-agent` as `/to-tickets` says.
- Never put a closing keyword aimed at the effort issue in a ticket or the spec.

## Gate

Write these when the column starts:

- `spec-published`: "Spec issue published and approved by the human, recorded as artifact Spec"
- `tickets-published`: "Tickets published, each labelled kipo:<n>, recorded as artifact Tickets"
- `blocking-native`: "Every blocking edge is a native GitHub blocking link"

## Exit artifacts

- "Spec": the spec issue URL. Use exactly this label: the backend reads the spec from it.
- "Tickets": the tracker query for this effort's tickets (`https://github.com/<owner>/<repo>/issues?q=label%3Akipo%3A<n>`).
