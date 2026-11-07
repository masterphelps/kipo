import { Badge, Btn, Card, CardTitle } from '@kirocrew/app-sdk/ui'
import { useCallback, useEffect, useState } from 'react'
import { backend, errorText } from './api'
import { ErrorLine, PathChip } from './common'
import type { BrowseResult, FoundRepo, RepoConfig } from './types'

// Repos are picked, never typed: the backend finds local checkouts and reads
// each one's GitHub repo from its origin remote.
export function Settings({ onSaved }: { onSaved: (repos: RepoConfig[]) => void }) {
  const [found, setFound] = useState<FoundRepo[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [browsing, setBrowsing] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setFound((await backend.discoverRepos()).repos)
    } catch (e) {
      setError(errorText(e))
      setFound([])
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const run = async (key: string, action: () => Promise<{ repos: RepoConfig[] }>) => {
    setBusy(key)
    setError('')
    try {
      const out = await action()
      onSaved(out.repos)
      await refresh()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const add = (path: string) => run(path, () => backend.addRepo(path))
  const remove = (slug: string) => run(slug, () => backend.removeRepo(slug))

  if (!found) return <p className="text-sm text-muted">Looking for your repos…</p>

  const added = found.filter(r => r.configured)
  const available = found.filter(r => !r.configured && r.slug && !r.worktree)
  const unusable = found.filter(r => !r.configured && (!r.slug || r.worktree))

  return (
    <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ErrorLine>{error}</ErrorLine>

      <Card>
        <CardTitle>Your KiPo repos</CardTitle>
        {added.length === 0
          ? <p className="text-sm text-muted">None yet. Add one from the list below.</p>
          : (
            <ul className="flex flex-col gap-1">
              {added.map(r => (
                <RepoRow key={r.path} repo={r}>
                  <Btn danger disabled={busy === r.slug} onClick={() => r.slug && remove(r.slug)}>Remove</Btn>
                </RepoRow>
              ))}
            </ul>
          )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>Repos on this Mac</CardTitle>
          <Btn onClick={() => setBrowsing(b => !b)}>{browsing ? 'Close folder picker' : 'Pick another folder…'}</Btn>
        </div>
        {browsing && <FolderPicker busy={busy} onAdd={add} />}
        {available.length === 0
          ? <p className="text-sm text-muted">No other GitHub checkouts found in your usual code folders.</p>
          : (
            <ul className="flex flex-col gap-1">
              {available.map(r => (
                <RepoRow key={r.path} repo={r}>
                  <Btn primary disabled={busy === r.path} onClick={() => add(r.path)}>
                    {busy === r.path ? 'Adding…' : 'Add'}
                  </Btn>
                </RepoRow>
              ))}
            </ul>
          )}
        {unusable.length > 0 && (
          <details className="mt-3">
            <summary className="text-sm text-muted cursor-pointer">
              {unusable.length} more that can't be added
            </summary>
            <ul className="flex flex-col gap-1 mt-2">
              {unusable.map(r => (
                <RepoRow key={r.path} repo={r}>
                  <span className="text-sm text-muted">
                    {r.worktree ? 'a worktree of another checkout' : 'no GitHub remote'}
                  </span>
                </RepoRow>
              ))}
            </ul>
          </details>
        )}
      </Card>
    </div>
  )
}

function RepoRow({ repo, children }: { repo: FoundRepo; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-1.5">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">
          {repo.slug ?? repo.name}
          {repo.slug && repo.slug.split('/')[1]?.toLowerCase() !== repo.name.toLowerCase() && (
            <span className="text-muted font-normal"> · {repo.name}</span>
          )}
        </div>
        <div className="mt-0.5"><PathChip path={repo.path} /></div>
      </div>
      {children}
    </li>
  )
}

export function FolderPicker({ busy, onAdd, actionLabel = 'Add' }: {
  busy: string | null; onAdd: (path: string) => void; actionLabel?: string
}) {
  const [view, setView] = useState<BrowseResult | null>(null)
  const [error, setError] = useState('')

  const open = useCallback(async (path?: string) => {
    setError('')
    try { setView(await backend.browse(path)) } catch (e) { setError(errorText(e)) }
  }, [])

  useEffect(() => { void open() }, [open])

  return (
    <div
      className="rounded-md p-3 mb-3"
      style={{ background: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border)' }}
    >
      <ErrorLine>{error}</ErrorLine>
      {!view
        ? <p className="text-sm text-muted">Opening your home folder…</p>
        : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Btn disabled={!view.parent} onClick={() => view.parent && open(view.parent)}>Up</Btn>
              <PathChip path={view.path} />
              {view.here?.slug && (
                <Btn primary disabled={busy === view.path} onClick={() => onAdd(view.path)}>{actionLabel} this folder</Btn>
              )}
            </div>
            <ul className="flex flex-col max-h-72 overflow-y-auto">
              {view.folders.map(f => (
                <li key={f.path} className="flex items-center gap-2 py-1">
                  <button
                    type="button"
                    className="text-sm text-left flex-1 truncate hover:underline"
                    style={{ background: 'transparent', color: 'var(--text)' }}
                    onClick={() => open(f.path)}
                  >
                    {f.name}
                  </button>
                  {f.repo && (f.slug
                    ? <>
                        <Badge variant="aim">{f.slug}</Badge>
                        <Btn primary disabled={busy === f.path} onClick={() => onAdd(f.path)}>{actionLabel}</Btn>
                      </>
                    : <Badge variant="muted">no GitHub remote</Badge>)}
                </li>
              ))}
              {view.folders.length === 0 && <li className="text-sm text-muted">No folders here.</li>}
            </ul>
          </>
        )}
    </div>
  )
}
