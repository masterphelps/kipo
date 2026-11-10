
import { tileMeaning } from './glossary'
import { TILE_STATES, type FrontierCounts, type Lane, type Tile, type TileState } from './types'

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

export const frontierTotal = (counts: FrontierCounts, fog: number) =>
  TILE_STATES.reduce((n, s) => n + (counts[s] || 0), 0) + fog

// A lane's tickets as one bar, a segment per state: done (green), in review,
// building, HITL (amber), agent (teal), blocked (red). Only tickets: the map's
// fog isn't drawn, since it never closes, so a lane whose tickets are all closed
// is a full green bar. Hover for the counts.
const BAR_ORDER: TileState[] = ['done', 'review', 'building', 'you', 'afk', 'blocked']

export function FrontierBar({ counts, fog, height = 6 }: {
  counts: FrontierCounts
  fog: number
  height?: number
}) {
  const parts = BAR_ORDER.map(st => [st, counts[st] || 0] as const).filter(([, n]) => n > 0)
  const total = parts.reduce((a, [, n]) => a + n, 0)
  if (!total) return null
  const title = [
    `${counts.done || 0} of ${total} done`,
    ...parts.filter(([st]) => st !== 'done').map(([st, n]) => `${n} ${STATE_META[st].label}`),
    ...(fog ? [`${fog} not yet specified (not in the bar)`] : []),
  ].join(' · ')
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={counts.done || 0} aria-label={title} title={title}
      style={{ display: 'flex', gap: 2, height, borderRadius: height / 2, overflow: 'hidden' }}>
      {parts.map(([st, n]) => (
        <span key={st} style={{ flex: n, minWidth: 4, background: STATE_META[st].color }} />
      ))}
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

// A session's status dot: pulsing blue while the agent works, amber when it has
// stopped and the conversation is waiting on you.
// attention: the session stopped on something only the human can give it (a
// trust prompt on a tool call, or input it asked for) — louder than running.
export type SessionStatus = 'running' | 'waiting' | 'attention'

export function TileButton({ tile, onClick, size = 34, open, status, bare, numberOnly, width }: {
  tile: Tile; onClick?: () => void; size?: number; open?: boolean; status?: SessionStatus
  bare?: boolean // no number in the corner: for small tiles next to their own label
  // Small tiles: just the number, centered (the type letters and a corner number
  // don't both fit under ~30px). The type stays in the hover text.
  numberOnly?: boolean
  width?: number
}) {
  const c = STATE_META[tile.state]
  const solid = tile.state !== 'blocked'
  const done = tile.state === 'done'
  const hint = tile.state === 'blocked' && tile.blockedBy.length
    ? `#${tile.number} ${tile.title}: waiting on ${tile.blockedBy.map(b => `#${b}`).join(', ')}`
    : `#${tile.number} ${tile.title}: ${c.label}`
  const sessionHint = status === 'running' ? ' · agent working'
    : status === 'attention' ? ' · needs you: a trust prompt or question'
    : status === 'waiting' ? ' · awaiting input' : ''
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${hint}${sessionHint}\n\n${tileMeaning(tile)}`}
      aria-current={open ? 'true' : undefined}
      style={{
        position: 'relative', width: width ?? size, height: numberOnly ? size : size + 6, flexShrink: 0, borderRadius: 6, padding: 0,
        outline: open ? '2px solid var(--text-strong, #fff)' : undefined, outlineOffset: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: onClick ? 'pointer' : 'default',
        fontWeight: numberOnly ? 700 : 800, fontSize: numberOnly ? 11 : 13, fontVariantNumeric: 'tabular-nums',
        background: done ? 'rgba(63,174,106,.22)' : solid ? c.color : 'transparent',
        color: done ? '#7fd39a' : solid ? '#14121c' : 'var(--muted)',
        border: solid ? '1px solid transparent' : `1.5px solid ${c.color}`,
      }}
    >
      {numberOnly ? tile.number : (<>
        {!bare && <span style={{ position: 'absolute', top: 2, left: 4, fontSize: 8.5, fontWeight: 600, opacity: 0.85 }}>{tile.number}</span>}
        {tile.code}
      </>)}
      {status && (
        // Inside the tile's top-right corner, in the tile's own text color so it
        // reads on every tile color: pulsing while the agent works or needs
        // you (trust prompt, question), steady when merely waiting.
        <span
          className={status === 'running' || status === 'attention' ? 'kipo-pulse' : undefined}
          style={{
            position: 'absolute', top: numberOnly ? 2 : 4, right: numberOnly ? 2 : 4, width: numberOnly ? 5 : 6, height: numberOnly ? 5 : 6, borderRadius: 999,
            background: 'currentColor',
          }}
        />
      )}
    </button>
  )
}
