import { useEffect, useRef, useState } from 'react'
import { T } from './common'
import { STATE_META, TileButton, type SessionStatus } from './Frontier'
import type { Tile } from './types'

// The blocking graph drawn with the tiles themselves: each ticket sits in a
// column by how deep it is in the chain (nothing blocks column 0), arrows run
// from blocker to blocked. An arrow from a closed blocker is faint and dashed:
// that wait is over. Fog, when given, is dashed "?" tiles past the last column.

type Placed = { tile: Tile; col: number; row: number }

function layout(tiles: Tile[]): { placed: Placed[]; cols: number; rows: number } {
  const byNumber = new Map(tiles.map(t => [t.number, t]))
  const blockersOf = (t: Tile) => (t.blockers ?? t.blockedBy).filter(n => byNumber.has(n) && n !== t.number)
  const depth = new Map<number, number>()
  const visiting = new Set<number>()
  const depthOf = (t: Tile): number => {
    if (depth.has(t.number)) return depth.get(t.number)!
    if (visiting.has(t.number)) return 0 // a cycle: break it rather than loop
    visiting.add(t.number)
    const bs = blockersOf(t)
    const d = bs.length ? 1 + Math.max(...bs.map(n => depthOf(byNumber.get(n)!))) : 0
    visiting.delete(t.number)
    depth.set(t.number, d)
    return d
  }
  tiles.forEach(depthOf)
  const cols = Math.max(0, ...tiles.map(t => depth.get(t.number)!)) + 1
  // Rows: column 0 by number; later columns by the average row of their blockers
  // (one barycenter pass keeps most arrows short and uncrossed).
  const rowOf = new Map<number, number>()
  const placed: Placed[] = []
  let rows = 0
  for (let c = 0; c < cols; c++) {
    const inCol = tiles.filter(t => depth.get(t.number) === c)
    const key = (t: Tile) => {
      const bs = blockersOf(t).map(n => rowOf.get(n)).filter((r): r is number => r !== undefined)
      return bs.length ? bs.reduce((a, b) => a + b, 0) / bs.length : t.number / 1000
    }
    inCol.sort((a, b) => key(a) - key(b) || a.number - b.number)
    inCol.forEach((t, i) => { rowOf.set(t.number, i); placed.push({ tile: t, col: c, row: i }) })
    rows = Math.max(rows, inCol.length)
  }
  // Center each column against the tallest, so the diagram reads as a flow.
  for (let c = 0; c < cols; c++) {
    const n = placed.filter(p => p.col === c).length
    const shift = (rows - n) / 2
    placed.forEach(p => { if (p.col === c) p.row += shift })
  }
  return { placed, cols, rows }
}

