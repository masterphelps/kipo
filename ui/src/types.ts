// Shapes from CONTRACT.md. Change the contract first, then these.

// Matt Pocock's flow as seven columns. An effort moves left to right along the
// path its start point picked; columns off the path are skipped.
export const COLUMNS = ['intake', 'shape', 'grill', 'plan', 'build', 'review', 'done'] as const
export type Column = typeof COLUMNS[number]

export const COLUMN_LABELS: Record<Column, string> = {
  intake: 'Intake',
  shape: 'Shape',
  grill: 'Grill',
  plan: 'Plan',
  build: 'Build',
  review: 'Review',
  done: 'Done',
}

// When an effort belongs in each column (the board's own wording).
export const COLUMN_HINTS: Record<Column, string> = {
  intake: 'A raw issue, request or refactor candidate nobody has shaped yet.',
  shape: 'Open questions: a wayfinder map, a prototype, research, a questionnaire waiting on someone.',
  grill: 'An interview in progress. It updates GLOSSARY.md and adds ADRs.',
  plan: 'A spec and the tickets that hang off it, with their blocking links.',
  build: 'Tickets being built, or a branch with commits.',
  review: 'A PR is open: the agent reviews it, fixes what it finds and merges it.',
  done: 'Merged. /retro turns what went wrong into checks, standards and agent instructions.',
}

// The skills you start (buttons) and the ones the agent reaches for itself (chips).
export const BUTTONS: Record<Column, string[]> = {
  intake: ['setup-matt-pocock-skills', 'ask-matt', 'triage', 'improve-codebase-architecture'],
  shape: ['wayfinder', 'to-questionnaire', 'handoff', 'teach'],
  grill: ['grill-with-docs', 'grill-me', 'wait-what'],
  plan: ['to-spec', 'to-tickets'],
  build: ['implement', 'implement-spec'],
  review: [],
  done: ['retro'],
}
export const CHIPS: Record<Column, string[]> = {
  intake: [],
  shape: ['research', 'prototype'],
  grill: ['grilling', 'domain-modeling'],
  plan: ['codebase-design'],
  build: ['tdd', 'diagnosing-bugs', 'wizard'],
  review: ['code-review', 'pr'],
  done: ['writing-for-agents'],
}
// Work in any column, so they sit above the chat box.
export const SESSION_CONTROLS = ['handoff', 'wait-what', 'teach', 'writing-for-agents']

// One-line descriptions shown on hover, so a button says what it does.
export const SKILL_HINTS: Record<string, string> = {
  'setup-matt-pocock-skills': 'Set up this repo for the skills: tracker, triage labels, docs layout. Once per repo.',
  'ask-matt': 'Ask which skill or flow fits this situation.',
  triage: 'Move a raw issue through triage to an agent-ready brief.',
  'improve-codebase-architecture': 'Survey the codebase for deepening opportunities; picking one becomes an idea for Grill.',
  wayfinder: 'Chart a map of decision tickets for an effort too big to see through, then work them one at a time.',
  'to-questionnaire': 'Write a questionnaire for someone else who holds the answers.',
  handoff: 'Write a portable handoff file, for a new directory, harness or person.',
  teach: 'Learn a concept over several sessions, using this folder as the workspace.',
  'grill-with-docs': 'Interview you about the idea, keeping GLOSSARY.md and ADRs up to date.',
  'grill-me': 'The same interview, without writing anything to the repo.',
  'wait-what': 'Re-explain the last message in plain words.',
  'to-spec': 'Turn the conversation into a spec.',
  'to-tickets': 'Split the spec into tracer-bullet tickets with blocking links.',
  implement: 'Build one ticket, test-first, then review it.',
  'implement-spec': 'Build every unblocked ticket in parallel on one integration branch, then one review.',
  retro: 'Look back and turn lessons into checks, coding standards and agent instructions.',
  'writing-for-agents': 'Write or edit skills, AGENTS.md and CLAUDE.md.',
  research: 'Investigate a question against primary sources and leave a cited note.',
  prototype: 'Throwaway code to answer one design question.',
  grilling: 'The interview itself.',
  'domain-modeling': 'Sharpen the domain language: GLOSSARY.md and ADRs.',
  'codebase-design': 'Design the module shape: depth, seams, interfaces.',
  tdd: 'Red, green, refactor, one slice at a time.',
  'diagnosing-bugs': 'A tight feedback loop on a hard bug, then a fix with a regression test.',
  wizard: 'A guided script for steps only you can do.',
  'code-review': 'Review the diff against the coding standards and the spec.',
  pr: 'Write the PR body: the change, evidence it works, and how reversible it is.',
}

export const STARTS = ['idea', 'small', 'huge', 'issue', 'bug'] as const
export type Start = typeof STARTS[number]

