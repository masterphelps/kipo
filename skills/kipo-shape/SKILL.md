---
name: kipo-shape
description: KiPo Shape column. Loaded by a KiPo column session seed ("Load the skill `kipo-shape`"); works the open questions of a foggy effort (wayfinder map, prototype, research, questionnaire) until the way to a spec is clear.
---

# Column 2 of 7: Shape

There are open questions: a wayfinder map, a prototype branch, a research file, a questionnaire waiting on someone. Shape produces decisions, not deliverables, until nothing is left to decide before a spec.

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
- Never edit the effort's `kipo:` labels or its `kipo:meta` comment: the backend owns them. The human moves on by clicking Next (or Skip). When every gate item is done, say so in one line and stop.
- Shape ticket sessions (`shape-t<t>`) run in parallel and may share the state file: re-read it before every write and change only your own entries.

## Buttons

`wayfinder`, `to-questionnaire`, `handoff`, `teach`. The human may press any of them at any time; it arrives as "Run /<skill>: …". Follow that skill for this effort and record it.

If no button has been pressed yet, recommend one as decision `button` (options: the four buttons) and wait. Choose by:

- **`wayfinder`**: the effort is too big for one session and the way to the destination isn't visible. Never for a well-scoped feature: that belongs in Grill.
- **`to-questionnaire`**: what blocks you is in someone else's head, not yours or the code's. What comes back feeds Grill or `/to-spec`.
- **`handoff`**: a question needs its own directory or a fresh session (a prototype detour, a colleague, another harness). Hand off out, and hand back what was learned.
- **`teach`**: the human must learn a concept before they can decide well.

## Chips

- **`prototype`**: a question needs a runnable answer (a state model, business logic, a UI you have to see). Build it throwaway on a `prototype/<name>` branch off main and link it from the ticket it answers.
- **`research`**: a question needs reading primary sources (docs, APIs, specs). Delegate it to a background agent; it leaves a cited Markdown file in the repo. Keep working while it reads.

## Path

Read `Start:` and the `Column:` line.

- **`huge`** (shape → plan → build → review → done): start with `wayfinder`. Name the destination as the effort's `## Destination`, chart the map, then work the frontier one decision ticket per session.
- **A ticket session** (the seed has `Ticket:`): claim that one decision ticket first (assign it), resolve it per `wayfinder`, record the answer on the ticket and close it, update the map's Decisions-so-far, then stop. Don't take a second ticket in the same session.
- **The hand-off.** Wayfinder hands off, it doesn't build. When the frontier is empty and Not yet specified holds nothing in scope, the way is clear: say the human can click Next to Plan, where `/to-spec` collapses the map into a spec. Go straight to Build only if the effort turned out genuinely small, and then tell the human to use "Move to…".
- On any other path an effort lands here only by "Move to…": ask which open question brought it here before recommending a button.

## Gate

Write these when the column starts:

- `map-charted`: "Wayfinder map issue exists with its destination, recorded as artifact Wayfinder map" (when `wayfinder` runs)
- `ticket-<t>-resolved`: "Decision ticket #<t> answered on the ticket and closed" (one per ticket session)
- `questions-answered`: "Every open question has a recorded answer (map frontier empty, questionnaires back, prototypes and research linked)"
- `way-clear`: "Nothing in scope is left to decide before a spec"

## Exit artifacts

- "Wayfinder map": the map issue URL. Use exactly this label: the backend reads the map from it.
- "Prototype": each `prototype/<name>` branch URL.
- "Research": each research file path.
- "Questionnaire": each questionnaire sent, and its answers when they come back.
- "Handoff": each handoff document path.
