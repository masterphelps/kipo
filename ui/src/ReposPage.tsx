import { Btn } from '@kirocrew/app-sdk/ui'
import { ChevronRight, ExternalLink, FolderGit2, FolderOpen, FolderPlus, Map as MapIcon, MoreHorizontal, Search, Target, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { backend, errorText } from './api'
import { ErrorLine, timeAgo } from './common'
import { LaneBars } from './Frontier'
import { Confirm, Menu, type MenuItem } from './Menu'
import { FolderPicker } from './FolderPicker'
import type { AvailableRepo, RepoTree, TreeItem, TreeRepo } from './types'

// Your repos as a tree, the way Kiro shows folders: each repo opens to show
// what's in it, its KiPo efforts and its open wayfinder maps. A green dot means
// it's on your sidebar; click the dot to put it there or take it off. Add a repo
// from the button at the top; remove one from its own menu. GitHub is never
// changed from here.

const ON = '#3fae6a'
const EXPANDED_KEY = 'kipo.repoTree.open'

const readExpanded = (): Record<string, boolean> => {
  try { return JSON.parse(localStorage.getItem(EXPANDED_KEY) || '{}') } catch { return {} }
}

type Popover =
  | { kind: 'add'; x: number; y: number }
  | { kind: 'repo'; repo: TreeRepo; x: number; y: number }
  | { kind: 'remove'; repo: TreeRepo; x: number; y: number }

export function ReposPage({ onOpen, onChanged }: {
  onOpen: (repo: string, number: number) => void // open it in the workspace
  onChanged: () => void                          // the sidebar changed: reload it
}) {
  const [tree, setTree] = useState<RepoTree | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>(readExpanded)
  const [pop, setPop] = useState<Popover | null>(null)
  const [browsing, setBrowsing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(() => backend.tree()
    .then(t => { setTree(t); setError('') })
    .catch(e => { setError(errorText(e)); setTree(t => t ?? { repos: [], available: [] }) }), [])
  useEffect(() => { void load() }, [load])
  useEffect(() => { localStorage.setItem(EXPANDED_KEY, JSON.stringify(expanded)) }, [expanded])

  // A repo is open unless you folded it.
  const isOpen = (slug: string) => expanded[slug] !== false
  const toggleOpen = (slug: string) => setExpanded(e => ({ ...e, [slug]: !isOpen(slug) }))

  const q = filter.trim().toLowerCase()
  const shown = useMemo(() => (tree?.repos ?? []).map(r => ({
    ...r,
    items: q && !r.slug.toLowerCase().includes(q) ? r.items.filter(i => i.title.toLowerCase().includes(q)) : r.items,
  })).filter(r => !q || r.slug.toLowerCase().includes(q) || r.items.length), [tree, q])

  const flip = async (repo: TreeRepo, item: TreeItem) => {
    const on = !item.onSidebar
    const mark = (value: boolean) => setTree(t => t && ({
      ...t,
      repos: t.repos.map(r => r.slug !== repo.slug ? r : {
        ...r, items: r.items.map(i => (i.kind === item.kind && i.number === item.number ? { ...i, onSidebar: value } : i)),
      }),
    }))
    mark(on)
    try {
      await backend.setOnSidebar(repo.slug, item.number, item.kind, on)
      onChanged()
    } catch (e) {
      mark(!on)
      setError(errorText(e))
    }
  }

  const openItem = async (repo: TreeRepo, item: TreeItem) => {
    if (!item.onSidebar) await flip(repo, item)
    onOpen(repo.slug, item.number)
  }

  const addRepo = async (path: string) => {
    setBusy(path)
    setError('')
    try {
      const c = await backend.addRepo(path)
      const added = c.repos.find(r => r.path === path)
      if (added) setExpanded(e => ({ ...e, [added.slug]: true }))
      setBrowsing(false)
      await load()
      onChanged()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const removeRepo = async (repo: TreeRepo) => {
    try {
      await backend.removeRepo(repo.slug)
      await load()
      onChanged()
    } catch (e) {
      setError(errorText(e))
    }
  }

  const at = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: r.left, y: r.bottom + 4 }
  }

  return (
    <div className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>
      <div className="flex items-center gap-3" style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="text-base font-semibold" style={{ color: 'var(--text-strong, var(--text))' }}>Repos</div>
          <div className="text-xs text-muted" style={{ marginTop: 2 }}>
            Each repo's efforts and open wayfinder maps. <Dot on /> on your sidebar; click a dot to add or remove it.
          </div>
        </div>
        <label className="flex items-center gap-1.5 rounded-md" style={{ border: '1px solid var(--border)', padding: '4px 8px', width: 220 }}>
          <Search size={13} />
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter" aria-label="Filter repos, efforts and maps"
            className="text-xs" style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', color: 'var(--text)' }} />
        </label>
        <span onClick={e => setPop({ kind: 'add', ...at(e) })}>
          <Btn primary><span className="inline-flex items-center gap-1.5"><FolderPlus size={14} />Add repo</span></Btn>
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 12px 24px' }}>
        <ErrorLine>{error}</ErrorLine>
        {tree?.searchError && (
          <div className="text-xs text-muted" style={{ padding: '4px 8px' }}>Couldn't search GitHub for maps: {tree.searchError}</div>
        )}
        {browsing && (
          <div style={{ maxWidth: 720, margin: '4px 8px 12px' }}>
            <FolderPicker busy={busy} onAdd={p => void addRepo(p)} />
          </div>
        )}
        {tree === null && <div className="text-xs text-muted" style={{ padding: 8 }}>Loading your repos…</div>}
        {tree !== null && !tree.repos.length && (
          <div className="text-sm text-muted" style={{ padding: '24px 8px' }}>
            No repos yet. Use <b>Add repo</b> to pick one; its efforts and maps show up under it.
          </div>
        )}
        {tree !== null && tree.repos.length > 0 && !shown.length && (
          <div className="text-xs text-muted" style={{ padding: 8 }}>Nothing matches.</div>
        )}

        <div role="tree" aria-label="Repos" style={{ maxWidth: 960 }}>
          {shown.map(repo => {
            const open = isOpen(repo.slug) || !!q
            const onCount = repo.items.filter(i => i.onSidebar).length
            return (
              <div key={repo.slug} role="treeitem" aria-expanded={open}>
                <Row onClick={() => toggleOpen(repo.slug)}
                  onMenu={e => setPop({ kind: 'repo', repo, ...at(e) })}
                  onContextMenu={e => { e.preventDefault(); setPop({ kind: 'repo', repo, x: e.clientX, y: e.clientY }) }}
                  lead={<FolderGlyph open={open} />}
                  title={<span className="font-medium">{repo.slug}</span>}
                  sub={repo.path}
                  meta={repo.items.length ? `${repoDone(repo)}${onCount} of ${repo.items.length} on sidebar` : 'empty'} />
                <Collapse open={open}>
                  <div role="group" style={{ paddingLeft: 22 }}>
                    {repo.error && <div className="text-xs" style={{ color: 'var(--danger-text)', padding: '4px 10px' }}>{repo.error}</div>}
                    {!repo.items.length && !repo.error && (
                      <div className="text-xs text-muted" style={{ padding: '5px 10px' }}>No efforts or open maps yet.</div>
                    )}
                    {repo.items.map(item => (
                      <Row key={`${item.kind}-${item.number}`} small
                        onClick={() => void openItem(repo, item)}
                        lead={<DotButton on={item.onSidebar} kind={item.kind} onToggle={() => void flip(repo, item)} />}
                        icon={item.kind === 'map' ? <MapIcon size={13} /> : <Target size={13} />}
                        title={<span style={{ color: item.onSidebar ? 'var(--text)' : 'var(--muted)' }}>{item.title}</span>}
                        progress={<Progress p={item.progress} />}
                        meta={`${item.kind === 'map' ? 'Map' : item.map ? `Effort · map #${item.map}` : 'Effort'} · #${item.number} · ${timeAgo(item.updatedAt)}`}
                        onMenu={() => { window.open(item.url, '_blank', 'noreferrer') }}
                        menuIcon={<ExternalLink size={13} />} menuLabel="Open on GitHub" />
                    ))}
                  </div>
                </Collapse>
              </div>
            )
          })}
        </div>
      </div>

      {pop?.kind === 'add' && (
        <AddRepoMenu x={pop.x} y={pop.y} available={tree?.available ?? []} onClose={() => setPop(null)}
          onAdd={r => void addRepo(r.path)} onBrowse={() => setBrowsing(true)} />
      )}
      {pop?.kind === 'repo' && (
        <Menu x={pop.x} y={pop.y} onClose={() => setPop(null)} items={[
          { label: 'Open on GitHub', icon: ExternalLink, onSelect: () => window.open(`https://github.com/${pop.repo.slug}`, '_blank', 'noreferrer') },
          { separator: true },
          { label: 'Remove repo…', icon: Trash2, danger: true, onSelect: () => setPop({ ...pop, kind: 'remove' }) },
        ]} />
      )}
      {pop?.kind === 'remove' && (
        <Confirm x={pop.x} y={pop.y} onClose={() => setPop(null)} action="Remove"
          title={`Remove ${pop.repo.slug} from KiPo?`} onConfirm={() => void removeRepo(pop.repo)}>
          Its efforts and maps leave your sidebar. Nothing on GitHub or on disk changes, and adding it again brings them back.
        </Confirm>
      )}
    </div>
  )
}

// One tree row, in Kiro's sidebar style: hover highlight, a ⋯ on hover.
function Row({ lead, icon, title, sub, meta, progress, small, onClick, onMenu, onContextMenu, menuIcon, menuLabel = 'More' }: {
  lead: ReactNode; icon?: ReactNode; title: ReactNode; sub?: string; meta?: string; progress?: ReactNode; small?: boolean
  onClick: () => void
  onMenu?: (e: React.MouseEvent<HTMLButtonElement>) => void
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void
  menuIcon?: ReactNode; menuLabel?: string
}) {
  const [hover, setHover] = useState(false)
  return (
    <div className="group items-center gap-2 rounded-md cursor-pointer select-none hover:bg-bg-hover transition-colors"
      onClick={onClick} onContextMenu={onContextMenu}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ height: small ? 28 : 34, padding: '0 6px 0 8px', background: hover ? 'var(--bg-hover, rgba(255,255,255,0.05))' : undefined,
        // Rows with a progress column use fixed columns, so bars line up across repos.
        ...(progress
          ? { display: 'grid', gridTemplateColumns: `18px ${icon ? '14px ' : ''}minmax(0, 1fr) 230px 190px 22px`, columnGap: 8 }
          : { display: 'flex' }) }}>
      {lead}
      {icon && <span className="text-muted" style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
      <span className={small ? 'text-sm' : 'text-sm'} style={{ minWidth: 0, flexShrink: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
      {sub && <span className="text-xs text-muted" style={{ minWidth: 0, flexShrink: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>}
      {!progress && <span style={{ flex: 1 }} />}
      {progress}
      {meta && (
        // A fixed width when there's a progress column, so the bars line up row to row.
        <span className="text-xs text-muted" title={meta}
          style={{ whiteSpace: 'nowrap', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right',
            ...(progress ? { width: 190 } : {}) }}>{meta}</span>
      )}
      {onMenu && (
        <button type="button" aria-label={menuLabel} title={menuLabel}
          onClick={e => { e.stopPropagation(); onMenu(e) }}
          className="text-muted rounded"
          style={{ width: 22, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent',
            border: 0, padding: 0, cursor: 'pointer', opacity: hover ? 1 : 0, flexShrink: 0 }}>
          {menuIcon ?? <MoreHorizontal size={14} />}
        </button>
      )}
    </div>
  )
}

// How far a map or effort has got: its Decide and Deliver bars, and "done of
// total" tickets (fog, the map's not-yet-specified questions, alongside).
function Progress({ p }: { p: TreeItem['progress'] }) {
  const total = p?.counts ? Object.values(p.counts).reduce((a, b) => a + (b || 0), 0) : 0
  const width = { width: 230, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 } as const
  if (!p || !p.counts) {
    return <span className="text-xs text-muted" style={width} title="KiPo hasn't read this effort yet: open it once.">not read yet</span>
  }
  if (!total) {
    return <span className="text-xs text-muted" style={width}>no tickets yet{p.fog ? ` · ${p.fog} fog` : ''}</span>
  }
  const done = p.counts.done || 0
  return (
    <span style={width} title={`${done} of ${total} tickets done${p.fog ? `, ${p.fog} not yet specified` : ''}`}>
      <span style={{ width: 110, flexShrink: 0 }}><LaneBars frontier={{ counts: p.counts, fog: p.fog, lanes: p.lanes }} height={3} /></span>
      <span className="text-xs" style={{ whiteSpace: 'nowrap', color: done === total ? 'var(--ok, #3fae6a)' : 'var(--text)' }}>
        {done}/{total}<span className="text-muted"> done{p.fog ? ` · ${p.fog} fog` : ''}</span>
      </span>
    </span>
  )
}

const repoDone = (repo: TreeRepo) => {
  let done = 0, total = 0
  for (const i of repo.items) {
    for (const [k, v] of Object.entries(i.progress?.counts ?? {})) { total += v || 0; if (k === 'done') done += v || 0 }
  }
  return total ? `${done} of ${total} tickets done · ` : ''
}

// Kiro's folder glyph: a folder with a small disclosure chevron in its corner.
function FolderGlyph({ open }: { open: boolean }) {
  const Icon = open ? FolderOpen : FolderGit2
  return (
    <span className="text-muted" aria-hidden style={{ position: 'relative', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={16} />
      <span style={{ position: 'absolute', right: -3, bottom: -3, display: 'inline-flex', background: 'var(--bg)', borderRadius: 999,
        transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
        <ChevronRight size={9} strokeWidth={3} />
      </span>
    </span>
  )
}

// The green dot: filled when it's on the sidebar, an empty ring when it isn't.
function Dot({ on }: { on: boolean }) {
  return (
    <span aria-hidden style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 999, verticalAlign: 'middle',
      background: on ? ON : 'transparent', boxShadow: on ? `0 0 0 3px color-mix(in srgb, ${ON} 22%, transparent)` : 'inset 0 0 0 1.5px var(--muted)' }} />
  )
}

function DotButton({ on, kind, onToggle }: { on: boolean; kind: 'effort' | 'map'; onToggle: () => void }) {
  const what = kind === 'map' ? 'map' : 'effort'
  return (
    <button type="button" role="switch" aria-checked={on}
      aria-label={on ? `Take this ${what} off the sidebar` : `Put this ${what} on the sidebar`}
      title={on ? 'On your sidebar. Click to take it off.' : 'Not on your sidebar. Click to add it.'}
      onClick={e => { e.stopPropagation(); onToggle() }}
      style={{ width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent',
        border: 0, padding: 0, cursor: 'pointer', flexShrink: 0 }}>
      <Dot on={on} />
    </button>
  )
}

// Folding like Kiro's folders: the height eases open and shut.
function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div aria-hidden={!open} style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 150ms ease-out' }}>
      <div style={{ overflow: 'clip', minHeight: 0, visibility: open ? 'visible' : 'hidden', opacity: open ? 1 : 0 }}>{children}</div>
    </div>
  )
}

// "Add repo": the checkouts on this Mac you haven't added, those with open maps
// first, then a folder picker for anything else.
function AddRepoMenu({ x, y, available, onAdd, onBrowse, onClose }: {
  x: number; y: number; available: AvailableRepo[]
  onAdd: (r: AvailableRepo) => void; onBrowse: () => void; onClose: () => void
}) {
  const items: MenuItem[] = [
    ...available.slice(0, 12).map(r => ({
      label: r.maps ? `${r.slug} · ${r.maps} open map${r.maps === 1 ? '' : 's'}` : r.slug,
      icon: FolderGit2,
      onSelect: () => onAdd(r),
    })),
    ...(available.length ? [{ separator: true } as const] : []),
    { label: 'Browse for a folder…', icon: FolderOpen, onSelect: onBrowse },
  ]
  return <Menu x={x} y={y} items={items} onClose={onClose} />
}
