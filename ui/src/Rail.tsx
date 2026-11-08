import { Btn } from '@kirocrew/app-sdk/ui'
import { ExternalLink, EyeOff, FolderGit2, MoreHorizontal, Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Confirm, Menu } from './Menu'
import { T, fieldStyle, muted, strong, timeAgo } from './common'
import { LaneBars, frontierTotal, whoIsUp } from './Frontier'
import { TERM } from './glossary'
import { STAGE_LABELS, stageOfColumn, type Effort, type Stage } from './types'

// The left rail, after Spec Builder's spec list: one place to start something new,
// filter, and jump between efforts. One flat list, most recently touched first;
// each row shows its Decide and Deliver bars, or its stage before it has tickets.

export type RailView = 'maps'

// Once an effort has tickets (or a mapped fog), its bars say where it is; before
// that, its stage does.
const hasFrontier = (e: Effort) => !!e.frontier && frontierTotal(e.frontier.counts, e.frontier.fog) > 0

function progress(e: Effort): string {
  const repo = e.repo.split('/').pop() || e.repo
  if (hasFrontier(e)) {
    const up = whoIsUp(e.frontier!.counts)
    return up ? `${repo} · ${up}` : repo
  }
  const c = e.ticketCounts
  if (!c || !(c.open + c.closed)) return repo
  return `${repo}, ${c.closed} of ${c.open + c.closed} tickets done`
}

function StageTag({ stage }: { stage: Stage }) {
  return (
    <span style={{
      flexShrink: 0, fontSize: 10, lineHeight: '15px', padding: '0 6px', borderRadius: 999,
      border: '1px solid var(--accent)', color: 'var(--accent)', whiteSpace: 'nowrap',
    }}>
      {STAGE_LABELS[stage]}
    </span>
  )
}

