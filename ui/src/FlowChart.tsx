import { useLayoutEffect, useRef, useState } from 'react'
import { STATE_META, type SessionStatus } from './Frontier'
import { STATE_MEANING } from './glossary'
import type { Tile } from './types'

// The effort's main picture: the seven KiPo stages as columns, every piece of
// work as a bar that reaches as far as it has got, and the frontier (the red
// staircase) along the bar ends.
//
//   Intake ─┬─ Shape ── Grill ─┬─ Plan ─┬─ Build ── Review ─┬─ Done
//           │  one bar per     │  the   │  one bar per      │  the fan
//           │  decision ticket │  spec  │  spec ticket      │  closes
//           └─ (fans out)  ────┘ (fans  └─ (fans out) ──────┘
//                                 in)
//
// A bar's colour is what's finished; its end is where it stands now, with a
// marker for whose move it is (HITL amber, Agent teal), a red dot when it's
// blocked, a blue one while an agent works. Fog is a dashed, empty bar: decided
// to be in scope, not specified yet. Gates (amber) are the hand-offs a person
// approves: decisions into a spec, and merges into Done.

export const STAGES = [
  { id: 'intake', label: 'Intake', skill: 'kipo-intake', matt: ['triage', 'setup-matt-pocock-skills'], what: 'The source issue or request: triaged, and the repo set up for the skills' },
  { id: 'shape', label: 'Shape', skill: 'kipo-shape', matt: ['wayfinder', 'prototype', 'research'], what: 'Chart the wayfinder map; resolve prototype, research and task tickets' },
  { id: 'grill', label: 'Grill', skill: 'kipo-grill', matt: ['grilling', 'grill-with-docs', 'domain-modeling'], what: 'Grilling tickets: an interview settles each decision, GLOSSARY.md and ADRs kept current' },
  { id: 'plan', label: 'Plan', skill: 'kipo-plan', matt: ['to-spec', 'to-tickets'], what: 'The hand-over: the decisions become a spec, the spec becomes natively blocked tickets' },
  { id: 'build', label: 'Build', skill: 'kipo-build', matt: ['implement', 'implement-spec', 'tdd', 'diagnosing-bugs'], what: 'Each ticket built test-first until its PR opens' },
  { id: 'review', label: 'Review', skill: 'kipo-review', matt: ['code-review', 'pr'], what: 'PRs reviewed and fixed; two-way doors merge when clean, one-way doors ask you' },
  { id: 'done', label: 'Done', skill: 'kipo-done', matt: ['retro'], what: 'Merged and closed; the retro turns lessons into checks and cleans up' },
] as const

const BAR = '#0d5244'
const BAR_EDGE = '#2fa58a'
const FRONTIER = '#e4643a'
const GATE = '#c98a1f'
const ROW = 22
const GAP = 7
const HEAD = 30

type Bar = {
  key: string; x0: number; x1: number; row: number; label: string; title: string
  tile?: Tile; fog?: string; dashed?: boolean; marker?: 'you' | 'afk' | 'blocked' | 'building' | null
}

