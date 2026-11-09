# KiPo contract

The single source of truth for KiPo's skills, backend and page. Change it here first.
KiPo is a fork of Launchpad (`/Users/masterphelps/repos/launchpad`): same plumbing, its own
labels, storage and sidebar folder, so both can work in the same repo without colliding.

## The model in one paragraph

An **effort** is a GitHub issue (or an open wayfinder map) in a repo KiPo watches. Its
**tickets** are tiles in two lanes, **Decide** and **Deliver**, after Matt Pocock's two
halves of the flow (skills v1.3: the front half `/grill-with-docs → /to-spec → /to-tickets`
ends with a spec and tickets; the back half is `/implement-spec … /pr … /retro`). KiPo reads
the effort's **stage** (Intake, Decide, Deliver, Done) from its tickets and PRs: nobody moves
an effort, and there are no columns, no Next and no Skip. The human works through
**conversations**: one for the effort itself and one per ticket, started from the tiles and
from the **Next** line above them.

## Conversations and skills

Each conversation KiPo starts loads one of KiPo's seven skills (`skills/kipo-<name>/SKILL.md`),
which says what that conversation is for and which of Matt's skills it runs. Matt's 27 skills
live at `/Users/masterphelps/.agents/skills/<name>/SKILL.md`; KiPo never edits them.

| KiPo skill | The conversation | Matt's skills it runs |
|---|---|---|
| `kipo-intake` | The effort's own, while it's raw (an `issue` start): get the repo ready, triage, say where it starts | `setup-matt-pocock-skills`, `triage`, `improve-codebase-architecture`, `ask-matt` |
| `kipo-shape` | Charting a wayfinder map (a `huge` start), or one Decide ticket from it | `wayfinder`, `grilling`, `domain-modeling`, `research`, `prototype`, `to-questionnaire` |
| `kipo-grill` | The effort's own on an `idea` or `small` start, or a grilling ticket: the interview | `grill-with-docs` (or `grill-me`), `grilling`, `domain-modeling`, `prototype` |
| `kipo-plan` | The hand-over ("Write the spec"): spec, then tickets | `to-spec`, `to-tickets`, `codebase-design` |
| `kipo-build` | One Deliver ticket, every ready ticket at once, or a ticketless change | `implement`, `implement-spec`, `tdd`, `diagnosing-bugs`, `wizard` |
| `kipo-review` | "Review the PRs": review, fix, then merge by Merge Danger | `code-review`, `pr` |
| `kipo-done` | "Run /retro": the retro and the clean-up | `retro`, `writing-for-agents`, `improve-codebase-architecture` |

`wait-what`, `handoff`, `teach` and `writing-for-agents` fit any conversation. The agent
chooses which of Matt's skills to run; there are no skill buttons. The human may type any
`/skill`, and the chat box offers `/wait-what` (a reaction to the last message). Skills are
loaded by reading the file (most refuse the Skill tool). When KiPo starts a conversation for a
particular skill, the seed ends with:

```
Run /<skill>: read /Users/masterphelps/.agents/skills/<skill>/SKILL.md (and any file it links to) and follow it now, for this effort.
```

## Start points (the start form's "Where does this start?")

