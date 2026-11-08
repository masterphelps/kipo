
import { Fragment, useState, type ReactNode } from 'react'
import { Popover } from './Menu'
import { T } from './common'
import { TILE_STATES, type Frontier, type FrontierCounts, type Lane, type Tile, type TileState } from './types'

// The frontier bar: an effort's tickets as one bar of colored segments, like a
// storage meter. Done fills from the left; amber is HITL, teal is agent (AFK);
// the striped end is the fog, the questions not sharp enough to ticket yet.
// Click a segment to see its tickets as tiles; click a tile to open or start it.

export const STATE_META: Record<TileState | 'fog', { label: string; color: string; text: string }> = {
  done: { label: 'done', color: '#3fae6a', text: '#7fd39a' },
  review: { label: 'in review', color: '#a78bfa', text: '#a78bfa' },
  building: { label: 'building', color: '#60a5fa', text: '#60a5fa' },
  you: { label: 'HITL', color: '#f5b14c', text: '#f5b14c' },
  afk: { label: 'agent', color: '#2dd4bf', text: '#2dd4bf' },
  blocked: { label: 'blocked', color: '#c2615b', text: '#e08a85' },
  fog: { label: 'fog', color: 'transparent', text: 'var(--muted)' },
}

const FOG_FILL = 'repeating-linear-gradient(135deg, var(--border) 0 4px, transparent 4px 8px)'

export const frontierTotal = (counts: FrontierCounts, fog: number) =>
  TILE_STATES.reduce((n, s) => n + (counts[s] || 0), 0) + fog

// A lane's progress: green fills as its tickets close (a merged PR, a resolved
// decision); lighter green is work in review, nearly there. Everything else is
// track, so a lane with every ticket closed reads as a full green bar. The
// breakdown by HITL, agent and blocked is in the tooltip and the ticket grid.
export function FrontierBar({ counts, fog, height = 6 }: {
  counts: FrontierCounts
  fog: number
  height?: number
}) {
  const total = frontierTotal(counts, fog)
  if (!total) return null
  const done = counts.done || 0
  const review = counts.review || 0
  const pct = (n: number) => `${(n / total) * 100}%`
  const title = [
    `${done} of ${total} done`,
    ...(['review', 'building', 'you', 'afk', 'blocked'] as TileState[]).filter(st => counts[st]).map(st => `${counts[st]} ${STATE_META[st].label}`),
    ...(fog ? [`${fog} not yet specified`] : []),
  ].join(' · ')
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={title} title={title}
      style={{ display: 'flex', height, borderRadius: height / 2, overflow: 'hidden', background: 'var(--border)' }}>
      <span style={{ width: pct(done), background: STATE_META.done.color, transition: 'width .3s' }} />
      <span style={{ width: pct(review), background: STATE_META.done.color, opacity: 0.45, transition: 'width .3s' }} />
    </div>
  )
}

// The list's view of an effort: one thin bar per half that has anything in it,
// Decide over Deliver. Falls back to one bar for frontiers saved before lanes.
type Saved = { counts: FrontierCounts; fog: number; lanes?: Record<Lane, FrontierCounts> }

export function LaneBars({ frontier, height = 4 }: { frontier: Saved; height?: number }) {
  if (!frontier.lanes) return <FrontierBar counts={frontier.counts} fog={frontier.fog} height={height + 2} />
  const rows = (['decide', 'deliver'] as Lane[]).filter(l =>
    frontierTotal(frontier.lanes![l], l === 'decide' ? frontier.fog : 0) > 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {rows.map(l => (
        <div key={l} title={l === 'decide' ? 'Decide: the front half' : 'Deliver: the back half'}>
          <FrontierBar counts={frontier.lanes![l]} fog={l === 'decide' ? frontier.fog : 0} height={height} />
        </div>
      ))}
    </div>
  )
}

