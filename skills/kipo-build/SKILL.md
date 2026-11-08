---
name: kipo-build
description: KiPo Build column. Loaded by a KiPo build session seed ("Load the skill `kipo-build`"); builds one ticket with /implement, every unblocked ticket with /implement-spec, or a ticketless small or bug effort, test-first, and opens the PR.
---

# Column 5 of 7: Build

Tickets are being built, or a branch has commits. Build turns tickets (or a small change, or a diagnosed bug) into tested commits on a branch with a PR open.

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
- Build sessions run in parallel and may share the state file: re-read it before every write and change only your own entries.
- Push as its own command with a literal branch (`git -C <worktree> push -u origin <branch>`); write PR bodies to a file and pass `--body-file`. Never push to main.

## Buttons

`implement`, `implement-spec`. The human may press either at any time; it arrives as "Run /<skill>: …". Follow that skill for this effort and record it.

If no button has been pressed yet, recommend one as decision `button` (options: the two buttons) and wait. Choose by:

- **`implement`**: one ticket per session with fresh context (a ticket session), or a ticketless effort built right here. The human drives each ticket.
- **`implement-spec`**: the whole spec in one run across the ready frontier, landing on one integration branch. When the human would rather orchestrate than drive each ticket.

## Chips

- **`tdd`**: always, for the code: one red-green slice at a time at the seams the spec agreed. `implement` pulls it in.
- **`diagnosing-bugs`**: something broken that resists a first glance. No theory before a command that goes red on this bug.
- **`wizard`**: a step only the human can take (credentials, CI secrets, a third-party dashboard, a cutover). Not for steps you can do yourself.

## Sessions

- **Ticket session** (the seed has `Ticket:`): `/implement` exactly that ticket, test-first. Claim it (`gh issue edit <t> --add-assignee @me`). Work on branch `kipo/<n>-t<t>` in its own worktree (`git -C <checkout> worktree add <checkout>-kipo<n>-t<t> -b kipo/<n>-t<t> origin/main`; without `-b` if the branch exists). If `Blocked by:` lists an open blocker whose PR is unmerged, branch from that blocker's branch and say so in the PR body. Open a PR to main whose body says "Closes #<t>" and "Part of #<n>".
- **Build-spec session** (the seed's mode is implement-spec): `/implement-spec` across the unblocked tickets labelled `kipo:<n>`, on one integration branch `kipo/<n>`, with one PR to main whose body closes each ticket it delivers ("Closes #<t>" per ticket).
- **Ticketless** (`small` or `bug`, no tickets): build in this session on branch `kipo/<n>`, then one PR to main.
- Work outside the ticket isn't this session's: name it as a candidate ticket.
- Never a closing keyword aimed at the effort issue `#<n>`. Leave worktrees in place; Done removes them.

## Path

Read `Start:` and the `Column:` line.

- **`small`**: this is the Grill session, continued, or a fresh `build` session. `/implement` the agreed change here.
- **`bug`** (build → review → done): start with `diagnosing-bugs`. Its red command becomes the regression test; the fix turns it green.
- **`issue`**: the triaged source issue's agent brief is the spec; treat the source issue as the ticket ("Closes #<source>").
- **`idea`** / **`huge`**: tickets come from Plan's "Tickets" artifact.

## Gate

Write these when the session starts (suffix ids with `-t<t>` in ticket sessions):

- `built`: "Acceptance criteria implemented test-first on the branch"
- `suite-green`: "Full test suite passes on the branch (command and result in summary)"
- `pr-open`: "Branch pushed and PR open to main, recorded as artifact PR"

## Exit artifacts

- "PR": each pull request URL (label it "PR #<t>" in ticket sessions).
- "Regression test": the test's path, for `bug` efforts.
