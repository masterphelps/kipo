
import { useState } from 'react'
import { T, muted } from './common'
import { TILE_STATES, type Frontier, type FrontierCounts, type Lane, type Tile, type TileState } from './types'

// The frontier bar: an effort's tickets as one bar of colored segments, like a
// storage meter. Done fills from the left; amber is your move, teal the agent's;
// the striped end is the fog, the questions not sharp enough to ticket yet.
// Click a segment to see its tickets as tiles; click a tile to open or start it.

export const STATE_META: Record<TileState | 'fog', { label: string; color: string; text: string }> = {
  done: { label: 'done', color: '#3fae6a', text: '#7fd39a' },
  review: { label: 'in review', color: '#a78bfa', text: '#a78bfa' },
  building: { label: 'building', color: '#60a5fa', text: '#60a5fa' },
  you: { label: 'your move', color: '#f5b14c', text: '#f5b14c' },
  afk: { label: "agent's move", color: '#2dd4bf', text: '#2dd4bf' },
  blocked: { label: 'blocked', color: '#4a4757', text: 'var(--muted)' },
  fog: { label: 'fog', color: 'transparent', text: 'var(--muted)' },
}

const FOG_FILL = 'repeating-linear-gradient(135deg, var(--border) 0 4px, transparent 4px 8px)'

export const frontierTotal = (counts: FrontierCounts, fog: number) =>
  TILE_STATES.reduce((n, s) => n + (counts[s] || 0), 0) + fog

export function FrontierBar({ counts, fog, height = 6, selected, onSelect }: {
  counts: FrontierCounts
  fog: number
  height?: number
  selected?: TileState | 'fog' | null
  onSelect?: (s: TileState | 'fog') => void
}) {
  const parts: [TileState | 'fog', number][] = [...TILE_STATES.map(s => [s, counts[s] || 0] as [TileState, number]), ['fog', fog]]
  const shown = parts.filter(([, n]) => n > 0)
  if (!shown.length) return null
  return (
    <div style={{ display: 'flex', gap: 2, height, borderRadius: height / 2, overflow: 'hidden', background: 'var(--bg-elevated)' }}>
      {shown.map(([s, n]) => {
        const on = selected === s
        const dim = !!selected && !on
        const style = {
          flex: n,
          minWidth: 4,
          height: '100%',
          background: s === 'fog' ? FOG_FILL : STATE_META[s].color,
          opacity: dim ? 0.35 : 1,
          transition: 'opacity .15s',
          cursor: onSelect ? 'pointer' : undefined,
          padding: 0,
          border: 0,
        }
        const title = `${n} ${STATE_META[s].label}`
        return onSelect
          ? <button key={s} type="button" aria-label={title} title={title} aria-pressed={on} onClick={() => onSelect(s)} style={style} />
          : <span key={s} title={title} style={style} />
      })}
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

// "2 for you · 4 for agents", or what the effort is doing when nobody's up.
export function whoIsUp(counts: FrontierCounts): string {
  const bits: string[] = []
  if (counts.you) bits.push(`${counts.you} for you`)
  if (counts.afk) bits.push(`${counts.afk} for agents`)
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
  const sessionHint = status === 'running' ? ' · agent working' : status === 'waiting' ? ' · waiting on you' : ''
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
// picked the row is the frontier (open and unblocked: your move or the
// agent's). Picking a segment shows that segment's tickets instead: only that
// half's, the segment stays marked, and the other bar dims. Click it again to
// go back to the frontier.
export function FrontierSummary({ frontier, onTile, openNumber, statuses }: {
  frontier: Frontier
  onTile: (t: Tile) => void
  openNumber: number | null
  statuses: Record<number, SessionStatus>
}) {
  const { counts, fog, tiles } = frontier
  const [pick, setPick] = useState<Pick | null>(null)
  if (!frontierTotal(counts, fog)) return null
  const toggle = (p: Pick) => setPick(cur => (cur && cur.lane === p.lane && cur.state === p.state ? null : p))
  const row = !pick
    ? tiles.filter(t => t.state === 'you' || t.state === 'afk')
    : pick.state === 'fog' ? []
    : tiles.filter(t => t.state === pick.state && (pick.lane === null || t.lane === pick.lane))
  const caption = !pick
    ? 'Frontier: open and unblocked'
    : pick.state === 'fog'
      ? `${fog} question${fog === 1 ? '' : 's'} not yet specified: in scope, not sharp enough to ticket yet`
      : `${STATE_META[pick.state].label[0].toUpperCase()}${STATE_META[pick.state].label.slice(1)}${pick.lane ? ` · ${LANE_LABEL[pick.lane]}` : ''}`
  return (
    <div style={{ padding: '6px 16px 8px', display: 'flex', flexDirection: 'column', gap: 4, borderBottom: '1px solid var(--border)' }}>
      <style>{'@keyframes kipo-pulse{0%,100%{opacity:1}50%{opacity:.35}}.kipo-pulse{animation:kipo-pulse 1.2s ease-in-out infinite}'}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: T.small, minWidth: 0 }}>
        {counts.you > 0 && <span style={{ whiteSpace: 'nowrap' }}><b style={{ color: STATE_META.you.text }}>Your move:</b> {counts.you}</span>}
        {counts.afk > 0 && <span style={{ whiteSpace: 'nowrap' }}><b style={{ color: STATE_META.afk.text }}>Agent's move:</b> {counts.afk}</span>}
        <span style={{ ...muted, fontSize: T.tiny, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
          {counts.done} of {tiles.length} done{fog ? ` · ${fog} in the fog` : ''}
        </span>
      </div>
      {(['decide', 'deliver'] as Lane[]).map(lane => {
        if (!laneTotal(frontier, lane)) return null
        const mine = pick?.lane === lane
        const other = !!pick && pick.lane !== null && !mine
        return (
          <div key={lane} style={{ display: 'grid', gridTemplateColumns: '50px minmax(0, 1fr)', alignItems: 'center', gap: 8,
            opacity: other ? 0.35 : 1, transition: 'opacity .15s' }}>
            <span title={LANE_HINT[lane]} style={{ fontSize: T.tiny, color: mine ? 'var(--text)' : frontier.active[lane] ? 'var(--text)' : 'var(--muted)', fontWeight: mine ? 600 : 400 }}>
              {LANE_LABEL[lane]}
            </span>
            <FrontierBar counts={frontier.lanes[lane]} fog={lane === 'decide' ? fog : 0} height={7}
              selected={mine ? pick!.state : null} onSelect={st => toggle({ lane, state: st })} />
          </div>
        )
      })}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingLeft: 58, fontSize: T.tiny, marginTop: 2 }}>
        <span style={{ color: pick && pick.state !== 'fog' ? STATE_META[pick.state].text : 'var(--muted)' }}>{caption}</span>
        {pick && (
          <button type="button" onClick={() => setPick(null)}
            style={{ background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--muted)', textDecoration: 'underline', fontSize: T.tiny }}>
            back to the frontier
          </button>
        )}
        {!pick && !row.length && <span style={muted}>· nothing to act on right now</span>}
      </div>
      {row.length > 0 && (
        // Padding inside the scroller leaves room for the open tile's outline.
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '5px 6px 4px 4px', margin: '0 -6px 0 54px', scrollbarWidth: 'thin' }}>
          {row.map(t => (
            <TileButton key={t.number} tile={t} onClick={() => onTile(t)} open={t.number === openNumber} status={statuses[t.number]} />
          ))}
        </div>
      )}
    </div>
  )
}

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
