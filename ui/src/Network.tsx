import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { T } from './common'
import { STATE_META, type SessionStatus } from './Frontier'
import { chain } from './Graph'
import { STATE_MEANING, TERM } from './glossary'
import type { PrInfo, Tile } from './types'

// The effort as a network of what it's made of and how those things relate.
//
//   contains   a panel holds its members: the wayfinder map holds its decision
//              tickets and its fog (one cloud: what nobody has charted yet); the
//              spec's tickets sit together; the source issue alone
//   blocks     one ticket waits on another (GitHub's native blocking link), inside
//              a panel or across panels; red while the blocker is open, faded
//              green once it's done. Work flows left to right: a blocker sits to
//              the left of what it blocks.
//   closes     a pull request closes a ticket: a badge on that ticket's card
//   hand-over  the spec's tickets were cut from the decided map: one band between
//              the two panels
//
// It's a live layout. Tickets pull toward their own panel and toward what they're
// linked to, and push everything else away. Drag a ticket and its neighbours
// follow; where you drop it, it stays (remembered per effort). Drag a panel's
// header to move the whole group. Drag empty space to pan; scroll to zoom.

type GroupId = 'map' | 'tickets' | 'source'
type Group = { id: GroupId; label: string; phase: string }
type Node = {
  id: string; group: GroupId; tile: Tile
  x: number; y: number; vx: number; vy: number
  pinned?: boolean
}
type Edge = { a: Node; b: Node }
type View = { k: number; tx: number; ty: number }
type Saved = { nodes: Record<string, { x: number; y: number; pinned?: boolean }>; view?: View }
type Region = { group: Group; x0: number; y0: number; x1: number; y1: number; members: Node[] }

const W = 188 // card
const H = 70
const PAD = 22 // panel padding around its cards
const HEAD = 34 // panel header
const FOG_H = 58 // the fog cloud under the map's cards
const GAP = 22 // between cards
const PANEL_GAP = 110 // between panels: room for the hand-over band

const TYPE_LABEL: Record<Tile['type'], string> = {
  grilling: 'Grilling', prototype: 'Prototype', research: 'Research', task: 'Task', build: 'Build', issue: 'Issue',
}
const STATE_LABEL: Record<Tile['state'], string> = {
  done: 'Done', review: 'In review', building: 'In progress', you: 'HITL', afk: 'Agent', blocked: 'Blocked',
}

const groupOf = (t: Tile): GroupId => (t.source ? 'source' : t.type === 'build' ? 'tickets' : 'map')

