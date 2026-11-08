import { useEffect, useMemo, useRef, useState } from 'react'
import { T } from './common'
import { STATE_META, TileButton, type SessionStatus } from './Frontier'
import { chain } from './Graph'
import type { Tile } from './types'

// The effort as a network: containers that hold tickets (the wayfinder map with
// its decisions and its fog, the spec's tickets, the source issue), and the
// blocking links between tickets, inside a container or across them. Placement
// comes from the connections, not from columns: a force layout pulls each ticket
// toward its own container and toward what it's linked to, pushes everything
// else apart, and keeps containers clear of each other. It's seeded, so the same
// effort draws the same picture every time.

type Group = { id: string; label: string; hint: string }
type Node = { id: string; group: string; tile?: Tile; fog?: string; x: number; y: number; vx: number; vy: number }

const TILE = 34
const R = 26 // a node's reach, for spacing and arrow ends

function groupOf(t: Tile): string {
  if (t.source) return 'source'
  if (t.type === 'build') return 'tickets'
  return 'map'
}

// A small deterministic random, so the layout doesn't jump between renders.
function seeded(seed: number) {
  let s = seed >>> 0 || 1
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

function layout(tiles: Tile[], fogItems: string[], groups: Group[], width: number, height: number) {
  const rand = seeded(tiles.reduce((a, t) => a * 31 + t.number, 7) + fogItems.length)
  const cx = width / 2
  const cy = height / 2
  const ring = Math.min(width, height) * 0.3
  const center = new Map(groups.map((g, i) => {
    // Side by side first (left, right), then around a circle.
    const a = (i / Math.max(groups.length, 1)) * Math.PI * 2 + Math.PI
    return [g.id, groups.length === 1 ? { x: cx, y: cy } : { x: cx + Math.cos(a) * ring, y: cy + Math.sin(a) * ring }]
  }))
  const nodes: Node[] = [
    ...tiles.map(t => ({ id: `t${t.number}`, group: groupOf(t), tile: t, x: 0, y: 0, vx: 0, vy: 0 })),
    ...fogItems.map((f, i) => ({ id: `f${i}`, group: 'map', fog: f, x: 0, y: 0, vx: 0, vy: 0 })),
  ]
  for (const n of nodes) {
    const c = center.get(n.group) ?? { x: cx, y: cy }
    n.x = c.x + (rand() - 0.5) * 80
    n.y = c.y + (rand() - 0.5) * 80
  }
  const byId = new Map(nodes.map(n => [n.id, n]))
  const known = new Set(tiles.map(t => t.number))
  const edges = tiles.flatMap(t => (t.blockers ?? t.blockedBy).filter(b => known.has(b) && b !== t.number)
    .map(b => ({ from: byId.get(`t${b}`)!, to: byId.get(`t${t.number}`)! })))

  const steps = 420
  for (let it = 0; it < steps; it++) {
    const alpha = 1 - it / steps
    // Everything repels; across containers, harder.
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j]
        let dx = b.x - a.x, dy = b.y - a.y
        let d2 = dx * dx + dy * dy
        if (d2 < 1) { dx = rand() - 0.5; dy = rand() - 0.5; d2 = 1 }
        const d = Math.sqrt(d2)
        const f = (a.group === b.group ? 9000 : 22000) / d2 * (0.3 + alpha)
        a.vx -= (dx / d) * f; a.vy -= (dy / d) * f
        b.vx += (dx / d) * f; b.vy += (dy / d) * f
      }
    }
    // Links pull their ends to a comfortable length.
    for (const { from, to } of edges) {
      const dx = to.x - from.x, dy = to.y - from.y
      const d = Math.max(1, Math.hypot(dx, dy))
      const pull = (d - 110) * 0.03
      from.vx += (dx / d) * pull; from.vy += (dy / d) * pull
      to.vx -= (dx / d) * pull; to.vy -= (dy / d) * pull
    }
    // Each ticket is drawn to its container's middle; containers to their home.
    const centroid = new Map<string, { x: number; y: number; n: number }>()
    for (const n of nodes) {
      const c = centroid.get(n.group) ?? { x: 0, y: 0, n: 0 }
      c.x += n.x; c.y += n.y; c.n += 1
      centroid.set(n.group, c)
    }
    for (const n of nodes) {
      const c = centroid.get(n.group)!
      const home = center.get(n.group) ?? { x: cx, y: cy }
      n.vx += (c.x / c.n - n.x) * 0.012 + (home.x - n.x) * 0.004
      n.vy += (c.y / c.n - n.y) * 0.012 + (home.y - n.y) * 0.004
    }
    // Tickets never overlap: any two closer than a gap apart are pushed apart.
    const gap = 2 * R + 18
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j]
        const dx = b.x - a.x, dy = b.y - a.y
        const d = Math.hypot(dx, dy) || 0.01
        if (d < gap) {
          const push = (gap - d) / 2
          a.x -= (dx / d) * push; a.y -= (dy / d) * push
          b.x += (dx / d) * push; b.y += (dy / d) * push
        }
      }
    }
    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy
      n.vx *= 0.55; n.vy *= 0.55
      n.x = Math.max(R + 8, Math.min(width - R - 8, n.x))
      n.y = Math.max(R + 28, Math.min(height - R - 8, n.y))
    }
  }

  const hulls = groups.map(g => {
    const members = nodes.filter(n => n.group === g.id)
    if (!members.length) return null
    const x = members.reduce((a, n) => a + n.x, 0) / members.length
    const y = members.reduce((a, n) => a + n.y, 0) / members.length
    const r = Math.max(...members.map(n => Math.hypot(n.x - x, n.y - y))) + R + 18
    return { group: g, x, y, r }
  }).filter((h): h is NonNullable<typeof h> => !!h)

  // Fit the whole picture (rings and their labels) into the box, centred.
  if (hulls.length) {
    const minX = Math.min(...hulls.map(h => h.x - h.r)), maxX = Math.max(...hulls.map(h => h.x + h.r))
    const minY = Math.min(...hulls.map(h => h.y - h.r - 18)), maxY = Math.max(...hulls.map(h => h.y + h.r))
    const pad = 8
    const s = Math.min(1, (width - 2 * pad) / (maxX - minX), (height - 2 * pad) / (maxY - minY))
    const ox = (width - (maxX - minX) * s) / 2, oy = (height - (maxY - minY) * s) / 2
    const fit = (x: number, y: number) => ({ x: (x - minX) * s + ox, y: (y - minY) * s + oy })
    for (const n of nodes) Object.assign(n, fit(n.x, n.y))
    for (const h of hulls) { Object.assign(h, fit(h.x, h.y)); h.r *= s }
  }
  return { nodes, edges, hulls }
}

