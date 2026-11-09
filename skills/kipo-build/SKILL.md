---
name: kipo-build
description: KiPo deliver conversation: builds one ticket (a ticket conversation, with /implement), every ready ticket in one run (/implement-spec), or a ticketless small change or bug, test-first, and opens the PR. Loaded by a KiPo seed ("Load the skill `kipo-build`").
---

# KiPo: build

A Deliver ticket is ready for an agent (AFK), or a small change or bug has no tickets. This conversation turns it into tested commits on a branch with a PR open. Review and merging happen in the review conversation.

## How KiPo works now

- An effort's tickets are tiles in two lanes, **Decide** and **Deliver**. KiPo reads the effort's stage (Intake, Decide, Deliver, Done) from its tickets and PRs. Nobody moves it: there are no columns, no Next and no Skip. Never edit the effort's `kipo:` labels or its `kipo:meta` comment.
- The human starts conversations from the tiles and from KiPo's **Next** line (start a ticket, start agents, write the spec, review the PRs, run /retro). This is one of those conversations; the seed's `Conversation:` line says which. Do this conversation's job, then stop. Work outside it isn't yours: name it as a candidate ticket.
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
- **When this conversation's job is done**, say so in one line, set `summary`, and stop. Keep `blocking` set to what you're waiting on, or null.

## Skills

- **`implement`**: one ticket, or a ticketless change. **`implement-spec`** when the seed's run line says so: every unblocked ticket in one run.
- **`tdd`**: always, for the code: one red-green slice at a time at the seams the spec agreed.
- **`diagnosing-bugs`**: something broken that resists a first look. No theory before a command that goes red on this bug.
- **`wizard`**: a step only the human can take (credentials, CI secrets, a third-party dashboard, a cutover). Never for a step you can do yourself.

## Conversations

- **A ticket** (the seed has `Ticket:`): build exactly that ticket. Claim it (`gh issue edit <t> --add-assignee @me`). Work on branch `kipo/<n>-t<t>` in its own worktree (`git -C <checkout> worktree add <checkout>-kipo<n>-t<t> -b kipo/<n>-t<t> origin/main`; without `-b` if the branch exists). If `Blocked by:` lists an open blocker whose PR is unmerged, branch from that blocker's branch and say so in the PR body. Open a PR to main whose body says "Closes #<t>" and "Part of #<n>".
- **Every ready ticket** (the run line is `implement-spec`): across the unblocked tickets labelled `kipo:<n>`, on one integration branch `kipo/<n>`, with one PR to main closing each ticket it delivers ("Closes #<t>" per ticket).
- **No tickets** (`small` or `bug` starts): build here on branch `kipo/<n>`, then one PR to main.
- Never a closing keyword aimed at the effort issue `#<n>`. Leave worktrees in place; the retro conversation removes them.
- Other build conversations run in parallel: touch only your own ticket's branch and worktree.

## By start

- **`bug`**: start with `diagnosing-bugs`. Its red command becomes the regression test; the fix turns it green.
- **`issue`**: the triaged source issue's agent brief is the spec; treat it as the ticket ("Closes #<source>").
- **`idea`** / **`huge`**: the tickets come from the hand-over's "Tickets".

## Done when

The acceptance criteria are built test-first, the full suite passes (say the command and result), and the PR is open. Say so in one line with the PR link.

## Documents

- "PR": each pull request URL (label it "PR #<t>" in a ticket conversation).
- "Regression test": the test's path, on `bug` starts.
