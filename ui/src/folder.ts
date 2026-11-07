// KiPo's sessions live in one sidebar folder, so the Sessions list stays tidy.
import type { useAppApi } from '@kirocrew/app-sdk'
import { backend } from './api'

type Api = ReturnType<typeof useAppApi>

const FOLDER_NAME = 'KiPo'
const TIDIED_KEY = 'kipo.sessionsFiled.v1'

// Creating a folder whose name the app already owns returns that folder, so this
// is safe to call every time a session starts.
export async function kipoFolderId(api: Api): Promise<string> {
  const folders = await api.get<{ id: string; name: string; parent_id?: string | null }[]>('/api/chat/folders')
  const found = folders?.find(f => f.name === FOLDER_NAME && !f.parent_id)
  if (found) return found.id
  const made = await api.post<{ id?: string; folder?: { id?: string } }>('/api/chat/folders', { name: FOLDER_NAME, icon: '🚀' })
  const id = made?.id ?? made?.folder?.id
  if (!id) throw new Error("the sidebar didn't return the new folder")
  return id
}

// Once per browser: move every session KiPo started before sessions were
// filed into the folder. Runs once so a session you later move elsewhere stays put.
export async function fileExistingSessions(api: Api): Promise<void> {
  if (localStorage.getItem(TIDIED_KEY)) return
  const { sessions } = await backend.listSessions()
  if (sessions.length) {
    const folderId = await kipoFolderId(api)
    await Promise.all(sessions.map(slot =>
      api.patch(`/api/chat/slots/${encodeURIComponent(slot)}/folder`, { folder_id: folderId })
        .catch(() => undefined), // a session that was closed or deleted is simply skipped
    ))
  }
  localStorage.setItem(TIDIED_KEY, new Date().toISOString())
}
