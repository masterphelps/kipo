// Client for the KiPo backend, reached through the gateway's reverse proxy.
import type {
  BrowseResult, Config, Doc, FoundRepo, Initiative, Size, InitiativeDetail, PhaseId, SessionStart, Ticket,
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
  listInitiatives: () => call<{ initiatives: Initiative[] }>('/initiatives'),
  startInitiative: (start: { path: string; description: string; size: Size | null; worktree: boolean }) =>
    call<Initiative>('/initiatives', 'POST', start),
  getInitiative: (repo: string, n: number) =>
    call<InitiativeDetail>(issuePath(repo, n)),
  advance: (repo: string, n: number, force: boolean) =>
    call<InitiativeDetail>(`${issuePath(repo, n)}/advance`, 'POST', { force }),
  // Initiative-phase sessions, and wayfinder decision-ticket sessions in Discovery.
  startSession: (repo: string, n: number, phase: PhaseId, ticket: number | null) =>
    call<SessionStart>(`${issuePath(repo, n)}/session`, 'POST', { phase, ticket }),
  listSessions: () => call<{ sessions: string[] }>('/sessions'),
  removeInitiative: (repo: string, n: number) =>
    call<{ removed: boolean }>(`${issuePath(repo, n)}/remove`, 'POST', {}),
  frontier: (repo: string, n: number) =>
    call<{ tickets: Ticket[] }>(`${issuePath(repo, n)}/frontier`),
  ticketSession: (repo: string, n: number, t: number) =>
    call<SessionStart>(`${issuePath(repo, n)}/tickets/${t}/session`, 'POST', {}),
  ticketAdvance: (repo: string, n: number, t: number, force: boolean) =>
    call<InitiativeDetail>(`${issuePath(repo, n)}/tickets/${t}/advance`, 'POST', { force }),
  doc: (repo: string, n: number, href: string) =>
    call<Doc>(`${issuePath(repo, n)}/doc?href=${encodeURIComponent(href)}`),
}

export function errorText(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}
