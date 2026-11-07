# Launchpad contract

The single source of truth that the skills, the backend and the UI share. Change it
here first, then in code. Product plan: `/Users/masterphelps/.kiro/crew/workspace/plans/launchpad-app-plan.md`.

## Phases: two levels

An initiative is one plan until Design splits it into tickets; after that each
ticket is its own PR and moves on its own.

**Initiative phases** (the `phase:` label on the initiative issue), in order:

`intake, discovery, refinement, design, delivery, release, operate`

**Ticket stages** (the `stage:` label on each ticket issue), in order:

`build, review, test, security, ready, shipped`

- `delivery` has no skill and no session of its own: it is the phase in which the
  initiative's tickets move through `build → review → test → security`. Each of those
  four stages has a skill and runs one session per ticket.
- `ready` means a ticket cleared Security and is waiting to ship; `shipped` means its
  PR is merged and released.
- The ten skills are unchanged in name: `skills/phase-<id>/SKILL.md` for intake,
  discovery, refinement, design, build, review, test, security, release, operate.
  build/review/test/security always run for one ticket. release runs for the whole
  initiative (ship together) or for one ticket (ship as each lands).

**Ship mode** (`meta.ship`, decided at the end of Design and written by the agent as
`state.ship`): `together` (default) or `each`.

- `together`: delivery → release is allowed once every ticket is `ready` (or `shipped`).
  Release ships them all; advancing release marks every `ready` ticket `shipped`.
- `each`: a `ready` ticket can be shipped on its own with a ticket `release` session;
  advancing that ticket marks it `shipped`. delivery → operate (release is skipped) once
  every ticket is `shipped`.

**When the initiative enters delivery** the backend labels every open `launchpad:<n>`
ticket that has no `stage:` label with `stage:build`. A ticket filed later (during
delivery) is labelled `stage:build` the first time the backend sees it.

A `small` or `bug` initiative that skipped to-tickets has no tickets. Entering delivery
then files one ticket for the whole initiative (title = initiative title, body = link
back + Destination, labels `launchpad:<n>` and `stage:build`), so the same path applies.

Blocking: a ticket is **blocked** while any native `blockedBy` issue is still open
**and** not yet `ready`/`shipped`. (In ship-together mode tickets stay open until
Release merges them, so "closed" alone would deadlock every dependent ticket.) A
blocked ticket's build session can't start; the UI shows which tickets it waits on.
Ticket seeds carry `Blocked by: #a (ready), #b (shipped)` so Build branches from the
right place, and a ticket release seed reads `Stage: release for ticket #<t> "<title>"`.

## Initiative = a GitHub issue in the target repo

Labels (the backend creates any that are missing, with `gh label create --force`):

- `launchpad:initiative`: marks the issue as an initiative
- `phase:<id>`: exactly one, the current phase
- `size:small|feature|foggy|bug`: set at Intake; absent until then

Issue body, which the backend writes and the backend parses:

```markdown
## Destination

<one or two lines; starts as the human's description, Intake sharpens it>

## Original request

<the human's description from the start form, never edited>

## Artifacts

- [<label>](<url or absolute path>)

## Phase log

- 2026-11-06 created in intake
- 2026-11-06 intake → discovery

<!-- launchpad:meta {"repoPath":"/abs/path/to/checkout","size":null,"mapIssue":null,"specPath":null} -->
```

The meta comment is a single line of JSON and is the last line of the body.
`repoPath` is the absolute local checkout the agent works in. `mapIssue` is the
issue number of a `wayfinder:map` (foggy initiatives). `specPath` is the
repo-relative spec path once `to-spec` has written it.

## Phase state file (written by the agent, read by the backend)

`<repoPath>/.launchpad/<issueNumber>/state.json`

```json
{
  "phase": "discovery",
  "summary": "One plain sentence: where this phase stands.",
  "blocking": "One plain sentence: what is being waited on, or null.",
  "decisions": [
    {"id": "auth", "title": "Auth provider", "options": ["Clerk", "Supabase"], "recommended": "Clerk", "answer": null}
  ],
  "gate": [
    {"id": "glossary", "label": "GLOSSARY.md updated with new terms", "done": false}
  ],
  "artifacts": [
    {"label": "Spec", "href": "docs/specs/foo.md"}
  ],
  "size": "feature",
  "skillsUsed": ["phase-discovery", "grill-with-docs", "domain-modeling"]
}
```

