import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { STATE_META, type SessionStatus } from './Frontier'
import { chain } from './Graph'
import { STATE_MEANING, TERM } from './glossary'
import type { PrInfo, Tile } from './types'

// The effort as a board: one column per KiPo skill, in the order work flows,
// left to right, Done on the right. A ticket sits in the column of the skill
// that handles it now and moves right as it gets done:
//
//   Intake   kipo-intake   the source issue
//   Shape    kipo-shape    the wayfinder map's prototype, research and task tickets, and its fog
//   Grill    kipo-grill    grilling tickets
//   Plan     kipo-plan     the hand-over: the spec and its tickets, once the decisions are made
//   Build    kipo-build    build tickets until their PR opens
//   Review   kipo-review   tickets whose PR is open
//   Done     kipo-done     closed tickets
//
// Columns group into the stages: Intake, Decide (Shape, Grill, Plan), Deliver
// (Build, Review), Done. Lines are the blocking links: red from an open blocker
// to the ticket it holds up. Hover a card to trace its whole chain, done links too.

type ColId = 'intake' | 'shape' | 'grill' | 'plan' | 'build' | 'review' | 'done'
export const COLUMNS: { id: ColId; label: string; skill: string; matt: string[]; what: string }[] = [
  { id: 'intake', label: 'Intake', skill: 'kipo-intake', matt: ['triage', 'setup-matt-pocock-skills'], what: 'The source issue or request, triaged and the repo set up' },
  { id: 'shape', label: 'Shape', skill: 'kipo-shape', matt: ['wayfinder', 'prototype', 'research'], what: "The wayfinder map: prototype, research and task tickets, and the fog still to chart" },
  { id: 'grill', label: 'Grill', skill: 'kipo-grill', matt: ['grilling', 'grill-with-docs', 'domain-modeling'], what: 'Grilling tickets: an interview with you settles each decision' },
  { id: 'plan', label: 'Plan', skill: 'kipo-plan', matt: ['to-spec', 'to-tickets'], what: 'The hand-over: once the decisions are made, the spec and its natively blocked tickets' },
  { id: 'build', label: 'Build', skill: 'kipo-build', matt: ['implement', 'implement-spec', 'tdd', 'diagnosing-bugs'], what: 'Build tickets, test-first, until their PR opens' },
  { id: 'review', label: 'Review', skill: 'kipo-review', matt: ['code-review', 'pr'], what: 'Open PRs: reviewed, fixed, and merged when clean (one-way doors ask you)' },
  { id: 'done', label: 'Done', skill: 'kipo-done', matt: ['retro'], what: 'Closed tickets; the retro turns lessons into checks and cleans up' },
]
const STAGES: { label: string; cols: ColId[]; hint: string }[] = [
  { label: 'Intake', cols: ['intake'], hint: 'A raw issue or request' },
  { label: 'Decide', cols: ['shape', 'grill', 'plan'], hint: TERM.Decide },
  { label: 'Deliver', cols: ['build', 'review'], hint: TERM.Deliver },
  { label: 'Done', cols: ['done'], hint: 'Closed' },
]

const TYPE_LABEL: Record<Tile['type'], string> = {
  grilling: 'Grilling', prototype: 'Prototype', research: 'Research', task: 'Task', build: 'Build', issue: 'Issue',
}
const STATE_LABEL: Record<Tile['state'], string> = {
  done: 'Done', review: 'In review', building: 'In progress', you: 'HITL', afk: 'Agent', blocked: 'Blocked',
}
const ORDER: Tile['state'][] = ['you', 'afk', 'building', 'review', 'blocked', 'done']

export const columnOf = (t: Tile): ColId =>
  t.state === 'done' ? 'done'
    : t.source ? 'intake'
      : t.state === 'review' ? 'review'
        : t.type === 'build' ? 'build'
          : t.type === 'grilling' ? 'grill'
            : 'shape'

const COL_W = 212
const COL_GAP = 34 // gutters the lines run through
const EMPTY_W = 34

