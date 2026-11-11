import { Btn } from '@kirocrew/app-sdk/ui'
import { FolderGit2, FolderOpen, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { backend, errorText } from './api'
import { ErrorLine, T, muted, strong } from './common'
import { FolderPicker } from './FolderPicker'
import type { AvailableRepo } from './types'

// "Add repo", as a modal — the way Kiro adds a session folder. The checkouts on
// this Mac you haven't added yet (those with open wayfinder maps first), and a
// folder browser for anything else. Adding a repo puts it on the sidebar with
// all its maps and efforts under it.
export function AddRepoModal({ onAdded, onClose }: {
  onAdded: () => void
  onClose: () => void
}) {
  const [available, setAvailable] = useState<AvailableRepo[] | null>(null)
  const [error, setError] = useState('')
  const [browsing, setBrowsing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    backend.tree()
      .then(t => { if (live) setAvailable(t.available) })
      .catch(e => { if (live) { setAvailable([]); setError(errorText(e)) } })
    return () => { live = false }
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const add = async (path: string) => {
    setBusy(path)
    setError('')
    try {
      await backend.addRepo(path)
      onAdded()
      onClose()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div role="presentation" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.55)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh' }}>
      <div role="dialog" aria-modal="true" aria-label="Add a repo" onClick={e => e.stopPropagation()}
        style={{ width: 'min(560px, calc(100vw - 48px))', maxHeight: '72vh', display: 'flex', flexDirection: 'column',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 16px 48px rgba(0,0,0,.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...strong, fontSize: T.body }}>Add a repo</div>
            <div style={{ ...muted, fontSize: T.tiny, marginTop: 1 }}>
              It joins the sidebar with all its wayfinder maps and efforts under it. GitHub isn't changed.
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'inline-flex' }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 12px 14px' }}>
          <ErrorLine>{error}</ErrorLine>
          {available === null && <div style={{ ...muted, fontSize: T.small, padding: '6px 6px' }}>Looking for checkouts on this Mac…</div>}
          {available !== null && available.length > 0 && !browsing && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {available.slice(0, 12).map(r => (
                <button key={r.path} type="button" disabled={!!busy} onClick={() => void add(r.path)}
                  title={r.path}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover, rgba(255,255,255,0.06))' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 6,
                    background: 'transparent', color: 'var(--text)', cursor: busy ? 'default' : 'pointer', textAlign: 'left' }}>
                  <FolderGit2 size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: T.small, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {busy === r.path ? 'Adding…' : r.slug}
                  </span>
                  {r.maps > 0 && (
                    <span style={{ ...muted, fontSize: T.tiny, flexShrink: 0 }}>{r.maps} open map{r.maps === 1 ? '' : 's'}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {available !== null && available.length === 0 && !browsing && (
            <div style={{ ...muted, fontSize: T.small, padding: '6px 6px' }}>
              No un-added checkouts found under your home folder. Browse for one:
            </div>
          )}
          {browsing
            ? <div style={{ marginTop: 6 }}><FolderPicker busy={busy} onAdd={p => void add(p)} /></div>
            : (
              <button type="button" onClick={() => setBrowsing(true)}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover, rgba(255,255,255,0.06))' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 6, marginTop: 4,
                  background: 'transparent', color: 'var(--text)', cursor: 'pointer', width: '100%', textAlign: 'left', fontSize: T.small }}>
                <FolderOpen size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                Browse for a folder…
              </button>
            )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </div>
  )
}
