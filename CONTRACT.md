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
**conversations**: the effort's own (its **conductor**) and one per thread (a ticket, the
hand-over, the review, the retro), dispatched by the conductor or started from the stations
panel. Every stage conversation reports to the conductor.

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
- **The conductor screen** (the effort's own conversation): the **overview** is a band across
  the top (draggable, fits its content) and the conductor's chat is below it — the one place
  you type. Kiro's native side panel (Subagents, Changes, browser, Terminal) opens on the
  chat's right via the header toggle: the conductor spawns the sessions, so its Subagents and
  Changes belong here. The overview reads the effort as a **chain** (map · decisions · spec ·
  tickets · PRs, with a `N unlinked` watch-number), a **Needs you** inbox (open questions, PRs
  to review, gate sign-offs — each with an Answer / Review / Sign off action that opens that
  ticket), **Moving on its own** (building, ready, waiting on a named ticket), the stage
  **Gates**, and **Nothing missed** (the integrity checks code enforces; the coverage and
  silent-stall checks are marked "soon" until pass 2).

- **One screen, no modes** (ticket sessions):
  - **The spine, inside the sidebar**: the open effort's row unfolds in place into its spine
    (the sidebar's other efforts keep their glance rows). The **conductor is pinned on top**
    (with its open question count), then the effort as the seven KiPo skills, each a counter
    **in its own units** (Grill counts questions, Plan is the `1 spec → N tickets` fan-out,
    Build counts tickets, Review counts PRs, Done is merged-of-total plus whether /retro
    ran), each with a bar normalized to its own station. The spine header names the **front**
    and the **tail** (the earliest station still waiting on a human) and carries the amber
    roll-up — "N questions waiting on you" — which on each click jumps to the next
    conversation with open questions. A station expands to its queue: ticket rows (each
    badged with its session's open question count), its answered/done tickets last and dim —
    so "5 answered" always expands to show which five — and a row for the station's own
    conversation once it exists (Writing the spec, Reviewing the PRs, The retro, …). The
    Done station lists every done ticket in one place. Clicking any row — conductor, ticket,
    conversation — swaps only the conversation and the right panel; the open row reads as
    selected. Stations carry their own next step until its conversation exists (Write the
    spec, Review the PRs, Run /retro, Close effort behind a confirm). Stations before the
    entry point read "entered at <station>". Autopilot lives in the spine header. A narrow
    sidebar drops the units column; hover a station's name for them.
  - **The conversation fills the rest**, and **its right panel is Kiro's own native side
    panel** — browser, +, Changes, Terminal, Subagents and the rest. KiPo adds **no** right
    panel of its own: there is exactly one, and it is Kiro's. The conversation is embedded
    through `/popout/chat?sid=` (the one embedded surface that binds to a single session,
    renders only its conversation, and keeps Kiro's native panel alive; `/embed/chat` shows
    the session list). Kiro hides its own panel toggle on embedded surfaces, so KiPo's chat
    header carries a **panel button** that fires the chat page's own `toggle-activity-panel`
    window event into the (same-origin) frame — it shows and hides Kiro's real panel, no
    reload. The popout's dead "Return to the main window" control is hidden. A ticket's
    conversation carries its map over the chat ("Where it sits": the whole chain, blockers in
    a top row with arrows down).
  - **The question wizard** (docked at the bottom of the conversation): the open decisions
    the agent recorded, shown **one at a time** — the question, its options as pills plus a
    free-text answer, Back / Next, and dots for the batch. **Submit sends every answer as one
    message** (the agent takes them all in one turn; unanswered ones stay for later). It
    appears only when the conversation has open questions, and never on a settled ticket. The
    agent still asks each in full in the chat too; the spine counts and points to them (row
    badges, station roll-ups, the header's amber "N questions waiting on you" jump).
  - **The map is on demand**: a **Map** toggle in the conversation header shows/hides this
    ticket's "Where it sits" chain (blockers in a top row, arrows down) over the chat, instead
    of it being permanently stacked. Off by default.
  - **A ticket with no live conversation** (closed, blocked, in review, or not yet started)
    has no chat and no panel, so **its own details fill the centre** instead: state, PRs, How
    it ended (last comment), What it asks/asked (body), with a Start button over them when it
    can still be started.
- **Autopilot** (per effort, in the browser, while the page is open): each Deliver tile that
  becomes `afk` gets an `implement` conversation, once.

## The conductor

One long-lived agent per effort (`agents/kipo-conductor.json`, skill `kipo-conductor`). It is
the effort's own conversation and never does the work itself.

- **Watch**: on every wake it runs `python3 <app>/backend/kipo_cli.py frontier <repo> <n>`,
  which prints the open threads (`kipo/conductor.py`: each with its stage, KiPo skill, owner
  HITL / Agent / Running / Stalled / Blocked, and next action; a ticket whose session stalled is
  `Stalled` instead of `Running` or `Agent`, with `session`, `stall` and `why`: see "Stalled
  sessions") from GitHub through KiPo's own frontier
  code. It works from that output only. It wakes when the human writes, and when the page sees
  a ticket's or PR's state change (`[KiPo] Frontier changed: …`, sent only if it's not mid-turn;
  what it last saw is remembered per effort in the browser), and when a stage session reports
  (`[KiPo] Report from <session>: <event>: <text>`, or `[KiPo] Reports from the sessions:` with a
  list; also only when it's not mid-turn; the last report id sent is remembered per effort in
  the browser, and a report the conductor has already read is never sent), and when the page
  woke a stalled session (`[KiPo] Woke <session>: <why>`, held until it's not mid-turn) or one
  turned stuck (in `[KiPo] Frontier changed: <session> stuck …`).
- **Dispatch**: `kipo_cli.py dispatch <repo> <n> (--ticket <t> | --stage shape|plan|review|done) [--skill <s>]`
  appends to `dispatch` in its state file (`.kipo/<n>/conductor.json`). A ticket thread whose
  skill is `kipo-build` is `--ticket <t>`; whenever the thread's skill differs from `kipo-build`,
  it is `--ticket <t> --skill <thread's skill>`. A ticket in review (action "dispatch
  kipo-review: review, fix, merge if a two-way door") is `--ticket <t> --skill kipo-review`:
  its own review conversation (`review-t<t>`, seeded with the ticket and its open PRs), beside
  its build. Entries are deduped on (ticket, stage, skill), a missing skill counting as its
  own value, so a ticket's build and then its review each queue once. The page starts each
  queued entry once while it's open, its started-marker keyed on ticket or stage, skill and
  time (skipping a ticket that's done or blocked, a ticket that already has the conversation
  the entry asks for: `review-t<t>` for kipo-review, its build or decision otherwise, and a
  stage conversation that exists).
- **Hear**: every stage session reports to it (below). The frontier command's JSON also carries
  `reports` (the unread reports, oldest first, marked read once printed; `--peek` leaves them
  unread), `waiting` (every stage session's unanswered decision cards, `{from, id, title,
  options, recommended}`: not the conductor's own, not a done ticket's; plus one card per stuck
  session, `{from: <key>, id: "stuck-<key>", …, stuck: true}`) and `sessionsBlocking`
  (`{from, blocking}`). `kipo_cli.py reports <repo> <n> [--checkout <path>] [--peek]` prints
  the unread reports without GitHub, for when the frontier fails. Each wake it relays the
  reports, one line each.
- **Ask you**: every HITL thread as one batch of decision cards in its state file. Its reply's
  **Waiting on you** also lists each session's open cards from `waiting`, grouped by session,
  and each `blocked` or `failed` session; it never copies a session's cards into its own
  `decisions` or answers them, and drops its own card when a session's asks the same thing.
- **Sessions**: each wake it also runs `kipo_cli.py sessions <repo> <n>` (below, "Closing
  sessions") and names on its Closed line each session KiPo closed since it last said, and on
  its Stalled line each stalled, woken or stuck session with why. It never wakes or messages a
  session itself, and never dispatches a `Stalled` thread.
- **Merge**: through the kipo-review conversation it dispatches (Merge Danger).
- **Close**: dispatches kipo-done when the retro is the only thread, then closes the effort
  issue once `done` reports `finished`.
- **Reply**: short, in this order, empty lines left out: Changed, Reports, Dispatched,
  Closed, Stalled, Waiting on you.
- **Cron**: with Kiro Crew's cron tools it arms one 15-minute `[KiPo] Check the frontier`
  while there are `Agent`, `Running` or `Stalled` threads or a dispatched session hasn't reported
  `finished`, `nothing-to-do` or `failed`. That is how it hears reports while the page is closed.

## Reports: stage sessions to the conductor

Every stage conversation (the seven skills' "Report to the conductor" section) reports at each
moment, as it happens:

```
python3 <app>/backend/kipo_cli.py report <repo> <n> --from <session> --checkout <path> --event <kind> --text "<one line>" [--item "<…>"]...
```

- `--from`: the session's key: `build-t<t>`, `review-t<t>` or `shape-t<t>` for a ticket's
  conversation (older seeds said `t<t>` for all three; still accepted, and attributed to the
  ticket's only conversation open at the time, it existed and KiPo hadn't closed it, or else to
  `build-t<t>`: `closing.attribute`), `shape`, `plan`, `review`, `done`, or `intake`, `grill`,
  `build-spec`.
- `--event`: `started`; `asked` (one `--item` per question, `<card id>: <title>`); `answered`
  (`<card id>: <answer>`); `pr-opened`, `pr-merged`; `issue-created`, `issue-closed`;
  `finished`; `nothing-to-do` (and why); `blocked` (exactly what clears it: `#<n>` for an issue
  or PR, or the session it waits on); `failed` (what broke).
- **After `blocked`** a session keeps checking on its own where it can (the Monitor tool, or a
  short loop on `gh pr view`, `gh issue view`, `git status`) until the blocker clears, rather
  than ending its turn to wait. It ends a turn while waiting only when the blocker needs the
  human or will take hours, with a `blocked` report naming what clears it (every stage skill's
  "Blocked: keep checking yourself").
- `--checkout`: the effort's checkout (the seed's Report line carries it); without it the CLI
  reads it from the effort issue's meta, else the repo's configured path.

It appends `{id, at, from, event, text, items?}` to `.kipo/<n>/reports.json`
(`backend/kipo/reports.py`): `{"reports": [...], "read": <highest id the conductor has been
shown>}`. Its own file, not `conductor.json`, because the conductor agent rewrites that one;
appends and reads take a lock (`reports.json.lock`) so parallel sessions lose nothing. Ids
only rise; the file keeps the last 500. Reports persist whether or not the page is open. The
effort detail carries `reports: {reports: [the last 50], read}` for the page.

## Closing sessions

KiPo closes the stage sessions it opened once they're finished, with one rule
(`backend/kipo/closing.py`, a pure function of the effort detail and every report). A session
is **closable** when both hold:

1. **It finished**: it reported `finished` or `nothing-to-do`, or it reported `failed` and a
   later report on the same thread (`started`, `finished`, `nothing-to-do`, `pr-merged`) shows
   another try took over. Reports count by session key; an older `t<t>` report counts for the
   session it is attributed to (above, "Reports"), so a build's `finished` never makes the
   ticket's review look finished. A session with no report at all predates reporting and counts
   as finished.
2. **Its thread is settled**:

| Session | Settled when |
|---|---|
| `shape-t<t>` | `#t` is closed |
| `build-t<t>` | `#t` is closed, or it has a PR and `review-t<t>` exists (the review owns it now) |
| `review-t<t>` | `#t` is closed, or every PR for `#t` is merged or closed |
| `review` | every effort PR its reports name (`#<n>` in text or items) is merged or closed; naming none, the frontier has landed |
| `shape`, `grill`, `intake` | the Decide half is clear: no open decision ticket, no fog |
| `plan` | build tickets are cut |
| `build-spec`, `done` | the frontier has landed |

Never closable: the conductor, and any session whose state file has an unanswered decision
card (the stage conversations share `state.json`, so a card there holds all of them).

The effort detail carries `closing: [{key, slot, status, reason}]` for every session in
`sessions`, `status` being `open` (it stays), `closable` or `closed`. On its 5-second effort
refresh the page closes each `closable` session through Kiro Crew's own close,
`DELETE /api/chat/slots/<slot>` (what a session's ⋯ menu "Close session" does: the session
stops, its history is kept, and it can be resumed; Kiro Crew lets an app close only slots it
created), skipping one that is mid-turn or on screen. It then posts the keys to
`POST /initiatives/<owner>/<repo>/<n>/sessions/closed` (`{keys}`), which records them in
`data/closed.json` so they read `closed`; starting a session again clears its record. Each slot
is closed at most once per browser, so one you reopen by hand stays open. Close effort closes
every session regardless.

`python3 <app>/backend/kipo_cli.py sessions <repo> <n>` prints
`{effort, repo, open, closable, closed, sessions: [...]}` for the conductor. Closing happens only
in the page (Kiro Crew's API is the page's), so `closable` ones close the next time the effort
is open.

## Stalled sessions

KiPo notices its stage sessions that stopped without finishing and wakes them itself, so the
human never has to type "carry on". One rule (`backend/kipo/stalls.py`, a pure function of the
effort detail, every report, each session's activity, the wakes sent, and the time).

A session is a candidate when it isn't the conductor, is `open` in the close rule (not
closable, not closed), has no unanswered decision card (a session waiting on the human's cards
is never stalled), isn't mid-turn, and its thread isn't settled (the close rule's table). A
candidate is **stalled** when either holds:

1. **Idle**: its last activity was 15 minutes ago or more, and its last report isn't
   `finished` or `nothing-to-do`. A session that never reported predates reporting and is left
   alone.
2. **Its blocker cleared**: its last report is `blocked`, and later another session on the same
   ticket reported `finished` or `pr-opened`, or a PR or issue that the blocked report's text
   names (`#<n>`, not its own ticket or PRs) was merged or closed: by a later `pr-merged` /
   `issue-closed` report, or on GitHub (the effort's tickets and PRs).

Each stall has an id (`blocked#<report id>`, or `idle@<last activity>`). The effort detail's
`closing` rows carry `stall: {state, why, id, wakes}` on such sessions, `state` being:

| `state` | Meaning | The page |
|---|---|---|
| `stalled` | stalled, not yet woken for this stall | wakes it |
| `woken` | woken for this stall, or its last wake is unanswered | waits |
| `stuck` | 2 wakes in a row with no answer | never wakes it again; the conductor puts it to the human (a `stuck` card in `waiting`) |

A wake is answered when the session reports after it, or acts after it (the agent's message;
when only the transcript mtime is known, more than 30 s after the wake).

**Activity.** Every 30 seconds, for each open stage session (not the conductor), the page reads
Kiro Crew's `GET /api/chat/slots/<slot>?limit=1` (`running`, and the last message's `ts` and
`role`) and posts `POST …/sessions/activity` (`{activity: {key: {at, running, agent}}}`). KiPo
keeps it in `data/activity.json` with when it was seen. An observation over 2 minutes old (the
page is closed, as for `kipo_cli.py`) falls back to the session's transcript mtime
(`~/.kiro/crew/session_map.json` maps `dashboard:<slot>` to its session id;
`~/.claude/projects/<cwd as a folder name>/<sid>.jsonl`), with mid-turn unknown.

**Waking.** On its 5-second effort refresh the page wakes each `stalled` session through the same
chat websocket it uses for the conductor (`POST /api/chat?ws=1`), skipping one that is mid-turn
(`running`) or on screen (the close rule's guards):

```
[KiPo] Carry on: <why: idle N min | your blocker cleared: <what>>. Re-read your ticket, its PR and comments, and your state file, then continue from where you stopped; report when you finish or block.
```

It then posts `POST …/sessions/woken` (`{key, stall, why}`), which records the wake in the
effort's checkout, `.kipo/<n>/wakes.json` (`{"wakes": {key: [{at, stall, why}]}}`, once per
stall id, the last 20 per session), and tells the conductor `[KiPo] Woke <session>: <why>` (held
in the browser until the conductor isn't mid-turn) so it can relay it. Each (session, stall) is
also woken at most once per browser.

`kipo_cli.py sessions` counts `stalled`, `woken` and `stuck` beside `open`, `closable` and
`closed`, and each row with a stall carries it. In the frontier, a ticket whose session is
stalled, woken or stuck is owned by `Stalled` with that session, its state and why.

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
message to send into it instead of a new seed, which carries a Report line with
`--from plan`.

The conductor's seed has, instead of `Stage:`/`Start:`/`Report:`, its `Frontier:`,
`Dispatch:`, `Reports:` and `Sessions:` command lines. Finished conversations are closed by the
rule in "Closing sessions".

Seed (the first message):

```
[KiPo] Effort #<n> "<title>" in <owner>/<repo>
Conversation: <the effort's own conversation | ticket #<t>, in the Decide|Deliver lane | the hand-over: … | review and merge … | the retro | build every ready ticket …>
Stage: <Intake|Decide|Deliver|Done>
Start: <start>
Repo checkout: <repoPath>
Effort issue: <url>
State file: <path>
Report: python3 <app>/backend/kipo_cli.py report <repo> <n> --from <key> --checkout <path> --event <kind> --text "<one line>" [--item "<one per question, PR or issue>"]...
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
| GET | `/initiatives/{o}/{r}/{n}` | | `EffortDetail` (with `reports: {reports, read}`) |
| POST | `…/{n}/sessions/closed` | `{"keys":[…]}` | the page closed these (closable) sessions: recorded in `data/closed.json` |
| POST | `…/{n}/sessions/activity` | `{"activity":{key:{at,running,agent}}}` | `{recorded}`: what Kiro Crew says of each open session, for the stall rule |
| POST | `…/{n}/sessions/woken` | `{"key","stall","why"}` | `{wake}`: the page woke a stalled session; recorded in `.kipo/<n>/wakes.json`, once per stall |
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

`$KIROCREW_HOME/apps/kipo/data/`: `config.json` (watched repos), `sessions.json`, `closed.json`
(sessions the page closed), `activity.json` (what the page last read of each open session),
`frontier.json` (each effort's last frontier, for the sidebar bars), `maps.json` (maps put on
the sidebar), `hidden.json` (efforts taken off it). In the effort's checkout,
`.kipo/<n>/`: the state files, `reports.json` and `wakes.json`.