export function SkillBoard({ tiles, prs = [], fogItems = [], effort, statuses, focus, highlight, onOpen }: {
  tiles: Tile[]
  prs?: PrInfo[]
  fogItems?: string[]
  effort: number
  statuses?: Record<number, SessionStatus>
  focus?: number | null
  highlight?: Set<number> | null
  onOpen: (t: Tile) => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  const inner = useRef<HTMLDivElement>(null)
  const cards = useRef(new Map<number, HTMLDivElement>())
  const [rects, setRects] = useState<Map<number, DOMRect>>(new Map())
  const [box, setBox] = useState({ w: 0, h: 0 })

  // Where each card is, for drawing the lines.
  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    const measure = () => {
      const o = el.getBoundingClientRect()
      const m = new Map<number, DOMRect>()
      for (const [n, c] of cards.current) {
        const r = c.getBoundingClientRect()
        m.set(n, new DOMRect(r.left - o.left, r.top - o.top, r.width, r.height))
      }
      setRects(m)
      setBox({ w: el.scrollWidth, h: el.scrollHeight })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [tiles, fogItems.length])

  const byCol = new Map<ColId, Tile[]>(COLUMNS.map(c => [c.id, []]))
  for (const t of tiles) byCol.get(columnOf(t))!.push(t)
  for (const ts of byCol.values()) ts.sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state) || a.number - b.number)

  // The Plan column's one card: where the hand-over stands.
  const builds = tiles.filter(t => t.type === 'build')
  const openDecisions = tiles.filter(t => !t.source && t.type !== 'build' && t.state !== 'done')
  const plan: { title: string; state: 'done' | 'you' | 'blocked'; hint: string } =
    builds.length
      ? { title: `Spec cut into ${builds.length} ticket${builds.length === 1 ? '' : 's'} · kipo:${effort}`, state: 'done', hint: `${TERM.spec}\n${TERM.kipo.replace(/<n>/g, String(effort))}` }
      : !openDecisions.length && !fogItems.length
        ? { title: 'Decisions made: write the spec and cut the tickets', state: 'you', hint: 'HITL: start kipo-plan from the effort conversation (/to-spec, then /to-tickets)' }
        : { title: `Waiting on ${openDecisions.length} decision${openDecisions.length === 1 ? '' : 's'}${fogItems.length ? ` and ${fogItems.length} fog` : ''}`, state: 'blocked', hint: 'The spec can be written once every decision is made and the fog is charted' }

  const traced = hover != null ? new Set(chain(tiles, hover).map(t => t.number)) : null
  const lit = (n: number) => (traced ? traced.has(n) : highlight ? highlight.has(n) : true)

  // Lines: open blockers always; done ones only while tracing a chain.
  const known = new Set(tiles.map(t => t.number))
  const links = tiles.flatMap(t => (t.blockers ?? t.blockedBy).filter(b => known.has(b) && b !== t.number).map(b => ({ from: b, to: t.number })))
    .filter(l => {
      const done = tiles.find(t => t.number === l.from)!.state === 'done'
      return !done || (traced?.has(l.from) && traced?.has(l.to))
    })

  const empty = (c: ColId) => !byCol.get(c)!.length && !(c === 'plan') && !(c === 'shape' && fogItems.length)
  const colW = (c: ColId) => (empty(c) ? EMPTY_W : COL_W)

  return (
    <div style={{ height: '100%', overflow: 'auto', scrollbarWidth: 'thin' }}>
      <div ref={inner} style={{ position: 'relative', display: 'flex', gap: COL_GAP, padding: '12px 16px 24px', minWidth: 'min-content', alignItems: 'stretch', minHeight: '100%' }}>
        {STAGES.map(s => (
          <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div title={s.hint} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)',
              borderBottom: '2px solid color-mix(in srgb, var(--accent) 45%, transparent)', paddingBottom: 3, cursor: 'help', whiteSpace: 'nowrap' }}>
              {s.cols.every(empty) ? '' : s.label}
            </div>
            <div style={{ display: 'flex', gap: COL_GAP, flex: 1 }}>
              {s.cols.map(id => {
                const col = COLUMNS.find(c => c.id === id)!
                const ts = byCol.get(id)!
                const head = `${col.label} · ${col.skill}\n${col.what}\nRuns Matt's: ${col.matt.map(m => `/${m}`).join(', ')}`
                if (empty(id)) {
                  return (
                    <div key={id} title={`${head}\n\nNothing here right now.`}
                      style={{ width: EMPTY_W, borderRadius: 10, border: '1px dashed var(--border)', display: 'flex', justifyContent: 'center', paddingTop: 10, cursor: 'help' }}>
                      <span style={{ writingMode: 'vertical-rl', fontSize: 11, color: 'var(--muted)', letterSpacing: '.04em' }}>{col.label} · 0</span>
                    </div>
                  )
                }
                return (
                  <div key={id} style={{ width: colW(id), display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 12, padding: 8,
                    background: 'color-mix(in srgb, var(--bg-elevated) 60%, transparent)', border: '1px solid var(--border)' }}>
                    <div title={head} style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '0 2px 2px', cursor: 'help' }}>
                      <span style={{ fontSize: 13, fontWeight: 650, color: 'var(--text-strong)' }}>{col.label}</span>
                      {id !== 'plan' && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{ts.length}</span>}
                      <span style={{ flex: 1 }} />
                      <code style={{ fontSize: 10, color: 'var(--muted)' }}>{col.skill}</code>
                    </div>
                    {id === 'plan' && (
                      <div title={plan.hint} style={{ ...cardBase, borderLeft: `4px solid ${STATE_META[plan.state].color}`, padding: '8px 10px', cursor: 'help',
                        opacity: traced ? 0.3 : 1 }}>
                        <Pill state={plan.state} />
                        <div style={{ fontSize: 11.5, lineHeight: 1.3, color: plan.state === 'done' ? 'var(--muted)' : 'var(--text)', marginTop: 4 }}>{plan.title}</div>
                      </div>
                    )}
                    {ts.map(t => (
                      <Card key={t.number} tile={t} prs={prs.filter(p => p.tickets.includes(t.number))} compact={id === 'done'}
                        running={statuses?.[t.number] === 'running'} open={t.number === focus} dim={!lit(t.number)}
                        cardRef={el => { if (el) cards.current.set(t.number, el); else cards.current.delete(t.number) }}
                        onOpen={() => onOpen(t)} onHover={on => setHover(h => (on ? t.number : h === t.number ? null : h))} />
                    ))}
                    {id === 'shape' && fogItems.length > 0 && (
                      <div title={STATE_MEANING.fog} style={{ position: 'relative', padding: '10px 12px', borderRadius: 14, cursor: 'help', opacity: traced ? 0.3 : 1 }}>
                        <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 18, filter: 'blur(8px)',
                          background: 'radial-gradient(ellipse at 35% 50%, color-mix(in srgb, var(--muted) 32%, transparent), transparent 72%), radial-gradient(ellipse at 70% 45%, color-mix(in srgb, var(--muted) 24%, transparent), transparent 72%)' }} />
                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 650, color: 'var(--muted)' }}>☁ Not yet specified · {fogItems.length}</span>
                          {fogItems.map(f => <span key={f} style={{ fontSize: 11, color: 'var(--text)', fontStyle: 'italic' }}>{f}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <svg width={box.w} height={box.h} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible' }} aria-hidden>
          <defs>
            <marker id="kipo-board-open" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={STATE_META.blocked.color} />
            </marker>
            <marker id="kipo-board-done" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={STATE_META.done.color} />
            </marker>
          </defs>
          {links.map(({ from, to }) => {
            const a = rects.get(from), b = rects.get(to)
            if (!a || !b) return null
            const done = tiles.find(t => t.number === from)!.state === 'done'
            const on = lit(from) && lit(to)
            return (
              <path key={`${from}-${to}`} d={route(a, b)} fill="none" stroke={done ? STATE_META.done.color : STATE_META.blocked.color}
                strokeWidth={traced && on ? 2.4 : 1.8} strokeDasharray={done ? '5 5' : undefined}
                opacity={on ? (done ? 0.7 : 0.85) : 0.1} markerEnd={`url(#kipo-board-${done ? 'done' : 'open'})`} />
            )
          })}
        </svg>
      </div>
    </div>
  )
}

// A line from a blocker's card to the card it holds up, through the gutters:
// rightward when the blocked card is to the right, leftward when it's to the
// left, and out round the right side when both are in one column.
function route(a: DOMRect, b: DOMRect) {
  const ay = a.top + a.height / 2, by = b.top + b.height / 2
  if (b.left > a.right) {
    const x1 = a.right, x2 = b.left - 3, mx = (x1 + x2) / 2
    return `M${x1},${ay} C${mx},${ay} ${mx},${by} ${x2},${by}`
  }
  if (b.right < a.left) {
    const x1 = a.left, x2 = b.right + 3, mx = (x1 + x2) / 2
    return `M${x1},${ay} C${mx},${ay} ${mx},${by} ${x2},${by}`
  }
  const x = Math.max(a.right, b.right), out = x + 22
  return `M${a.right},${ay} C${out},${ay} ${out},${by} ${b.right + 3},${by}`
}

const cardBase: CSSProperties = {
  borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: '0 3px 10px rgba(0,0,0,.25)',
}

function Pill({ state }: { state: Tile['state'] }) {
  const m = STATE_META[state]
  const act = state === 'you' || state === 'afk'
  return (
    <span title={STATE_MEANING[state]} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', padding: '1px 6px', borderRadius: 999,
      color: act ? '#14121a' : m.text, background: act ? m.color : `${m.color}26`, whiteSpace: 'nowrap' }}>
      {state === 'done' ? '✓ ' : ''}{STATE_LABEL[state]}
    </span>
  )
}