| Start | Where it begins | Meaning |
|---|---|---|
| `idea` | a grilling (the effort's own conversation) | A normal idea (default) |
| `small` | a short grilling, then a build in the same conversation | No spec or tickets |
| `huge` | a wayfinder map | Too many unknowns: the map's tickets are the Decide lane |
| `issue` | intake: triage the source issue | The source issue becomes a tile (Deliver once `ready-for-agent`) |
| `bug` | a build that starts with `/diagnosing-bugs` | The retro asks what would have prevented it |

## Effort = a GitHub issue in the target repo

Labels (created by the backend when missing):

- `kipo:effort`: marks the issue
- `kipo:start:<start>`: the start point
- `kipo:col:<id>`: legacy. Read only to pick the effort's own conversation's skill and as
  the stage before an effort has tickets; nothing moves it any more (except "Close effort")
- tickets filed by `/to-tickets` for effort `n` carry `kipo:<n>`

Issue body: `## Destination`, `## Original request`, `## Artifacts`, `## Phase log`, then
the one-line meta comment:

```
<!-- kipo:meta {"repoPath":"/abs","start":"idea","path":["grill","plan","build","review","done"],"mapIssue":null,"specPath":null,"sourceIssue":null} -->
```

`sourceIssue` is the issue an `issue` start was opened from. Agents never edit the labels or
the meta comment.

**A wayfinder map is an effort too.** On the Repos page, an open `wayfinder:map` issue in a
watched repo can be put on the sidebar as it stands: its Destination is the map's own, its
tickets are the map's children, and KiPo never writes to it. A map an effort already points at
shows only as that effort.

## The frontier

The effort detail returns `frontier: {tiles, counts, lanes, fog, stage, active, handover, landed}`
(`backend/kipo/frontier.py`).

- **Tiles**: the effort's `kipo:<n>` tickets, its wayfinder map's children, and an `issue`
  start's source issue. The map is found from the meta's `mapIssue`, or an artifact labelled
  "Wayfinder map" or "Wayfinder map #<n>".
- **Type** (tile code): `wayfinder:grilling` Gr, `prototype` Pr, `research` Rs, `task` Tk; a
  `kipo:<n>` ticket is `build` Bd; an untyped map child is a grill unless it carries a triage
  label, then it's an `issue` Is.
- **Who**: `you` (HITL) or `afk`. Grilling and prototype are HITL; research and build are AFK;
  task and issue are AFK only with `ready-for-agent`; `ready-for-human` makes anything HITL.
- **State**, first match wins: closed `done`; an open PR closes it `review`; an open blocker
  `blocked`; AFK with a session or an assignee `building`; else its who (`you` or `afk`).
- **Lane**: `deliver` when it ends in a PR (a build ticket, anything with a PR, or a task/issue
  labelled `ready-for-agent`); else `decide`. Deliver tiles get `build-t<t>` conversations
  running `implement`; Decide tiles get `shape-t<t>` conversations running their type's skill.
- **Fog**: list items in the map's "Not yet specified" section.
- **Stage**: `done` if the legacy label is `done`; with no tiles and no PRs, the label's stage;
  else the earliest half with open work; `done` once everything is merged or closed. `active`
  says which halves have open work: both can be on.
- **`handover`**: Decide tiles exist, all closed, no fog, no Deliver tiles yet.
- **`landed`**: everything delivered is merged or closed.

## What the page shows

- **Left**: the efforts on the sidebar, each row an effort's header line: its name, its seven
  stations as a tiny segment row (from the saved `stations` summary), and its **front** (the
  furthest station with open work) with what's open (HITL, in agents, fog). A row's ⋯ menu
  (or right-click) opens it on GitHub, removes it from the sidebar (nothing changes on
  GitHub), or — efforts only, behind a confirm — closes its issue as not planned. **Repos**
  shows each watched repo as a tree of its efforts and open maps; a green dot means it's on
  the sidebar, and clicking the dot adds or removes it. Repos are added there.
- **One main view**, by what's open (there are no tabs):
  - **The conductor screen** (the effort's own conversation): the conductor's chat in the
    middle (Kiro's own chat page, embedded through `/popout/chat?sid=`, so its side panel —
    subagents, browser, terminal, changes — works), and on the right the **stations panel**:
    the effort as the seven KiPo skills, each a counter **in its own units** (Grill counts
    questions, Plan is the `1 spec → N tickets` fan-out, Build counts tickets, Review counts
    PRs, Done is merged-of-total plus whether /retro ran), each with a bar normalized to its
    own station. The header names the **front** and the **tail** (the earliest station still
    waiting on a human): an effort has both, never one stage. A station expands to its queue;
    a queue row opens that ticket's session; stations carry their own next step (Write the
    spec, Review the PRs, Run /retro, Close effort behind a confirm). Stations before the
    entry point read "entered at <station>". Autopilot lives in the panel header.
  - **A ticket's session**: its map ("Where it sits": the whole chain, blockers in a top row
    with arrows down) over its conversation in the middle, and on the right the **session
    panel**: the conversation's open decision cards (each question's options as radios plus a
    free-text answer, answered together and sent as one message, "Take all recommendations"),
    what it's waiting on, what's been decided, and the ticket itself (state, PRs, what it
    asks, how it ended). Questions and interviews still happen in the chat in full; the cards
    are the same questions, answerable without typing. The conductor screen shows the
    conductor's own open cards the same way, above the stations.
- **Autopilot** (per effort, in the browser, while the page is open): each Deliver tile that
  becomes `afk` gets an `implement` conversation, once.

## The conductor

One long-lived agent per effort (`agents/kipo-conductor.json`, skill `kipo-conductor`). It is
the effort's own conversation and never does the work itself.

- **Watch**: on every wake it runs `python3 <app>/backend/kipo_cli.py frontier <repo> <n>`,
  which prints the open threads (`kipo/conductor.py`: each with its stage, KiPo skill, owner
  HITL / Agent / Running / Blocked, and next action) from GitHub through KiPo's own frontier
  code. It works from that output only. It wakes when the human writes, and when the page sees
  a ticket's or PR's state change (`[KiPo] Frontier changed: …`, sent only if it's not mid-turn;
  what it last saw is remembered per effort in the browser).
- **Dispatch**: `kipo_cli.py dispatch <repo> <n> --ticket <t> | --stage shape|plan|review|done`
  appends to `dispatch` in its state file (`.kipo/<n>/conductor.json`); the page starts each
  queued session once while it's open (skipping a ticket that's done, blocked or already has
  its conversation, and a stage conversation that exists).
- **Ask you**: every HITL thread as one batch of decision cards in its state file.
- **Merge**: through the kipo-review conversation it dispatches (Merge Danger).
- **Close**: dispatches kipo-done when the retro is the only thread, then closes the effort issue.

## Conversations, keys and seeds