export type RepoConfig = { slug: string; path: string }
export type Config = { repos: RepoConfig[] }

export type FoundRepo = {
  path: string; name: string; slug: string | null; remote: string | null;
  worktree: boolean; configured: boolean;
}
export type BrowseFolder = { path: string; name: string; repo: boolean; slug: string | null }
export type BrowseResult = {
  path: string; parent: string | null; home: string; folders: BrowseFolder[];
  here: { path: string; name: string; slug: string | null } | null;
}

// The frontier (CONTRACT.md): every ticket of an effort in its real state.
export const TILE_STATES = ['done', 'review', 'building', 'you', 'afk', 'blocked'] as const
export type TileState = typeof TILE_STATES[number]
export type FrontierCounts = Record<TileState, number>
export type Tile = {
  number: number
  title: string
  url: string
  type: 'grilling' | 'prototype' | 'research' | 'task' | 'build' | 'issue'
  code: string
  who: 'you' | 'afk'
  lane: 'decide' | 'deliver'
  source?: boolean
  state: TileState
  blockedBy: number[]
  sessionKey: string | null
  prs: number[]
}
export type Lane = 'decide' | 'deliver'
export type Frontier = {
  tiles: Tile[]
  counts: FrontierCounts
  lanes: Record<Lane, FrontierCounts>
  fog: number
  stage: Stage
  active: Record<Lane, boolean>
  handover: boolean // the map is clear and no tickets are cut yet: /to-spec, /to-tickets
  landed: boolean   // everything delivered is merged: /retro, then close
}

// Matt's two halves, with Intake before and Done after. The seven columns are
// the steps inside them; an effort's stage is read from its tickets.
export const STAGES = ['intake', 'decide', 'deliver', 'done'] as const
export type Stage = typeof STAGES[number]
export const STAGE_LABELS: Record<Stage, string> = { intake: 'Intake', decide: 'Decide', deliver: 'Deliver', done: 'Done' }
export const STAGE_COLUMNS: Record<Stage, Column[]> = {
  intake: ['intake'],
  decide: ['shape', 'grill', 'plan'],
  deliver: ['build', 'review'],
  done: ['done'],
}
export const STAGE_HINTS: Record<Stage, string> = {
  intake: 'A raw issue or request: triage it, or set the repo up for the skills.',
  decide: "The front half: grill, map, prototype and research until the fog clears, then /to-spec and /to-tickets.",
  deliver: 'The back half: implement each ticket, review it, and merge the two-way doors.',
  done: 'Everything delivered is merged: /retro the run, then close the effort.',
}
export const stageOfColumn = (c: Column): Stage =>
  (STAGES.find(s => STAGE_COLUMNS[s].includes(c)) ?? 'intake')

export type Effort = {
  repo: string
  number: number
  title: string
  url: string
  column: Column
  start: Start
  path: Column[]
  destination: string
  updatedAt: string
  ticketCounts?: { open: number; closed: number } | null
  // The last frontier seen in this effort's detail (no tiles), for the list's bar.
  frontier?: { counts: FrontierCounts; fog: number; lanes?: Record<'decide' | 'deliver', FrontierCounts>; stage?: Stage } | null
  stage?: Stage
}

export type Decision = { id: string; title: string; options: string[]; recommended: string | null; answer: string | null }
export type GateItem = { id: string; label: string; done: boolean }
export type Artifact = { label: string; href: string }

export type PhaseState = {
  phase?: string
  summary: string | null
  blocking: string | null
  decisions: Decision[]
  gate: GateItem[]
  artifacts: Artifact[]
  skillsUsed?: string[]
}

export type TicketInfo = {
  number: number
  title: string
  url: string
  state: 'OPEN' | 'CLOSED'
  blockedBy: number[]
  sessionKey: string | null
  prs: number[]
}

export type PrInfo = {
  number: number
  title: string
  url: string
  state: 'OPEN' | 'MERGED' | 'CLOSED'
  isDraft: boolean
  headRefName: string
  tickets: number[]
}

export type EffortDetail = Effort & {
  repoPath: string
  mapIssue: number | null
  specPath: string | null
  artifacts: Artifact[]
  phaseLog: string[]
  state: PhaseState | null
  gatePassed: boolean
  sessions: Record<string, string>
  history?: Partial<Record<Column, PhaseState>>
  tickets: TicketInfo[]
  prs: PrInfo[]
  frontier?: Frontier
  ticketsError?: string
}

export type Ticket = { number: number; title: string; url: string; labels: string[]; type: string | null }
export type Doc = { href: string; title: string; kind: 'markdown'; text: string; url: string | null }
export type SessionStart = { slotName: string; seed: string; existing?: boolean }