function Card({ tile: t, prs, compact, running, open, dim, onOpen, onHover, cardRef }: {
  tile: Tile; prs: PrInfo[]; compact?: boolean; running?: boolean; open?: boolean; dim?: boolean
  onOpen: () => void; onHover: (on: boolean) => void; cardRef: (el: HTMLDivElement | null) => void
}) {
  const m = STATE_META[t.state]
  const act = t.state === 'you' || t.state === 'afk'
  const isDone = t.state === 'done'
  const waiting = t.state === 'blocked' && t.blockedBy.length ? `\nWaiting on ${t.blockedBy.map(b => `#${b}`).join(', ')}` : ''
  return (
    <div ref={cardRef} role="button" tabIndex={0} onClick={onOpen} onKeyDown={e => { if (e.key === 'Enter') onOpen() }}
      onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}
      title={`#${t.number} ${t.title}\n\n${TYPE_LABEL[t.type]} · ${STATE_MEANING[t.state]}${waiting}${running ? '\nAn agent is working on it now' : ''}`}
      style={{ ...cardBase, position: 'relative', display: 'flex', overflow: 'hidden', cursor: 'pointer', flex: 'none',
        border: `1px solid ${open ? 'var(--accent)' : act ? m.color : 'var(--border)'}`,
        boxShadow: act ? `0 0 0 1px ${m.color}44, 0 5px 18px ${m.color}2e` : cardBase.boxShadow,
        opacity: dim ? 0.22 : 1, transition: 'opacity .15s' }}>
      <span style={{ width: 4, flex: 'none', background: m.color, opacity: isDone ? 0.6 : 1 }} />
      <div style={{ flex: 1, minWidth: 0, padding: compact ? '5px 8px' : '7px 9px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, minWidth: 0 }}>
          <span style={{ fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>#{t.number}</span>
          {compact
            ? <span style={{ flex: 1, minWidth: 0, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11 }}>{t.title}</span>
            : <><span style={{ color: 'var(--muted)' }}>{TYPE_LABEL[t.type]}</span><span style={{ flex: 1 }} /></>}
          {running && <span title="An agent is working on it" style={{ width: 6, height: 6, borderRadius: 9, flex: 'none', background: STATE_META.building.color, boxShadow: `0 0 6px ${STATE_META.building.color}` }} />}
          {!compact && <Pill state={t.state} />}
          {compact && prs.map(p => <PrBadge key={p.number} pr={p} />)}
        </div>
        {!compact && (
          <div style={{ fontSize: 11.5, lineHeight: 1.3, color: isDone ? 'var(--muted)' : 'var(--text)', overflow: 'hidden',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.title}</div>
        )}
        {!compact && prs.length > 0 && <div style={{ display: 'flex', gap: 4 }}>{prs.map(p => <PrBadge key={p.number} pr={p} />)}</div>}
      </div>
    </div>
  )
}

function PrBadge({ pr: p }: { pr: PrInfo }) {
  const c = p.state === 'MERGED' ? STATE_META.done.color : p.state === 'OPEN' ? STATE_META.review.color : 'var(--muted)'
  return (
    <span title={`PR #${p.number} (pull request) · ${p.title}\n${p.state === 'MERGED' ? 'Merged: it closed this ticket' : p.state === 'OPEN' ? 'Open: it closes this ticket when merged' : 'Closed without merging'}\nClick to open it on GitHub`}
      onClick={e => { e.stopPropagation(); window.open(p.url, '_blank', 'noreferrer') }}
      style={{ fontSize: 9.5, fontWeight: 700, padding: '0 6px', borderRadius: 999, border: `1px solid ${c}`, color: c, cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none' }}>
      PR #{p.number}
    </span>
  )
}
