---
name: kipo-done
description: KiPo Done column. Loaded by a KiPo column session seed ("Load the skill `kipo-done`"); runs /retro on the merged effort and turns its lessons into checks, standards and agent instruction files, then cleans up.
---

# Column 7 of 7: Done

It's merged. `/retro` turns the effort's lessons into checks, standards and agent instruction files, so the next effort starts from a better environment.

## Ground rules

- The seed gives the effort (number, title, issue URL), `Column:`, `Start:`, the repo checkout and the state file. Work in that checkout with absolute paths. The authority for everything here is `/Users/masterphelps/repos/kipo/CONTRACT.md`.
- **State file**: the path on the seed's `State file:` line. The effort's own conversation uses `<checkout>/.kipo/<n>/state.json`; a ticket's conversation has its own, such as `<checkout>/.kipo/<n>/build-t22.json` or `shape-t24.json`, so conversations running side by side never overwrite each other. Write only your own. Shape: `{"phase": "<column id>", "summary", "blocking", "decisions": [{id, title, options, recommended, answer}], "gate": [{id, label, done}], "artifacts": [{label, href}], "skillsUsed": []}`. Create its directory if missing; if it already holds this column, resume from it. Rewrite it on every decision asked or answered, gate item done, artifact produced and skill loaded. It is plumbing: never mention it in chat.
- `.kipo/` stays out of commits: if `git status` shows it, add `.kipo/` to `<checkout>/.git/info/exclude`.
- **Decisions are cards.** Write the `decisions` entry first (stable `id`, 2-4 short `options`, your `recommended`), then ask in one line pointing at it; 1-3 at a time. The answer arrives as `<decision title>: <answer>`; put it in `answer`. Never use the `ask_question` tool.
- Facts are your job: read, run and look them up. Decisions are the human's.
- **Load a skill by reading** `/Users/masterphelps/.agents/skills/<name>/SKILL.md` (and any file it links to), never through the Skill tool: most refuse model invocation. When a loaded skill says "call the Skill tool with X", read X's file the same way.
- **Record every skill** (button, chip or session control) by appending its name to `skillsUsed` the moment you load it.
- The tracker is this repo's GitHub Issues, through `gh`. If a skill finds no tracker config (`docs/agents/issue-tracker.md`), tell the human to run `setup-matt-pocock-skills` (Intake's first button).
- Session controls (`handoff`, `wait-what`, `teach`, `writing-for-agents`) can arrive in any column as "Run /<skill>: …": follow and record them, then resume.
- Never edit the effort's `kipo:` labels or its `kipo:meta` comment: the backend owns them. There is no Next: KiPo reads the effort's stage (Intake, Decide, Deliver, Done) from its tickets and PRs. When every gate item is done, say so in one line and stop.

## Buttons

`retro`. The human may press it at any time; it arrives as "Run /retro: …". Follow it for this effort and record it.

If it hasn't been pressed yet, recommend it as decision `button` (options: `retro`, no retro) and wait. Recommend `retro` always; most strongly when the effort went sideways (an approach thrown away, repeated red runs, a surprise in the code) or was a bug.

## Chips

- **`writing-for-agents`**: whenever the retro edits `AGENTS.md`, `CLAUDE.md`, a skill, or the coding standards. Load it before writing.

## Steps

1. Read what happened: the effort issue (`## Phase log`), the archived states `<checkout>/.kipo/<n>/state.<column>.json`, the merged PRs and their review comments. The earlier columns' sessions are named `kipo-<owner>-<repo>-<n>-<column>`; point `retro` at their logs.
2. Run `retro`. Show its candidates in order of severity; each one the human wants built is a decision card (options: build it, skip).
3. Build the agreed changes: mechanical mistakes become deterministic checks (lint rule, pre-commit hook, CI job); judgement calls become coding standards. Commit them on a branch `kipo/<n>-retro` and open a PR, or a candidate ticket if it is too big to do here.
4. Clean up: remove this effort's worktrees (`git -C <checkout> worktree remove <path>`) and delete its merged `kipo/<n>*` branches, local and remote.

## Path

Read `Start:` and the `Column:` line.

- **`bug`**: the retro's first question is what would have prevented this bug. Where the answer is "there's no good seam to lock it down", name `improve-codebase-architecture` as the follow-up.
- **Every path**: the human's "Close effort" button closes the effort issue; don't close it yourself.

## Gate

Write these when the column starts:

- `retro-run`: "Retro run on the effort and its candidates shown to the human"
- `changes-landed`: "Each agreed change is committed with a PR open, or filed as a ticket (or the human agreed none)"
- `cleaned-up`: "Effort's worktrees removed and merged kipo/<n> branches deleted"

## Exit artifacts

- "Retro": the list of what changed, as a comment on the effort issue (its URL).
- "Retro PR": the PR with the checks, standards or instruction changes.
