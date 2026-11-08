---
name: kipo-intake
description: KiPo intake conversation: an effort's own conversation while it is still raw (an incoming issue, a request, a refactor candidate). Loaded by a KiPo seed ("Load the skill `kipo-intake`"); gets the repo ready, triages the source issue, and says where the effort starts.
---

# KiPo: intake

An effort has just been opened from something nobody has shaped yet. This conversation gets it to where KiPo can show tickets: an agent-ready issue, an idea worth grilling, or a foggy effort worth a wayfinder map.

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

- **`setup-matt-pocock-skills`**: first, when the repo has no `docs/agents/issue-tracker.md` or triage labels. Every other engineering skill assumes them.
- **`triage`**: an issue someone else filed (a bug report, an incoming request). Its goal is `ready-for-agent` with an agent brief comment. Not for tickets `/to-tickets` produced: those are agent-ready already.
- **`improve-codebase-architecture`**: the request is upkeep ("make this area better"), not a feature. Its output is a picked deepening opportunity: an idea to grill, not a ticket.
- **`ask-matt`**: when it isn't clear which flow fits.

## What to do

1. Read the effort (`gh issue view <url> --comments`) and its source issue (the `sourceIssue` in the `kipo:meta` comment).
2. Run the skill that fits, without asking which: set up the tracker if missing, then triage the source issue (on `issue` starts), or run `improve-codebase-architecture` (upkeep requests).
3. Say where the effort stands in one line:
   - triaged `ready-for-agent`: it's a Deliver ticket now; KiPo shows it as ready for an agent (AFK).
   - `needs-info`, `ready-for-human` or `wontfix`: put that in `blocking` and say what would unblock it.
   - an idea came out (a picked candidate, or a request too fuzzy to build): say it needs grilling, and that the human can start that from the effort.

## Documents

- "Source issue": the triaged issue URL.
- "Architecture report": the report path, when `improve-codebase-architecture` ran.
