// KiPo's sessions live in the sidebar as KiPo / <repo name>, so the Sessions list
// stays tidy and each project's conversations sit together.
import type { useAppApi } from '@kirocrew/app-sdk'
import { backend } from './api'

type Api = ReturnType<typeof useAppApi>
type Folder = { id: string; name: string; parent_id?: string | null }

const FOLDER_NAME = 'KiPo'
// v2: re-file once into the per-repo subfolders (v1 filed everything flat in KiPo).
const TIDIED_KEY = 'kipo.sessionsFiled.v2'

const madeId = (made: { id?: string; folder?: { id?: string } } | null | undefined) => {
  const id = made?.id ?? made?.folder?.id
  if (!id) throw new Error("the sidebar didn't return the new folder")
  return id
}

// Creating a folder whose name the app already owns under the same parent returns
// that folder, so these are safe to call every time a session starts.
async function findOrMake(api: Api, name: string, parentId: string | null, icon?: string): Promise<string> {
  const folders = await api.get<Folder[]>('/api/chat/folders')
  const found = folders?.find(f => f.name === name && (f.parent_id || null) === parentId)
  if (found) return found.id
  return madeId(await api.post('/api/chat/folders', {
    name,
    ...(parentId ? { parent_id: parentId } : {}),
    ...(icon ? { icon } : {}),
  }))
}

export const kipoFolderId = (api: Api) => findOrMake(api, FOLDER_NAME, null, '⚗️')

// The repo's own name ("widgets" for acme/widgets) names its subfolder.
export const repoFolderName = (repo: string) => repo.split('/').pop() || repo

// KiPo / <repo name>. Falls back to the KiPo folder alone if the subfolder can't be made.
export async function repoFolderId(api: Api, repo: string): Promise<string> {
  const parent = await kipoFolderId(api)
  try { return await findOrMake(api, repoFolderName(repo), parent) } catch { return parent }
}

// Once per browser: move every session KiPo started into its repo's subfolder.
// Runs once so a session you later move elsewhere stays put.
export async function fileExistingSessions(api: Api): Promise<void> {
  if (localStorage.getItem(TIDIED_KEY)) return
  const { byRepo } = await backend.listSessions()
  const ids = new Map<string, string>()
  for (const { repo } of byRepo ?? []) {
    if (!ids.has(repo)) ids.set(repo, await repoFolderId(api, repo))
  }
  await Promise.all((byRepo ?? []).map(({ slot, repo }) =>
    api.patch(`/api/chat/slots/${encodeURIComponent(slot)}/folder`, { folder_id: ids.get(repo) })
      .catch(() => undefined), // a session that was closed or deleted is simply skipped
  ))
  localStorage.setItem(TIDIED_KEY, new Date().toISOString())
}