// "2 HITL · 4 agent", or what the effort is doing when neither is ready.
export function whoIsUp(counts: FrontierCounts): string {
  const bits: string[] = []
  if (counts.you) bits.push(`${counts.you} HITL`)
  if (counts.afk) bits.push(`${counts.afk} agent`)
  if (bits.length) return bits.join(' · ')
  if (counts.building) return 'agent building'
  if (counts.review) return 'in review'
  if (counts.blocked) return 'blocked'
  return counts.done ? 'all done' : ''
}

// A session's status dot: pulsing blue while the agent works, amber when it has
// stopped and the conversation is waiting on you.
export type SessionStatus = 'running' | 'waiting'

export function TileButton({ tile, onClick, size = 34, open, status, bare }: {
  tile: Tile; onClick?: () => void; size?: number; open?: boolean; status?: SessionStatus
  bare?: boolean // no number in the corner: for small tiles next to their own label
}) {
  const c = STATE_META[tile.state]
  const solid = tile.state !== 'blocked'
  const done = tile.state === 'done'
  const hint = tile.state === 'blocked' && tile.blockedBy.length
    ? `#${tile.number} ${tile.title}: waiting on ${tile.blockedBy.map(b => `#${b}`).join(', ')}`
    : `#${tile.number} ${tile.title}: ${c.label}`
  const sessionHint = status === 'running' ? ' · agent working' : status === 'waiting' ? ' · awaiting input' : ''
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint + sessionHint}
      aria-current={open ? 'true' : undefined}
      style={{
        position: 'relative', width: size, height: size + 6, flexShrink: 0, borderRadius: 6, padding: 0,
        outline: open ? '2px solid var(--text-strong, #fff)' : undefined, outlineOffset: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: onClick ? 'pointer' : 'default',
        fontWeight: 800, fontSize: 13,
        background: done ? 'rgba(63,174,106,.22)' : solid ? c.color : 'transparent',
        color: done ? '#7fd39a' : solid ? '#14121c' : 'var(--muted)',
        border: solid ? '1px solid transparent' : `1.5px solid ${c.color}`,
      }}
    >
      {!bare && <span style={{ position: 'absolute', top: 2, left: 4, fontSize: 8.5, fontWeight: 600, opacity: 0.85 }}>{tile.number}</span>}
      {tile.code}
      {status && (
        // Inside the tile's top-right corner, in the tile's own text color so it
        // reads on every tile color: pulsing while the agent works, steady
        // when the conversation is waiting on you.
        <span
          className={status === 'running' ? 'kipo-pulse' : undefined}
          style={{
            position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: 999,
            background: 'currentColor',
          }}
        />
      )}
    </button>
  )
}

// The effort's frontier, under its header: who's up, then Matt's two halves as
// two bars (Decide: the front half, ending in a spec and tickets; Deliver: the
// back half, ending in merged PRs), a legend that picks a segment, and that
// segment's tiles.
export type Pick = { lane: Lane | null; state: TileState | 'fog' }

const LANE_LABEL: Record<Lane, string> = { decide: 'Decide', deliver: 'Deliver' }
const LANE_HINT: Record<Lane, string> = {
  decide: 'The front half: grills, prototypes, research and tasks that settle what to build. Ends in a spec and tickets.',
  deliver: 'The back half: tickets that end in a PR. Implement, review, merge.',
}

export const laneTotal = (f: Frontier, l: Lane) =>
  TILE_STATES.reduce((n, s) => n + (f.lanes[l][s] || 0), 0) + (l === 'decide' ? f.fog : 0)