function seeded(seed: number) {
  let s = seed >>> 0 || 1
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

function regionsOf(nodes: Node[], groups: Group[], fog: number): Region[] {
  return groups.map(g => {
    const members = nodes.filter(n => n.group === g.id)
    if (!members.length) return null
    const x0 = Math.min(...members.map(n => n.x)) - W / 2 - PAD
    const x1 = Math.max(...members.map(n => n.x)) + W / 2 + PAD
    const y0 = Math.min(...members.map(n => n.y)) - H / 2 - PAD - HEAD
    let y1 = Math.max(...members.map(n => n.y)) + H / 2 + PAD
    if (g.id === 'map' && fog) y1 += FOG_H
    return { group: g, x0, y0, x1, y1, members }
  }).filter((r): r is Region => !!r)
}

// One step of the forces. `home` (initial placement only) pulls each panel
// toward its own spot so panels start apart; live, panels move freely.
function step(nodes: Node[], edges: Edge[], groups: Group[], fog: number, alpha: number, home?: Map<string, { x: number; y: number }>) {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      let dx = b.x - a.x, dy = b.y - a.y
      let d2 = dx * dx + dy * dy
      if (d2 < 1) { dx = 0.5; dy = 0.3; d2 = 1 }
      const d = Math.sqrt(d2)
      const f = (a.group === b.group ? 40000 : 90000) / d2 * (0.3 + alpha)
      a.vx -= (dx / d) * f; a.vy -= (dy / d) * f
      b.vx += (dx / d) * f; b.vy += (dy / d) * f
    }
  }
  for (const { a, b } of edges) {
    const dx = b.x - a.x, dy = b.y - a.y
    const d = Math.max(1, Math.hypot(dx, dy))
    const pull = (d - (W + 70)) * 0.02
    a.vx += (dx / d) * pull; a.vy += (dy / d) * pull
    b.vx -= (dx / d) * pull; b.vy -= (dy / d) * pull
    // Flow: a blocker sits to the left of what it blocks.
    const want = W + 60
    if (dx < want) { const f = (want - dx) * 0.03; a.vx -= f; b.vx += f }
  }
  const centroid = new Map<string, { x: number; y: number; n: number }>()
  for (const n of nodes) {
    const c = centroid.get(n.group) ?? { x: 0, y: 0, n: 0 }
    c.x += n.x; c.y += n.y; c.n += 1
    centroid.set(n.group, c)
  }
  for (const n of nodes) {
    const c = centroid.get(n.group)!
    n.vx += (c.x / c.n - n.x) * 0.01
    n.vy += (c.y / c.n - n.y) * 0.016
    const h = home?.get(n.group)
    if (h) { n.vx += (h.x - n.x) * 0.006; n.vy += (h.y - n.y) * 0.006 }
  }
  for (const n of nodes) {
    if (n.pinned) { n.vx = 0; n.vy = 0; continue }
    n.x += n.vx; n.y += n.vy
    n.vx *= 0.55; n.vy *= 0.55
  }
  // Panels don't overlap: two panels closer than PANEL_GAP are pushed apart whole,
  // along whichever axis needs less movement.
  const rs = regionsOf(nodes, groups, fog)
  for (let i = 0; i < rs.length; i++) {
    for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j]
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + PANEL_GAP
      const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + PANEL_GAP
      if (ox <= 0 || oy <= 0) continue
      const acx = (a.x0 + a.x1) / 2, bcx = (b.x0 + b.x1) / 2, acy = (a.y0 + a.y1) / 2, bcy = (b.y0 + b.y1) / 2
      const alongX = ox < oy
      const push = Math.min(14, (alongX ? ox : oy) / 2)
      const sx = alongX ? (bcx >= acx ? 1 : -1) * push : 0
      const sy = alongX ? 0 : (bcy >= acy ? 1 : -1) * push
      for (const n of a.members) if (!n.pinned) { n.x -= sx; n.y -= sy }
      for (const n of b.members) if (!n.pinned) { n.x += sx; n.y += sy }
    }
  }
  // Cards never overlap.
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      const dx = b.x - a.x, dy = b.y - a.y
      const ox = W + GAP - Math.abs(dx), oy = H + GAP - Math.abs(dy)
      if (ox <= 0 || oy <= 0) continue
      const alongX = ox / W < oy / H
      const push = (alongX ? ox : oy) / 2
      const sx = alongX ? (dx >= 0 ? 1 : -1) * push : 0
      const sy = alongX ? 0 : (dy >= 0 ? 1 : -1) * push
      if (!a.pinned) { a.x -= sx; a.y -= sy }
      if (!b.pinned) { b.x += sx; b.y += sy }
    }
  }
}

