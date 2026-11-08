import { Badge, Btn } from '@kirocrew/app-sdk/ui'
import { useCallback, useEffect, useState } from 'react'
import { backend, errorText } from './api'
import { ErrorLine, PathChip } from './common'
import type { BrowseResult } from './types'

// A folder browser over your home folder, marking which folders are git checkouts
// with a GitHub remote: used by Add repo and the new-effort form.
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
