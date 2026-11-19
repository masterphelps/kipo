// Client for the KiPo backend, reached through the gateway's reverse proxy.
import type {
  BrowseResult, Column, Config, Doc, Effort, EffortDetail, FoundRepo, RepoMeta, RepoTree, SessionObservation, SessionStart, Start, Ticket, TicketCard,
} from './types'

const BASE = '/apps/kipo/api'

export class BackendError extends Error {
  status: number
  code: string | null
  constructor(status: number, message: string, code: string | null) {
    super(message)
    this.name = 'BackendError'
    this.status = status
    this.code = code
  }
}

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new BackendError(0, "Couldn't reach the KiPo backend. Is the app running?", null)
  }
  const text = await res.text()
  let data: unknown = undefined
  if (text.trim()) {
    try { data = JSON.parse(text) } catch { data = undefined }
  }
  if (!res.ok) {
    const err = (data ?? {}) as { error?: unknown; code?: unknown }
    const message = typeof err.error === 'string' && err.error
      ? err.error
      : `The KiPo backend answered ${res.status}.`
    throw new BackendError(res.status, message, typeof err.code === 'string' ? err.code : null)
  }
  return data as T
}

const issuePath = (repo: string, n: number) => {
  const [owner, name] = repo.split('/')
  return `/initiatives/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/${n}`
}

export const backend = {
  getConfig: () => call<Config>('/config'),
  putConfig: (config: Config) => call<Config>('/config', 'PUT', config),
  discoverRepos: () => call<{ repos: FoundRepo[] }>('/repos/discover'),
  addRepo: (path: string) => call<Config>('/repos', 'POST', { path }),
  removeRepo: (slug: string) => call<Config>('/repos/remove', 'POST', { slug }),
  browse: (path?: string) =>
    call<BrowseResult>(path ? `/browse?path=${encodeURIComponent(path)}` : '/browse'),
  listInitiatives: () =>
    call<{ initiatives: Effort[]; repos?: RepoMeta[]; errors?: { repo: string; error: string; code?: string }[] }>('/initiatives'),
  startInitiative: (start: { path: string; description: string; start: Start; worktree: boolean; sourceIssue: number | null }) =>
    call<Effort>('/initiatives', 'POST', start),
  getInitiative: (repo: string, n: number) =>
    call<EffortDetail>(issuePath(repo, n)),
  // Next along the path, or `to` a later column.
  advance: (repo: string, n: number, force: boolean, to: Column | null = null) =>
    call<EffortDetail>(`${issuePath(repo, n)}/advance`, 'POST', { force, to }),
  // A column's session; `skill` makes its seed end with that skill's Run line.
  // `replace`: the thread's session is dead (stuck, closed, never started): a fresh slot.
  startSession: (repo: string, n: number, body: { column: Column; skill?: string | null; ticket?: number | null; mode?: 'implement-spec' | 'conductor' | null; replace?: boolean }) =>
    call<SessionStart>(`${issuePath(repo, n)}/session`, 'POST', { skill: null, ticket: null, mode: null, ...body }),
  // The session's seed (or hand-over message) went out: it has started. Until
  // then KiPo counts a recorded session as not started, and the page retries it.
  sessionStarted: (repo: string, n: number, key: string) =>
    call<{ started: { at: string; slot: string; seeded: boolean } }>(`${issuePath(repo, n)}/sessions/started`, 'POST', { key }),
  // The page closed these sessions (the close rule's closable ones): KiPo records them.
  sessionsClosed: (repo: string, n: number, keys: string[]) =>
    call<{ closed: Record<string, string> }>(`${issuePath(repo, n)}/sessions/closed`, 'POST', { keys }),
  // What Kiro Crew says of each open session (last message's time and author,
  // mid-turn or not), for the stall rule (backend/kipo/stalls.py).
  sessionsActivity: (repo: string, n: number, activity: Record<string, SessionObservation>) =>
    call<{ recorded: string[] }>(`${issuePath(repo, n)}/sessions/activity`, 'POST', { activity }),
  // The page woke a stalled session: KiPo records it in .kipo/<n>/wakes.json, once per stall.
  sessionsWoken: (repo: string, n: number, key: string, stall: string, why: string) =>
    call<{ wake: { at: string; stall: string; why: string } }>(`${issuePath(repo, n)}/sessions/woken`, 'POST', { key, stall, why }),
  // The "Run /<skill>: …" line, to send into a session that already exists.
  skillMessage: (repo: string, n: number, skill: string) =>
    call<{ message: string }>(`${issuePath(repo, n)}/skill`, 'POST', { skill }),
  listSessions: () => call<{ sessions: string[]; byRepo?: { slot: string; repo: string }[] }>('/sessions'),
  tree: (completed = false) => call<RepoTree>(completed ? '/tree?completed=1' : '/tree'),
  // The green dot: on the sidebar or off. Nothing changes on GitHub.
  setOnSidebar: (repo: string, number: number, kind: 'effort' | 'map', on: boolean) =>
    call<{ onSidebar: boolean }>('/sidebar', 'POST', { repo, number, kind, on }),
  // Off the sidebar and back; nothing changes on GitHub.
  hide: (repo: string, n: number) => call<{ hidden: boolean }>(`${issuePath(repo, n)}/hide`, 'POST', {}),
  unhide: (repo: string, n: number) => call<{ hidden: boolean }>(`${issuePath(repo, n)}/unhide`, 'POST', {}),
  removeInitiative: (repo: string, n: number) =>
    call<{ removed: boolean }>(`${issuePath(repo, n)}/remove`, 'POST', {}),
  ticket: (repo: string, n: number, t: number) =>
    call<TicketCard>(`${issuePath(repo, n)}/tickets/${t}`),
  frontier: (repo: string, n: number) =>
    call<{ tickets: Ticket[] }>(`${issuePath(repo, n)}/frontier`),
  doc: (repo: string, n: number, href: string) =>
    call<Doc>(`${issuePath(repo, n)}/doc?href=${encodeURIComponent(href)}`),
}

export function errorText(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}