export function Rail({ width, items, error, selected, onNew, onMaps, onSelect, onHide, onCollapse }: {
  width: number
  onCollapse: () => void
  items: Effort[] | null
  error: string
  selected: string | null
  view: RailView | null
  onNew: () => void
  onMaps: () => void
  onSelect: (i: Effort) => void
  onHide: (i: Effort) => void
}) {
  const [filter, setFilter] = useState('')
  const [hover, setHover] = useState<string | null>(null)
  // The open row menu, or its confirmation step.
  const [menu, setMenu] = useState<{ key: string; item: Effort; x: number; y: number; confirm: boolean } | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return (items ?? []).filter(i => !q || i.title.toLowerCase().includes(q) || i.repo.toLowerCase().includes(q))
  }, [items, filter])

  return (
    <nav
      aria-label="Efforts"
      style={{
        width,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <div style={{ padding: '12px 12px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Kiro's own buttons, so the sidebar matches the rest of the app. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <Btn primary onClick={onNew}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Plus size={14} />New effort</span></Btn>
          <span title="Your repos, with their efforts and wayfinder maps: choose what's on this sidebar">
            <Btn onClick={onMaps}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><FolderGit2 size={14} />Repos</span></Btn>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter efforts"
          aria-label="Filter efforts"
          style={{ ...fieldStyle, fontSize: T.small, padding: '4px 8px', flex: 1, minWidth: 0 }}
        />
        <button type="button" onClick={onCollapse} title="Fold the effort list away" aria-label="Fold the effort list away"
          style={{ background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, fontSize: 14, flexShrink: 0 }}>
          «
        </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 6px 8px' }}>
        {error && <div style={{ color: 'var(--danger-text)', fontSize: T.small, padding: '4px 6px' }}>{error}</div>}
        {items === null && !error && <div style={{ ...muted, fontSize: T.small, padding: '4px 6px' }}>Loading…</div>}
        {items !== null && items.length === 0 && (
          <div style={{ ...muted, fontSize: T.small, padding: '4px 6px' }}>No efforts yet.</div>
        )}
        {items !== null && items.length > 0 && !shown.length && (
          <div style={{ ...muted, fontSize: T.small, padding: '4px 6px' }}>Nothing matches.</div>
        )}
        {shown.length > 0 && (
            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {shown.map(i => {
                const key = `${i.repo}#${i.number}`
                const on = key === selected
                return (
                  <div key={key} style={{ position: 'relative' }}
                    onContextMenu={e => { e.preventDefault(); setMenu({ key, item: i, x: e.clientX, y: e.clientY, confirm: false }) }}
                    onPointerEnter={() => setHover(key)} onPointerLeave={() => setHover(h => (h === key ? null : h))}>
                  <button
                    type="button"
                    onClick={() => onSelect(i)}
                    aria-current={on ? 'page' : undefined}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 8px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: on ? 'var(--bg-elevated)' : 'transparent',
                      color: 'var(--text)',
                      border: on ? '1px solid var(--border)' : '1px solid transparent',
                    }}
                  >
                    <div style={{ ...(on ? strong : {}), fontSize: T.body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {i.title}
                    </div>
                    {hasFrontier(i) && (
                      <div style={{ marginTop: 5 }}><LaneBars frontier={i.frontier!} /></div>
                    )}
                    <div style={{ ...muted, fontSize: T.tiny, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {i.kind === 'map' && (
                        <span title="A wayfinder map, shown as it stands" style={{ flexShrink: 0, padding: '0 5px', borderRadius: 4, border: '1px solid var(--border)', color: 'var(--muted)' }}>Map</span>
                      )}
                      {!hasFrontier(i) && <StageTag stage={i.stage ?? stageOfColumn(i.column)} />}
                      <span title={`${progress(i)}\n\n${TERM.HITL}\n${TERM.Agent}`} style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{progress(i)}</span>
                      <span style={{ flexShrink: 0 }}>{timeAgo(i.updatedAt)}</span>
                    </div>
                  </button>
                  {(hover === key || on || menu?.key === key) && (
                    <button type="button" aria-label={`More for ${i.title}`} aria-haspopup="menu" title="More"
                      onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setMenu({ key, item: i, x: r.left, y: r.bottom + 2, confirm: false }) }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      style={{ position: 'absolute', top: 5, right: 5, width: 22, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', background: 'transparent', color: 'var(--text-muted, var(--muted))', cursor: 'pointer', padding: 0 }}>
                      <MoreHorizontal size={14} />
                    </button>
                  )}
                  </div>
                )
              })}
            </div>
        )}
      </div>

      {menu && !menu.confirm && (
        <Menu x={menu.x} y={menu.y} onClose={closeMenu} items={[
          { label: 'Open on GitHub', icon: ExternalLink, onSelect: () => window.open(menu.item.url, '_blank', 'noreferrer') },
          { separator: true },
          { label: 'Remove from sidebar…', icon: EyeOff, danger: true, onSelect: () => setMenu({ ...menu, confirm: true }) },
        ]} />
      )}
      {menu?.confirm && (
        <Confirm x={menu.x} y={menu.y} onClose={closeMenu} action="Remove"
          title={`Remove "${menu.item.title}" from the sidebar?`}
          onConfirm={() => onHide(menu.item)}>
          {menu.item.kind === 'map'
            ? 'The map stays open on GitHub. Put it back from Repos.'
            : 'Its issue stays open on GitHub. Put it back from Repos.'}
        </Confirm>
      )}
    </nav>
  )
}

// The effort list folded away: a narrow strip that still lets you switch efforts.
// Each effort is a small marker colored by who's up (amber: you, teal: an agent,
// blue: building or in review, green: all done, grey: nothing yet); hover for its title.
export function RailStrip({ items, selected, onNew, onSelect, onExpand }: {
  items: Effort[] | null
  selected: string | null
  onNew: () => void
  onSelect: (i: Effort) => void
  onExpand: () => void
}) {
  const color = (e: Effort) => {
    const c = e.frontier?.counts
    if (!c) return 'var(--muted)'
    if (c.you) return '#f5b14c'
    if (c.afk) return '#2dd4bf'
    if (c.building || c.review) return '#60a5fa'
    if (c.done) return '#3fae6a'
    return 'var(--muted)'
  }
  const icon = { width: 28, height: 28, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' } as const
  return (
    <nav aria-label="Efforts" style={{ width: 44, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 0', borderRight: '1px solid var(--border)', background: 'var(--bg)', minHeight: 0 }}>
      <button type="button" onClick={onExpand} title="Show the effort list" aria-label="Show the effort list"
        style={{ ...icon, background: 'transparent', color: 'var(--muted)', fontSize: 14 }}>»</button>
      <button type="button" onClick={onNew} title="New effort" aria-label="New effort"
        style={{ ...icon, background: 'var(--accent)', color: 'var(--accent-fg, #fff)', fontWeight: 700, fontSize: 16, borderRadius: 999 }}>+</button>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 6, scrollbarWidth: 'none' }}>
        {(items ?? []).map(e => {
          const key = `${e.repo}#${e.number}`
          const on = key === selected
          return (
            <button key={key} type="button" onClick={() => onSelect(e)} title={`${e.title} (${e.repo.split('/').pop()})`}
              aria-current={on ? 'page' : undefined}
              style={{ ...icon, background: on ? 'var(--bg-elevated)' : 'transparent', border: on ? '1px solid var(--border)' : '1px solid transparent', flexShrink: 0 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: color(e) }} />
            </button>
          )
        })}
      </div>
    </nav>
  )
}
