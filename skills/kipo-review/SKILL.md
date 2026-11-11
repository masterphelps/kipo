---
name: kipo-review
description: KiPo review conversation: reviews the effort's open PRs against the spec or ticket with /code-review, fixes what it finds, shapes PR bodies with /pr, then merges each two-way-door PR once it's clean and green and asks on one-way doors (Matt's Merge Danger). Loaded by a KiPo seed ("Load the skill `kipo-review`") when the human chooses "Review the PRs".
---

# KiPo: review and merge

The effort has open PRs. This conversation makes each one worth merging (reviewed against what was asked, findings fixed, body clear) and then merges it. Merging is the last step of Deliver.

## How KiPo works now

- An effort's tickets are tiles in two lanes, **Decide** and **Deliver**. KiPo reads the effort's stage (Intake, Decide, Deliver, Done) from its tickets and PRs. Nobody moves it: there are no columns, no Next and no Skip. Never edit the effort's `kipo:` labels or its `kipo:meta` comment.
- Conversations are started by the effort's **conductor** (it dispatches one per open thread and KiPo's page starts it) or by the human from the stations panel (a ticket's row, or a station's own step: Write the spec, Review the PRs, Run /retro). This is one of those conversations; the seed's `Conversation:` line says which. Do this conversation's job, then stop. Work outside it isn't yours: name it as a candidate ticket.
- There are no skill buttons. You choose which of Matt's skills to run, from the list below. The human may also type any `/skill` in the chat: follow it for this effort, record it, then carry on.

## Ground rules

- The seed gives the effort (number, title, issue URL), `Conversation:`, `Stage:`, `Start:`, the repo checkout and the state file. Work in that checkout with absolute paths. The authority for everything here is `/Users/masterphelps/repos/kipo/CONTRACT.md`.
- **State file**: the path on the seed's `State file:` line, and only that one (conversations run side by side, each with its own). Shape: `{"summary", "blocking", "decisions": [{id, title, options, recommended, answer}], "artifacts": [{label, href}], "skillsUsed": []}`. Create its directory if missing; if it exists, resume from it, and re-read it before every write. Rewrite it whenever a decision is asked or answered, a document is produced, or a skill is loaded. KiPo shows `decisions`, `blocking`, `artifacts` and `skillsUsed` to the human. It is plumbing: never mention it in chat.
- `.kipo/` stays out of commits: if `git status` shows it, add `.kipo/` to `<checkout>/.git/info/exclude`.
- **Decisions are asked in the chat**, in full, for choices only the human can make. Ask every question you have at that point together in one message, numbered, each with its 2-4 short options and your recommendation marked — never a bare "your decisions are waiting". Record each question in the state file's `decisions` as you ask it (stable `id`, `options`, `recommended`) — follow-ups and clarifications too: every question to the human, however small, gets its own `decisions` entry (a new `id`) before it goes to the chat, or KiPo shows no card for it and the human never sees options to click: KiPo renders that record as answerable decision cards in the session's right panel (and counts it in the stations), so the human may answer in the chat or on the cards — card answers arrive as one combined chat message. The human answers in the chat, in any form; put each answer in its decision's `answer` and act on all of them in the same turn. Never use the `ask_question` tool, and never ask something you can decide or look up yourself.
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
| You can't go on until something happens | `blocked` | what you wait on, named so its clearing can be seen (the same as `blocking`) |
| Something broke that you can't fix here | `failed` | what broke: the command and its error |

For example, from the hand-over:

```
python3 <kipo>/backend/kipo_cli.py report <owner/repo> <n> --from plan --checkout <checkout> --event asked --text "2 decisions on the spec" --item "held-store: One table or two?" --item "spec-approved: Publish the spec and cut the tickets?"
```

In this conversation: `pr-merged` per merge, with the tickets it closed; `asked` for every "Merge #<pr>?" card; `finished` when every PR is merged.

