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
