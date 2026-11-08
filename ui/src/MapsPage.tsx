import { useEffect, useMemo, useState } from 'react'
import { backend, errorText } from './api'
import { ActionButton, ErrorLine, T, fieldStyle, muted, strong, timeAgo } from './common'
import type { HiddenEffort, MapListing, RepoConfig } from './types'

// Pick the wayfinder maps to work on. Every open map in your repos is listed,
// grouped by repo; tick the ones you want and open them. A map whose repo KiPo
// doesn't watch yet adds that repo as it opens. Below: efforts you took off the
// sidebar, to bring back.
const box = { border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', background: 'var(--bg)' } as const
const plainList = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' } as const

export function MapsPage({ onOpened, onRestored }: {
  onOpened: (first: { repo: string; number: number } | null) => void
  onRestored: () => void
}) {
  const [maps, setMaps] = useState<MapListing[] | null>(null)
  const [hidden, setHidden] = useState<HiddenEffort[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [repos, setRepos] = useState<RepoConfig[]>([])

  const load = () => Promise.all([
    backend.listMaps()
      .then(r => { setMaps(r.maps); setHidden(r.hidden); setError('') })
      .catch(e => { setError(errorText(e)); setMaps([]) }),
    backend.getConfig().then(c => setRepos(c?.repos ?? [])).catch(() => undefined),
  ])

  // Stop watching a repo: its efforts and maps leave the sidebar. Nothing on
  // GitHub or on disk changes; opening one of its maps adds it back.
  const removeRepo = async (slug: string) => {
    try {
      const c = await backend.removeRepo(slug)
      setRepos(c.repos)
      onRestored()
      await load()
    } catch (e) {
      setError(errorText(e))
    }
  }
  useEffect(() => { void load() }, [])

  const key = (m: { repo: string; number: number }) => `${m.repo}#${m.number}`
  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const by = new Map<string, MapListing[]>()
    for (const m of maps ?? []) {
      if (q && !m.title.toLowerCase().includes(q) && !m.repo.toLowerCase().includes(q)) continue
      by.set(m.repo, [...(by.get(m.repo) ?? []), m])
    }
    return [...by.entries()]
  }, [maps, filter])

  const toggle = (m: MapListing) => setPicked(p => {
    const next = new Set(p)
    if (next.has(key(m))) next.delete(key(m)); else next.add(key(m))
    return next
  })
  const openable = (m: MapListing) => !m.opened && !!(m.repoAdded || m.checkout)

  const open = async () => {
    const chosen = (maps ?? []).filter(m => picked.has(key(m))).map(m => ({ repo: m.repo, number: m.number }))
    if (!chosen.length) return
    setBusy(true)
    setError('')
    try {
      const r = await backend.openMaps(chosen)
      if (r.errors.length) setError(r.errors.map(e => `${e.repo} #${e.number}: ${e.error}`).join(' '))
      setPicked(new Set())
      await load()
      if (r.opened.length) onOpened(r.opened[0])
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const restore = async (h: HiddenEffort) => {
    try {
      await backend.unhide(h.repo, h.number)
      setHidden(list => list.filter(x => key(x) !== key(h)))
      onRestored()
    } catch (e) {
      setError(errorText(e))
    }
  }

  const count = picked.size
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '18px 24px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ ...strong, fontSize: T.title }}>Open a wayfinder map</div>
          <div style={{ ...muted, fontSize: T.small, marginTop: 2 }}>
            Every open map in your repos. Tick the ones to work on; each opens as an effort on the sidebar.
          </div>
        </div>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter maps" aria-label="Filter maps"
          style={{ ...fieldStyle, fontSize: T.small, padding: '5px 8px', width: 220 }} />
        <ActionButton primary disabled={!count || busy} onClick={() => void open()}>
          {busy ? 'Opening…' : count ? `Open ${count} map${count === 1 ? '' : 's'}` : 'Open maps'}
        </ActionButton>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 24px 24px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 860 }}>
        <ErrorLine>{error}</ErrorLine>
        {maps === null && <span style={{ ...muted, fontSize: T.small }}>Looking for maps on GitHub…</span>}
        {maps !== null && !groups.length && (
          <span style={{ ...muted, fontSize: T.small }}>{filter ? 'No map matches.' : 'No open wayfinder maps in your repos.'}</span>
        )}
        {groups.map(([repo, list]) => {
          const first = list[0]
          return (
            <section key={repo} style={box}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <span style={{ ...strong, fontSize: T.body }}>{repo}</span>
                <span style={{ ...muted, fontSize: T.tiny }}>
                  {first.repoAdded ? `${list.length} map${list.length === 1 ? '' : 's'}`
                    : first.checkout ? 'Not in KiPo yet: opening a map adds this repo'
                    : "Not checked out on this Mac, so KiPo can't work in it"}
                </span>
              </div>
              <ul style={plainList}>
                {list.map(m => {
                  const can = openable(m)
                  const on = picked.has(key(m))
                  return (
                    <li key={key(m)}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px', borderRadius: 6,
                        cursor: can ? 'pointer' : 'default', background: on ? 'var(--bg-elevated)' : 'transparent' }}>
                        <input type="checkbox" checked={m.opened || on} disabled={!can} onChange={() => toggle(m)}
                          style={{ width: 15, height: 15, accentColor: 'var(--accent)', flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: T.body, color: can || m.opened ? 'var(--text)' : 'var(--muted)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.title}
                        </span>
                        {m.opened && (
                          <span style={{ fontSize: T.tiny, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                            {m.effort ? `on the sidebar as effort #${m.effort}` : 'on the sidebar'}
                          </span>
                        )}
                        <span style={{ ...muted, fontSize: T.tiny, whiteSpace: 'nowrap' }}>#{m.number} · {timeAgo(m.updatedAt)}</span>
                        <a href={m.url} target="_blank" rel="noreferrer" title="Open on GitHub" onClick={e => e.stopPropagation()}
                          style={{ color: 'var(--muted)', fontSize: T.small, textDecoration: 'none' }}>↗</a>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}

        {hidden.length > 0 && (
          <section style={box}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <span style={{ ...strong, fontSize: T.body }}>Taken off the sidebar</span>
              <span style={{ ...muted, fontSize: T.tiny }}>Still open on GitHub. Restore puts one back.</span>
            </div>
            <ul style={{ ...plainList, gap: 2 }}>
              {hidden.map(h => (
                <li key={key(h)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: T.body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.title}</span>
                  <span style={{ ...muted, fontSize: T.tiny, whiteSpace: 'nowrap' }}>{h.repo.split('/').pop()} #{h.number}</span>
                  <ActionButton onClick={() => void restore(h)}>Restore</ActionButton>
                </li>
              ))}
            </ul>
          </section>
        )}

        {repos.length > 0 && (
          <section style={box}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <span style={{ ...strong, fontSize: T.body }}>Repos KiPo watches</span>
              <span style={{ ...muted, fontSize: T.tiny }}>Added when you open a map or start an effort in one. Removing only stops KiPo watching it.</span>
            </div>
            <ul style={{ ...plainList, gap: 2 }}>
              {repos.map(r => (
                <li key={r.slug} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px' }}>
                  <span style={{ fontSize: T.body }}>{r.slug}</span>
                  <span style={{ ...muted, fontSize: T.tiny, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.path}</span>
                  <ActionButton danger onClick={() => void removeRepo(r.slug)}>Remove</ActionButton>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
