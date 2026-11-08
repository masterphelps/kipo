import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { T } from './common'
import { STATE_META, TileButton, type SessionStatus } from './Frontier'
import { chain } from './Graph'
import type { PrInfo, Tile } from './types'

// The effort as a network of what it's made of and how those things relate.
//
//   contains   a ring holds its members: the wayfinder map holds its decision
//              tickets and its fog; the spec's tickets sit together; the source
//              issue alone
//   blocks     one ticket waits on another (GitHub's native blocking link), inside
//              a ring or across rings; dashed once the blocker is done
//   closes     a pull request closes tickets: a small PR node on each, green once
//              merged
//   hand-over  the spec's tickets were cut from the decided map: one link between
//              the two rings
//
// It's a live layout. Tickets pull toward their own ring and toward what they're
// linked to, and push everything else away. Drag a ticket and its neighbours
// follow; where you drop it, it stays (remembered per effort). Drag a ring's
// label to move the whole group. Drag empty space to pan; scroll to zoom.

type GroupId = 'map' | 'tickets' | 'source'
type Group = { id: GroupId; label: string }
type Kind = 'tile' | 'fog' | 'pr'
type Node = {
  id: string; kind: Kind; group: GroupId | 'pr'
  tile?: Tile; fog?: string; pr?: PrInfo
  x: number; y: number; vx: number; vy: number
  pinned?: boolean
}
type Edge = { a: Node; b: Node; kind: 'blocks' | 'closes' }
type View = { k: number; tx: number; ty: number }
type Saved = { nodes: Record<string, { x: number; y: number; pinned?: boolean }>; view?: View }

const TILE = 34
const R = 26
const PR_W = 62
const PR_H = 22

const groupOf = (t: Tile): GroupId => (t.source ? 'source' : t.type === 'build' ? 'tickets' : 'map')

function seeded(seed: number) {
  let s = seed >>> 0 || 1
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

// One step of the forces. `home` (initial placement only) pulls each ring
// toward its own spot so rings start apart; live, rings move freely.
function step(nodes: Node[], edges: Edge[], alpha: number, home?: Map<string, { x: number; y: number }>) {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      let dx = b.x - a.x, dy = b.y - a.y
      let d2 = dx * dx + dy * dy
      if (d2 < 1) { dx = 0.5; dy = 0.3; d2 = 1 }
      const d = Math.sqrt(d2)
      const same = a.group === b.group
      const f = (same ? 9000 : 22000) / d2 * (0.3 + alpha)
      a.vx -= (dx / d) * f; a.vy -= (dy / d) * f
      b.vx += (dx / d) * f; b.vy += (dy / d) * f
    }
  }
  for (const { a, b, kind } of edges) {
    const dx = b.x - a.x, dy = b.y - a.y
    const d = Math.max(1, Math.hypot(dx, dy))
    const rest = kind === 'closes' ? 64 : 110
    const pull = (d - rest) * (kind === 'closes' ? 0.08 : 0.03)
    a.vx += (dx / d) * pull; a.vy += (dy / d) * pull
    b.vx -= (dx / d) * pull; b.vy -= (dy / d) * pull
  }
  const centroid = new Map<string, { x: number; y: number; n: number }>()
  for (const n of nodes) {
    if (n.kind === 'pr') continue
    const c = centroid.get(n.group) ?? { x: 0, y: 0, n: 0 }
    c.x += n.x; c.y += n.y; c.n += 1
    centroid.set(n.group, c)
  }
  for (const n of nodes) {
    if (n.kind === 'pr') continue
    const c = centroid.get(n.group)!
    n.vx += (c.x / c.n - n.x) * 0.012
    n.vy += (c.y / c.n - n.y) * 0.012
    const h = home?.get(n.group)
    if (h) { n.vx += (h.x - n.x) * 0.004; n.vy += (h.y - n.y) * 0.004 }
  }
  for (const n of nodes) {
    if (n.pinned) { n.vx = 0; n.vy = 0; continue }
    n.x += n.vx; n.y += n.vy
    n.vx *= 0.55; n.vy *= 0.55
  }
  // Rings don't overlap: two groups closer than their radii are pushed apart whole.
  const rings = [...new Set(nodes.filter(n => n.kind !== 'pr').map(n => n.group))].map(g => {
    const m = nodes.filter(n => n.group === g)
    const x = m.reduce((a, n) => a + n.x, 0) / m.length, y = m.reduce((a, n) => a + n.y, 0) / m.length
    return { m, x, y, r: Math.max(...m.map(n => Math.hypot(n.x - x, n.y - y))) + R + 18 }
  })
  for (let i = 0; i < rings.length; i++) {
    for (let j = i + 1; j < rings.length; j++) {
      const a = rings[i], b = rings[j]
      const dx = b.x - a.x, dy = b.y - a.y
      const d = Math.hypot(dx, dy) || 0.01
      const want = a.r + b.r + 70 // room for the hand-over link between them
      if (d < want) {
        const push = Math.min(12, (want - d) / 2)
        for (const n of a.m) if (!n.pinned) { n.x -= (dx / d) * push; n.y -= (dy / d) * push }
        for (const n of b.m) if (!n.pinned) { n.x += (dx / d) * push; n.y += (dy / d) * push }
      }
    }
  }
  // Nothing overlaps.
  const gap = 2 * R + 18
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      const dx = b.x - a.x, dy = b.y - a.y
      const d = Math.hypot(dx, dy) || 0.01
      const g = a.kind === 'pr' || b.kind === 'pr' ? gap * 0.8 : gap
      if (d < g) {
        const push = (g - d) / 2
        if (!a.pinned) { a.x -= (dx / d) * push; a.y -= (dy / d) * push }
        if (!b.pinned) { b.x += (dx / d) * push; b.y += (dy / d) * push }
      }
    }
  }
}