export function NetworkMap({ tiles, fogItems = [], mapIssue, effort, statuses, focus, highlight, onOpen }: {
  tiles: Tile[]
  fogItems?: string[]
  mapIssue: number | null
  effort: number
  statuses?: Record<number, SessionStatus>
  focus?: number | null
  highlight?: Set<number> | null
  onOpen: (t: Tile) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const groups: Group[] = useMemo(() => [
    { id: 'map', label: mapIssue ? `Wayfinder map #${mapIssue}` : 'Decisions', hint: 'Decision tickets and the fog (not yet specified)' },
    { id: 'tickets', label: `Spec tickets · kipo:${effort}`, hint: 'What the hand-over cut from the spec' },
    { id: 'source', label: 'Source issue', hint: 'The issue this effort started from' },
  ].filter(g => tiles.some(t => groupOf(t) === g.id) || (g.id === 'map' && fogItems.length > 0)), [tiles, fogItems.length, mapIssue, effort])

  const count = tiles.length + fogItems.length
  const height = Math.max(420, Math.min(760, 200 + count * 26))
  const { nodes, edges, hulls } = useMemo(
    () => (width ? layout(tiles, fogItems, groups, width, height) : { nodes: [], edges: [], hulls: [] }),
    [tiles, fogItems, groups, width, height],
  )

  const traced = hover != null ? new Set(chain(tiles, hover).map(t => t.number)) : null
  const lit = (n: number) => (traced ? traced.has(n) : highlight ? highlight.has(n) : true)
  const hovered = hover != null ? tiles.find(t => t.number === hover) ?? null : null

  return (
    <div ref={box} style={{ position: 'relative', width: '100%', height, minWidth: 0 }}>
      {width > 0 && (
        <>
          <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }} aria-hidden>
            <defs>
              <marker id="kipo-net-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L8,4 L0,8 z" fill="var(--muted)" />
              </marker>
            </defs>
            {hulls.map(h => (
              <g key={h.group.id}>
                <circle cx={h.x} cy={h.y} r={h.r} fill="var(--accent)" fillOpacity={0.04} stroke="var(--border)" strokeWidth={1.2} />
                <text x={h.x} y={Math.max(14, h.y - h.r - 6)} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--muted)">{h.group.label}</text>
              </g>
            ))}
            {edges.map(({ from, to }) => {
              const dx = to.x - from.x, dy = to.y - from.y
              const d = Math.max(1, Math.hypot(dx, dy))
              const ux = dx / d, uy = dy / d
              const done = from.tile!.state === 'done'
              const on = lit(from.tile!.number) && lit(to.tile!.number)
              const bold = traced ? on : focus != null && (from.tile!.number === focus || to.tile!.number === focus)
              return (
                <line key={`${from.id}-${to.id}`} x1={from.x + ux * R} y1={from.y + uy * R} x2={to.x - ux * (R + 2)} y2={to.y - uy * (R + 2)}
                  stroke={bold ? 'var(--text)' : 'var(--muted)'} strokeWidth={bold ? 1.8 : 1.2} strokeDasharray={done ? '4 4' : undefined}
                  opacity={on ? (done ? 0.5 : 0.85) : 0.12} markerEnd="url(#kipo-net-arrow)" />
              )
            })}
          </svg>
          {nodes.map(n => n.tile ? (
            <div key={n.id} style={{ position: 'absolute', left: n.x - TILE / 2, top: n.y - (TILE + 6) / 2,
              opacity: lit(n.tile.number) ? 1 : 0.25, transition: 'opacity .15s' }}
              onPointerEnter={() => setHover(n.tile!.number)} onPointerLeave={() => setHover(h => (h === n.tile!.number ? null : h))}>
              <span style={{ display: 'inline-flex', borderRadius: 8,
                boxShadow: n.tile.state === 'you' || n.tile.state === 'afk' ? `0 0 0 2px var(--bg), 0 0 0 3.5px ${STATE_META[n.tile.state].color}` : undefined }}>
                <TileButton tile={n.tile} size={TILE} onClick={() => onOpen(n.tile!)} open={n.tile.number === focus} status={statuses?.[n.tile.number]} />
              </span>
            </div>
          ) : (
            <span key={n.id} title={`Not yet specified: ${n.fog}`}
              style={{ position: 'absolute', left: n.x - TILE / 2, top: n.y - (TILE + 6) / 2, width: TILE, height: TILE + 6, borderRadius: 6,
                border: '1.5px dashed var(--muted)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, opacity: traced ? 0.25 : 1 }}>?</span>
          ))}
          {hovered && (
            <div style={{ position: 'absolute', left: 8, bottom: 8, maxWidth: 420, padding: '8px 10px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text)', fontSize: T.small, lineHeight: 1.4, pointerEvents: 'none' }}>
              <b>#{hovered.number}</b> {hovered.title}
              <div style={{ color: STATE_META[hovered.state].text, fontSize: T.tiny, marginTop: 2 }}>
                {STATE_META[hovered.state].label}{hovered.blockedBy.length ? ` · waiting on ${hovered.blockedBy.map(b => `#${b}`).join(', ')}` : ''}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