// The summary over the conversation: who's up, the two halves as bars, and a
// row of tiles to switch tickets without leaving the conversation. With nothing
// picked the row is the frontier (open and unblocked: HITL or the
// agent's). Picking a segment shows that segment's tickets instead: only that
// half's, the segment stays marked, and the other bar dims. Click it again to
// go back to the frontier.
// Every ticket of the effort as a tile, in a grid: Decide and Deliver as rows,
// whose move it is as columns. Nothing hides behind a bar segment; a tile opens
// its conversation. `next` is the one thing to do now, above it all.
const GROUPS: { key: string; label: string; states: TileState[]; hint: string }[] = [
  { key: 'you', label: 'HITL', states: ['you'], hint: 'Human in the loop: open, unblocked, and it needs you (a grilling, a prototype, a ticket labelled ready-for-human).' },
  { key: 'afk', label: 'Agent', states: ['afk'], hint: 'AFK: open, unblocked, and an agent can take it on its own.' },
  { key: 'working', label: 'In progress', states: ['building', 'review'], hint: 'An agent is building it, or its PR is open for review.' },
  { key: 'blocked', label: 'Blocked', states: ['blocked'], hint: 'Blocked by a ticket that is still open.' },
  { key: 'done', label: 'Done', states: ['done'], hint: 'Closed.' },
]

