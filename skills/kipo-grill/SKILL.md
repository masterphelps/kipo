---
name: kipo-grill
description: KiPo Grill column. Loaded by a KiPo column session seed ("Load the skill `kipo-grill`"); sharpens the effort by interview, keeping GLOSSARY.md and ADRs current, and stops when the idea is sharp (Plan continues in the same session).
---

# Column 3 of 7: Grill

An interview is in progress; it updates `GLOSSARY.md` and adds ADRs. Grill makes the idea sharp enough that a spec writes itself.

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

`grill-with-docs`, `grill-me`, `wait-what`. The human may press any of them at any time; it arrives as "Run /<skill>: …". Follow that skill for this effort and record it.

If no button has been pressed yet, recommend one as decision `button` (options: the three buttons) and wait. Choose by:

- **`grill-with-docs`**: the default whenever there is a repo checkout, which in KiPo is always. It runs the interview and leaves a paper trail in `GLOSSARY.md` and ADRs.
- **`grill-me`**: the same interview, stateless. Only when the human wants to sharpen something with no paper trail (a piece of writing, a plan outside this repo).
- **`wait-what`**: your last message didn't land. Re-pitch it plainly in the glossary's words, then carry on with the interview.

## Chips

- **`grilling`**: the interview primitive under both grill buttons. Load it when a grill button tells you to, or when a question mid-column needs grilling with no wrapper.
- **`domain-modeling`**: when a term is fuzzy or overloaded, or a decision is hard to reverse. It keeps `GLOSSARY.md` clean and writes the ADR.

## Docs

- Keep the glossary in `GLOSSARY.md` at the repo root (not `CONTEXT.md`), per `domain-modeling`'s GLOSSARY-FORMAT. ADRs go in `docs/adr/`.
- Update them as decisions land, not at the end. Commit them on the effort's branch or main as the repo's flow expects; never commit `.kipo/`.

## Path

Read `Start:` and the `Column:` line.

- **`idea`** (grill → plan → build → review → done): grill until the idea is sharp, then stop. Grill and Plan share this session, so say in one line that `/to-spec` then `/to-tickets` (the Decide skills on the right) continue in this same conversation and end the front half. Don't compact or clear.
- **`small`** (grill → build → review → done): grill briefly, only what the change needs. Then, when the human says go (or presses `/implement`), build it here with `/implement`: there is no spec or tickets, and this effort's own PR on `kipo/<n>` is its Deliver half. If the grilling shows a multi-session build or a hard-to-reverse decision, say so as decision `still-small` (options: keep small, move to Plan) before building.
- If a question needs a runnable answer, recommend a prototype (the Decide stage's `prototype`, or a wayfinder prototype ticket), or hand off with `handoff`.

## Gate

Write these when the column starts:

- `idea-sharp`: "Every open question answered; the human agrees the idea is sharp"
- `glossary-current`: "New or changed domain terms are in GLOSSARY.md"
- `adrs-written`: "Each hard-to-reverse decision has an ADR in docs/adr/ (or none was needed, said in summary)"

## Exit artifacts

- "Glossary": the `GLOSSARY.md` path, when it changed.
- "ADR": each new ADR path.