export function TileGraph({ tiles, focus, fog = 0, onOpen, statuses, labeled }: {
  tiles: Tile[]
  focus?: number | null          // highlight this ticket and its neighbors
  fog?: number
  onOpen: (t: Tile) => void
  statuses?: Record<number, SessionStatus>
  labeled?: boolean               // wider nodes with the ticket's title
}) {
  // Fit the panel: labeled nodes shrink to the width available (down to a floor).
  const box = useRef<HTMLDivElement>(null)
  const [avail, setAvail] = useState(0)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setAvail(el.clientWidth))
    ro.observe(el)
    setAvail(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  if (!tiles.length) return null
  // Tickets that block nothing and wait on nothing sit in a row underneath.
  const linked = new Set<number>()
  const known = new Set(tiles.map(t => t.number))
  for (const t of tiles) {
    for (const b of t.blockers ?? t.blockedBy) {
      if (known.has(b) && b !== t.number) { linked.add(b); linked.add(t.number) }
    }
  }
  const alone = tiles.length > 1 ? tiles.filter(t => !linked.has(t.number)) : []
  const inGraph = alone.length ? tiles.filter(t => linked.has(t.number)) : tiles
  const { placed, cols, rows } = layout(inGraph)
  const size = 30
  const gapX = labeled ? 32 : 56
  const fit = avail && cols ? Math.floor((avail - 2 - (cols - 1) * gapX) / cols) : 168
  const nodeW = labeled ? Math.max(110, Math.min(200, fit)) : size
  const nodeH = size + 6
  const gapY = labeled ? 10 : 8
  const fogCols = fog > 0 ? 1 : 0
  const width = (cols + fogCols) * nodeW + (cols + fogCols - 1) * gapX + 2
  const fogN = fog > 0 ? Math.min(fog, 4) : 0
  const allRows = Math.max(rows, fogN)
  const height = inGraph.length || fogN ? allRows * (nodeH + gapY) - gapY + 2 : 0
  const pos = new Map(placed.map(p => [p.tile.number, { x: 1 + p.col * (nodeW + gapX), y: 1 + p.row * (nodeH + gapY) }]))
  const byNumber = new Map(tiles.map(t => [t.number, t]))

  const neighbors = new Set<number>()
  if (focus != null) {
    neighbors.add(focus)
    const f = byNumber.get(focus)
    ;(f?.blockers ?? f?.blockedBy ?? []).forEach(n => neighbors.add(n))
    tiles.forEach(t => { if ((t.blockers ?? t.blockedBy).includes(focus)) neighbors.add(t.number) })
  }
  const lit = (n: number) => focus == null || neighbors.has(n)

  const edges: { from: Tile; to: Tile }[] = []
  for (const t of tiles) {
    for (const b of t.blockers ?? t.blockedBy) {
      const from = byNumber.get(b)
      if (from && from.number !== t.number) edges.push({ from, to: t })
    }
  }

  return (
    <div ref={box} style={{ overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'thin', minWidth: 0 }}>
      <div style={{ position: 'relative', width, height, minWidth: width }}>
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden>
          <defs>
            <marker id="kipo-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8 z" fill="var(--muted)" />
            </marker>
          </defs>
          {edges.map(({ from, to }) => {
            const a = pos.get(from.number)!
            const b = pos.get(to.number)!
            const x1 = a.x + nodeW + 2
            const y1 = a.y + nodeH / 2
            const x2 = b.x - 2
            const y2 = b.y + nodeH / 2
            const mid = (x1 + x2) / 2
            const done = from.state === 'done'
            const on = lit(from.number) && lit(to.number) && (focus == null || from.number === focus || to.number === focus)
            return (
              <path key={`${from.number}-${to.number}`}
                d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                fill="none" stroke={on && focus != null ? 'var(--text)' : 'var(--muted)'}
                strokeWidth={on && focus != null ? 1.6 : 1.2}
                strokeDasharray={done ? '3 3' : undefined}
                opacity={focus != null && !on ? 0.15 : done ? 0.45 : 0.8}
                markerEnd="url(#kipo-arrow)" />
            )
          })}
        </svg>
        {placed.map(({ tile }) => {
          const p = pos.get(tile.number)!
          return (
            <div key={tile.number}
              style={{ position: 'absolute', left: p.x, top: p.y, width: nodeW, display: 'flex', alignItems: 'center', gap: 8,
                opacity: lit(tile.number) ? 1 : 0.3, transition: 'opacity .15s' }}>
              <TileButton tile={tile} size={size} onClick={() => onOpen(tile)} open={tile.number === focus} status={statuses?.[tile.number]} />
              {labeled && (
                <button type="button" onClick={() => onOpen(tile)} title={tile.title}
                  style={{ flex: 1, minWidth: 0, background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer',
                    color: 'var(--text)', fontSize: T.tiny, lineHeight: 1.3, fontWeight: tile.number === focus ? 600 : 400,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {tile.title}
                </button>
              )}
            </div>
          )
        })}
        {Array.from({ length: fogN }).map((_, i) => (
          <div key={`fog-${i}`} title={`${fog} question${fog === 1 ? '' : 's'} not yet specified`}
            style={{ position: 'absolute', left: 1 + (inGraph.length ? cols : 0) * (nodeW + gapX), top: 1 + ((allRows - fogN) / 2 + i) * (nodeH + gapY), width: size, height: nodeH,
              borderRadius: 6, border: '1.5px dashed var(--border)', color: 'var(--muted)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>
            ?
          </div>
        ))}
      </div>
      {alone.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: T.tiny, color: 'var(--muted)', marginRight: 4 }}>Not linked to anything</span>
          {alone.map(t => (
            <span key={t.number} style={{ opacity: lit(t.number) ? 1 : 0.3 }}>
              <TileButton tile={t} size={size} onClick={() => onOpen(t)} open={t.number === focus} status={statuses?.[t.number]} />
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: T.tiny, color: 'var(--muted)' }}>
        <span><svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke="var(--muted)" strokeWidth="1.2" /></svg> still blocks</span>
        <span><svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke="var(--muted)" strokeWidth="1.2" strokeDasharray="3 3" opacity=".6" /></svg> blocker closed</span>
        {fog > 0 && <span style={{ color: STATE_META.fog.text }}>? not yet specified</span>}
      </div>
    </div>
  )
}

// A ticket's neighborhood: what blocks it, it, and what it blocks (one step
// each way, plus their links to each other).
export function neighborhood(tiles: Tile[], focus: number): Tile[] {
  const f = tiles.find(t => t.number === focus)
  if (!f) return []
  const keep = new Set<number>([focus, ...(f.blockers ?? f.blockedBy)])
  tiles.forEach(t => { if ((t.blockers ?? t.blockedBy).includes(focus)) keep.add(t.number) })
  // Within the neighborhood, edges only between kept tiles (layout ignores the rest).
  return tiles.filter(t => keep.has(t.number))
}
