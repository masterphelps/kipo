import { useEffect, useRef, useState } from 'react'
import { T } from './common'
import { STATE_META, TileButton, type SessionStatus } from './Frontier'
import type { Tile } from './types'

// The blocking graph drawn with the tiles themselves: each ticket sits in a
// column by how deep it is in the chain (nothing blocks column 0), arrows run
// from blocker to blocked. An arrow from a closed blocker is faint and dashed:
// that wait is over. With `bands`, Decide tickets sit in a top band and Deliver
// tickets in a bottom one, so the hand-over shows as arrows crossing between
// them. The frontier (open, unblocked tickets: HITL or agent) is
// outlined in its own color. Fog is dashed "?" tiles past the last column.

const PAD = 6

type Placed = { tile: Tile; col: number; row: number }
type Layout = { placed: Placed[]; cols: number; rows: number; split: number | null }

const blockersIn = (t: Tile, known: Map<number, Tile>) =>
  (t.blockers ?? t.blockedBy).filter(n => known.has(n) && n !== t.number)

function layout(tiles: Tile[], bands: boolean): Layout {
  const byNumber = new Map(tiles.map(t => [t.number, t]))
  const depth = new Map<number, number>()
  const visiting = new Set<number>()
  const depthOf = (t: Tile): number => {
    if (depth.has(t.number)) return depth.get(t.number)!
    if (visiting.has(t.number)) return 0 // a cycle: break it rather than loop
    visiting.add(t.number)
    const bs = blockersIn(t, byNumber)
    const d = bs.length ? 1 + Math.max(...bs.map(n => depthOf(byNumber.get(n)!))) : 0
    visiting.delete(t.number)
    depth.set(t.number, d)
    return d
  }
  tiles.forEach(depthOf)
  const cols = tiles.length ? Math.max(...tiles.map(t => depth.get(t.number)!)) + 1 : 0

  // Rows, one band at a time: column 0 by number, later columns by the average
  // row of their blockers (one barycenter pass keeps arrows short), each column
  // centered in its band.
  const groups: Tile[][] = bands
    ? [tiles.filter(t => t.lane === 'decide'), tiles.filter(t => t.lane !== 'decide')]
    : [tiles]
  const rowOf = new Map<number, number>()
  const placed: Placed[] = []
  let top = 0
  let split: number | null = null
  groups.forEach((group, gi) => {
    if (!group.length) return
    if (bands && gi === 1 && top > 0) { split = top; top += 0.6 } // room for the band line
    let bandRows = 0
    const perCol: Tile[][] = []
    for (let c = 0; c < cols; c++) {
      const inCol = group.filter(t => depth.get(t.number) === c)
      const key = (t: Tile) => {
        const bs = blockersIn(t, byNumber).map(n => rowOf.get(n)).filter((r): r is number => r !== undefined)
        return bs.length ? bs.reduce((a, b) => a + b, 0) / bs.length : t.number / 1000
      }
      inCol.sort((a, b) => key(a) - key(b) || a.number - b.number)
      inCol.forEach((t, i) => rowOf.set(t.number, top + i))
      perCol.push(inCol)
      bandRows = Math.max(bandRows, inCol.length)
    }
    perCol.forEach((inCol, c) => {
      const shift = (bandRows - inCol.length) / 2
      inCol.forEach((t, i) => {
        const row = top + i + shift
        rowOf.set(t.number, row)
        placed.push({ tile: t, col: c, row })
      })
    })
    top += bandRows
  })
  return { placed, cols, rows: top, split }
}