export function FlowChart({ tiles, fogItems = [], openNumber, statuses, onTile, onFog }: {
  tiles: Tile[]
  fogItems?: string[]
  openNumber: number | null
  statuses: Record<number, SessionStatus>
  onTile: (t: Tile) => void
  onFog?: (at: { x: number; y: number }) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const col = Math.max(70, w / STAGES.length)
  const X = (stage: number, f = 0) => (stage + f) * col
  const pad = 4

  const source = tiles.find(t => t.source)
  const decide = tiles.filter(t => !t.source && t.lane === 'decide')
  const deliver = tiles.filter(t => !t.source && t.lane === 'deliver')

  const mark = (t: Tile): Bar['marker'] =>
    statuses[t.number] === 'running' || t.state === 'building' ? 'building'
      : t.state === 'blocked' ? 'blocked' : t.state === 'you' ? 'you' : t.state === 'afk' ? 'afk' : null
  const frac = (t: Tile) => (t.state === 'blocked' ? 0.22 : t.state === 'you' || t.state === 'afk' ? 0.5 : 0.75)

  // Decisions fan out of Intake across Shape (prototype, research, task) and Grill.
  const decideEnd = (t: Tile) => (t.state === 'done' ? X(3) - pad : X(t.type === 'grilling' ? 2 : 1, frac(t)))
  const decideRows = [
    ...decide.map(t => ({ t, end: decideEnd(t) })).sort((a, b) => b.end - a.end || a.t.number - b.t.number),
  ]
  // Delivery fans out of Plan across Build and Review into Done.
  const deliverEnd = (t: Tile) =>
    t.state === 'done' ? X(6) - pad : t.state === 'review' ? X(5, 0.55) : t.state === 'building' || statuses[t.number] === 'running' ? X(4, 0.6) : X(4) + pad + 34
  const deliverRows = deliver.map(t => ({ t, end: deliverEnd(t) })).sort((a, b) => b.end - a.end || a.t.number - b.t.number)

  const nDecide = decideRows.length + fogItems.length
  const rows = Math.max(1, nDecide, deliverRows.length)
  const top = HEAD + 14
  const rowY = (i: number, n: number) => top + ((rows - n) / 2 + i) * (ROW + GAP)
  const mid = rowY(0, 1)
  const height = top + rows * (ROW + GAP) + 8

  const bars: Bar[] = []
  // Intake: the effort itself.
  const pastIntake = decide.length + deliver.length + fogItems.length > 0
  bars.push({
    key: 'intake', x0: X(0) + pad, x1: pastIntake ? X(1) - pad : X(0, source?.state === 'done' ? 1 : 0.5), row: -1,
    label: source ? `#${source.number}` : 'Intake', title: source ? `#${source.number} ${source.title}\nThe source issue` : 'The effort, triaged',
    tile: source, marker: !pastIntake && source ? mark(source) : null,
  })
  const MIN = 58 // room for "#26" and its marker
  decideRows.forEach(({ t, end }, i) => bars.push({
    key: `t${t.number}`, x0: X(1) + pad, x1: Math.max(end, X(1) + pad + MIN), row: i,
    label: `#${t.number} ${t.title}`, title: `#${t.number} ${t.title}\n\n${STATE_MEANING[t.state]}`, tile: t, marker: mark(t),
  }))
  fogItems.forEach((f, i) => bars.push({
    // Not started: an empty outline in Shape, where charting it will happen.
    key: `fog${i}`, x0: X(1) + pad, x1: X(2) - pad, row: decideRows.length + i, dashed: true,
    label: `☁ ${f}`, title: `${STATE_MEANING.fog}\n\n${f}`, fog: f,
  }))
  // Plan: one bar where the decisions converge into the spec.
  const specCut = deliver.length > 0
  const decided = decide.every(t => t.state === 'done') && !fogItems.length
  bars.push({
    key: 'plan', x0: X(3) + pad, x1: specCut ? X(4) - pad : X(3, decided ? 0.5 : 1) - (decided ? 0 : pad), row: -1,
    dashed: !specCut && !decided, label: specCut ? `Spec · ${deliver.length} tickets` : decided ? 'Write the spec' : 'Spec',
    title: specCut ? `The spec, cut into ${deliver.length} tickets` : decided ? 'HITL: every decision is made; write the spec and cut the tickets (kipo-plan)' : 'Waiting on the decisions and the fog',
    marker: !specCut && decided ? 'you' : null,
  })
  deliverRows.forEach(({ t, end }, i) => bars.push({
    key: `t${t.number}`, x0: X(4) + pad, x1: Math.max(end, X(4) + pad + MIN), row: i,
    label: `#${t.number} ${t.title}`, title: `#${t.number} ${t.title}\n\n${STATE_MEANING[t.state]}${statuses[t.number] === 'running' ? '\nAn agent is working on it now' : ''}`,
    tile: t, marker: mark(t),
  }))
  const allShipped = deliver.length > 0 && deliver.every(t => t.state === 'done')

  const yOf = (b: Bar) => (b.row < 0 ? mid : b.key.startsWith('t') && deliverRows.some(r => `t${r.t.number}` === b.key) ? rowY(b.row, deliverRows.length) : rowY(b.row, nDecide))
  const isDeliver = (b: Bar) => deliverRows.some(r => `t${r.t.number}` === b.key)
  const decideBars = bars.filter(b => b.row >= 0 && !isDeliver(b) && !b.fog)
  const fogBars = bars.filter(b => b.fog)
  const deliverBars = bars.filter(b => isDeliver(b))
  const intakeBar = bars.find(b => b.key === 'intake')!
  const planBar = bars.find(b => b.key === 'plan')!

  // Green threads: the fan out of Intake, into Plan, out of Plan, into Done.
  const threads: string[] = []
  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const m = (x1 + x2) / 2
    return `M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2}`
  }
  const cy = mid + ROW / 2
  for (const b of [...decideBars, ...fogBars]) threads.push(curve(intakeBar.x1, cy, b.x0, yOf(b) + ROW / 2))
  for (const b of decideBars) if (b.tile?.state === 'done') threads.push(curve(b.x1, yOf(b) + ROW / 2, planBar.x0, cy))
  if (specCut) for (const b of deliverBars) threads.push(curve(planBar.x1, cy, b.x0, yOf(b) + ROW / 2))
  for (const b of deliverBars) if (b.tile?.state === 'done') threads.push(curve(b.x1, yOf(b) + ROW / 2, X(6) + pad, cy))

  // The frontier: a staircase down each open fan, through every bar's end.
  const stair = (fan: Bar[]) => {
    if (!fan.length || fan.every(b => b.tile?.state === 'done')) return null
    const s = [...fan].sort((a, b) => yOf(a) - yOf(b))
    let d = `M${s[0].x1},${yOf(s[0]) - 8}`
    s.forEach((b, i) => {
      const next = s[i + 1]
      if (!next) { d += ` L${b.x1},${yOf(b) + ROW + 8}`; return }
      const between = (yOf(b) + ROW + yOf(next)) / 2
      d += ` L${b.x1},${between} L${next.x1},${between}`
    })
    return d
  }
  const frontiers = [stair(decideBars), stair(deliverBars)].filter(Boolean) as string[]

  // The stages with work that can move now get lit.
  const live = new Set<number>()
  for (const b of bars) if (b.marker === 'you' || b.marker === 'afk' || b.marker === 'building') live.add(Math.min(6, Math.floor((b.x1 - 1) / col)))

  const MARK: Record<NonNullable<Bar['marker']>, string> = {
    you: STATE_META.you.color, afk: STATE_META.afk.color, blocked: '#b3362f', building: STATE_META.building.color,
  }

  return (
    <div ref={box} style={{ position: 'relative', width: '100%', minWidth: 490, height: height + 26 }}>
      {w > 0 && (<>
        {/* Stage buttons. */}
        {STAGES.map((s, i) => (
          <div key={s.id} title={`${s.label} · ${s.skill}\n${s.what}\nRuns Matt's: ${s.matt.map(m => `/${m}`).join(', ')}`}
            style={{ position: 'absolute', left: X(i) + 3, top: 0, width: col - 6, height: HEAD, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: live.has(i) ? 650 : 500, cursor: 'help', whiteSpace: 'nowrap', overflow: 'hidden',
              color: live.has(i) ? 'var(--text-strong)' : 'var(--text)',
              background: live.has(i) ? 'color-mix(in srgb, var(--accent) 22%, var(--bg-elevated))' : 'var(--bg-elevated)',
              border: `1px solid ${live.has(i) ? 'var(--accent)' : 'var(--border)'}` }}>
            {s.label}
          </div>
        ))}

        <svg width={w} height={height} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden>
          {/* Column lines; amber gates where a person approves the hand-off. */}
          {STAGES.slice(1).map((_, i) => {
            const x = X(i + 1)
            const gate = i + 1 === 3 || i + 1 === 6
            return gate
              ? <rect key={i} x={x - 2} y={top - 8} width={4} height={height - top + 6} rx={1.5} fill={GATE} opacity={0.75} />
              : <line key={i} x1={x} x2={x} y1={top - 8} y2={height - 2} stroke="var(--muted)" strokeOpacity={0.35} strokeDasharray="4 4" />
          })}
          {threads.map((d, i) => <path key={i} d={d} fill="none" stroke={BAR_EDGE} strokeWidth={1.3} opacity={0.75} />)}
          {/* Fan closes: the deliveries come back together in Done. */}
          <rect x={X(6) + pad} y={mid - 4} width={col - 2 * pad} height={ROW + 8} rx={7}
            fill={allShipped ? BAR : 'none'} stroke={BAR_EDGE} strokeWidth={1.3} strokeDasharray={allShipped ? undefined : '5 4'} opacity={0.85} />
        </svg>

        {/* Bars. */}
        {bars.map(b => {
          const y = b.key === 'intake' || b.key === 'plan' ? mid : yOf(b)
          const width = Math.max(18, b.x1 - b.x0)
          const open = b.tile && b.tile.number === openNumber
          const click = b.tile ? () => onTile(b.tile!) : b.fog && onFog ? undefined : undefined
          return (
            <div key={b.key} title={b.title} role={b.tile || b.fog ? 'button' : undefined}
              onClick={b.fog && onFog ? e => { const r = e.currentTarget.getBoundingClientRect(); onFog({ x: r.left, y: r.bottom + 4 }) } : click}
              style={{ position: 'absolute', left: b.x0, top: y, width, height: ROW, borderRadius: 6, boxSizing: 'border-box',
                background: b.dashed ? 'transparent' : BAR, border: `1.3px ${b.dashed ? 'dashed' : 'solid'} ${b.dashed ? 'var(--muted)' : BAR_EDGE}`,
                outline: open ? '2px solid var(--accent)' : undefined, outlineOffset: 1,
                cursor: b.tile || b.fog ? 'pointer' : 'help', display: 'flex', alignItems: 'center', padding: `0 ${b.marker ? 18 : 7}px 0 7px`, overflow: 'hidden' }}>
              <span style={{ fontSize: 10.5, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                color: b.dashed ? 'var(--muted)' : '#d9f3ea', fontStyle: b.fog ? 'italic' : undefined }}>{b.label}</span>
              {b.marker && (
                <span className={b.marker === 'building' ? 'kipo-pulse' : undefined} title={STATE_MEANING[b.marker === 'building' ? 'building' : b.marker]}
                  style={{ position: 'absolute', right: 3, top: (ROW - 14) / 2 - 1.3, width: 14, height: 14, borderRadius: 99, background: MARK[b.marker],
                    border: `1.5px solid ${b.marker === 'blocked' ? '#e0605a' : 'rgba(0,0,0,.35)'}` }} />
              )}
            </div>
          )
        })}

        <svg width={w} height={height} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden>
          {frontiers.map((d, i) => <path key={i} d={d} fill="none" stroke={FRONTIER} strokeWidth={3} strokeLinejoin="miter" />)}
        </svg>

        {/* Legend. */}
        <div style={{ position: 'absolute', left: 0, top: height + 6, display: 'flex', flexWrap: 'wrap', gap: '2px 14px', fontSize: 11, color: 'var(--muted)', alignItems: 'center' }}>
          <Key title="Finished work: a bar reaches as far as it has got"><span style={{ width: 18, height: 10, borderRadius: 3, background: BAR, border: `1px solid ${BAR_EDGE}` }} />Completed</Key>
          <Key title="The frontier: the edge between done and not done, through every bar's end"><span style={{ width: 18, height: 3, background: FRONTIER }} />Frontier</Key>
          <Key title="A hand-off a person approves: decisions into a spec, merges into Done"><span style={{ width: 4, height: 12, borderRadius: 1, background: GATE }} />Gate</Key>
          <Key title={STATE_MEANING.you}><Dot c={MARK.you} />HITL</Key>
          <Key title={STATE_MEANING.afk}><Dot c={MARK.afk} />Agent</Key>
          <Key title={STATE_MEANING.building}><Dot c={MARK.building} />In progress</Key>
          <Key title={STATE_MEANING.blocked}><Dot c={MARK.blocked} />Blocked</Key>
          <Key title={STATE_MEANING.fog}><span style={{ width: 18, height: 10, borderRadius: 3, border: '1px dashed var(--muted)' }} />Fog</Key>
          <Key title="Where the delivery fan closes: solid once every ticket is merged"><span style={{ width: 18, height: 10, borderRadius: 3, border: `1px dashed ${BAR_EDGE}` }} />Fan closes</Key>
        </div>
      </>)}
    </div>
  )
}

function Key({ title, children }: { title: string; children: React.ReactNode }) {
  return <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'help' }}>{children}</span>
}
function Dot({ c }: { c: string }) {
  return <span style={{ width: 10, height: 10, borderRadius: 99, background: c }} />
}