| Conversation | Key | Skill | State file |
|---|---|---|---|
| The effort's own: the conductor | `conductor` (agent `kipo-conductor`) | `kipo-conductor` | `.kipo/<n>/conductor.json` |
| An earlier effort conversation | its legacy label (`intake`, `grill`, `shape`, `build`) | `kipo-<label>` | `.kipo/<n>/state.json` |
| A Decide ticket | `shape-t<t>` | `kipo-shape`, plus its type's skill | `.kipo/<n>/shape-t<t>.json` |
| A Deliver ticket | `build-t<t>` | `kipo-build` + `implement` | `.kipo/<n>/build-t<t>.json` |
| Every ready ticket | `build-spec` | `kipo-build` + `implement-spec` | `.kipo/<n>/build-spec.json` |
| The hand-over | `plan` | `kipo-plan` + `to-spec` | `.kipo/<n>/state.json` |
| Review the PRs | `review` | `kipo-review` | `.kipo/<n>/state.json` |
| The retro | `done` | `kipo-done` + `retro` | `.kipo/<n>/state.json` |

Session names are `kipo-<owner>-<repo>-<n>-<key>`, filed in the sidebar folder
`KiPo / <repo name>`. The hand-over continues the grilling's conversation when there is one
(Matt: keep grill → spec → tickets in one context); the backend then returns a short hand-over
message to send into it instead of a new seed. A conversation whose ticket is done is closed.

Seed (the first message):

```
[KiPo] Effort #<n> "<title>" in <owner>/<repo>
Conversation: <the effort's own conversation | ticket #<t>, in the Decide|Deliver lane | the hand-over: … | review and merge … | the retro | build every ready ticket …>
Stage: <Intake|Decide|Deliver|Done>
Start: <start>
Repo checkout: <repoPath>
Effort issue: <url>
State file: <path>
Ticket: #<t> "<title>"                 (ticket conversations only)
Blocked by: #a (closed), #b (open)     (when it has blockers)
Load the skill `kipo-<name>` and follow it. Destination: <destination>
Run /<skill>: …                         (when started for a particular skill)
```

## State file (written by the agent, read by the backend)

One per conversation, at the seed's `State file:` path:
`{summary, blocking, decisions: [{id, title, options, recommended, answer}], artifacts: [{label, href}], skillsUsed}`.
The detail returns the effort's own as `state` and each ticket conversation's as
`sessionStates: {key: state}`, and merges their artifacts into `artifacts`. Decisions whose
id starts `t<N>-` in the effort's file are shown under ticket N's conversation (from
conversations seeded before each had its own file).

The UI shows the open conversation's `skillsUsed` as "Running …". Decisions are asked **in
the chat** in full (numbered, with options and a recommendation) and recorded in the state
file's `decisions` as they are asked: those entries render as the session panel's answerable
decision cards and feed the stations panel's counters (answered · waiting). The human answers
either way — in the chat in any form, or on the cards, which arrive as one combined chat
message. A closed ticket's unanswered entries are settled history, never open questions.

Artifact labels the backend reads: "Wayfinder map", "Spec", "Source issue".

## Backend HTTP API

Prefixes `/apps/kipo/api`, `/api/apps/kipo`, `/api`, none; errors are `{error, code}`; GET
handlers read the query string.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/initiatives` | | `{"initiatives":[Effort]}`: the sidebar (watched repos' efforts and opened maps, minus hidden ones) |
| POST | `/initiatives` | `{"path","description","start","worktree":bool,"sourceIssue":n\|null}` | `Effort` |
| GET | `/initiatives/{o}/{r}/{n}` | | `EffortDetail` |
| POST | `…/{n}/session` | `{"column":"<key base>","skill":"<name>"\|null,"ticket":n\|null,"mode":"implement-spec"\|null}` | `{"slotName","seed","existing":bool}` |
| GET | `…/{n}/tickets/{t}` | | a ticket's card: body and latest comment |
| POST | `…/{n}/hide`, `…/{n}/unhide` | | off and back on the sidebar (local) |
| POST | `…/{n}/remove` | | closes a KiPo effort's issue as not planned; a map is only taken off the sidebar |
| POST | `…/{n}/advance` | `{"force":bool,"to":"done"\|null}` | legacy: "Close effort" moves the label to `done`, then the issue closes; refused for a map |
| GET | `/tree` | | `{repos: [{slug, path, items: [{kind:'effort'\|'map', number, title, url, updatedAt, onSidebar, map}]}], available, searchError?}` |
| POST | `/sidebar` | `{"repo","number","kind":"effort"\|"map","on":bool}` | the green dot |
| GET | `/sessions` | | `{sessions, byRepo: [{slot, repo}]}` |
| | `/health`, `/config`, `/repos/discover`, `POST /repos`, `/repos/remove`, `/browse`, `…/doc?href=`, `…/frontier`, `…/skill` | | as in Launchpad |

## Storage

`$KIROCREW_HOME/apps/kipo/data/`: `config.json` (watched repos), `sessions.json`,
`frontier.json` (each effort's last frontier, for the sidebar bars), `maps.json` (maps put on
the sidebar), `hidden.json` (efforts taken off it).
