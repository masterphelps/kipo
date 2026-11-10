---
name: kipo-shape
description: KiPo decide conversation for a foggy effort: charts a wayfinder map, or resolves one decision ticket from it. Loaded by a KiPo seed ("Load the skill `kipo-shape`"); produces decisions, not deliverables, until the way to a spec is clear.
---

# KiPo: shape (wayfinder)

The effort is too big or too foggy for one session. This conversation either charts its wayfinder map (the effort's own conversation on a `huge` start), or resolves one decision ticket from the map (a ticket conversation: the seed has `Ticket:`). It produces decisions, not deliverables.

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

In this conversation: charting reports `issue-created` for the map and its tickets, and `nothing-to-do` (with why) when there is nothing you can chart yet, so the conductor stops telling the human the fog is open with them. A ticket conversation reports `issue-closed` for its ticket and `issue-created` for each ticket its answer graduates.

The report doesn't replace asking in the chat and recording the cards (above), and the conductor never answers for the human. Reporting is plumbing: don't mention it in chat. If the command fails, say so in one line and carry on; don't retry in a loop. A seed with no `Report:` line (a conversation started before reporting existed): skip reporting.

## Skills

- **`wayfinder`**: the map and its tickets. Read it first, every time.
- **`grilling`** and **`domain-modeling`**: a grilling ticket is worked with them (wayfinder says so).
- **`research`**: a question that needs primary sources read. Delegate it to a background agent; it leaves a cited Markdown file. Keep working while it reads.
- **`prototype`**: a question that needs a runnable answer (a state model, business logic, a UI you have to see). Build it throwaway on a `prototype/<name>` branch off main and link it from the ticket.
- **`to-questionnaire`**: what blocks the decision is in someone else's head.

## Conversations

- **Charting** (no `Ticket:`, on a `huge` start): run `wayfinder` to name the destination (as the effort's `## Destination`), chart the map with what you can ticket now, and sketch the rest into Not yet specified. Record the map as artifact "Wayfinder map" (exactly that label: KiPo reads the map from it). Then stop: charting resolves nothing.
- **A ticket** (the seed has `Ticket:`): claim that one ticket first (assign it), resolve it as its `wayfinder:<type>` label says, post the answer as a comment, close it, and add its line to the map's Decisions so far. Graduate any fog the answer made specifiable into new tickets. Then stop: one ticket per conversation.
- **Record answers before you close.** Write every decision card's final `answer` into the state file *before* closing the ticket on GitHub: the moment the ticket closes, KiPo shows it as done, and a done ticket with unanswered cards reads as the board asking the human questions about finished work.
- **The way is clear** when the map has no open tickets and nothing in scope left in Not yet specified. The frontier then shows the hand-over, the conductor asks the human "Write the spec now?", and the Plan station offers "Write the spec". Say so in one line and report `finished`. If the effort turned out small, say that instead: the human can build it directly.

## Documents

- "Wayfinder map": the map issue URL.
- "Prototype": each `prototype/<name>` branch URL.
- "Research": each research file path.
- "Questionnaire": each questionnaire sent, and its answers when they come back.
