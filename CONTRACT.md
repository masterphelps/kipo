# KiPo contract

The single source of truth for KiPo's skills, backend and page. Change it here first.
KiPo is a fork of Launchpad (`/Users/masterphelps/repos/launchpad`): same layout and
plumbing, different progression. It is a separate app with its own labels, storage
and sidebar folder, so both can work in the same repo without colliding.

## The seven columns

Ids are lowercase, in order: `intake, shape, grill, plan, build, review, done`.

| # | Column | Buttons (skills the human starts) | Chips (skills the agent uses on its own) | An effort is here when |
|---|---|---|---|---|
| 1 | Intake | `setup-matt-pocock-skills`, `ask-matt`, `triage`, `improve-codebase-architecture` | | A raw issue, request or refactor candidate exists that nobody has shaped yet |
| 2 | Shape | `wayfinder`, `to-questionnaire`, `handoff`, `teach` | `research`, `prototype` | There are open questions: a wayfinder map, a prototype branch, a research file, a questionnaire waiting on someone |
| 3 | Grill | `grill-with-docs`, `grill-me`, `wait-what` | `grilling`, `domain-modeling` | An interview is in progress; it updates `GLOSSARY.md` and adds ADRs |
| 4 | Plan | `to-spec`, `to-tickets` | `codebase-design` | A spec issue exists and tickets with blocking links hang off it |
| 5 | Build | `implement`, `implement-spec` | `tdd`, `diagnosing-bugs`, `wizard` | Tickets are being built, or a branch has commits |
| 6 | Review | | `code-review`, `pr` | A PR is open: reviewed, fixed, then merged by the agent (it asks first when a merge needs something only you can do) |
| 7 | Done | `retro` | `writing-for-agents` | It's merged; `/retro` turns lessons into checks, standards and agent instruction files |

27 skills, all installed at `/Users/masterphelps/.agents/skills/<name>/SKILL.md`.

**Session controls** (work in any column, shown in a bar above the chat box):
`handoff`, `wait-what`, `teach`, `writing-for-agents`.

**Starting a skill from a button** sends this message into the column's session:

```
Run /<skill>: read /Users/masterphelps/.agents/skills/<skill>/SKILL.md (and any file it links to) and follow it now, for this effort.
```

Most of these skills refuse model invocation through the Skill tool, so they are always
loaded by reading the file. If the column has no session yet, the backend's seed for the
new session ends with that line.

Each column also has a KiPo column skill, `skills/kipo-<id>/SKILL.md` (name `kipo-<id>`),
that the session seed loads first: it says what the column is for, how to keep the state
file, which button skills fit which situation, and what the checklist is.

## Start points (the start form's "Where does this start?")

| Start | Path | Meaning |
|---|---|---|
| `idea` | grill → plan → build → review → done | A normal idea (default) |
| `small` | grill → build → review → done | A small change: `/implement` in the same session, no Plan |
| `huge` | shape → plan → build → review → done | Too many unknowns: wayfinder, which merges at `/to-spec` |
| `issue` | intake → build → review → done | An incoming issue, triaged to `ready-for-agent` |
| `bug` | build → review → done | A hard bug: start with `/diagnosing-bugs`; `/retro` asks what would have prevented it |

The path is stored in the meta comment (`"start"` and `"path"`). Next moves to the next
column **on the path**; columns off the path are shown but skipped. The human can move an
effort to any later column with "Move to…" (the path is rewritten from there).

## Effort = a GitHub issue in the target repo

Labels (created by the backend when missing):

- `kipo:effort`: marks the issue
- `kipo:col:<id>`: exactly one, the current column
- `kipo:start:<start>`: the start point
- tickets filed by `/to-tickets` for effort `n` carry `kipo:<n>` (the Plan skill adds it)

Issue body: the same format as Launchpad (`## Destination`, `## Original request`,
`## Artifacts`, `## Phase log`, then the one-line meta comment), with the meta comment
named `kipo:meta`:

```
<!-- kipo:meta {"repoPath":"/abs","start":"idea","path":["grill","plan","build","review","done"],"mapIssue":null,"specPath":null,"sourceIssue":null} -->
```

`sourceIssue` is the issue number an `issue` start was opened from (or null).

## State file (written by the agent, read by the backend)

`<repoPath>/.kipo/<n>/state.json`, the same shape as Launchpad's
(`summary`, `blocking`, `decisions`, `gate`, `artifacts`, `skillsUsed`). Archived on Next to
`state.<column>.json`; the detail returns earlier columns' archived states as `history`.
The agent appends every skill it loads (button or chip) to `skillsUsed`.

## Sessions

- One session per column, key `<column>`, name `kipo-<owner>-<repo>-<n>-<column>`.
- **Grill and Plan share one session** (Matt: keep grill → spec → tickets in one unbroken
  context). Plan's key resolves to the Grill session when one exists; the backend returns a
  short "moving to Plan" message to send into it instead of a new seed. On paths without
  Grill, Plan gets its own session.
- Build: one session per ticket for `/implement` (key `build-t<t>`, fresh context per
  ticket), or one `build-spec` session for `/implement-spec` across every unblocked ticket.
  A `small` or `bug` effort with no tickets builds in the column's own `build` session.
- Shape: wayfinder decision tickets keep Launchpad's per-ticket sessions, key `shape-t<t>`.
- All KiPo sessions go in the sidebar folder **KiPo**.

Seed:

