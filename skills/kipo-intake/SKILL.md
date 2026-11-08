---
name: kipo-intake
description: KiPo Intake column. Loaded by a KiPo column session seed ("Load the skill `kipo-intake`"); shapes a raw issue, request or refactor candidate that nobody has shaped yet, usually by triaging it to ready-for-agent.
---

# Column 1 of 7: Intake

A raw issue, request or refactor candidate exists that nobody has shaped yet. Intake turns it into something a later column can take: an agent-ready issue, or an idea worth grilling.

## Ground rules

- The seed gives the effort (number, title, issue URL), `Column:`, `Start:`, the repo checkout and the state file. Work in that checkout with absolute paths. The authority for everything here is `/Users/masterphelps/repos/kipo/CONTRACT.md`.
- **State file** (`<checkout>/.kipo/<n>/state.json`): `{"phase": "<column id>", "summary", "blocking", "decisions": [{id, title, options, recommended, answer}], "gate": [{id, label, done}], "artifacts": [{label, href}], "skillsUsed": []}`. Create its directory if missing; if it already holds this column, resume from it. Rewrite it on every decision asked or answered, gate item done, artifact produced and skill loaded. It is plumbing: never mention it in chat.
- `.kipo/` stays out of commits: if `git status` shows it, add `.kipo/` to `<checkout>/.git/info/exclude`.
- **Decisions are cards.** Write the `decisions` entry first (stable `id`, 2-4 short `options`, your `recommended`), then ask in one line pointing at it; 1-3 at a time. The answer arrives as `<decision title>: <answer>`; put it in `answer`. Never use the `ask_question` tool.
- Facts are your job: read, run and look them up. Decisions are the human's.
- **Load a skill by reading** `/Users/masterphelps/.agents/skills/<name>/SKILL.md` (and any file it links to), never through the Skill tool: most refuse model invocation. When a loaded skill says "call the Skill tool with X", read X's file the same way.
- **Record every skill** (button, chip or session control) by appending its name to `skillsUsed` the moment you load it.
- The tracker is this repo's GitHub Issues, through `gh`. If a skill finds no tracker config (`docs/agents/issue-tracker.md`), tell the human to run `setup-matt-pocock-skills` (Intake's first button).
- Session controls (`handoff`, `wait-what`, `teach`, `writing-for-agents`) can arrive in any column as "Run /<skill>: …": follow and record them, then resume.
- Never edit the effort's `kipo:` labels or its `kipo:meta` comment: the backend owns them. There is no Next: KiPo reads the effort's stage (Intake, Decide, Deliver, Done) from its tickets and PRs. When every gate item is done, say so in one line and stop.

## Buttons

`setup-matt-pocock-skills`, `ask-matt`, `triage`, `improve-codebase-architecture`. The human may press any of them at any time; it arrives as "Run /<skill>: …". Follow that skill for this effort and record it.

If no button has been pressed yet, read the effort (`gh issue view <url> --comments`) and the source issue (the `sourceIssue` in its `kipo:meta` comment), then recommend one as decision `button` (options: the four buttons) and wait. Choose by:

- **`setup-matt-pocock-skills`**: the repo has no `docs/agents/issue-tracker.md` or triage labels yet. Every other engineering skill assumes them, so this comes first.
- **`triage`**: an issue someone else filed (bug report, incoming request). Not for tickets `/to-tickets` produced: they are agent-ready already.
- **`improve-codebase-architecture`**: the request is upkeep, "make this area better", not a feature. Its output is a picked deepening opportunity, i.e. an idea for Grill.
- **`ask-matt`**: none of these clearly fits, or the human wants to know which flow suits the effort.

## Chips

None. Intake's skills are all the human's to start.

## Path

Read `Start:` and the `Column:` line. Intake is the first column only on the `issue` path (intake → build → review → done):

- **`issue`**: recommend `triage` on the source issue. Its goal is `ready-for-agent` with an agent brief comment, because the next column is Build. If triage lands elsewhere (`needs-info`, `ready-for-human`, `wontfix`), say so in `blocking`: the effort can't go to Build yet, and the human may Skip, wait, or close it.
- If `improve-codebase-architecture` produces a candidate the human picks, it is an idea, not a ticket: tell the human to use "Move to…" Grill, so `/grill-with-docs` sharpens it.

## Gate

Write these when the column starts:

- `tracker-ready`: "Repo has `docs/agents/issue-tracker.md` and the triage labels"
- `triaged`: "Source issue triaged to ready-for-agent with an agent brief comment" (on `issue` starts, or when `triage` runs)
- `candidate-picked`: "Deepening opportunity picked and posted as a comment on the effort issue" (only when `improve-codebase-architecture` runs; replaces `triaged`)

## Exit artifacts

- "Source issue": the triaged issue URL.
- "Architecture report": the HTML report path, when `improve-codebase-architecture` ran.
