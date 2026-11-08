---
name: kipo-grill
description: KiPo decide conversation for an idea or a small change: an interview that sharpens it and keeps GLOSSARY.md and ADRs current. Loaded by a KiPo seed ("Load the skill `kipo-grill`"), or for a grilling ticket.
---

# KiPo: grill

An idea needs sharpening before it can become a spec, or a small change before it can be built. This conversation interviews the human until it's sharp, and leaves a paper trail.

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

- **`grill-with-docs`**: the default. The interview, updating `GLOSSARY.md` and writing ADRs as decisions land. If the seed's run line says `grill-me`, run that instead: the same interview with no paper trail.
- **`grilling`** and **`domain-modeling`**: the interview primitive, and the glossary and ADR keeper, as the grill skill directs.
- **`prototype`**: when a question needs a runnable answer, or `handoff` to work it in its own directory.

## Docs

- The glossary is `GLOSSARY.md` at the repo root (not `CONTEXT.md`), per `domain-modeling`'s format. ADRs go in `docs/adr/`. Update them as decisions land, not at the end. Never commit `.kipo/`.

## By start

- **`idea`**: grill until the idea is sharp, then say so in one line. The front half ends with a spec and tickets: KiPo's Next line offers "Write the spec", which continues in a hand-over conversation.
- **`small`**: grill briefly, only what the change needs. When the human says go, build it here with `implement`, test-first (`tdd`), on branch `kipo/<n>`, with one PR to main. If the grilling shows a multi-session build or a hard-to-reverse decision, ask it as a decision `still-small` (options: keep it small, write a spec) before building.
- **A grilling ticket** (the seed has `Ticket:`): grill that question only, post the answer on the ticket, close it, and update the map's Decisions so far. Then stop.

## Documents

- "Glossary": the `GLOSSARY.md` path, when it changed.
- "ADR": each new ADR path.