export function FrontierSummary({ frontier, onTile, openNumber, statuses, next, mapUrl }: {
  mapUrl?: string | null // the wayfinder map, for the fog popover
  frontier: Frontier
  onTile: (t: Tile) => void
  openNumber: number | null
  statuses: Record<number, SessionStatus>
  next?: ReactNode
}) {
  const { counts, fog, tiles } = frontier
  const [fogAt, setFogAt] = useState<{ x: number; y: number } | null>(null)
  if (!frontierTotal(counts, fog)) return next ? <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>{next}</div> : null
  const lanes = (['decide', 'deliver'] as Lane[]).filter(l => tiles.some(t => t.lane === l) || (l === 'decide' && fog > 0))
  const groups = GROUPS.filter(g => tiles.some(t => g.states.includes(t.state)))
  const cols = groups.length + (fog ? 1 : 0)
  const headColor = (g: typeof GROUPS[number]) => STATE_META[g.states[0]].text
  const cellTiles = (lane: Lane, g: typeof GROUPS[number]) =>
    tiles.filter(t => t.lane === lane && g.states.includes(t.state)).sort((a, b) => a.number - b.number)
  return (
    <div style={{ padding: '8px 16px 10px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--border)' }}>
      <style>{'@keyframes kipo-pulse{0%,100%{opacity:1}50%{opacity:.35}}.kipo-pulse{animation:kipo-pulse 1.2s ease-in-out infinite}'}</style>
      {next}
      <div style={{ overflowX: 'auto', scrollbarWidth: 'thin', paddingBottom: 2 }}>
        <div role="grid" aria-label="Tickets by lane and whose move"
          style={{ display: 'grid', gridTemplateColumns: `58px repeat(${cols}, minmax(max-content, auto))`, columnGap: 6, rowGap: 4, alignItems: 'start', minWidth: 'min-content' }}>
          <span />
          {groups.map(g => {
            const n = tiles.filter(t => g.states.includes(t.state)).length
            return (
              <span key={g.key} role="columnheader" title={g.hint}
                style={{ fontSize: T.tiny, fontWeight: 600, color: headColor(g), whiteSpace: 'nowrap', padding: '0 6px' }}>
                {g.label} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{n}</span>
              </span>
            )
          })}
          {fog > 0 && (
            <span role="columnheader" title="In the map's Not yet specified: in scope, but not sharp enough to ticket yet."
              style={{ fontSize: T.tiny, fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap', padding: '0 6px' }}>
              Fog <span style={{ fontWeight: 400 }}>{fog}</span>
            </span>
          )}
          {lanes.map(lane => (
            <Fragment key={lane}>
              <span role="rowheader" title={LANE_HINT[lane]}
                style={{ fontSize: T.tiny, fontWeight: 600, color: frontier.active[lane] ? 'var(--text)' : 'var(--muted)', alignSelf: 'center' }}>
                {LANE_LABEL[lane]}
              </span>
              {groups.map(g => {
                const ts = cellTiles(lane, g)
                return (
                  <div key={g.key} role="gridcell"
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '5px 6px', minHeight: 46, borderRadius: 8,
                      background: ts.length ? 'var(--bg-elevated)' : 'transparent', border: `1px solid ${ts.length ? 'var(--border)' : 'transparent'}`,
                      maxWidth: g.key === 'done' ? 200 : 260 }}>
                    {ts.length
                      ? ts.map(t => <TileButton key={t.number} tile={t} size={32} onClick={() => onTile(t)} open={t.number === openNumber} status={statuses[t.number]} />)
                      : <span style={{ color: 'var(--border)', fontSize: T.small, alignSelf: 'center', paddingLeft: 4 }}>–</span>}
                  </div>
                )
              })}
              {fog > 0 && (
                <div role="gridcell" style={{ display: 'flex', gap: 5, padding: '5px 6px', minHeight: 46 }}>
                  {lane === 'decide' && Array.from({ length: Math.min(fog, 4) }).map((_, i) => {
                    const text = frontier.fogItems?.[i]
                    const more = i === 3 && fog > 4 ? fog - 3 : 0
                    return (
                      <button key={i} type="button"
                        title={more ? `${more} more not yet specified` : text ? `Not yet specified: ${plain(text)}` : 'Not yet specified'}
                        onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setFogAt({ x: r.left, y: r.bottom + 4 }) }}
                        style={{ width: 32, height: 38, borderRadius: 6, border: '1.5px dashed var(--muted)', color: 'var(--muted)', background: 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: more ? 11 : 13, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                        {more ? `+${more}` : '?'}
                      </button>
                    )
                  })}
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>
      {fogAt && (
        <Popover x={fogAt.x} y={fogAt.y} label="Not yet specified" onClose={() => setFogAt(null)}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong, var(--text))' }}>Not yet specified · {fog}</div>
          <div style={{ fontSize: T.tiny, color: 'var(--muted)', marginTop: 3, lineHeight: 1.4 }}>
            Fog: in scope, but not sharp enough to ticket yet. Each becomes a ticket once the decisions ahead of it are made.
          </div>
          <ol style={{ margin: '10px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(frontier.fogItems?.length ? frontier.fogItems : ['(The map describes it in prose.)']).map((t, i) => (
              <li key={i} style={{ fontSize: T.small, lineHeight: 1.45, color: 'var(--text)' }}>{plain(t)}</li>
            ))}
          </ol>
          {mapUrl && (
            <a href={mapUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 10, fontSize: T.small, color: 'var(--accent)' }}>
              Open the map on GitHub
            </a>
          )}
        </Popover>
      )}
    </div>
  )
}

// Markdown emphasis and links read as plain text in a small popover or tooltip.
const plain = (md: string) => md.replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

// The legend for the Map tab: counts per state; picking one highlights those
// tickets on the map.
export function MapLegend({ frontier, picked, onPick }: { frontier: Frontier; picked: Pick | null; onPick: (p: Pick | null) => void }) {
  const { counts, fog } = frontier
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: T.tiny }}>
      {([...TILE_STATES, 'fog'] as const).map(s => {
        const n = s === 'fog' ? fog : counts[s]
        if (!n) return null
        const on = picked?.state === s && picked.lane === null
        return (
          <button key={s} type="button" onClick={() => onPick(on ? null : { lane: null, state: s })}
            title={s === 'fog' ? "Questions in the map's Not yet specified: in scope, not sharp enough to ticket yet" : 'Highlight these on the map'}
            style={{ background: 'transparent', padding: 0, cursor: 'pointer', color: on ? STATE_META[s].text : 'var(--muted)', fontWeight: on ? 600 : 400 }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: 2, marginRight: 5,
              background: s === 'fog' ? FOG_FILL : STATE_META[s].color, border: s === 'fog' ? '1px dashed var(--muted)' : undefined,
            }} />
            {n} {STATE_META[s].label}
          </button>
        )
      })}
      {picked && <button type="button" onClick={() => onPick(null)} style={{ background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--muted)', textDecoration: 'underline' }}>show all</button>}
    </div>
  )
}

export const pickedSet = (f: Frontier, p: Pick | null) =>
  !p || p.state === 'fog' ? null
    : new Set(f.tiles.filter(t => t.state === p.state && (p.lane === null || t.lane === p.lane)).map(t => t.number))
