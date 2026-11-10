---
name: kipo-done
description: KiPo retro conversation: runs /retro on the effort's merged work and turns its lessons into checks, standards and agent instruction files, then cleans up worktrees and branches. Loaded by a KiPo seed ("Load the skill `kipo-done`") when the human chooses "Run /retro".
---

# KiPo: retro

Work has merged. `/retro` turns what happened into checks, standards and agent instruction files, so the next run starts from a better place. Matt retros each run, not only the whole effort.

## How KiPo works now

- An effort's tickets are tiles in two lanes, **Decide** and **Deliver**. KiPo reads the effort's stage (Intake, Decide, Deliver, Done) from its tickets and PRs. Nobody moves it: there are no columns, no Next and no Skip. Never edit the effort's `kipo:` labels or its `kipo:meta` comment.
- Conversations are started by the effort's **conductor** (it dispatches one per open thread and KiPo's page starts it) or by the human from the stations panel (a ticket's row, or a station's own step: Write the spec, Review the PRs, Run /retro). This is one of those conversations; the seed's `Conversation:` line says which. Do this conversation's job, then stop. Work outside it isn't yours: name it as a candidate ticket.
- There are no skill buttons. You choose which of Matt's skills to run, from the list below. The human may also type any `/skill` in the chat: follow it for this effort, record it, then carry on.

## Ground rules

- The seed gives the effort (number, title, issue URL), `Conversation:`, `Stage:`, `Start:`, the repo checkout and the state file. Work in that checkout with absolute paths. The authority for everything here is `/Users/masterphelps/repos/kipo/CONTRACT.md`.
- **State file**: the path on the seed's `State file:` line, and only that one (conversations run side by side, each with its own). Shape: `{"summary", "blocking", "decisions": [{id, title, options, recommended, answer}], "artifacts": [{label, href}], "skillsUsed": []}`. Create its directory if missing; if it exists, resume from it, and re-read it before every write. Rewrite it whenever a decision is asked or answered, a document is produced, or a skill is loaded. KiPo shows `decisions`, `blocking`, `artifacts` and `skillsUsed` to the human. It is plumbing: never mention it in chat.
- `.kipo/` stays out of commits: if `git status` shows it, add `.kipo/` to `<checkout>/.git/info/exclude`.
- **Decisions are asked in the chat**, in full, for choices only the human can make. Ask every question you have at that point together in one message, numbered, each with its 2-4 short options and your recommendation marked — never a bare "your decisions are waiting". Record each question in the state file's `decisions` as you ask it (stable `id`, `options`, `recommended`): KiPo renders that record as answerable decision cards in the session's right panel (and counts it in the stations), so the human may answer in the chat or on the cards — card answers arrive as one combined chat message. The human answers in the chat, in any form; put each answer in its decision's `answer` and act on all of them in the same turn. Never use the `ask_question` tool, and never ask something you can decide or look up yourself.
- Facts are your job: read, run and look them up. Decisions are the human's.
- **Load a skill by reading** `/Users/masterphelps/.agents/skills/<name>/SKILL.md` (and any file it links to), never through the Skill tool: most refuse model invocation. When a loaded skill says "call the Skill tool with X", read X's file the same way. Append its name to `skillsUsed` the moment you load it.
- The tracker is this repo's GitHub Issues, through `gh`. If a skill finds no tracker config (`docs/agents/issue-tracker.md`), run `setup-matt-pocock-skills` first.
- `wait-what`, `handoff`, `teach` and `writing-for-agents` fit any conversation: when the human types one, or when the moment calls for it.
- Publish a branch as its own command with a literal branch name; write PR bodies to a file and pass `--body-file`. Never publish to main.
- **When this conversation's job is done**, say so in one line, set `summary`, report `finished` (below), and stop. Keep `blocking` set to what you're waiting on, or null. Report `finished` (or `nothing-to-do`) so KiPo can close you: KiPo closes a conversation once it has reported that, its thread is settled (its ticket closed, its PR merged or with its review, its stage's work done) and none of its cards is unanswered. Without the report it stays open in the sidebar.

## Report to the conductor

The effort's conductor tracks every conversation it dispatched, and knows only what you report. Report with the seed's `Report:` command: it already carries `--from` (this conversation) and `--checkout`; you fill in `--event`, a one-line `--text` of facts, and one `--item` per question, PR or issue. Report each moment as it happens, in the same turn, never saved up for the end:

| When | `--event` | `--text`, `--item` |
|---|---|---|
| You begin this conversation's job (after reading the seed and the state file) | `started` | what you are about to do |
| You ask the human questions (the turn you record their cards) | `asked` | how many; one `--item` per question: `<card id>: <title>` |
| The human answers | `answered` | what was decided; one `--item` per answer: `<card id>: <answer>` |
| You open or merge a PR | `pr-opened`, `pr-merged` | the tickets it closes; `--item` `#<pr> <url>` |
| You create or close an issue | `issue-created`, `issue-closed` | why; `--item` `#<issue> <title>` per issue |
| The job is done | `finished` | the `summary` you set |
| There is nothing for you to do | `nothing-to-do` | why, in one line |
| You can't go on until something happens | `blocked` | what you wait on (the same as `blocking`) |
| Something broke that you can't fix here | `failed` | what broke: the command and its error |

For example, from the hand-over:

```
python3 <kipo>/backend/kipo_cli.py report <owner/repo> <n> --from plan --checkout <checkout> --event asked --text "2 decisions on the spec" --item "held-store: One table or two?" --item "spec-approved: Publish the spec and cut the tickets?"
```

In this conversation: `asked` for the retro's candidates, `pr-opened` for the retro PR, and `finished` once the worktrees and branches are cleaned up: that report is what lets the conductor close the effort.

The report doesn't replace asking in the chat and recording the cards (above), and the conductor never answers for the human. Reporting is plumbing: don't mention it in chat. If the command fails, say so in one line and carry on; don't retry in a loop. A seed with no `Report:` line (a conversation started before reporting existed): skip reporting.

## Skills

- **`retro`**: the whole point. Run it straight away.
- **`writing-for-agents`**: before the retro edits `AGENTS.md`, `CLAUDE.md`, a skill, or the coding standards.
- **`improve-codebase-architecture`**: name it as the follow-up when the answer to "what would have prevented this" is "there's no good seam to lock it down".

## Steps

1. Read what happened: the effort issue and its comments, every conversation's state file in `<checkout>/.kipo/<n>/`, the merged PRs and their review comments. KiPo's conversations are named `kipo-<owner>-<repo>-<n>-<key>`; point `retro` at their logs.
2. Run `retro`. Show its candidates in order of severity, and ask about the ones worth building together in one numbered message (options: build it, skip), recording each in the state file's `decisions`.
3. Build the agreed changes: mechanical mistakes become deterministic checks (lint rule, pre-commit hook, CI job); judgement calls become coding standards. Commit them on a branch `kipo/<n>-retro` and open a PR, or file a candidate ticket if it's too big to do here.
4. Clean up: remove this effort's worktrees (`git -C <checkout> worktree remove <path>`) and delete its merged `kipo/<n>*` branches, local and remote.

On `bug` starts, the retro's first question is what would have prevented this bug. The human closes the effort with KiPo's "Close effort"; don't close the issue yourself.

## Documents

- "Retro": the list of what changed, as a comment on the effort issue (its URL).
- "Retro PR": the PR with the checks, standards or instruction changes.