// Where a link leaves or enters a card: the middle of the side facing the other end.
function port(n: { x: number; y: number }, other: { x: number; y: number }) {
  const dx = other.x - n.x, dy = other.y - n.y
  if (Math.abs(dx) / W >= Math.abs(dy) / H) return { x: n.x + Math.sign(dx || 1) * W / 2, y: n.y, h: true, s: Math.sign(dx || 1) }
  return { x: n.x, y: n.y + Math.sign(dy || 1) * H / 2, h: false, s: Math.sign(dy || 1) }
}
function curve(a: { x: number; y: number }, b: { x: number; y: number }, endGap = 0) {
  const p = port(a, b), q = port(b, a)
  const bend = Math.max(40, Math.hypot(q.x - p.x, q.y - p.y) * 0.4)
  const qx = q.x + (q.h ? q.s * endGap : 0), qy = q.y + (q.h ? 0 : q.s * endGap)
  const c1 = p.h ? { x: p.x + p.s * bend, y: p.y } : { x: p.x, y: p.y + p.s * bend }
  const c2 = q.h ? { x: qx + q.s * bend, y: qy } : { x: qx, y: qy + q.s * bend }
  return `M${p.x},${p.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${qx},${qy}`
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
  const fog = fogItems.length

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const groups: Group[] = useMemo(() => [
    { id: 'source' as const, label: 'Source issue', phase: 'Origin' },
    { id: 'map' as const, label: mapIssue ? `Wayfinder map #${mapIssue}` : 'Decisions', phase: 'Decide' },
    { id: 'tickets' as const, label: `Spec tickets · kipo:${effort}`, phase: 'Deliver' },
  ].filter(g => tiles.some(t => groupOf(t) === g.id) || (g.id === 'map' && fog > 0)), [tiles, fog, mapIssue, effort])

  const viewRef = useRef(view)
  viewRef.current = view
  const save = useCallback((v?: View) => {
    const nodes: Saved['nodes'] = {}
    for (const n of sim.current.nodes) nodes[n.id] = { x: Math.round(n.x), y: Math.round(n.y), pinned: n.pinned }
    try { localStorage.setItem(storageKey, JSON.stringify({ nodes, view: v ?? viewRef.current })) } catch { /* private mode */ }
  }, [storageKey])

  const groupsRef = useRef(groups)
  groupsRef.current = groups
  const run = useCallback(() => {
    if (raf.current != null) return
    const loop = () => {
      step(sim.current.nodes, sim.current.edges, groupsRef.current, fog, alpha.current)
      alpha.current *= 0.96
      setTick(t => t + 1)
      raf.current = alpha.current > 0.02 ? requestAnimationFrame(loop) : null
    }
    raf.current = requestAnimationFrame(loop)
  }, [fog])
  useEffect(() => () => { if (raf.current != null) cancelAnimationFrame(raf.current) }, [])

  const fit = useCallback((nodes = sim.current.nodes) => {
    if (!size.w || !nodes.length) return undefined
    const rs = regionsOf(nodes, groups, fog)
    const minX = Math.min(...rs.map(r => r.x0)) - 30, maxX = Math.max(...rs.map(r => r.x1)) + 30
    const minY = Math.min(...rs.map(r => r.y0)) - 44, maxY = Math.max(...rs.map(r => r.y1)) + 44 // toolbar above, legend below
    const k = Math.max(0.3, Math.min(1.2, size.w / (maxX - minX), size.h / (maxY - minY)))
    const v = { k, tx: (size.w - (maxX - minX) * k) / 2 - minX * k, ty: (size.h - (maxY - minY) * k) / 2 - minY * k }
    setView(v)
    return v
  }, [size.w, size.h, groups, fog])

  // Build the network whenever the effort's tickets change, keeping whatever
  // positions are already known (on screen, or remembered).
  useEffect(() => {
    if (!size.w) return
    const saved = readSaved(storageKey)?.nodes ?? {}
    const prev = new Map(sim.current.nodes.map(n => [n.id, n]))
    const known = new Set(tiles.map(t => t.number))
    const nodes: Node[] = tiles.map(t => ({ id: `t${t.number}`, group: groupOf(t), tile: t, x: 0, y: 0, vx: 0, vy: 0 }))
    const byId = new Map(nodes.map(n => [n.id, n]))
    const edges: Edge[] = tiles.flatMap(t => (t.blockers ?? t.blockedBy).filter(b => known.has(b) && b !== t.number)
      .map(b => ({ a: byId.get(`t${b}`)!, b: byId.get(`t${t.number}`)! })))
    const rand = seeded(tiles.reduce((a, t) => a * 31 + t.number, 7) + fog)
    // Panels start in reading order: source, then the map (Decide), then the spec (Deliver).
    const home = new Map(groups.map((g, i) => [g.id as string, { x: (i - (groups.length - 1) / 2) * 720, y: 0 }]))
    let fresh = 0
    for (const n of nodes) {
      const was = prev.get(n.id) ?? saved[n.id]
      if (was) { n.x = was.x; n.y = was.y; n.pinned = was.pinned; continue }
      fresh++
      const h = home.get(n.group) ?? { x: 0, y: 0 }
      n.x = h.x + (rand() - 0.5) * 200
      n.y = h.y + (rand() - 0.5) * 200
    }
    // A first layout settles before it's shown; later changes settle live.
    if (fresh === nodes.length) {
      for (let i = 0; i < 420; i++) step(nodes, edges, groups, fog, 1 - i / 420, home)
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

  // Dragging: a card, a whole panel, or the canvas (pan).
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
      // A dropped ticket stays where it was put; a moved panel keeps moving freely.
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

  // Wheel, trackpad and keyboard navigation, following the usual canvas conventions:
  //   wheel                 zoom around the pointer (map convention)
  //   Ctrl/⌘ + wheel        zoom; Chrome and Firefox report a trackpad pinch this way too
  //   Shift + wheel         pan sideways
  //   Alt/⌥ + wheel         pan up and down
  //   two-finger swipe      pan (a trackpad sends sideways movement with it)
  //   Safari pinch          gesture events, zoom around the pointer
  //   + / − / 0, arrows     zoom in, out, fit, pan (when the map has focus)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const zoomAt = (clientX: number, clientY: number, f: number) => {
      const r = el.getBoundingClientRect()
      const sx = clientX - r.left, sy = clientY - r.top
      setView(v => {
        const k = Math.max(0.25, Math.min(3, v.k * f))
        return { k, tx: sx - (sx - v.tx) * (k / v.k), ty: sy - (sy - v.ty) * (k / v.k) }
      })
    }
    const pan = (dx: number, dy: number) => setView(v => ({ ...v, tx: v.tx - dx, ty: v.ty - dy }))
    const clamp = (d: number, m: number) => Math.max(-m, Math.min(m, d))
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1
      const dx = e.deltaX * unit, dy = e.deltaY * unit
      if (e.ctrlKey || e.metaKey) return zoomAt(e.clientX, e.clientY, Math.exp(-clamp(dy, 50) * 0.01))
      if (e.shiftKey) return pan(dx || dy, 0)
      if (e.altKey) return pan(0, dy)
      if (dx !== 0) return pan(dx, dy)
      zoomAt(e.clientX, e.clientY, Math.exp(-clamp(dy, 120) * 0.0015))
    }
    // Safari reports a trackpad pinch as gesture events, not ctrl + wheel.
    let lastScale = 1
    const gstart = (e: Event) => { e.preventDefault(); lastScale = 1 }
    const gchange = (e: Event) => {
      e.preventDefault()
      const g = e as Event & { scale: number; clientX: number; clientY: number }
      zoomAt(g.clientX, g.clientY, g.scale / lastScale)
      lastScale = g.scale
    }
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('gesturestart', gstart)
    el.addEventListener('gesturechange', gchange)
    return () => {
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('gesturestart', gstart)
      el.removeEventListener('gesturechange', gchange)
    }
  }, [])
  const onKey = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const stepPx = e.shiftKey ? 200 : 60
    const keys: Record<string, () => void> = {
      '+': () => zoomBy(1.25), '=': () => zoomBy(1.25), '-': () => zoomBy(1 / 1.25), '_': () => zoomBy(1 / 1.25), '0': () => fit(),
      ArrowLeft: () => setView(v => ({ ...v, tx: v.tx + stepPx })), ArrowRight: () => setView(v => ({ ...v, tx: v.tx - stepPx })),
      ArrowUp: () => setView(v => ({ ...v, ty: v.ty + stepPx })), ArrowDown: () => setView(v => ({ ...v, ty: v.ty - stepPx })),
    }
    const k = keys[e.key]
    if (k) { e.preventDefault(); k() }
  }
  useEffect(() => { const t = setTimeout(() => save(view), 400); return () => clearTimeout(t) }, [view, save])

  const zoomBy = (f: number) => setView(v => {
    const sx = size.w / 2, sy = size.h / 2
    const k = Math.max(0.25, Math.min(3, v.k * f))
    return { k, tx: sx - (sx - v.tx) * (k / v.k), ty: sy - (sy - v.ty) * (k / v.k) }
  })
  const resetLayout = () => {
    try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
    sim.current = { nodes: [], edges: [] }
    fitted.current = false
    setRebuild(r => r + 1)
  }

  const { nodes, edges } = sim.current
  const regions = regionsOf(nodes, groups, fog)
  const traced = hover != null ? new Set(chain(tiles, hover).map(t => t.number)) : null
  const lit = (n: number) => (traced ? traced.has(n) : highlight ? highlight.has(n) : true)
  const mapR = regions.find(r => r.group.id === 'map')
  const specR = regions.find(r => r.group.id === 'tickets')
  const prsOf = (n: number) => prs.filter(p => p.tickets.includes(n))

  const btn = { height: 26, minWidth: 28, padding: '0 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text)', cursor: 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } as const
  const grid = 22 * view.k

  return (
    <div ref={box} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 420, overflow: 'hidden', touchAction: 'none', userSelect: 'none',
      cursor: dragging ? 'grabbing' : 'grab', outline: 'none',
      backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--muted) 28%, transparent) 1px, transparent 1.3px)',
      backgroundSize: `${grid}px ${grid}px`, backgroundPosition: `${view.tx}px ${view.ty}px` }}
      tabIndex={0} onKeyDown={onKey} aria-label="Effort network map"
      onPointerDownCapture={e => e.currentTarget.focus({ preventScroll: true })}
      onPointerDown={e => startDrag(e, 'pan', [])}>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.k})`, transformOrigin: '0 0' }}>
        {/* Panels: what contains what. */}
        {regions.map(r => {
          const done = r.members.filter(n => n.tile.state === 'done').length
          const pct = r.members.length ? done / r.members.length : 0
          return (
            <div key={r.group.id} style={{ position: 'absolute', left: r.x0, top: r.y0, width: r.x1 - r.x0, height: r.y1 - r.y0, borderRadius: 16,
              background: 'color-mix(in srgb, var(--bg-elevated) 82%, transparent)', border: '1px solid var(--border)',
              boxShadow: '0 10px 30px rgba(0,0,0,.28)', opacity: traced ? 0.85 : 1 }}>
              <div title="Drag to move this group" onPointerDown={e => startDrag(e, 'ring', r.members.map(m => m.id))}
                style={{ height: HEAD, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', cursor: 'move',
                  borderBottom: '1px solid var(--border)', borderRadius: '16px 16px 0 0' }}>
                <span title={TERM[r.group.phase]} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)', cursor: 'help' }}>{r.group.phase}</span>
                <span title={r.group.id === 'tickets' ? `${TERM.spec}\n${TERM.kipo.replace(/<n>/g, String(effort))}` : r.group.id === 'map' ? TERM.map : TERM.Origin}
                  style={{ fontSize: 13, fontWeight: 650, color: 'var(--text-strong)', whiteSpace: 'nowrap' }}>{r.group.label}</span>
                <span style={{ flex: 1 }} />
                <span style={{ width: 54, height: 4, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${pct * 100}%`, background: STATE_META.done.color }} />
                </span>
                <span title={`${done} of ${r.members.length} tickets done`} style={{ fontSize: 11, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{done}/{r.members.length}</span>
              </div>
            </div>
          )
        })}

        {/* Fog: one cloud at the foot of the map — what nobody has charted yet. */}
        {mapR && fog > 0 && (
          <div title={`Not yet specified:\n${fogItems.map(f => `• ${f}`).join('\n')}`}
            style={{ position: 'absolute', left: mapR.x0 + 14, top: mapR.y1 - FOG_H + 2, width: mapR.x1 - mapR.x0 - 28, height: FOG_H - 14,
              opacity: traced ? 0.35 : 1, pointerEvents: 'auto' }}
            onPointerDown={e => e.stopPropagation()}>
            <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 999, filter: 'blur(10px)',
              background: 'radial-gradient(ellipse at 30% 50%, color-mix(in srgb, var(--muted) 30%, transparent), transparent 70%), radial-gradient(ellipse at 70% 40%, color-mix(in srgb, var(--muted) 22%, transparent), transparent 70%)' }} />
            <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', overflow: 'hidden' }}>
              <span style={{ fontSize: 11, fontWeight: 650, color: 'var(--muted)', whiteSpace: 'nowrap' }}>☁ Not yet specified · {fog}</span>
              {fogItems.map(f => (
                <span key={f} style={{ fontSize: 11, color: 'var(--text)', padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap',
                  background: 'color-mix(in srgb, var(--muted) 16%, transparent)', fontStyle: 'italic' }}>{f}</span>
              ))}
            </div>
          </div>
        )}

        <svg width={1} height={1} style={{ position: 'absolute', overflow: 'visible', pointerEvents: 'none' }} aria-hidden>
          <defs>
            <marker id="kipo-net-open" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={STATE_META.blocked.color} />
            </marker>
            <marker id="kipo-net-done" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={STATE_META.done.color} />
            </marker>
            <linearGradient id="kipo-net-hand" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="var(--accent)" stopOpacity={0.05} />
              <stop offset="1" stopColor="var(--accent)" stopOpacity={0.55} />
            </linearGradient>
          </defs>
          {mapR && specR && (() => {
            // The hand-over: the spec's tickets were cut from the decided map.
            const a = { x: (mapR.x0 + mapR.x1) / 2, y: (mapR.y0 + mapR.y1) / 2 }
            const b = { x: (specR.x0 + specR.x1) / 2, y: (specR.y0 + specR.y1) / 2 }
            const right = b.x >= a.x
            const x1 = right ? mapR.x1 : mapR.x0, x2 = right ? specR.x0 : specR.x1
            if ((x2 - x1) * (right ? 1 : -1) < 30) return null
            const y1 = Math.max(mapR.y0 + 40, Math.min(mapR.y1 - 40, b.y)), y2 = Math.max(specR.y0 + 40, Math.min(specR.y1 - 40, a.y))
            const mx = (x1 + x2) / 2, s = right ? 1 : -1
            const band = 14
            const d = `M${x1},${y1 - band} C${mx},${y1 - band} ${mx},${y2 - band} ${x2 - s * 16},${y2 - band} L${x2 - s * 16},${y2 - band - 6} L${x2},${y2} L${x2 - s * 16},${y2 + band + 6} L${x2 - s * 16},${y2 + band} C${mx},${y2 + band} ${mx},${y1 + band} ${x1},${y1 + band} Z`
            return (
              <g opacity={traced ? 0.25 : 1}>
                <path d={d} fill="url(#kipo-net-hand)" transform={right ? undefined : `translate(${x1 + x2},0) scale(-1,1) translate(${-(x1 + x2)},0)`} />
                <text x={mx} y={(y1 + y2) / 2 - band - 8} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--accent)">hand-over<title>{TERM['hand-over']}</title></text>
              </g>
            )
          })()}
          {edges.map(({ a, b }) => {
            const done = a.tile.state === 'done'
            const on = lit(a.tile.number) && lit(b.tile.number)
            const bold = traced ? on : focus != null && (a.tile.number === focus || b.tile.number === focus)
            const color = done ? STATE_META.done.color : STATE_META.blocked.color
            return (
              <path key={`${a.id}-${b.id}`} d={curve(a, b, 3)} fill="none" stroke={color}
                strokeWidth={bold ? 2.6 : done ? 1.4 : 2} strokeDasharray={done ? '5 5' : undefined}
                opacity={on ? (done ? 0.5 : 0.9) : 0.08} markerEnd={`url(#kipo-net-${done ? 'done' : 'open'})`} />
            )
          })}
        </svg>

        {/* Cards: tickets. */}
        {nodes.map(n => {
          const t = n.tile
          const m = STATE_META[t.state]
          const running = statuses?.[t.number] === 'running'
          const act = t.state === 'you' || t.state === 'afk'
          const isDone = t.state === 'done'
          const open = t.number === focus
          const ps = prsOf(t.number)
          return (
            <div key={n.id} title={`#${t.number} ${t.title}\n\n${TYPE_LABEL[t.type]} · ${STATE_MEANING[t.state]}${running ? '\nAn agent is working on it now' : ''}`}
              onPointerDown={e => startDrag(e, 'node', [n.id], () => onOpen(t))}
              onPointerEnter={() => setHover(t.number)} onPointerLeave={() => setHover(h => (h === t.number ? null : h))}
              style={{ position: 'absolute', left: n.x - W / 2, top: n.y - H / 2, width: W, height: H, borderRadius: 10, cursor: 'pointer',
                background: 'var(--bg)', border: `1px solid ${open ? 'var(--accent)' : act ? m.color : 'var(--border)'}`,
                boxShadow: act ? `0 0 0 1px ${m.color}55, 0 6px 22px ${m.color}33` : '0 4px 14px rgba(0,0,0,.3)',
                opacity: lit(t.number) ? 1 : 0.22, overflow: 'hidden', display: 'flex', transition: 'opacity .15s' }}>
              <span style={{ width: 4, flex: 'none', background: m.color, opacity: isDone ? 0.6 : 1 }} />
              <div style={{ flex: 1, minWidth: 0, padding: '7px 9px 6px 9px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>#{t.number}</span>
                  <span style={{ color: 'var(--muted)' }}>{TYPE_LABEL[t.type]}</span>
                  <span style={{ flex: 1 }} />
                  {running && <span title="An agent is working on it" style={{ width: 6, height: 6, borderRadius: 9, background: STATE_META.building.color, boxShadow: `0 0 6px ${STATE_META.building.color}` }} />}
                  <span title={STATE_MEANING[t.state]} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', padding: '1px 6px', borderRadius: 999,
                    color: isDone ? m.text : act ? '#14121a' : m.text, background: act ? m.color : `${m.color}26` }}>
                    {isDone ? '✓ ' : ''}{STATE_LABEL[t.state]}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, lineHeight: 1.3, color: isDone ? 'var(--muted)' : 'var(--text)', overflow: 'hidden',
                  display: '-webkit-box', WebkitLineClamp: ps.length ? 1 : 2, WebkitBoxOrient: 'vertical' }}>{t.title}</div>
                {ps.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 'auto' }}>
                    {ps.map(p => {
                      const c = p.state === 'MERGED' ? STATE_META.done.color : p.state === 'OPEN' ? STATE_META.review.color : 'var(--muted)'
                      return (
                        <span key={p.number} title={`PR #${p.number} (pull request) · ${p.title}\n${p.state === 'MERGED' ? 'Merged: it closed this ticket' : p.state === 'OPEN' ? 'Open: it will close this ticket when merged' : 'Closed without merging'}\nClick to open it on GitHub`}
                          onPointerDown={e => { e.stopPropagation(); window.open(p.url, '_blank', 'noreferrer') }}
                          style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 999, border: `1px solid ${c}`, color: c, cursor: 'pointer' }}>
                          PR #{p.number} {p.state === 'MERGED' ? 'merged' : p.state === 'OPEN' ? 'open' : 'closed'}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
              {n.pinned && <span title="Placed by you" style={{ position: 'absolute', right: 3, bottom: 3, width: 5, height: 5, borderRadius: 9, background: 'var(--muted)' }} />}
            </div>
          )
        })}
      </div>

      <div style={{ position: 'absolute', right: 10, top: 10, display: 'flex', gap: 4 }} onPointerDown={e => e.stopPropagation()}>
        <button type="button" style={btn} title="Zoom out (−). Scroll or pinch to zoom, Shift+scroll to pan sideways, Alt+scroll to pan up and down, drag empty space to pan" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.25)}>−</button>
        <button type="button" style={btn} title="Zoom in (+)" aria-label="Zoom in" onClick={() => zoomBy(1.25)}>+</button>
        <button type="button" style={btn} title="Fit everything in view (0)" onClick={() => fit()}>Fit</button>
        <button type="button" style={btn} title="Forget where you placed things and lay it out again" onClick={resetLayout}>Reset layout</button>
      </div>

      <div onPointerDown={e => e.stopPropagation()}
        style={{ position: 'absolute', left: 10, bottom: 10, display: 'flex', alignItems: 'center', gap: 14, fontSize: T.tiny, color: 'var(--muted)', cursor: 'default',
        flexWrap: 'wrap', maxWidth: '80%', padding: '5px 10px', borderRadius: 8, background: 'color-mix(in srgb, var(--bg) 85%, transparent)', border: '1px solid var(--border)' }}>
        <span title="Blocks: the arrow points from the open blocker to the ticket waiting on it"><svg width="24" height="8" aria-hidden><line x1="0" y1="4" x2="24" y2="4" stroke={STATE_META.blocked.color} strokeWidth="2" /></svg> blocks</span>
        <span title="Blocker done: the blocking ticket is closed, so it no longer holds anything up"><svg width="24" height="8" aria-hidden><line x1="0" y1="4" x2="24" y2="4" stroke={STATE_META.done.color} strokeWidth="1.4" strokeDasharray="4 4" opacity={0.7} /></svg> blocker done</span>
        <span title={TERM['hand-over']}><svg width="24" height="8" aria-hidden><rect x="0" y="1" width="24" height="6" rx="3" fill="var(--accent)" opacity={0.5} /></svg> hand-over</span>
        <span title={STATE_MEANING.fog}>☁ fog: not yet specified</span>
        <span title={`${STATE_MEANING.you}\n${STATE_MEANING.afk}`}>HITL · Agent</span>
        <span>hover a card to trace its chain · click to open</span>
      </div>
    </div>
  )
}
