---
name: kipo-review
description: KiPo Review column. Loaded by a KiPo column session seed ("Load the skill `kipo-review`"); reviews the effort's open PRs against the spec or ticket with /code-review, fixes what it finds, shapes PR bodies with /pr, then merges each PR once it's clean and green.
---

# Column 6 of 7: Review

A PR is open. Review makes each PR worth merging (reviewed against what was asked, findings fixed, body clear) and then merges it. Merging is Review's last step; Done starts after it.

## Ground rules

- The seed gives the effort (number, title, issue URL), `Column:`, `Start:`, the repo checkout and the state file. Work in that checkout with absolute paths. The authority for everything here is `/Users/masterphelps/repos/kipo/CONTRACT.md`.
- **State file** (`<checkout>/.kipo/<n>/state.json`): `{"phase": "<column id>", "summary", "blocking", "decisions": [{id, title, options, recommended, answer}], "gate": [{id, label, done}], "artifacts": [{label, href}], "skillsUsed": []}`. Create its directory if missing; if it already holds this column, resume from it. Rewrite it on every decision asked or answered, gate item done, artifact produced and skill loaded. It is plumbing: never mention it in chat.
- `.kipo/` stays out of commits: if `git status` shows it, add `.kipo/` to `<checkout>/.git/info/exclude`.
- **Decisions are cards.** Write the `decisions` entry first (stable `id`, 2-4 short `options`, your `recommended`), then ask in one line pointing at it; 1-3 at a time. The answer arrives as `<decision title>: <answer>`; put it in `answer`. Never use the `ask_question` tool.
- Facts are your job: read, run and look them up. Decisions are the human's.
- **Load a skill by reading** `/Users/masterphelps/.agents/skills/<name>/SKILL.md` (and any file it links to), never through the Skill tool: most refuse model invocation. When a loaded skill says "call the Skill tool with X", read X's file the same way.
- **Record every skill** (button, chip or session control) by appending its name to `skillsUsed` the moment you load it.
- The tracker is this repo's GitHub Issues, through `gh`. If a skill finds no tracker config (`docs/agents/issue-tracker.md`), tell the human to run `setup-matt-pocock-skills` (Intake's first button).
- Session controls (`handoff`, `wait-what`, `teach`, `writing-for-agents`) can arrive in any column as "Run /<skill>: …": follow and record them, then resume.
- Never edit the effort's `kipo:` labels or its `kipo:meta` comment: the backend owns them. The human moves on by clicking Next (or Skip). When every gate item is done, say so in one line and stop.

## Buttons

None. Review's skills are chips: run them yourself.

## Chips

- **`code-review`**: on every open PR of this effort, as soon as the column starts. The fixed point is the merge-base with main; the Spec axis reads the spec issue (artifact "Spec"), or for a ticket PR that ticket, or for `issue` starts the source issue's agent brief, or for `small` efforts the Destination and the grilling's decisions.
- **`pr`**: whenever you write or rewrite a PR body. Keep "Closes #<t>" lines intact and never add one aimed at the effort issue.

## Steps

1. List the effort's PRs: `gh pr list --state open --search "kipo/<n>"`, plus PRs closing its tickets (the detail's `prs`).
2. For each open PR: run `code-review`. Fix every finding on the PR's own branch, in its worktree, test-first where it's behaviour. Re-run the suite; push as its own command.
3. Rewrite the body with `pr` (`gh pr edit <pr> --body-file <file>`), and mark a draft ready (`gh pr ready <pr>`).
4. Post the review result as one PR comment: what each axis found and what was fixed.
5. **Merge it.** A PR is ready when every finding is fixed or answered, its checks are green (`gh pr checks <pr> --watch`), and nothing in the "Before merging" list below applies. Then:
   - Say "Merging #<pr>." in one line, and merge with the repo's allowed method, squash first: `gh pr merge <pr> --squash` (fall back to `--merge` or `--rebase` only if squash is refused). Never pass `--delete-branch` and never chain anything onto the merge: Done deletes branches.
   - Confirm it landed: `gh pr view <pr> --json state -q .state` must print `MERGED`. If it doesn't, say why in one line and stop on that PR.
   - Its "Closes #<t>" lines close the tickets. Say which tickets closed and what that unblocked.
6. When every PR is merged, say so in one line: the human clicks Next to move to Done.

**Before merging, ask instead.** Write a decision card (options "Merge now", "Hold") and wait when:
- the PR needs something only the human can do first: a migration or config change on a live environment, a secret, a deploy order, a feature flag;
- a review finding is a judgement call you didn't fix (scope, product behaviour, an API change other code depends on);
- checks are red or missing and the cause isn't in this PR.
Put the reason in `blocking`. On "Merge now", run step 5. On "Hold", leave it open and say what would unblock it.

Never close a PR, never force-push to main, and never merge a PR that doesn't belong to this effort.

## Path

Read `Start:` and the `Column:` line. Every path passes through Review. On `bug` efforts, check the PR includes the regression test that went red before the fix.

## Gate

Write none: Review's gate is computed from the PRs. Keep `summary` and `blocking` current (for example "PR #12 holds until migration 013 runs on Production").

## Exit artifacts

- "Review": each review comment's URL.