```
[KiPo] Effort #<n> "<title>" in <owner>/<repo>
Column: <id> (<k> of <len(path)> on this path: <path joined with " → ">)
Start: <start>
Repo checkout: <repoPath>
Effort issue: <url>
State file: <repoPath>/.kipo/<n>/state.json
Ticket: #<t> "<title>"                 (ticket sessions only)
Blocked by: #a (closed), #b (open)     (ticket sessions with blockers)
Load the skill `kipo-<id>` and follow it. Destination: <destination>
Run /<skill>: …                         (when started from a button)
```

## Backend HTTP API

Same conventions as Launchpad (prefixes `/apps/kipo/api`, `/api/apps/kipo`, `/api`, none;
`{error, code}` errors; GET handlers read the query string). Kept unchanged from Launchpad:
`/health`, `/config`, `/repos/discover`, `POST /repos`, `/repos/remove`, `/browse`, `/sessions`,
`…/remove`, `…/doc?href=`, `…/frontier` (wayfinder map, Shape only).
`/sessions` also returns `byRepo: [{slot, repo}]`, so the UI can file each session in the
sidebar folder `KiPo / <repo name>`.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/initiatives` | | `{"initiatives":[Effort]}` |
| POST | `/initiatives` | `{"path","description","start":"idea\|small\|huge\|issue\|bug","worktree":bool,"sourceIssue":n\|null}` | `Effort`, created in the first column of its path |
| GET | `/initiatives/{o}/{r}/{n}` | | `EffortDetail` |
| POST | `/initiatives/{o}/{r}/{n}/advance` | `{"force":false,"to":"<column>"\|null}` | `EffortDetail`; 409 `gate_not_passed` unless the gate passed or `force`; `to` jumps to a later column (rewrites the path from there); from `done` it closes the issue |
| POST | `/initiatives/{o}/{r}/{n}/session` | `{"column":"<id>","skill":"<name>"\|null,"ticket":n\|null,"mode":"implement-spec"\|null}` | `{"slotName","seed","existing":bool}`; `existing` true means the slot already exists (Grill↔Plan) and `seed` is the message to send into it |
| POST | `/initiatives/{o}/{r}/{n}/skill` | `{"skill":"<name>"}` | `{"message"}`: the "Run /<skill>: …" line, for a session that already exists; 400 `unknown_skill` for a name outside the 27 |

```ts
type Column = 'intake'|'shape'|'grill'|'plan'|'build'|'review'|'done'
type Start = 'idea'|'small'|'huge'|'issue'|'bug'
type Effort = { repo; number; title; url; column: Column; start: Start; path: Column[]; destination; updatedAt;
                ticketCounts: {open:number; closed:number} | null }
type EffortDetail = Effort & {
  repoPath; mapIssue; specPath; artifacts; phaseLog; state; gatePassed; sessions: Record<string,string>;
  history: Partial<Record<Column, PhaseState>>;
  tickets: { number; title; url; state:'OPEN'|'CLOSED'; blockedBy:number[]; sessionKey:string|null; prs:number[] }[];
  prs: { number; title; url; state:'OPEN'|'MERGED'|'CLOSED'; isDraft:boolean; headRefName; tickets:number[] }[];
}
```

`prs` are the repo's PRs (one `gh pr list --state all --limit 100` per detail) that close a
ticket of this effort or the effort itself ("Closes/Fixes/Resolves #x" in the body), or whose
branch starts with `kipo/<n>`. A ticket is blocked while any native `blockedBy` issue is open.

Gates: an agent-written checklist as in Launchpad, except **Review**, which is computed:
passed when the effort has at least one PR and every PR is `MERGED` (or `CLOSED` and the
human skipped it). Build's checklist is the agent's; the page also shows tickets closed.

## Storage

`$KIROCREW_HOME/apps/kipo/data/`: `config.json`, `sessions.json`, as in Launchpad.


## The frontier

Once an effort has tickets it is no longer in one place: its build tickets
(`kipo:<n>`) and its wayfinder map's children each have their own state. The
effort detail returns them as `frontier: {tiles, counts, fog}` (`backend/kipo/frontier.py`).

- **Type** (tile code): `wayfinder:grilling` Gr, `prototype` Pr, `research` Rs,
  `task` Tk; a `kipo:<n>` ticket is `build` Bd; an untyped map child is a grill,
  unless it carries a triage label (`needs-triage`, `ready-for-agent`, …): then
  it's an `issue` Is.
- **Who**: `you` (HITL) or `afk`. Grilling and prototype are HITL, research is
  AFK, build is AFK; task and issue are AFK only with `ready-for-agent`;
  `ready-for-human` makes anything HITL.
- **State**, first match wins: closed `done`; an open PR closes it `review`; an
  open blocker `blocked`; AFK with a session or an assignee `building`; else its
  who (`you` or `afk`). A HITL ticket with a session open is still `you`.
- **Fog**: list items in the map's "Not yet specified" section (prose with no
  list counts as one).
- The map is found from the meta's `mapIssue`, or an artifact labelled
  "Wayfinder map" or "Wayfinder map #<n>".
- `/initiatives` carries each effort's last-seen `frontier: {counts, fog}` (saved
  whenever its detail is read), so the list can draw a bar per effort without
  querying every map.

The UI draws `counts` as one bar (done, review, building, you, afk, blocked,
fog), with the column shown only for efforts that have no tickets yet. "Start N
agents" opens one session per `afk` tile: build tiles as `build-t<t>` sessions
running `implement`, map children as `shape-t<t>` sessions running their
type's skill.
