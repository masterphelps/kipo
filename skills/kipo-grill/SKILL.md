---
name: kipo-grill
description: KiPo decide conversation for an idea or a small change: an interview that sharpens it and keeps GLOSSARY.md and ADRs current. Loaded by a KiPo seed ("Load the skill `kipo-grill`"), or for a grilling ticket.
---

# KiPo: grill

An idea needs sharpening before it can become a spec, or a small change before it can be built. This conversation interviews the human until it's sharp, and leaves a paper trail.

## How KiPo works now

- An effort's tickets are tiles in two lanes, **Decide** and **Deliver**. KiPo reads the effort's stage (Intake, Decide, Deliver, Done) from its tickets and PRs. Nobody moves it: there are no columns, no Next and no Skip. Never edit the effort's `kipo:` labels or its `kipo:meta` comment.
- Conversations are started by the effort's **conductor** (it dispatches one per open thread and KiPo's page starts it) or by the human from the stations panel (a ticket's row, or a station's own step: Write the spec, Review the PRs, Run /retro). This is one of those conversations; the seed's `Conversation:` line says which. Do this conversation's job, then stop. Work outside it isn't yours: name it as a candidate ticket.
- There are no skill buttons. You choose which of Matt's skills to run, from the list below. The human may also type any `/skill` in the chat: follow it for this effort, record it, then carry on.

## Ground rules

- The seed gives the effort (number, title, issue URL), `Conversation:`, `Stage:`, `Start:`, the repo checkout and the state file. Work in that checkout with absolute paths. The authority for everything here is `~/.kiro/crew/apps/kipo/CONTRACT.md` (expand `~` to your home folder).
- **State file**: the path on the seed's `State file:` line, and only that one (conversations run side by side, each with its own). Shape: `{"summary", "blocking", "decisions": [{id, title, options, recommended, answer}], "artifacts": [{label, href}], "skillsUsed": []}`. Create its directory if missing; if it exists, resume from it, and re-read it before every write. Rewrite it whenever a decision is asked or answered, a document is produced, or a skill is loaded. KiPo shows `decisions`, `blocking`, `artifacts` and `skillsUsed` to the human. It is plumbing: never mention it in chat.
- `.kipo/` stays out of commits: if `git status` shows it, add `.kipo/` to `<checkout>/.git/info/exclude`.
- **Decisions are asked in the chat**, in full, for choices only the human can make. Ask every question you have at that point together in one message, numbered, each with its 2-4 short options and your recommendation marked — never a bare "your decisions are waiting". Record each question in the state file's `decisions` as you ask it (stable `id`, `options`, `recommended`) — follow-ups and clarifications too: every question to the human, however small, gets its own `decisions` entry (a new `id`) before it goes to the chat, or KiPo shows no card for it and the human never sees options to click: KiPo renders that record as answerable decision cards in the session's right panel (and counts it in the stations), so the human may answer in the chat or on the cards — card answers arrive as one combined chat message. The human answers in the chat, in any form; put each answer in its decision's `answer` and act on all of them in the same turn. Never use the `ask_question` tool, and never ask something you can decide or look up yourself.
- Facts are your job: read, run and look them up. Decisions are the human's.
- **Load a skill by reading** `<skills>/<name>/SKILL.md`, where `<skills>` is the folder on the seed's `Matt's skills:` line (and any file it links to), never through the Skill tool: most refuse model invocation. When a loaded skill says "call the Skill tool with X", read X's file the same way. Append its name to `skillsUsed` the moment you load it.
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
| You can't go on until something happens | `blocked` | what you wait on, named so its clearing can be seen (the same as `blocking`) |
| Something broke that you can't fix here | `failed` | what broke: the command and its error |

For example, from the hand-over:

```
python3 <kipo>/backend/kipo_cli.py report <owner/repo> <n> --from plan --checkout <checkout> --event asked --text "2 decisions on the spec" --item "held-store: One table or two?" --item "spec-approved: Publish the spec and cut the tickets?"
```

In this conversation: a grilling ticket reports `issue-closed` when you close it; an ADR or glossary PR is `pr-opened`. On a `small` start the build reports like kipo-build.

**Blocked: keep checking yourself.** After a `blocked` report, don't end your turn to wait when you can watch the blocker from here: poll it until it clears, then carry on. Use the Monitor tool, or a short loop, such as `for i in $(seq 30); do [ "$(gh pr view <pr> --json state -q .state)" = MERGED ] && break; sleep 60; done` for a PR, `gh issue view <t> --json state` for an issue, or `git -C <worktree> status --short` and `git log origin/<branch> -1` for a worktree another session is editing. End your turn while waiting only when the blocker needs the human or will take hours, and then report `blocked` naming exactly what clears it: `#<number>` for an issue or PR ("PR #77 merged", "#24 closed"), or the session it waits on ("build-t41 pushes its fix"). KiPo watches for that: when your blocker clears (another session on your ticket reports `finished` or `pr-opened`, or a PR or issue your `blocked` text names is merged or closed), or when you have sat idle 15 minutes with your work unfinished, it sends you `[KiPo] Carry on: <why>. …`. Then re-read your ticket, its PR and comments, and your state file, continue from where you stopped, and report when you finish or block. Two wakes with no answer and KiPo hands you to the human as stuck.

The report doesn't replace asking in the chat and recording the cards (above), and the conductor never answers for the human. Reporting is plumbing: don't mention it in chat. If the command fails, say so in one line and carry on; don't retry in a loop. A seed with no `Report:` line (a conversation started before reporting existed): skip reporting.

## Skills

- **`grill-with-docs`**: the default. The interview, updating `GLOSSARY.md` and writing ADRs as decisions land. If the seed's run line says `grill-me`, run that instead: the same interview with no paper trail.
- **`grilling`** and **`domain-modeling`**: the interview primitive, and the glossary and ADR keeper, as the grill skill directs.
- **`prototype`**: when a question needs a runnable answer, or `handoff` to work it in its own directory.

## Docs

- The glossary is `GLOSSARY.md` at the repo root (not `CONTEXT.md`), per `domain-modeling`'s format. ADRs go in `docs/adr/`. Update them as decisions land, not at the end. Never commit `.kipo/`.

## By start

- **`idea`**: grill until the idea is sharp, then say so in one line. The front half ends with a spec and tickets: the Plan station offers "Write the spec" (and the conductor asks the human), which continues in a hand-over conversation. Report `finished`.
- **`small`**: grill briefly, only what the change needs. When the human says go, build it here with `implement`, test-first (`tdd`), on branch `kipo/<n>`, with one PR to main. If the grilling shows a multi-session build or a hard-to-reverse decision, ask it as a decision `still-small` (options: keep it small, write a spec) before building.
- **A grilling ticket** (the seed has `Ticket:`): grill that question only, post the answer on the ticket, close it, and update the map's Decisions so far. Then stop.

## Documents

- "Glossary": the `GLOSSARY.md` path, when it changed.
- "ADR": each new ADR path.