`skillsUsed` lists every skill the phase agent loaded, in order, appended as it loads each one. Pocock skills are loaded by reading `~/.agents/skills/<name>/SKILL.md`, because most of them refuse model invocation through the Skill tool.

**Ticket state** lives beside it, one folder per ticket, same shape:
`<repoPath>/.launchpad/<n>/t<ticket>/state.json` (its `phase` is the ticket's stage).
Archived on ticket advance to `t<ticket>/state.<stage>.json`. Parallel ticket sessions
therefore never write the same file. Design also writes `"ship": "together"|"each"`.

Rules: the agent updates it on every decision asked or answered, every gate item
done, and every artifact produced. `size` is written only by Intake. The file is
plumbing: the agent never mentions it in chat. A phase's gate is **passed** when
every `gate` item is `done: true` and the `gate` list is non-empty. A missing or
unreadable file means no gate items yet, so the gate isn't passed.

## Session seed (the UI sends this as the first message of a phase session)

```
[Launchpad] Initiative #<n> "<title>" in <owner>/<repo>
Phase: <id> (<k> of 7)                         (initiative sessions)
Stage: <stage> for ticket #<t> "<ticket title>" (ticket sessions, instead of Phase)
Repo checkout: <repoPath>
Initiative issue: <url>
Ticket issue: <url>                            (ticket sessions only)
State file: <the initiative or ticket state.json path>
Size: <size or "unset">
Ship: <together|each>                          (once Design set it)
Load the skill `phase-<id or stage>` and follow it. Destination: <destination>
```

Session names: `launchpad-<owner>-<repo>-<n>-<phase>` (lowercase, non-alnum → `-`).
Ticket sessions: `launchpad-<owner>-<repo>-<n>-t<ticket>-<stage>`. Session keys in
`sessions` (detail) are `<phase>` and `t<ticket>-<stage>`. Wayfinder decision-ticket
sessions in Discovery keep their old key `discovery-t<ticket>`.

## Backend HTTP API

The UI calls these with `fetch('/apps/launchpad/api/<path>', {credentials: 'include'})`.
The gateway reverse-proxies to the backend. The backend must accept the path with
any of these prefixes: `/apps/launchpad/api`, `/api/apps/launchpad`, `/api`, or
none. All JSON. Errors: `{"error": "<plain sentence>", "code": "<slug>"}` with a
4xx/5xx status.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | | `{"status":"ok"}` (unauthenticated, cheap) |
| GET | `/config` | | `{"repos":[{"slug":"owner/name","path":"/abs"}]}` |
| PUT | `/config` | same shape | the saved config; validates that each path exists and is a git checkout |
| GET | `/repos/discover` | | `{"repos":[FoundRepo]}`: git checkouts up to two levels below the usual code folders (~/repos, ~/workspace, ~/Developer, …), each with its slug from the `origin` remote |
| POST | `/repos` | `{"path":"/abs"}` | the saved config; the slug is read from the folder's origin remote (400 `no_github_remote` / `not_a_checkout`, 409 `duplicate_repo`) |
| POST | `/repos/remove` | `{"slug":"owner/name"}` | the saved config |
| GET | `/browse?path=/abs` | | `{path, parent, home, folders:[{path,name,repo,slug}], here}`: subfolders for the folder picker, limited to the home folder |
| GET | `/sessions` | | `{"sessions":["<slotName>", …]}`: every session Launchpad has started; the page files them into the "Launchpad" sidebar folder |
| GET | `/initiatives` | | `{"initiatives":[Initiative]}` across all configured repos, open issues only |
| POST | `/initiatives` | `{"path":"/abs checkout","description":"...","size":"small\|feature\|foggy\|bug"\|null,"worktree":bool}` (legacy: `{"repo","title","destination"}`) | `Initiative` (created in `intake`). The folder is added to the config on first use; the title is cut from the description's first sentence; with `worktree` the checkout becomes `<path>-lp<n>` on branch `launchpad/<n>` |
| GET | `/initiatives/{owner}/{repo}/{n}` | | `InitiativeDetail` |
| POST | `/initiatives/{owner}/{repo}/{n}/advance` | `{"force":false}` | `InitiativeDetail`; 409 `gate_not_passed` unless the gate passed or `force` is true. From `operate`, advance closes the issue. |
| POST | `/initiatives/{owner}/{repo}/{n}/session` | `{"phase":"<id>","ticket":null}` | `{"slotName":"...","seed":"..."}`: the backend records the slot name in storage and returns the seed text; the UI creates the slot and sends the seed |
| POST | `/initiatives/{owner}/{repo}/{n}/remove` | | `{"removed":true}`: closes the issue as "not planned" with a comment; nothing is deleted, and reopening the issue puts it back on the board |
| GET | `/initiatives/{owner}/{repo}/{n}/frontier` | | `{"tickets":[Ticket]}`: open, unblocked, unassigned child issues of `mapIssue` (wayfinder decision tickets, Discovery only) |
| POST | `/initiatives/{owner}/{repo}/{n}/tickets/{t}/session` | `{}` | `{"slotName","seed"}` for the ticket's current stage; 409 `ticket_blocked` (with `blockedBy`) when it is in `build` and blocked, 409 `ticket_not_active` when `ready`/`shipped` (except a `ready` ticket in ship-`each` mode, which gets a `release` session) |
| POST | `/initiatives/{owner}/{repo}/{n}/tickets/{t}/advance` | `{"force":false}` | `InitiativeDetail`; moves the ticket one stage (`security → ready`, and `ready → shipped` for a ticket release in `each` mode); 409 `gate_not_passed` like the initiative |
| GET | `/initiatives/{owner}/{repo}/{n}/doc?href=<href>` | | `{"href","title","kind":"markdown","text","url"\|null}`: a phase document to render. `href` is an artifact href: a path (relative to the checkout, or absolute inside it; anything outside is 400 `outside_checkout`), or a GitHub issue/PR URL in the same repo (its title + body; for a `wayfinder:map` also a generated list of its child tickets with state). Text capped at 200 KB. |

```ts
type Initiative = {
  repo: string; number: number; title: string; url: string;
  phase: PhaseId; size: 'small'|'feature'|'foggy'|'bug'|null;
  destination: string; updatedAt: string;
}
type InitiativeDetail = Initiative & {
  repoPath: string; mapIssue: number|null; specPath: string|null;
  artifacts: {label:string; href:string}[];   // body artifacts + state artifacts merged, deduped by href
  phaseLog: string[];
  state: PhaseState|null;                       // the state.json, or null
  gatePassed: boolean;
  sessions: Record<string, string>;             // phase (or phase-tN) -> slot name
  ship: 'together'|'each'|null;
  tickets: TicketDetail[];                      // launchpad:<n> issues, open and closed; [] before Design files them
  delivery: { total:number; byStage: Record<Stage, number>; canAdvance:boolean; reason:string|null } | null;
}
type Stage = 'build'|'review'|'test'|'security'|'ready'|'shipped'
type TicketDetail = {
  number:number; title:string; url:string; state:'OPEN'|'CLOSED';
  stage: Stage|null;                            // null until delivery labels it
  blockedBy: number[];                          // open blockers only
  ticketState: PhaseState|null;                 // t<ticket>/state.json
  gatePassed: boolean;
  sessionKey: string|null;                      // key into sessions for its current stage
  prUrl: string|null;                           // first artifact labelled "PR" in ticketState, else null
}
type Ticket = { number:number; title:string; url:string; labels:string[]; type:string|null }
```

`Initiative` (the list) also carries `ticketsByStage: Record<Stage, number>|null` so the
rail can show "Build 3 of 7" without a detail fetch.

Gate for delivery → release/operate is computed, not from a state file: `delivery.canAdvance`
is true when there is at least one ticket and every one is `ready`/`shipped` (together) or
`shipped` (each); `reason` says what is left in one sentence. `force` overrides it.

`mapIssue` and `specPath` are derived by the backend: when the meta comment lacks
them, an artifact labelled "Wayfinder map" (href = issue URL) supplies `mapIssue`,
and one labelled "Spec" supplies `specPath` (a repo path or a spec issue URL).
Detail and frontier read the derived values live; advance writes them into the meta.

On advance, the backend: moves the `phase:` label; copies `state.size` to a
`size:` label and the meta comment if Intake set it; merges state artifacts into
the body's Artifacts list; appends a Phase log line; and archives `state.json` to
`state.<phase>.json` so the next phase starts clean.

Tickets produced by `to-tickets` for an initiative carry the label `launchpad:<n>`
(the phase-design skill tells the agent to add it). Ticket labels `stage:<stage>` are
managed by the backend only; agents never set them.

**Existing initiatives** labelled `phase:build|review|test|security` (the old one-level
model) are read as `delivery`; their tickets get `stage:<that phase>`.

## Storage

`$KIROCREW_HOME/apps/launchpad/data/` (create it if missing): `config.json`,
`sessions.json` (`{"owner/repo#n": {"<phase>": "<slotName>"}}`).
