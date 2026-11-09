import type { Tile } from './types'

// The seven stations' vocabulary: one per KiPo skill, in the order work flows,
// Done on the right; Matt's 27 under the KiPo skill that runs them. The
// stations panel (Stations.tsx) and the sidebar's glance row read this.

export type ColId = 'intake' | 'shape' | 'grill' | 'plan' | 'build' | 'review' | 'done'
// Matt's 27 under the KiPo skill that runs them (4 + 6 + 5 + 3 + 5 + 2 + 2);
// `any` ones are also usable from any stage.
export const COLUMN_DEFS: { id: ColId; label: string; skill: string; matt: string[]; any?: string[]; what: string }[] = [
  { id: 'intake', label: 'Intake', skill: 'kipo-intake', matt: ['setup-matt-pocock-skills', 'ask-matt', 'triage', 'improve-codebase-architecture'], what: 'Set the repo up, triage the issue, pick a start' },
  { id: 'shape', label: 'Shape', skill: 'kipo-shape', matt: ['wayfinder', 'research', 'prototype', 'to-questionnaire'], any: ['handoff', 'teach'], what: "Huge, foggy: chart the map, work its decision tickets" },
  { id: 'grill', label: 'Grill', skill: 'kipo-grill', matt: ['grill-with-docs', 'grill-me', 'grilling', 'domain-modeling'], any: ['wait-what'], what: "An idea: interview until it's sharp" },
  { id: 'plan', label: 'Plan', skill: 'kipo-plan', matt: ['to-spec', 'to-tickets', 'codebase-design'], what: 'Hand-over: spec, then tickets' },
  { id: 'build', label: 'Build', skill: 'kipo-build', matt: ['implement', 'implement-spec', 'tdd', 'diagnosing-bugs', 'wizard'], what: 'One ticket per session, test-first, open a PR' },
  { id: 'review', label: 'Review', skill: 'kipo-review', matt: ['code-review', 'pr'], what: 'Review, then merge by Merge Danger' },
  { id: 'done', label: 'Done', skill: 'kipo-done', matt: ['retro', 'writing-for-agents'], what: 'Retro the run, tidy the docs' },
]

// A tile's station: where its work is dealt with now.
export const columnOf = (t: Tile): ColId =>
  t.state === 'done' ? 'done'
    : t.source ? 'intake'
      : t.state === 'review' ? 'review'
        : t.type === 'build' ? 'build'
          : t.type === 'grilling' ? 'grill'
            : 'shape'
