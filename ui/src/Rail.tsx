import { Btn } from '@kirocrew/app-sdk/ui'
import { ChevronRight, ExternalLink, EyeOff, FolderGit2, FolderPlus, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Confirm, Menu } from './Menu'
import { MapTag, T, fieldStyle, muted, strong, timeAgo } from './common'
import { TERM } from './glossary'
import { stationGlance, StationGlanceBar } from './Stations'
import { STAGE_LABELS, stageOfColumn, type Effort, type RepoMeta, type Stage } from './types'

// The left rail: every repo added to KiPo, with all its wayfinder maps and
// efforts under it — the sidebar IS the repo tree. Each effort row is its name,
// its seven stations as a tiny segment row, and its front. Add repo opens a
// modal (like Kiro's add-session-folder); a repo's own menu removes it.

const REPO_OPEN_KEY = 'kipo.rail.repoOpen'
const readRepoOpen = (): Record<string, boolean> => {
  try { return JSON.parse(localStorage.getItem(REPO_OPEN_KEY) || '{}') } catch { return {} }
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

export function Rail({ width, items, repos, error, notice, selected, spineSlot, onNew, onAddRepo, onRemoveRepo, onRestore, onSelect, onHide, onRemove, onCollapse }: {
  width: number
  onCollapse: () => void
  items: Effort[] | null
  repos: RepoMeta[] | null // the added repos, in config order; the groups
  error: string
  notice?: string // degraded, not broken: GitHub refused some calls, showing last known
  selected: string | null
  // The open effort's stations render here, under its row: the Workspace
  // portals its spine (conductor + seven stations) into this element.
  spineSlot?: (el: HTMLElement | null) => void
  onNew: () => void
  onAddRepo: () => void
  onRemoveRepo: (slug: string) => void
  onRestore: (slug: string, numbers: number[]) => void // unhide what was removed
  onSelect: (i: Effort) => void
  onHide: (i: Effort) => void
  onRemove: (i: Effort) => void // closes a KiPo effort's issue as not planned
}) {
  const [filter, setFilter] = useState('')
  const [hover, setHover] = useState<string | null>(null)
  // One effort open at a time (its card glows); clicking its header folds the
  // spine away and back. Picking another effort opens that one instead.
  const [expanded, setExpanded] = useState(true)
  useEffect(() => { setExpanded(true) }, [selected])
  // The open row menu, or its confirmation step.
  const [menu, setMenu] = useState<{ key: string; item: Effort; x: number; y: number; confirm: false | 'hide' | 'remove' } | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])
  // A repo's own menu (Open on GitHub, Remove repo), or its confirmation.
  const [repoMenu, setRepoMenu] = useState<{ slug: string; x: number; y: number; confirm: boolean } | null>(null)
  // Each repo folds open and shut, remembered per browser.
  const [repoOpen, setRepoOpen] = useState<Record<string, boolean>>(readRepoOpen)
  useEffect(() => { localStorage.setItem(REPO_OPEN_KEY, JSON.stringify(repoOpen)) }, [repoOpen])
  const isRepoOpen = (slug: string) => repoOpen[slug] !== false

  const q = filter.trim().toLowerCase()
  // The repos in config order, each with its efforts and maps; a repo whose
  // name matches the filter keeps everything, otherwise its rows are filtered.
  const groups = useMemo(() => {
    const bySlug = new Map<string, Effort[]>()
    for (const i of items ?? []) {
      const list = bySlug.get(i.repo) ?? []
      list.push(i)
      bySlug.set(i.repo, list)
    }
    const slugs = (repos ?? []).map(r => r.slug)
    for (const slug of bySlug.keys()) if (!slugs.includes(slug)) slugs.push(slug)
    return slugs.map(slug => {
      const meta = (repos ?? []).find(r => r.slug === slug) ?? { slug, path: '', hidden: [] }
      const own = bySlug.get(slug) ?? []
      const nameHit = !q || slug.toLowerCase().includes(q)
      const rows = nameHit ? own : own.filter(i => i.title.toLowerCase().includes(q))
      return { meta, rows, show: !q || nameHit || rows.length > 0 }
    }).filter(g => g.show)
  }, [items, repos, q])

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
          <span title="Add a repo: it joins this sidebar with all its maps and efforts under it">
            <Btn onClick={onAddRepo}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><FolderPlus size={14} />Add repo</span></Btn>
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
        {!error && notice && (
          <div style={{ color: '#f5b14c', fontSize: T.tiny, padding: '4px 6px', lineHeight: 1.4 }}>{notice}</div>
        )}
        {items === null && !error && <div style={{ ...muted, fontSize: T.small, padding: '4px 6px' }}>Loading…</div>}
        {items !== null && !groups.length && (
          <div style={{ ...muted, fontSize: T.small, padding: '4px 6px' }}>
            {q ? 'Nothing matches.' : 'No repos yet. Add one; its maps and efforts show up under it.'}
          </div>
        )}
        {groups.map(g => {
          const open = isRepoOpen(g.meta.slug) || !!q
          const name = g.meta.slug.split('/').pop() ?? g.meta.slug
          return (
            <div key={g.meta.slug} style={{ marginTop: 4 }}>
              {/* The repo's own row, in Kiro's folder style: fold, name, ⋯. */}
              <div
                onContextMenu={e => { e.preventDefault(); setRepoMenu({ slug: g.meta.slug, x: e.clientX, y: e.clientY, confirm: false }) }}
                onPointerEnter={() => setHover(`repo:${g.meta.slug}`)} onPointerLeave={() => setHover(h => (h === `repo:${g.meta.slug}` ? null : h))}
                style={{ display: 'flex', alignItems: 'center', gap: 4, borderRadius: 6, padding: '3px 4px',
                  background: hover === `repo:${g.meta.slug}` ? 'var(--bg-hover, rgba(255,255,255,0.05))' : 'transparent' }}>
                <button type="button" onClick={() => setRepoOpen(o => ({ ...o, [g.meta.slug]: !open }))}
                  aria-expanded={open} title={g.meta.path || g.meta.slug}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, minWidth: 0, background: 'transparent',
                    color: 'var(--text)', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                  <ChevronRight size={11} aria-hidden style={{ flexShrink: 0, color: 'var(--muted)', transition: 'transform .12s',
                    transform: open ? 'rotate(90deg)' : undefined }} />
                  <FolderGit2 size={13} aria-hidden style={{ flexShrink: 0, color: 'var(--muted)' }} />
                  <span style={{ fontSize: T.small, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                    {name}
                  </span>
                  <span style={{ ...muted, fontSize: T.tiny, flexShrink: 0 }}>
                    {g.rows.length || (open ? '' : '0')}
                  </span>
                </button>
                {(hover === `repo:${g.meta.slug}` || repoMenu?.slug === g.meta.slug) && (
                  <button type="button" aria-label={`More for ${g.meta.slug}`} aria-haspopup="menu" title="More"
                    onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setRepoMenu({ slug: g.meta.slug, x: r.left, y: r.bottom + 2, confirm: false }) }}
                    style={{ width: 22, height: 18, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                    <MoreHorizontal size={13} />
                  </button>
                )}
              </div>
              {open && !g.rows.length && (
                <div style={{ ...muted, fontSize: T.tiny, padding: '2px 6px 4px 24px' }}>No maps or efforts yet.</div>
              )}
              {open && g.rows.length > 0 && (
            <div style={{ marginTop: 2, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {g.rows.map(i => {
                const key = `${i.repo}#${i.number}`
                const on = key === selected
                const unfolded = on && !!spineSlot && expanded
                return (
                  <div key={key}
                    style={{
                      position: 'relative', borderRadius: 8, overflow: 'hidden', background: 'var(--bg)',
                      // The open map glows; the rest sit as quiet cards.
                      border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                      boxShadow: on ? '0 0 12px color-mix(in srgb, var(--accent) 35%, transparent)' : undefined,
                    }}
                    onContextMenu={e => { e.preventDefault(); setMenu({ key, item: i, x: e.clientX, y: e.clientY, confirm: false }) }}
                    onPointerEnter={() => setHover(key)} onPointerLeave={() => setHover(h => (h === key ? null : h))}>
                  <button
                    type="button"
                    onClick={() => { if (on) setExpanded(e => !e); else onSelect(i) }}
                    aria-current={on ? 'page' : undefined}
                    aria-expanded={on && spineSlot ? expanded : undefined}
                    title={on ? (expanded ? 'Fold this effort\'s stations away' : 'Show this effort\'s stations') : undefined}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 8px',
                      cursor: 'pointer',
                      background: on ? 'var(--bg-elevated)' : 'transparent',
                      color: 'var(--text)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ChevronRight size={11} aria-hidden style={{
                        flexShrink: 0, color: 'var(--muted)', transition: 'transform .12s',
                        transform: unfolded ? 'rotate(90deg)' : undefined,
                      }} />
                      <span style={{ ...(on ? strong : {}), flex: 1, minWidth: 0, fontSize: T.body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <span style={{ ...muted, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>#{i.number}</span> {i.title}
                      </span>
                    </div>
                    {(() => {
                      // The open effort's spine unfolds right below: its glance
                      // bar and front line would say the same thing twice.
                      if (unfolded) {
                        return (
                          <div style={{ ...muted, fontSize: T.tiny, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <MapTag kind={i.kind} map={i.mapIssue} />
                            <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.repo.split('/').pop()}</span>
                            <span style={{ flexShrink: 0 }}>{timeAgo(i.updatedAt)}</span>
                          </div>
                        )
                      }
                      const g = i.frontier?.stations ? stationGlance(i.frontier.stations) : null
                      return (<>
                        {g && <div style={{ marginTop: 6 }}><StationGlanceBar glance={g} /></div>}
                        <div style={{ ...muted, fontSize: T.tiny, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MapTag kind={i.kind} map={i.mapIssue} />
                          {!g && <StageTag stage={i.stage ?? stageOfColumn(i.column)} />}
                          <span title={g ? `${g.bits || g.front}\n\n${TERM.HITL}\n${TERM.Agent}` : undefined}
                            style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {g ? (g.bits || g.front) : i.repo.split('/').pop()}
                          </span>
                          <span style={{ flexShrink: 0 }}>{timeAgo(i.updatedAt)}</span>
                        </div>
                      </>)
                    })()}
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
                  {/* The open effort unfolds in place: its spine (conductor +
                      seven stations) portals in here from the Workspace. */}
                  {unfolded && <div ref={spineSlot} style={{ borderTop: '1px solid var(--border)' }} />}
                  </div>
                )
              })}
            </div>
              )}
              {/* What you removed from this repo's list, one click from coming back. */}
              {open && g.meta.hidden.length > 0 && (
                <button type="button" onClick={() => onRestore(g.meta.slug, g.meta.hidden)}
                  title={`Removed from the sidebar: #${g.meta.hidden.join(', #')}. Click to restore them.`}
                  style={{ ...muted, fontSize: T.tiny, background: 'transparent', cursor: 'pointer',
                    padding: '3px 6px 2px 24px', textAlign: 'left' }}>
                  {g.meta.hidden.length} removed · restore
                </button>
              )}
            </div>
          )
        })}
      </div>

      {menu && !menu.confirm && (
        <Menu x={menu.x} y={menu.y} onClose={closeMenu} items={[
          { label: 'Open on GitHub', icon: ExternalLink, onSelect: () => window.open(menu.item.url, '_blank', 'noreferrer') },
          { separator: true },
          { label: 'Remove from sidebar…', icon: EyeOff, danger: true, onSelect: () => setMenu({ ...menu, confirm: 'hide' }) },
          ...(menu.item.kind === 'map' ? [] : [
            { label: 'Close effort as not planned…', icon: Trash2, danger: true, onSelect: () => setMenu({ ...menu, confirm: 'remove' as const }) },
          ]),
        ]} />
      )}
      {menu?.confirm === 'hide' && (
        <Confirm x={menu.x} y={menu.y} onClose={closeMenu} action="Remove"
          title={`Remove "${menu.item.title}" from the sidebar?`}
          onConfirm={() => onHide(menu.item)}>
          {menu.item.kind === 'map'
            ? 'The map stays open on GitHub. Its repo\'s "removed · restore" line brings it back.'
            : 'Its issue stays open on GitHub. Its repo\'s "removed · restore" line brings it back.'}
        </Confirm>
      )}
      {menu?.confirm === 'remove' && (
        <Confirm x={menu.x} y={menu.y} onClose={closeMenu} action="Close it"
          title={`Close "${menu.item.title}" as not planned?`}
          onConfirm={() => onRemove(menu.item)}>
          Its issue closes on GitHub as not planned and it leaves the sidebar.
        </Confirm>
      )}
      {repoMenu && !repoMenu.confirm && (
        <Menu x={repoMenu.x} y={repoMenu.y} onClose={() => setRepoMenu(null)} items={[
          { label: 'Open on GitHub', icon: ExternalLink, onSelect: () => window.open(`https://github.com/${repoMenu.slug}`, '_blank', 'noreferrer') },
          { separator: true },
          { label: 'Remove repo…', icon: Trash2, danger: true, onSelect: () => setRepoMenu({ ...repoMenu, confirm: true }) },
        ]} />
      )}
      {repoMenu?.confirm && (
        <Confirm x={repoMenu.x} y={repoMenu.y} onClose={() => setRepoMenu(null)} action="Remove"
          title={`Remove ${repoMenu.slug} from KiPo?`}
          onConfirm={() => onRemoveRepo(repoMenu.slug)}>
          Its efforts and maps leave the sidebar. Nothing on GitHub or on disk changes, and adding it again brings them back.
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