export function TileGraph({ tiles, focus, fog = 0, onOpen, statuses, labeled, bands, highlight, dimOthers = true, down }: {
  tiles: Tile[]
  focus?: number | null          // the open ticket: outlined, its arrows drawn bold
  fog?: number
  onOpen: (t: Tile) => void
  statuses?: Record<number, SessionStatus>
  labeled?: boolean              // wider nodes with the ticket's title
  bands?: boolean                // Decide band over Deliver band
  highlight?: Set<number> | null // a picked bar segment: these stay lit, the rest dim
  dimOthers?: boolean            // with a focus, dim tickets not linked to it
  down?: boolean                 // top to bottom: blockers in the top row, arrows pointing down (for narrow panels)
}) {
  // Fit the panel: labeled nodes shrink to the width available (down to a floor).
  const box = useRef<HTMLDivElement>(null)
  const [avail, setAvail] = useState(0)
  // Hovering a ticket lights its whole chain: everything it waits on, and
  // everything that waits on it.
  const [hover, setHover] = useState<number | null>(null)
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
  const known = new Map(tiles.map(t => [t.number, t]))
  const linked = new Set<number>()
  for (const t of tiles) for (const b of blockersIn(t, known)) { linked.add(b); linked.add(t.number) }
  const alone = tiles.length > 1 ? tiles.filter(t => !linked.has(t.number)) : []
  const inGraph = alone.length ? tiles.filter(t => linked.has(t.number)) : tiles
  const { placed, cols, rows, split } = layout(inGraph, !!bands)

  const size = 30
  const vertical = !!down && !bands
  const labelW = bands ? 52 : 0
  const gapX = vertical ? 12 : bands ? 64 : labeled ? 40 : 48
  const fogN = fog > 0 && !vertical ? Math.min(fog, 4) : 0
  const fogW = fogN ? gapX + size : 0 // the fog column is one narrow tile wide
  // Across the panel: depth columns, or (top to bottom) the widest row of one depth.
  const across = vertical ? Math.max(1, rows) : cols
  const fit = avail && across ? Math.floor((avail - 2 - 2 * PAD - labelW - fogW - (across - 1) * gapX) / across) : 168
  const nodeW = labeled ? Math.max(vertical ? 120 : 110, Math.min(bands ? 240 : vertical ? 260 : 200, fit)) : size
  const nodeH = size + 6
  const gapY = vertical ? 30 : labeled ? 10 : 8 // top to bottom: room for the arrows between rows
  const graphCols = inGraph.length ? cols : 0
  const width = vertical
    ? (inGraph.length ? across * (nodeW + gapX) - gapX : 0) + 2
    : labelW + (graphCols ? graphCols * (nodeW + gapX) - gapX : 0) + fogW + 2
  // The fog belongs to Decide: center it in the Decide band (the whole graph
  // when there are no bands).
  const decideRows = split ?? rows
  const allRows = vertical ? graphCols : Math.max(rows, fogN)
  const rowY = (r: number) => 1 + r * (nodeH + gapY)
  const height = inGraph.length || fogN ? rowY(allRows) - gapY + 1 : 0
  const pos = new Map(placed.map(p => [p.tile.number, vertical
    ? { x: 1 + p.row * (nodeW + gapX), y: rowY(p.col) }
    : { x: labelW + 1 + p.col * (nodeW + gapX), y: rowY(p.row) }]))

  const neighbors = new Set<number>()
  if (focus != null) {
    neighbors.add(focus)
    const f = known.get(focus)
    if (f) blockersIn(f, known).forEach(n => neighbors.add(n))
    tiles.forEach(t => { if (blockersIn(t, known).includes(focus)) neighbors.add(t.number) })
  }
  const hovered = hover != null && known.has(hover) ? new Set(chain(tiles, hover).map(t => t.number)) : null
  const lit = (n: number) =>
    hovered ? hovered.has(n)
      : (highlight ? highlight.has(n) : true) && (focus == null || !dimOthers || neighbors.has(n))
  const frontier = (t: Tile) => t.state === 'you' || t.state === 'afk'
  const ringFor = (t: Tile) =>
    frontier(t) && t.number !== focus ? `0 0 0 2px var(--bg), 0 0 0 3.5px ${STATE_META[t.state].color}` : undefined

  const edges: { from: Tile; to: Tile }[] = []
  for (const t of inGraph) for (const b of blockersIn(t, known)) edges.push({ from: known.get(b)!, to: t })
  const bandLineY = split != null ? rowY(split) + 0.3 * (nodeH + gapY) - gapY / 2 : null

  return (
    // PAD keeps the frontier ring and the open outline (both drawn outside the
    // tile) inside the scroller, which would otherwise clip them.
    <div ref={box} style={{ overflowX: 'auto', padding: PAD, scrollbarWidth: 'thin', minWidth: 0 }}>
      <div style={{ position: 'relative', width, height, minWidth: width }}>
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden>
          <defs>
            <marker id="kipo-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8 z" fill="var(--muted)" />
            </marker>
          </defs>
          {bandLineY != null && (
            <line x1={0} x2={width} y1={bandLineY} y2={bandLineY} stroke="var(--border)" strokeDasharray="2 4" />
          )}
          {edges.map(({ from, to }) => {
            const a = pos.get(from.number)
            const b = pos.get(to.number)
            if (!a || !b) return null
            const done = from.state === 'done'
            const bold = hovered ? hovered.has(from.number) && hovered.has(to.number)
              : focus != null && (from.number === focus || to.number === focus)
            const faded = hovered ? !bold : (focus != null && dimOthers && !bold) || !lit(from.number) || !lit(to.number)
            // Left to right: out of the blocker's right side into the blocked one's left.
            // Top to bottom: out of the blocker's bottom (under its tile) into the blocked one's top.
            const d = vertical
              ? (() => {
                const x1 = a.x + size / 2, y1 = a.y + nodeH + 2, x2 = b.x + size / 2, y2 = b.y - 2, mid = (y1 + y2) / 2
                return `M${x1},${y1} C${x1},${mid} ${x2},${mid} ${x2},${y2}`
              })()
              : (() => {
                const x1 = a.x + nodeW + 2, y1 = a.y + nodeH / 2, x2 = b.x - 2, y2 = b.y + nodeH / 2, mid = (x1 + x2) / 2
                return `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`
              })()
            return (
              <path key={`${from.number}-${to.number}`}
                d={d}
                fill="none" stroke={bold ? 'var(--text)' : 'var(--muted)'} strokeWidth={bold ? 1.6 : 1.2}
                strokeDasharray={done ? '3 3' : undefined}
                opacity={faded ? 0.15 : done ? 0.45 : 0.8}
                markerEnd="url(#kipo-arrow)" />
            )
          })}
        </svg>
        {bands && placed.length > 0 && (['decide', 'deliver'] as const).map(lane => {
          const ys = placed.filter(p => (lane === 'decide' ? p.tile.lane === 'decide' : p.tile.lane !== 'decide')).map(p => p.row)
          if (!ys.length) return null
          const mid = (Math.min(...ys) + Math.max(...ys)) / 2
          return (
            <span key={lane} style={{ position: 'absolute', left: 0, top: rowY(mid) + nodeH / 2 - 8, fontSize: T.tiny, fontWeight: 600, color: 'var(--muted)' }}>
              {lane === 'decide' ? 'Decide' : 'Deliver'}
            </span>
          )
        })}
        {placed.map(({ tile }) => {
          const p = pos.get(tile.number)!
          return (
            <div key={tile.number}
              onPointerEnter={() => setHover(tile.number)} onPointerLeave={() => setHover(h => (h === tile.number ? null : h))}
              style={{ position: 'absolute', left: p.x, top: p.y, width: nodeW, display: 'flex', alignItems: 'center', gap: 8,
                opacity: lit(tile.number) ? 1 : 0.28, transition: 'opacity .15s' }}>
              <span title={ringFor(tile) ? 'On the frontier: open and unblocked' : undefined}
                style={{ borderRadius: 8, boxShadow: ringFor(tile), display: 'inline-flex' }}>
                <TileButton tile={tile} size={size} onClick={() => onOpen(tile)} open={tile.number === focus} status={statuses?.[tile.number]} />
              </span>
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
            style={{ position: 'absolute', left: labelW + 1 + graphCols * (nodeW + gapX), top: rowY(Math.max(0, (decideRows - fogN) / 2) + i), width: size, height: nodeH,
              borderRadius: 6, border: '1.5px dashed var(--border)', color: 'var(--muted)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>
            ?
          </div>
        ))}
      </div>
      {alone.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap', paddingLeft: labelW }}>
          <span style={{ fontSize: T.tiny, color: 'var(--muted)', marginRight: 2 }}>Not linked to anything</span>
          {alone.map(t => (
            <span key={t.number} style={{ opacity: lit(t.number) ? 1 : 0.28, borderRadius: 8, display: 'inline-flex', boxShadow: ringFor(t) }}>
              <TileButton tile={t} size={size} onClick={() => onOpen(t)} open={t.number === focus} status={statuses?.[t.number]} />
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: T.tiny, color: 'var(--muted)', flexWrap: 'wrap', paddingLeft: labelW }}>
        <span><svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke="var(--muted)" strokeWidth="1.2" /></svg> still blocks</span>
        <span><svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke="var(--muted)" strokeWidth="1.2" strokeDasharray="3 3" opacity=".6" /></svg> blocker closed</span>
        <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, boxShadow: `0 0 0 1.5px ${STATE_META.you.color}`, marginRight: 5 }} />frontier: open and unblocked</span>
        {fog > 0 && <span>? not yet specified</span>}
      </div>
    </div>
  )
}

// A ticket's whole chain: everything it waits on (all the way up) and
// everything waiting on it (all the way down).
export function chain(tiles: Tile[], focus: number): Tile[] {
  const byNumber = new Map(tiles.map(t => [t.number, t]))
  if (!byNumber.has(focus)) return []
  const keep = new Set<number>([focus])
  const up = [focus]
  while (up.length) {
    const t = byNumber.get(up.pop()!)
    for (const b of t ? blockersIn(t, byNumber) : []) if (!keep.has(b)) { keep.add(b); up.push(b) }
  }
  const down = new Set<number>([focus])
  const queue = [focus]
  while (queue.length) {
    const n = queue.pop()!
    for (const t of tiles) {
      if (!down.has(t.number) && blockersIn(t, byNumber).includes(n)) { down.add(t.number); keep.add(t.number); queue.push(t.number) }
    }
  }
  return tiles.filter(t => keep.has(t.number))
}

// What closing a ticket frees: tickets it blocks whose every other blocker is closed.
export function opensUp(tiles: Tile[], focus: number): Tile[] {
  const byNumber = new Map(tiles.map(t => [t.number, t]))
  return tiles.filter(t => t.state !== 'done' && blockersIn(t, byNumber).includes(focus)
    && blockersIn(t, byNumber).every(b => b === focus || byNumber.get(b)?.state === 'done'))
}
