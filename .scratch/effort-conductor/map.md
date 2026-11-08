# Wayfinder map: Each effort has a conductor

Labels: wayfinder:map

## Destination

A spec, ready for `/to-spec`, for turning each effort's main conversation into a **conductor**: one long-lived agent per effort that watches its tickets, starts the sessions that do the work, merges by Merge Danger, and brings you only what needs you. The spec states what the conductor does on its own, what it asks you, how it wakes, how it starts sessions, what record it trusts, and what the effort screen shows.

## Notes

- Domain: KiPo, the Kiro Crew app in this repo. Read `CONTRACT.md` first: the frontier, the two halves (Decide / Deliver), one state file per conversation.
- Every session working this map consults the skills `grilling` and `domain-modeling`.
- Prior art to read before deciding: Kiro Crew's `goal-conductor` skill (`~/.kiro/crew/skills/goal-conductor/SKILL.md`). It owns a goal, starts one session per work item, checks results (e.g. "PR merged"), and never does the work itself.
- Why this effort exists (2026-11-08): today KiPo's UI is the conductor, and only while you have it open. Autopilot starts agents only while the effort is open, and the effort's chat is a different agent per stage (`kipo-intake`, `kipo-shape`, … `kipo-done`). Nobody is watching the effort as a whole.
- Leanings from that discussion, **not decided**. Each belongs to a ticket below:
  - GitHub stays the record of what's done; the conductor reads KiPo's frontier and keeps no list of its own (ticket 03).
  - The conductor wakes only when the frontier changes, not on a fixed poll (ticket 04).
  - The conductor never grills or writes code; it opens the session that does (tickets 02, 06).
  - Matt's deterministic-loop point: KiPo's frontier code decides what's ready, and the conductor's judgment goes into merges, ordering and talking to you (ticket 07).
- Tracker: local markdown (this repo has no remote). Tickets are in `issues/`.

## Decisions so far

## Not yet specified

- **Many efforts at once.** One conductor per effort, or one per crew watching every effort? What is the limit on concurrent agents across efforts, and who enforces it?
- **When things go wrong.** A stuck worker, red CI, a merge conflict, a reviewer blocking a PR: what the conductor retries, how many times, and when it hands the problem to you.
- **Efforts already in flight.** How an effort that started under the stage sessions (e.g. interrosec-portal #34) gets a conductor partway through.
- **Reaching you outside KiPo.** Whether a "needs you" item should also reach the bell, Slack or a notification, and how often.
- **Spend.** Whether an effort has a budget (sessions, tokens, wall clock) that the conductor stays inside.

## Out of scope

- Changing Kiro Crew's own `goal-conductor` skill or work ledger. This effort uses what Kiro Crew offers; it doesn't redesign it.
- Efforts that span several repos.
