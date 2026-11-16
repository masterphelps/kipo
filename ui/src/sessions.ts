// Opening a KiPo conversation: create the session (filed in the sidebar under
// KiPo / <repo name>) and send the backend's seed as its first message.
import type { useAppApi } from '@kirocrew/app-sdk'
import { repoFolderId } from './folder'

type Api = ReturnType<typeof useAppApi>

export async function openSession(api: Api, repo: string, slotName: string, seed: string, title: string, agent?: string): Promise<string> {
  let folderId: string | undefined
  try { folderId = await repoFolderId(api, repo) } catch { folderId = undefined }
  const row = await api.post<{ key?: string }>('/api/chat/slots', {
    name: slotName,
    title,
    ...(folderId ? { folder_id: folderId } : {}),
    // The app's own agent for this session (the conductor); the default agent otherwise.
    ...(agent ? { agent } : {}),
  })
  const key = row?.key || slotName
  await api.post('/api/chat?ws=1', { slot: key, message: seed })
  return key
}

// Closing a finished session: the dashboard stops it and saves its history (it
// can be resumed from history later). Each session is closed at most once per
// browser, so one you reopen by hand stays open.
const CLOSED_KEY = 'kipo.closedSessions.v1'

export const isClosed = (slot: string | null | undefined) => !!slot && closedSet().has(slot)

function closedSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(CLOSED_KEY) || '[]') as string[]) } catch { return new Set() }
}
function markClosed(slot: string) {
  const s = closedSet()
  s.add(slot)
  try { localStorage.setItem(CLOSED_KEY, JSON.stringify([...s].slice(-500))) } catch { /* full: fine */ }
}

// Close a dead session that a fresh one replaces (kipo_cli.py dispatch:
// stuck, closed, or never started), mid-turn or not: the thread must never
// have two live sessions. True once it's closed (or was never there).
export async function closeReplaced(api: Api, slot: string): Promise<boolean> {
  try {
    await api.del(`/api/chat/slots/${encodeURIComponent(slot)}`)
  } catch (e) {
    if (!/404|not.?found/i.test(String((e as Error)?.message ?? e))) return false
  }
  markClosed(slot)
  return true
}

// Close the given sessions unless one is still running (its agent is mid-turn,
// such as writing its last message) or is the one on screen. Kiro Crew's close
// (DELETE /api/chat/slots/<slot>) is what a session's ⋯ menu "Close session"
// does: stopped, history kept, resumable. Returns every given slot now known
// closed (closed here, closed by this browser before, or already gone).
export async function closeFinished(api: Api, slots: string[], onScreen: string | null): Promise<string[]> {
  const done = closedSet()
  const closed: string[] = []
  for (const slot of slots) {
    if (!slot || slot === onScreen) continue
    if (done.has(slot)) { closed.push(slot); continue }
    try {
      const info = await api.get<{ running?: boolean }>(`/api/chat/slots/${encodeURIComponent(slot)}?limit=1`)
      if (info?.running) continue
      await api.del(`/api/chat/slots/${encodeURIComponent(slot)}`)
      markClosed(slot)
      closed.push(slot)
    } catch (e) {
      // Already closed or gone: remember it so it isn't tried again.
      if (/404|not.?found/i.test(String((e as Error)?.message ?? e))) { markClosed(slot); closed.push(slot) }
    }
  }
  return closed
}