**Blocked: keep checking yourself.** After a `blocked` report, don't end your turn to wait when you can watch the blocker from here: poll it until it clears, then carry on. Use the Monitor tool, or a short loop, such as `for i in $(seq 30); do [ "$(gh pr view <pr> --json state -q .state)" = MERGED ] && break; sleep 60; done` for a PR, `gh issue view <t> --json state` for an issue, or `git -C <worktree> status --short` and `git log origin/<branch> -1` for a worktree another session is editing. End your turn while waiting only when the blocker needs the human or will take hours, and then report `blocked` naming exactly what clears it: `#<number>` for an issue or PR ("PR #77 merged", "#24 closed"), or the session it waits on ("build-t41 pushes its fix"). KiPo watches for that: when your blocker clears (another session on your ticket reports `finished` or `pr-opened`, or a PR or issue your `blocked` text names is merged or closed), or when you have sat idle 15 minutes with your work unfinished, it sends you `[KiPo] Carry on: <why>. …`. Then re-read your ticket, its PR and comments, and your state file, continue from where you stopped, and report when you finish or block. Two wakes with no answer and KiPo hands you to the human as stuck.

The report doesn't replace asking in the chat and recording the cards (above), and the conductor never answers for the human. Reporting is plumbing: don't mention it in chat. If the command fails, say so in one line and carry on; don't retry in a loop. A seed with no `Report:` line (a conversation started before reporting existed): skip reporting.

## Skills

- **`code-review`**: on every open PR of this effort, as soon as the conversation starts. The fixed point is the merge-base with main. The Spec axis reads the spec issue (artifact "Spec"); for a ticket's PR, that ticket; on `issue` starts, the source issue's agent brief; on `small` starts, the Destination and the grilling's decisions.
- **`pr`**: whenever you write or rewrite a PR body. Keep "Closes #<t>" lines intact and never add one aimed at the effort issue.

## Steps

A seed with a `Ticket:` line is one ticket's review (dispatched as `--ticket <t> --skill kipo-review`): its `PRs:` line lists that ticket's open PRs, and only those are this conversation's. Skip step 1 and run the rest on them.

1. List the effort's PRs: `gh pr list --state open --search "kipo/<n>"`, plus PRs closing its tickets.
2. For each open PR, run `code-review`. Fix every finding on the PR's own branch, in its worktree, test-first where it's behaviour. Re-run the suite; publish the branch as its own command.
3. Rewrite the body with `pr` (`gh pr edit <pr> --body-file <file>`), and mark a draft ready (`gh pr ready <pr>`).
4. Post the review result as one PR comment: what each axis found and what was fixed.
5. **Read its Merge Danger.** `pr` writes a "Merge Danger" section into every PR body; if the body lacks it, rewrite the body with `pr` first. It answers two questions:
   - **One-way or two-way door?** A two-way door you can walk back through: revert the commit and you're where you started. A one-way door does something out in the world a revert won't undo: a migration that drops or reshapes data, a run against a live environment, emails or webhooks sent, a published package or API other code depends on, a secret or permission change.
   - **Blast radius:** how much goes wrong if it's wrong. One screen, or every consumer of the code.
6. **Merge the two-way doors.** When the door is two-way, the blast radius is small, every finding is fixed or answered, and checks are green (`gh pr checks <pr> --watch`):
   - Say "Merging #<pr>: two-way door, small blast radius." in one line, and merge with the repo's allowed method, squash first: `gh pr merge <pr> --squash` (fall back to `--merge` or `--rebase` only if squash is refused). Never pass `--delete-branch` and never chain anything onto the merge: the retro conversation deletes branches.
   - Confirm it landed: `gh pr view <pr> --json state -q .state` must print `MERGED`. If it doesn't, say why in one line and stop on that PR.
   - Its "Closes #<t>" lines close the tickets. Say which tickets closed and what that unblocked.
7. **Ask on the one-way doors.** A one-way door, a large blast radius, a review finding that's a judgement call you didn't fix, or checks red for a reason outside the PR: write a decision card titled "Merge #<pr>?" (options "Merge now", "Hold") whose recommendation names the door and what has to happen first (for example "run migration 013 on Production, then merge"). Put that in `blocking`. Ask about every such PR together. On "Merge now", run step 6. On "Hold", leave it open and say what would unblock it.
8. When every PR is merged, say so in one line, and suggest `/retro` on this run: Matt retros each run, not only the whole effort.

Never close a PR, never force-publish to main, and never merge a PR that doesn't belong to this effort. On `bug` starts, check the PR includes the regression test that went red before the fix.

## Documents

- "Review": each review comment's URL.
