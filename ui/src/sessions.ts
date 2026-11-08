// Opening a KiPo conversation: create the session (filed in the sidebar under
// KiPo / <repo name>) and send the backend's seed as its first message.
import type { useAppApi } from '@kirocrew/app-sdk'
import { repoFolderId } from './folder'

type Api = ReturnType<typeof useAppApi>

export async function openSession(api: Api, repo: string, slotName: string, seed: string, title: string): Promise<string> {
  let folderId: string | undefined
  try { folderId = await repoFolderId(api, repo) } catch { folderId = undefined }
  const row = await api.post<{ key?: string }>('/api/chat/slots', {
    name: slotName,
    title,
    ...(folderId ? { folder_id: folderId } : {}),
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

// Close the given sessions unless one is still running (its agent is mid-turn,
// such as writing its last message) or is the one on screen. Returns how many closed.
export async function closeFinished(api: Api, slots: string[], onScreen: string | null): Promise<number> {
  const done = closedSet()
  let closed = 0
  for (const slot of slots) {
    if (!slot || done.has(slot) || slot === onScreen) continue
    try {
      const info = await api.get<{ running?: boolean }>(`/api/chat/slots/${encodeURIComponent(slot)}?limit=1`)
      if (info?.running) continue
      await api.del(`/api/chat/slots/${encodeURIComponent(slot)}`)
      markClosed(slot)
      closed++
    } catch (e) {
      // Already closed or gone: remember it so it isn't tried again.
      if (/404|not.?found/i.test(String((e as Error)?.message ?? e))) markClosed(slot)
    }
  }
  return closed
}
