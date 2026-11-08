import { useState } from 'react'
import { T, muted } from './common'
import { TILE_STATES, type Frontier, type FrontierCounts, type Tile, type TileState } from './types'

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
        const style = {
          flex: n,
          minWidth: 4,
          height: '100%',
          background: s === 'fog' ? FOG_FILL : STATE_META[s].color,
          boxShadow: on ? 'inset 0 0 0 2px #fff' : undefined,
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

export function TileButton({ tile, onClick, size = 34 }: { tile: Tile; onClick?: () => void; size?: number }) {
  const c = STATE_META[tile.state]
  const solid = tile.state !== 'blocked'
  const done = tile.state === 'done'
  const hint = tile.state === 'blocked' && tile.blockedBy.length
    ? `#${tile.number} ${tile.title}: waiting on ${tile.blockedBy.map(b => `#${b}`).join(', ')}`
    : `#${tile.number} ${tile.title}: ${c.label}`
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      style={{
        position: 'relative', width: size, height: size + 6, flexShrink: 0, borderRadius: 6, padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: onClick ? 'pointer' : 'default',
        fontWeight: 800, fontSize: 13,
        background: done ? 'rgba(63,174,106,.22)' : solid ? c.color : 'transparent',
        color: done ? '#7fd39a' : solid ? '#14121c' : 'var(--muted)',
        border: solid ? '1px solid transparent' : `1.5px solid ${c.color}`,
      }}
    >
      <span style={{ position: 'absolute', top: 2, left: 4, fontSize: 8.5, fontWeight: 600, opacity: 0.85 }}>{tile.number}</span>
      {tile.code}
    </button>
  )
}

// The effort's frontier, under its header: one line saying who's up, the bar,
// a legend that doubles as segment buttons, and the chosen segment's tiles.
export function FrontierPanel({ frontier, onTile, onStartAgents, starting }: {
  frontier: Frontier
  onTile: (t: Tile) => void
  onStartAgents: (tiles: Tile[]) => void
  starting: string | null
}) {
  const { counts, fog, tiles } = frontier
  const [picked, setPicked] = useState<TileState | 'fog' | null>(null)
  const auto: TileState | null = counts.you ? 'you' : counts.afk ? 'afk' : null
  const sel = picked ?? auto
  const ready = tiles.filter(t => t.state === 'afk')
  const total = frontierTotal(counts, fog)
  if (!total) return null
  const tilesShown = sel && sel !== 'fog' ? tiles.filter(t => t.state === sel) : []
  const ticketsTotal = tiles.length

  return (
    <div style={{ padding: '8px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: T.body, minWidth: 0 }}>
        {counts.you > 0 && <span><b style={{ color: STATE_META.you.text }}>Your move:</b> {counts.you}</span>}
        {counts.afk > 0 && <span><b style={{ color: STATE_META.afk.text }}>Agent's move:</b> {counts.afk}</span>}
        <span style={{ ...muted, fontSize: T.small, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {counts.done} of {ticketsTotal} done{fog ? ` · ${fog} in the fog` : ''}
        </span>
        <span style={{ flex: 1 }} />
        {ready.length > 0 && (
          <button
            type="button"
            disabled={!!starting}
            onClick={() => onStartAgents(ready)}
            title={`Start a session for each: ${ready.map(t => `#${t.number}`).join(', ')}`}
            style={{
              height: 26, padding: '0 11px', borderRadius: 6, border: 0, flexShrink: 0, whiteSpace: 'nowrap',
              background: STATE_META.afk.color, color: '#062621', fontWeight: 600, fontSize: T.small,
              cursor: starting ? 'default' : 'pointer', opacity: starting ? 0.6 : 1,
            }}
          >
            {starting ?? `Start ${ready.length} agent${ready.length === 1 ? '' : 's'}`}
          </button>
        )}
      </div>

      <FrontierBar counts={counts} fog={fog} height={12} selected={sel} onSelect={s => setPicked(p => (p === s ? null : s))} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: T.tiny }}>
        {([...TILE_STATES, 'fog'] as const).map(s => {
          const n = s === 'fog' ? fog : counts[s]
          if (!n) return null
          const on = sel === s
          return (
            <button key={s} type="button" onClick={() => setPicked(p => (p === s ? null : s))}
              style={{ background: 'transparent', padding: 0, cursor: 'pointer', color: on ? STATE_META[s].text : 'var(--muted)', fontWeight: on ? 600 : 400 }}>
              <span style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: 2, marginRight: 5,
                background: s === 'fog' ? FOG_FILL : STATE_META[s].color, border: s === 'fog' ? '1px dashed var(--muted)' : undefined,
              }} />
              {n} {STATE_META[s].label}
            </button>
          )
        })}
      </div>

      {sel === 'fog' && (
        <div style={{ ...muted, fontSize: T.small }}>
          {fog} question{fog === 1 ? '' : 's'} in the map's "Not yet specified": in scope, not sharp enough to ticket yet.
        </div>
      )}
      {tilesShown.length > 0 && (
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'thin' }}>
          {tilesShown.map(t => <TileButton key={t.number} tile={t} onClick={() => onTile(t)} />)}
        </div>
      )}
    </div>
  )
}