function hullsOf(nodes: Node[], groups: Group[]) {
  return groups.map(g => {
    const members = nodes.filter(n => n.group === g.id)
    if (!members.length) return null
    const x = members.reduce((a, n) => a + n.x, 0) / members.length
    const y = members.reduce((a, n) => a + n.y, 0) / members.length
    const r = Math.max(...members.map(n => Math.hypot(n.x - x, n.y - y))) + R + 18
    return { group: g, x, y, r, members }
  }).filter((h): h is NonNullable<typeof h> => !!h)
}

function readSaved(key: string): Saved | null {
  try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
}

export function NetworkMap({ tiles, prs = [], fogItems = [], mapIssue, effort, storageKey, statuses, focus, highlight, onOpen }: {
  tiles: Tile[]
  prs?: PrInfo[]
  fogItems?: string[]
  mapIssue: number | null
  effort: number
  storageKey: string // where dropped positions and the view are remembered
  statuses?: Record<number, SessionStatus>
  focus?: number | null
  highlight?: Set<number> | null
  onOpen: (t: Tile) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState<View>(() => readSaved(storageKey)?.view ?? { k: 1, tx: 0, ty: 0 })
  const [hover, setHover] = useState<number | null>(null)
  const [rebuild, setRebuild] = useState(0)
  const [, setTick] = useState(0)
  const sim = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] })
  const alpha = useRef(0)
  const raf = useRef<number | null>(null)
  const fitted = useRef(!!readSaved(storageKey)?.view)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const groups: Group[] = useMemo(() => [
    { id: 'map' as const, label: mapIssue ? `Wayfinder map #${mapIssue}` : 'Decisions' },
    { id: 'tickets' as const, label: `Spec tickets · kipo:${effort}` },
    { id: 'source' as const, label: 'Source issue' },
  ].filter(g => tiles.some(t => groupOf(t) === g.id) || (g.id === 'map' && fogItems.length > 0)), [tiles, fogItems.length, mapIssue, effort])

  const viewRef = useRef(view)
  viewRef.current = view
  const save = useCallback((v?: View) => {
    const nodes: Saved['nodes'] = {}
    for (const n of sim.current.nodes) nodes[n.id] = { x: Math.round(n.x), y: Math.round(n.y), pinned: n.pinned }
    try { localStorage.setItem(storageKey, JSON.stringify({ nodes, view: v ?? viewRef.current })) } catch { /* private mode */ }
  }, [storageKey])

  const run = useCallback(() => {
    if (raf.current != null) return
    const loop = () => {
      step(sim.current.nodes, sim.current.edges, alpha.current)
      alpha.current *= 0.96
      setTick(t => t + 1)
      raf.current = alpha.current > 0.02 ? requestAnimationFrame(loop) : null
    }
    raf.current = requestAnimationFrame(loop)
  }, [])
  useEffect(() => () => { if (raf.current != null) cancelAnimationFrame(raf.current) }, [])

  const fit = useCallback((nodes = sim.current.nodes) => {
    if (!size.w || !nodes.length) return undefined
    const hs = hullsOf(nodes, groups)
    const xs = [...hs.flatMap(h => [h.x - h.r, h.x + h.r]), ...nodes.map(n => n.x)]
    const ys = [...hs.flatMap(h => [h.y - h.r - 22, h.y + h.r]), ...nodes.map(n => n.y)]
    const minX = Math.min(...xs) - 30, maxX = Math.max(...xs) + 30
    const minY = Math.min(...ys) - 40, maxY = Math.max(...ys) + 50 // the legend sits at the bottom
    const k = Math.max(0.3, Math.min(1.4, size.w / (maxX - minX), size.h / (maxY - minY)))
    const v = { k, tx: (size.w - (maxX - minX) * k) / 2 - minX * k, ty: (size.h - (maxY - minY) * k) / 2 - minY * k }
    setView(v)
    return v
  }, [size.w, size.h, groups])

  // Build the network whenever the effort's tickets change, keeping whatever
  // positions are already known (on screen, or remembered).
  useEffect(() => {
    if (!size.w) return
    const saved = readSaved(storageKey)?.nodes ?? {}
    const prev = new Map(sim.current.nodes.map(n => [n.id, n]))
    const known = new Set(tiles.map(t => t.number))
    const nodes: Node[] = [
      ...tiles.map(t => ({ id: `t${t.number}`, kind: 'tile' as const, group: groupOf(t), tile: t, x: 0, y: 0, vx: 0, vy: 0 })),
      ...fogItems.map((f, i) => ({ id: `f${i}`, kind: 'fog' as const, group: 'map' as const, fog: f, x: 0, y: 0, vx: 0, vy: 0 })),
      ...prs.filter(p => p.tickets.some(n => known.has(n)))
        .map(p => ({ id: `p${p.number}`, kind: 'pr' as const, group: 'pr' as const, pr: p, x: 0, y: 0, vx: 0, vy: 0 })),
    ]
    const byId = new Map(nodes.map(n => [n.id, n]))
    const edges: Edge[] = [
      ...tiles.flatMap(t => (t.blockers ?? t.blockedBy).filter(b => known.has(b) && b !== t.number)
        .map(b => ({ a: byId.get(`t${b}`)!, b: byId.get(`t${t.number}`)!, kind: 'blocks' as const }))),
      ...nodes.filter(n => n.pr).flatMap(n => n.pr!.tickets.filter(t => known.has(t))
        .map(t => ({ a: n, b: byId.get(`t${t}`)!, kind: 'closes' as const }))),
    ]
    const rand = seeded(tiles.reduce((a, t) => a * 31 + t.number, 7) + fogItems.length)
    const ring = 260
    const home = new Map(groups.map((g, i) => {
      const a = (i / Math.max(groups.length, 1)) * Math.PI * 2 + Math.PI
      return [g.id as string, groups.length === 1 ? { x: 0, y: 0 } : { x: Math.cos(a) * ring, y: Math.sin(a) * ring }]
    }))
    let fresh = 0
    for (const n of nodes) {
      const was = prev.get(n.id) ?? saved[n.id]
      if (was) { n.x = was.x; n.y = was.y; n.pinned = was.pinned; continue }
      fresh++
      let h = home.get(n.group) ?? { x: 0, y: 0 }
      if (n.pr) {
        const t = byId.get(`t${n.pr.tickets.find(x => known.has(x))}`)
        if (t) h = { x: t.x, y: t.y }
      }
      n.x = h.x + (rand() - 0.5) * 80
      n.y = h.y + (rand() - 0.5) * 80
    }
    // A first layout settles before it's shown; later changes settle live.
    if (fresh === nodes.length) {
      for (let i = 0; i < 360; i++) step(nodes, edges, 1 - i / 360, home)
    }
    sim.current = { nodes, edges }
    if (!fitted.current) { fitted.current = true; const v = fit(nodes); if (v) save(v) }
    if (fresh && fresh < nodes.length) { alpha.current = 0.5; run() }
    setTick(t => t + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles, prs, fogItems, groups, size.w > 0, storageKey, rebuild])

  // Screen to world.
  const world = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect()
    const v = viewRef.current
    return { x: (e.clientX - r.left - v.tx) / v.k, y: (e.clientY - r.top - v.ty) / v.k }
  }

  // Dragging: a node, a whole ring, or the canvas (pan).
  type Drag = { kind: 'node' | 'ring' | 'pan'; ids: string[]; sx: number; sy: number; last: { x: number; y: number }; moved: boolean; onClick?: () => void }
  const drag = useRef<Drag | null>(null)
  const [dragging, setDragging] = useState<Drag['kind'] | null>(null)
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d) return
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4) { d.moved = true; setDragging(d.kind) }
      if (!d.moved) return
      if (d.kind === 'pan') {
        const dx = e.clientX - d.last.x, dy = e.clientY - d.last.y
        d.last = { x: e.clientX, y: e.clientY }
        setView(v => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }))
        return
      }
      const w = world(e)
      const dx = w.x - d.last.x, dy = w.y - d.last.y
      d.last = w
      for (const n of sim.current.nodes) {
        if (d.ids.includes(n.id)) { n.x += dx; n.y += dy; n.pinned = true; n.vx = 0; n.vy = 0 }
      }
      alpha.current = Math.max(alpha.current, 0.3)
      run()
    }
    const up = () => {
      const d = drag.current
      drag.current = null
      setDragging(null)
      if (!d) return
      if (!d.moved) { d.onClick?.(); return }
      // A dropped ticket stays where it was put; a moved ring keeps moving freely.
      if (d.kind === 'ring') for (const n of sim.current.nodes) if (d.ids.includes(n.id)) n.pinned = false
      save()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  })

  const startDrag = (e: React.PointerEvent, kind: Drag['kind'], ids: string[], onClick?: () => void) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    drag.current = { kind, ids, sx: e.clientX, sy: e.clientY, last: kind === 'pan' ? { x: e.clientX, y: e.clientY } : world(e), moved: false, onClick }
  }

  // Scroll to zoom around the pointer.
  useEffect(() => {
    const el = box.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const sx = e.clientX - r.left, sy = e.clientY - r.top
      setView(v => {
        const k = Math.max(0.3, Math.min(3, v.k * Math.exp(-e.deltaY * 0.0015)))
        return { k, tx: sx - (sx - v.tx) * (k / v.k), ty: sy - (sy - v.ty) * (k / v.k) }
      })
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [])
  useEffect(() => { const t = setTimeout(() => save(view), 400); return () => clearTimeout(t) }, [view, save])

  const zoomBy = (f: number) => setView(v => {
    const sx = size.w / 2, sy = size.h / 2
    const k = Math.max(0.3, Math.min(3, v.k * f))
    return { k, tx: sx - (sx - v.tx) * (k / v.k), ty: sy - (sy - v.ty) * (k / v.k) }
  })
  const resetLayout = () => {
    try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
    sim.current = { nodes: [], edges: [] }
    fitted.current = false
    setRebuild(r => r + 1)
  }

  const { nodes, edges } = sim.current
  const hulls = hullsOf(nodes, groups)
  const traced = hover != null ? new Set(chain(tiles, hover).map(t => t.number)) : null
  const litTile = (n: number) => (traced ? traced.has(n) : highlight ? highlight.has(n) : true)
  const litNode = (n: Node) => (n.tile ? litTile(n.tile.number) : n.pr ? n.pr.tickets.some(litTile) : !traced)
  const hovered = hover != null ? tiles.find(t => t.number === hover) ?? null : null
  const mapHull = hulls.find(h => h.group.id === 'map')
  const specHull = hulls.find(h => h.group.id === 'tickets')

  const btn = { height: 24, minWidth: 26, padding: '0 7px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text)', cursor: 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } as const

  return (
    <div ref={box} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 420, overflow: 'hidden', touchAction: 'none', userSelect: 'none',
      cursor: dragging === 'pan' ? 'grabbing' : dragging ? 'grabbing' : 'grab' }}
      onPointerDown={e => startDrag(e, 'pan', [])}>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.k})`, transformOrigin: '0 0' }}>
        <svg width={1} height={1} style={{ position: 'absolute', overflow: 'visible' }} aria-hidden>
          <defs>
            <marker id="kipo-net-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8 z" fill="var(--muted)" />
            </marker>
            <marker id="kipo-net-hand" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8 z" fill="var(--accent)" />
            </marker>
          </defs>
          {hulls.map(h => (
            <circle key={h.group.id} cx={h.x} cy={h.y} r={h.r} fill="var(--accent)" fillOpacity={0.04} stroke="var(--border)" strokeWidth={1.2} />
          ))}
          {mapHull && specHull && (() => {
            // The hand-over: the spec's tickets were cut from the decided map.
            const dx = specHull.x - mapHull.x, dy = specHull.y - mapHull.y
            const d = Math.max(1, Math.hypot(dx, dy))
            if (d < mapHull.r + specHull.r + 10) return null
            const ux = dx / d, uy = dy / d
            const x1 = mapHull.x + ux * mapHull.r, y1 = mapHull.y + uy * mapHull.r
            const x2 = specHull.x - ux * (specHull.r + 3), y2 = specHull.y - uy * (specHull.r + 3)
            return (
              <g opacity={traced ? 0.2 : 0.75}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--accent)" strokeWidth={2.5} strokeDasharray="8 6" markerEnd="url(#kipo-net-hand)" />
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} textAnchor="middle" fontSize={10} fill="var(--accent)">hand-over</text>
              </g>
            )
          })()}
          {edges.map(({ a, b, kind }) => {
            const dx = b.x - a.x, dy = b.y - a.y
            const d = Math.max(1, Math.hypot(dx, dy))
            const ux = dx / d, uy = dy / d
            const on = litNode(a) && litNode(b)
            if (kind === 'closes') {
              const merged = a.pr!.state === 'MERGED'
              return (
                <line key={`${a.id}-${b.id}`} x1={a.x} y1={a.y} x2={b.x - ux * R} y2={b.y - uy * R}
                  stroke={merged ? STATE_META.done.color : STATE_META.review.color} strokeWidth={1.4} opacity={on ? 0.8 : 0.12} />
              )
            }
            const done = a.tile!.state === 'done'
            const bold = traced ? on : focus != null && (a.tile!.number === focus || b.tile!.number === focus)
            return (
              <line key={`${a.id}-${b.id}`} x1={a.x + ux * R} y1={a.y + uy * R} x2={b.x - ux * (R + 2)} y2={b.y - uy * (R + 2)}
                stroke={bold ? 'var(--text)' : 'var(--muted)'} strokeWidth={bold ? 1.8 : 1.2} strokeDasharray={done ? '4 4' : undefined}
                opacity={on ? (done ? 0.5 : 0.85) : 0.12} markerEnd="url(#kipo-net-arrow)" />
            )
          })}
        </svg>
        {hulls.map(h => (
          <div key={h.group.id} title="Drag to move this group"
            onPointerDown={e => startDrag(e, 'ring', h.members.map(m => m.id))}
            style={{ position: 'absolute', left: h.x, top: h.y - h.r - 20, transform: 'translateX(-50%)', whiteSpace: 'nowrap',
              fontSize: 11, fontWeight: 600, color: 'var(--muted)', cursor: 'move', padding: '1px 6px', borderRadius: 4, background: 'var(--bg)',
              border: '1px solid var(--border)' }}>
            {h.group.label}
          </div>
        ))}
        {nodes.map(n => {
          if (n.tile) {
            const t = n.tile
            return (
              <div key={n.id} style={{ position: 'absolute', left: n.x - TILE / 2, top: n.y - (TILE + 6) / 2, opacity: litNode(n) ? 1 : 0.25, cursor: 'pointer' }}
                onPointerDown={e => startDrag(e, 'node', [n.id], () => onOpen(t))}
                onPointerEnter={() => setHover(t.number)} onPointerLeave={() => setHover(h => (h === t.number ? null : h))}>
                <span style={{ display: 'inline-flex', borderRadius: 8, pointerEvents: 'none',
                  boxShadow: t.state === 'you' || t.state === 'afk' ? `0 0 0 2px var(--bg), 0 0 0 3.5px ${STATE_META[t.state].color}` : undefined }}>
                  <TileButton tile={t} size={TILE} open={t.number === focus} status={statuses?.[t.number]} />
                </span>
                {n.pinned && <span title="Placed by you" style={{ position: 'absolute', right: -4, bottom: -4, width: 6, height: 6, borderRadius: 999, background: 'var(--muted)' }} />}
              </div>
            )
          }
          if (n.pr) {
            const p = n.pr
            const color = p.state === 'MERGED' ? STATE_META.done.color : p.state === 'OPEN' ? STATE_META.review.color : 'var(--muted)'
            return (
              <div key={n.id} title={`PR #${p.number} · ${p.title} (${p.state.toLowerCase()}): closes ${p.tickets.map(t => `#${t}`).join(', ')}`}
                onPointerDown={e => startDrag(e, 'node', [n.id], () => window.open(p.url, '_blank', 'noreferrer'))}
                style={{ position: 'absolute', left: n.x - PR_W / 2, top: n.y - PR_H / 2, width: PR_W, height: PR_H, borderRadius: 999,
                  border: `1.5px solid ${color}`, color, background: 'var(--bg)', fontSize: 10.5, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: litNode(n) ? 1 : 0.25 }}>
                PR #{p.number}
              </div>
            )
          }
          return (
            <div key={n.id} title={`Not yet specified: ${n.fog}`}
              onPointerDown={e => startDrag(e, 'node', [n.id])}
              style={{ position: 'absolute', left: n.x - TILE / 2, top: n.y - (TILE + 6) / 2, width: TILE, height: TILE + 6, borderRadius: 6,
                border: '1.5px dashed var(--muted)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, background: 'var(--bg)', cursor: 'grab', opacity: traced ? 0.25 : 1 }}>?</div>
          )
        })}
      </div>

      <div style={{ position: 'absolute', right: 8, top: 8, display: 'flex', gap: 4 }} onPointerDown={e => e.stopPropagation()}>
        <button type="button" style={btn} title="Zoom out" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.25)}>−</button>
        <button type="button" style={btn} title="Zoom in" aria-label="Zoom in" onClick={() => zoomBy(1.25)}>+</button>
        <button type="button" style={btn} title="Fit everything in view" onClick={() => fit()}>Fit</button>
        <button type="button" style={btn} title="Forget where you placed things and lay it out again" onClick={resetLayout}>Reset layout</button>
      </div>

      <div style={{ position: 'absolute', left: 8, bottom: 8, display: 'flex', gap: 12, fontSize: T.tiny, color: 'var(--muted)', pointerEvents: 'none', flexWrap: 'wrap', maxWidth: '70%' }}>
        <span><svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke="var(--muted)" strokeWidth="1.2" /></svg> blocks</span>
        <span><svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke="var(--muted)" strokeWidth="1.2" strokeDasharray="3 3" /></svg> blocker done</span>
        <span><svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke={STATE_META.done.color} strokeWidth="1.4" /></svg> PR closes it</span>
        <span><svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke="var(--accent)" strokeWidth="2" strokeDasharray="6 4" /></svg> hand-over</span>
        <span>ring: contains · drag anything · scroll to zoom</span>
      </div>

      {hovered && (
        <div style={{ position: 'absolute', left: 8, top: 8, maxWidth: 420, padding: '8px 10px', borderRadius: 8,
          border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text)', fontSize: T.small, lineHeight: 1.4, pointerEvents: 'none' }}>
          <b>#{hovered.number}</b> {hovered.title}
          <div style={{ color: STATE_META[hovered.state].text, fontSize: T.tiny, marginTop: 2 }}>
            {STATE_META[hovered.state].label}{hovered.blockedBy.length ? ` · waiting on ${hovered.blockedBy.map(b => `#${b}`).join(', ')}` : ''}
            {hovered.prs.length ? ` · PR ${hovered.prs.map(p => `#${p}`).join(', ')}` : ''}
          </div>
        </div>
      )}
    </div>
  )
}
