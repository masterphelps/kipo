---
name: kipo-plan
description: KiPo hand-over conversation: turns the effort's grilling or its wayfinder map into a spec with /to-spec, then into labelled, natively blocked tickets with /to-tickets. Loaded by a KiPo seed ("Load the skill `kipo-plan`") when the human chooses "Write the spec".
---

# KiPo: the hand-over

Decide is done: the idea is sharp, or the map is clear. This conversation writes the spec and cuts it into tracer-bullet tickets, which KiPo then shows in the Deliver lane.

## How KiPo works now

- An effort's tickets are tiles in two lanes, **Decide** and **Deliver**. KiPo reads the effort's stage (Intake, Decide, Deliver, Done) from its tickets and PRs. Nobody moves it: there are no columns, no Next and no Skip. Never edit the effort's `kipo:` labels or its `kipo:meta` comment.
- The human starts conversations from the tiles and from KiPo's **Next** line (start a ticket, start agents, write the spec, review the PRs, run /retro). This is one of those conversations; the seed's `Conversation:` line says which. Do this conversation's job, then stop. Work outside it isn't yours: name it as a candidate ticket.
- There are no skill buttons. You choose which of Matt's skills to run, from the list below. The human may also type any `/skill` in the chat: follow it for this effort, record it, then carry on.

## Ground rules

- The seed gives the effort (number, title, issue URL), `Conversation:`, `Stage:`, `Start:`, the repo checkout and the state file. Work in that checkout with absolute paths. The authority for everything here is `/Users/masterphelps/repos/kipo/CONTRACT.md`.
- **State file**: the path on the seed's `State file:` line, and only that one (conversations run side by side, each with its own). Shape: `{"summary", "blocking", "decisions": [{id, title, options, recommended, answer}], "artifacts": [{label, href}], "skillsUsed": []}`. Create its directory if missing; if it exists, resume from it, and re-read it before every write. Rewrite it whenever a decision is asked or answered, a document is produced, or a skill is loaded. KiPo shows `decisions`, `blocking`, `artifacts` and `skillsUsed` to the human. It is plumbing: never mention it in chat.
- `.kipo/` stays out of commits: if `git status` shows it, add `.kipo/` to `<checkout>/.git/info/exclude`.
- **Decisions are cards** on KiPo's right panel, for choices only the human can make. Write the `decisions` entry first (stable `id`, 2-4 short `options`, your `recommended`), then say in one line that they're waiting. Ask every question you have at that point together, not one at a time. Answers arrive together in one message, one numbered line each: `<n>. <title> (<id>): <answer>`. Put each in its decision's `answer` and act on all of them in the same turn; any listed as still open stay open. Never use the `ask_question` tool, and never make a card for something you can decide or look up yourself.
- Facts are your job: read, run and look them up. Decisions are the human's.
- **Load a skill by reading** `/Users/masterphelps/.agents/skills/<name>/SKILL.md` (and any file it links to), never through the Skill tool: most refuse model invocation. When a loaded skill says "call the Skill tool with X", read X's file the same way. Append its name to `skillsUsed` the moment you load it.
- The tracker is this repo's GitHub Issues, through `gh`. If a skill finds no tracker config (`docs/agents/issue-tracker.md`), run `setup-matt-pocock-skills` first.
- `wait-what`, `handoff`, `teach` and `writing-for-agents` fit any conversation: when the human types one, or when the moment calls for it.
- Publish a branch as its own command with a literal branch name; write PR bodies to a file and pass `--body-file`. Never publish to main.
- **When this conversation's job is done**, say so in one line, set `summary`, and stop. Keep `blocking` set to what you're waiting on, or null.

## Skills

- **`to-spec`**: first, always. No new interview: write it from what's decided.
- **`to-tickets`**: once the human has approved the spec (ask it as a decision `spec-approved` if they haven't said so).
- **`codebase-design`**: when the spec or a ticket has to say where a seam goes or what a module's interface is. Use its words (module, interface, depth, seam, adapter) so `tdd` picks them up.

## Where the decisions are

- **After a grilling** (`idea` start): the grilling's conversation, `GLOSSARY.md` and the ADRs. If this conversation continues the grilling, it's already in context: don't compact or clear before `to-tickets` is done.
- **After a wayfinder map** (`huge` start): read the map (artifact "Wayfinder map", or the effort's `mapIssue`) and its closed tickets, and let `to-spec` collapse them. Link the map from the spec.

## Tickets

- Every ticket gets the label `kipo:<n>` (the effort's number). Create it if missing: `gh label create kipo:<n> --color BFD4F2 --description "KiPo effort #<n>"`, ignoring "already exists".
- Blocking edges are GitHub's native blocking links (per `to-tickets` and `docs/agents/issue-tracker.md`), not "Blocked by" text. Check each with `gh` after publishing.
- Make each ticket a sub-issue of the spec issue where the tracker supports it, and apply `ready-for-agent` as `to-tickets` says: that's what puts a ticket in the Deliver lane, ready for an agent (AFK).
- Never put a closing keyword aimed at the effort issue in a ticket or the spec.

## Documents

- "Spec": the spec issue URL (exactly that label: KiPo reads the spec from it).
- "Tickets": `https://github.com/<owner>/<repo>/issues?q=label%3Akipo%3A<n>`.
