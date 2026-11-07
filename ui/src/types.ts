// Shapes from CONTRACT.md. Change the contract first, then these.

// Two levels: the initiative moves through PHASES as one plan; once Design files
// tickets, each ticket moves through STAGES on its own while the initiative is in
// delivery.
export const PHASES = ['intake', 'discovery', 'refinement', 'design', 'delivery', 'release', 'operate'] as const
export type PhaseId = typeof PHASES[number]

export const PHASE_LABELS: Record<PhaseId, string> = {
  intake: 'Intake',
  discovery: 'Discovery',
  refinement: 'Refinement',
  design: 'Design',
  delivery: 'Delivery',
  release: 'Release',
  operate: 'Operate',
}

export const STAGES = ['build', 'review', 'test', 'security', 'ready', 'shipped'] as const
export type Stage = typeof STAGES[number]

export const STAGE_LABELS: Record<Stage, string> = {
  build: 'Build',
  review: 'Review',
  test: 'Test',
  security: 'Security',
  ready: 'Ready',
  shipped: 'Shipped',
}

// The stages a ticket is actively worked in, each with its own skill and session.
export const WORK_STAGES: Stage[] = ['build', 'review', 'test', 'security']

export type Size = 'small' | 'feature' | 'foggy' | 'bug'
export type ShipMode = 'together' | 'each'

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

export type Initiative = {
  repo: string
  number: number
  title: string
  url: string
  phase: PhaseId
  size: Size | null
  destination: string
  updatedAt: string
  ticketsByStage?: Partial<Record<Stage, number>> | null
}

export type Decision = {
  id: string
  title: string
  options: string[]
  recommended: string | null
  answer: string | null
}

export type GateItem = { id: string; label: string; done: boolean }
export type Artifact = { label: string; href: string }

export type PhaseState = {
  phase: string
  summary: string | null
  blocking: string | null
  decisions: Decision[]
  gate: GateItem[]
  artifacts: Artifact[]
  size?: Size | null
  ship?: ShipMode | null
  // Skills the phase agent loaded, in order; written by the phase skill.
  skillsUsed?: string[]
}

// What each phase or stage's skill routes to, so the page can show what's unused.
// Mirrors skills/phase-<id>/SKILL.md; the agent picks the ones the size needs.
export const ROUTED_SKILLS: Record<string, string[]> = {
  intake: ['phase-intake', 'triage', 'ask-matt'],
  discovery: ['phase-discovery', 'grill-with-docs', 'domain-modeling', 'research', 'to-questionnaire', 'wayfinder', 'diagnosing-bugs'],
  refinement: ['phase-refinement', 'grilling', 'prototype', 'handoff'],
  design: ['phase-design', 'to-spec', 'codebase-design', 'to-tickets'],
  build: ['phase-build', 'implement', 'tdd'],
  review: ['phase-review', 'code-review', 'pr'],
  test: ['phase-test', 'tdd', 'verification-before-completion'],
  security: ['phase-security', 'security-review'],
  release: ['phase-release', 'deploy-checklist', 'wizard'],
  operate: ['phase-operate', 'diagnosing-bugs', 'retro', 'improve-codebase-architecture'],
}

export type TicketDetail = {
  number: number
  title: string
  url: string
  state: 'OPEN' | 'CLOSED'
  stage: Stage | null
  blockedBy: number[]
  ticketState: PhaseState | null
  gatePassed: boolean
  sessionKey: string | null
  prUrl: string | null
}

export type Delivery = {
  total: number
  byStage: Partial<Record<Stage, number>>
  canAdvance: boolean
  reason: string | null
}

export type InitiativeDetail = Initiative & {
  repoPath: string
  mapIssue: number | null
  specPath: string | null
  artifacts: Artifact[]
  phaseLog: string[]
  state: PhaseState | null
  gatePassed: boolean
  sessions: Record<string, string>
  ship: ShipMode | null
  tickets: TicketDetail[]
  delivery: Delivery | null
  // What each earlier phase recorded (its archived state), keyed by phase.
  history?: Partial<Record<PhaseId, PhaseState>>
  // Set when tickets couldn't be read, or blocking couldn't be checked.
  ticketsError?: string
  ticketsNote?: string
}

export type Ticket = {
  number: number
  title: string
  url: string
  labels: string[]
  type: string | null
}

export type Doc = { href: string; title: string; kind: 'markdown'; text: string; url: string | null }

export type SessionStart = { slotName: string; seed: string }
