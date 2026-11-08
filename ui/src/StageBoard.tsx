import type { ReactNode } from 'react'
import { STATE_META, type SessionStatus } from './Frontier'
import { STATE_MEANING, TERM } from './glossary'
import type { PrInfo, Tile } from './types'

// The effort's tickets in seven columns, one per KiPo skill, in the order work
// flows, Done on the right. A ticket sits in the column of the skill that handles
// it now and carries its state (HITL, Agent, In progress, In review, Blocked,
// Done). Loose ends sit where they'd be dealt with: a PR that closes no ticket
// in Review, a closed map's unspecified leftovers in Shape.

type ColId = 'intake' | 'shape' | 'grill' | 'plan' | 'build' | 'review' | 'done'
const COLUMNS: { id: ColId; label: string; skill: string; matt: string[]; what: string }[] = [
  { id: 'intake', label: 'Intake', skill: 'kipo-intake', matt: ['triage', 'setup-matt-pocock-skills'], what: 'The source issue or request: triaged, and the repo set up' },
  { id: 'shape', label: 'Shape', skill: 'kipo-shape', matt: ['wayfinder', 'prototype', 'research'], what: 'The wayfinder map: prototype, research and task tickets, and the fog still to chart' },
  { id: 'grill', label: 'Grill', skill: 'kipo-grill', matt: ['grilling', 'grill-with-docs', 'domain-modeling'], what: 'Grilling tickets: an interview settles each decision' },
  { id: 'plan', label: 'Plan', skill: 'kipo-plan', matt: ['to-spec', 'to-tickets'], what: 'The hand-over: the decisions become a spec, the spec becomes natively blocked tickets' },
  { id: 'build', label: 'Build', skill: 'kipo-build', matt: ['implement', 'implement-spec', 'tdd', 'diagnosing-bugs'], what: 'Tickets built test-first until their PR opens' },
  { id: 'review', label: 'Review', skill: 'kipo-review', matt: ['code-review', 'pr'], what: 'Open PRs: reviewed, fixed, merged when clean (one-way doors ask you)' },
  { id: 'done', label: 'Done', skill: 'kipo-done', matt: ['retro'], what: 'Closed; the retro turns lessons into checks and cleans up' },
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

const columnOf = (t: Tile): ColId =>
  t.state === 'done' ? 'done'
    : t.source ? 'intake'
      : t.state === 'review' ? 'review'
        : t.type === 'build' ? 'build'
          : t.type === 'grilling' ? 'grill'
            : 'shape'

export function StageBoard({ tiles, prs = [], fogItems = [], fogLeft = [], effort, openNumber, statuses, onTile, onFog }: {
  tiles: Tile[]
  prs?: PrInfo[]
  fogItems?: string[]
  fogLeft?: string[] // a closed map's unspecified items
  effort: number
  openNumber: number | null
  statuses: Record<number, SessionStatus>
  onTile: (t: Tile) => void
  onFog?: (at: { x: number; y: number }) => void
}) {
  const byCol = new Map<ColId, Tile[]>(COLUMNS.map(c => [c.id, []]))
  for (const t of tiles) byCol.get(columnOf(t))!.push(t)
  for (const ts of byCol.values()) ts.sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state) || a.number - b.number)

  const known = new Set(tiles.map(t => t.number))
  const strayPrs = prs.filter(p => p.state === 'OPEN' && !p.tickets.some(n => known.has(n)))
  const builds = tiles.filter(t => t.type === 'build')
  const openDecisions = tiles.filter(t => !t.source && t.lane === 'decide' && t.state !== 'done')
  const plan = builds.length
    ? null // the spec is cut: its tickets are in Build and beyond
    : tiles.length && !openDecisions.length && !fogItems.length && !fogLeft.length && tiles.some(t => t.lane === 'decide')
      ? { text: 'Every decision is made: write the spec and cut the tickets', state: 'you' as const, hint: 'HITL: kipo-plan runs /to-spec, then /to-tickets' }
      : openDecisions.length || fogItems.length
        ? { text: `Waiting on ${openDecisions.length} decision${openDecisions.length === 1 ? '' : 's'}${fogItems.length ? ` and ${fogItems.length} fog` : ''}`, state: 'blocked' as const, hint: 'The spec can be written once every decision is made and the fog is charted' }
        : null

  const extras: Partial<Record<ColId, ReactNode>> = {
    shape: <>
      {fogItems.length > 0 && <Loose kind="fog" title={`${STATE_MEANING.fog}\n\n${fogItems.map(f => `• ${plain(f)}`).join('\n')}`} onClick={onFog}
        text={`☁ ${fogItems.length} not yet specified`} sub="fog: chart it into tickets" />}
      {fogLeft.length > 0 && <Loose kind="left" title={`The map closed with these unspecified:\n\n${fogLeft.map(f => `• ${plain(f)}`).join('\n')}\n\nHITL: file each as an issue, or drop it.`} onClick={onFog}
        text={`${fogLeft.length} left unspecified`} sub="map closed · HITL: file or drop" />}
    </>,
    plan: plan && <Loose kind={plan.state} title={plan.hint} text={plan.text} />,
    review: <>{strayPrs.map(p => (
      <Loose key={p.number} kind="pr" title={`PR #${p.number} · ${p.title}\nOpen, and it closes no ticket of this effort.\nClick to open it on GitHub.`}
        onClick={() => window.open(p.url, '_blank', 'noreferrer')} text={`PR #${p.number} ${p.title}`} sub="open · closes no ticket" />
    ))}</>,
  }
  const count = (c: ColId) => byCol.get(c)!.length
  const hasExtra = (c: ColId) => (c === 'shape' && (fogItems.length + fogLeft.length) > 0) || (c === 'plan' && !!plan) || (c === 'review' && strayPrs.length > 0)
  const empty = (c: ColId) => !count(c) && !hasExtra(c)

  return (
    <div style={{ display: 'flex', gap: 6, minWidth: 'min-content', alignItems: 'stretch' }} aria-label={`Effort #${effort} by KiPo skill`}>
      {STAGES.map(s => (
        <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: s.cols.every(empty) ? '0 0 auto' : `${s.cols.filter(c => !empty(c)).length} 1 0` }}>
          <div title={s.hint} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)', cursor: 'help',
            borderBottom: '2px solid color-mix(in srgb, var(--accent) 40%, transparent)', paddingBottom: 2, whiteSpace: 'nowrap', minHeight: 15 }}>
            {s.cols.every(empty) ? '' : s.label}
          </div>
          <div style={{ display: 'flex', gap: 6, flex: 1 }}>
            {s.cols.map(id => {
              const col = COLUMNS.find(c => c.id === id)!
              const head = `${col.label} · ${col.skill}\n${col.what}\nRuns Matt's: ${col.matt.map(m => `/${m}`).join(', ')}`
              const ts = byCol.get(id)!
              if (empty(id)) {
                return (
                  <div key={id} title={`${head}\n\nNothing here now.`}
                    style={{ width: 24, flex: 'none', borderRadius: 8, border: '1px dashed var(--border)', display: 'flex', justifyContent: 'center', paddingTop: 8, cursor: 'help' }}>
                    <span style={{ writingMode: 'vertical-rl', fontSize: 10.5, color: 'var(--muted)' }}>{col.label}</span>
                  </div>
                )
              }
              const live = ts.some(t => t.state === 'you' || t.state === 'afk' || t.state === 'building' || statuses[t.number] === 'running')
              return (
                <div key={id} style={{ flex: '1 1 0', minWidth: id === 'done' ? 120 : 132, display: 'flex', flexDirection: 'column', gap: 5, padding: 6, borderRadius: 9,
                  background: 'var(--bg-elevated)', border: `1px solid ${live ? 'color-mix(in srgb, var(--accent) 55%, var(--border))' : 'var(--border)'}` }}>
                  <div title={head} style={{ display: 'flex', alignItems: 'baseline', gap: 5, cursor: 'help', padding: '0 2px' }}>
                    <span style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-strong, var(--text))' }}>{col.label}</span>
                    {ts.length > 0 && <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>{ts.length}</span>}
                  </div>
                  {ts.map(t => <Card key={t.number} t={t} compact={id === 'done'} open={t.number === openNumber}
                    running={statuses[t.number] === 'running'} prs={prs.filter(p => p.tickets.includes(t.number))} onClick={() => onTile(t)} />)}
                  {extras[id]}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function Pill({ state }: { state: Tile['state'] }) {
  const m = STATE_META[state]
  const act = state === 'you' || state === 'afk'
  return (
    <span title={STATE_MEANING[state]} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', padding: '1px 5px', borderRadius: 99,
      color: act ? '#14121a' : m.text, background: act ? m.color : `${m.color}2a`, whiteSpace: 'nowrap', flex: 'none' }}>
      {state === 'done' ? '✓ ' : ''}{STATE_LABEL[state]}
    </span>
  )
}

function Card({ t, compact, open, running, prs, onClick }: { t: Tile; compact: boolean; open: boolean; running: boolean; prs: PrInfo[]; onClick: () => void }) {
  const m = STATE_META[t.state]
  const act = t.state === 'you' || t.state === 'afk'
  const waits = t.state === 'blocked' && t.blockedBy.length ? `waits on ${t.blockedBy.map(b => `#${b}`).join(', ')}` : ''
  return (
    <button type="button" onClick={onClick}
      title={`#${t.number} ${t.title}\n\n${TYPE_LABEL[t.type]} · ${STATE_MEANING[t.state]}${waits ? `\nIt ${waits}` : ''}${running ? '\nAn agent is working on it now' : ''}${prs.length ? `\n${prs.map(p => `PR #${p.number} (${p.state.toLowerCase()})`).join(', ')}` : ''}`}
      style={{ display: 'flex', textAlign: 'left', padding: 0, cursor: 'pointer', borderRadius: 7, overflow: 'hidden', background: 'var(--bg)', color: 'var(--text)',
        border: `1px solid ${open ? 'var(--accent)' : act ? m.color : 'var(--border)'}`, boxShadow: act ? `0 0 10px ${m.color}33` : undefined, flex: 'none' }}>
      <span style={{ width: 3, flex: 'none', background: m.color, opacity: t.state === 'done' ? 0.55 : 1 }} />
      <span style={{ flex: 1, minWidth: 0, padding: compact ? '3px 6px' : '5px 7px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
          <b style={{ fontSize: 11, color: 'var(--text-strong, var(--text))', fontVariantNumeric: 'tabular-nums' }}>#{t.number}</b>
          {compact
            ? <span style={{ flex: 1, minWidth: 0, fontSize: 10.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
            : <span style={{ flex: 1 }} />}
          {running && <span className="kipo-pulse" title="An agent is working on it" style={{ width: 6, height: 6, borderRadius: 9, flex: 'none', background: STATE_META.building.color }} />}
          {!compact && <Pill state={t.state} />}
        </span>
        {!compact && (
          <span style={{ fontSize: 11, lineHeight: 1.3, color: 'var(--text)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.title}</span>
        )}
        {!compact && (waits || prs.length > 0) && (
          <span style={{ fontSize: 10, color: waits ? STATE_META.blocked.text : 'var(--muted)' }}>
            {waits}{waits && prs.length ? ' · ' : ''}{prs.map(p => `PR #${p.number}`).join(', ')}
          </span>
        )}
      </span>
    </button>
  )
}

// Not a ticket, but something the conductor has to deal with in this column.
function Loose({ kind, text, sub, title, onClick }: {
  kind: 'fog' | 'left' | 'pr' | 'you' | 'blocked'; text: string; sub?: string; title: string
  onClick?: ((at: { x: number; y: number }) => void) | (() => void)
}) {
  const color = kind === 'you' || kind === 'left' ? STATE_META.you.color : kind === 'blocked' ? STATE_META.blocked.color : kind === 'pr' ? STATE_META.review.color : 'var(--muted)'
  return (
    <button type="button" title={title} disabled={!onClick}
      onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onClick?.({ x: r.left, y: r.bottom + 4 }) }}
      style={{ textAlign: 'left', padding: '5px 7px', borderRadius: 7, border: `1px dashed ${color}`, background: 'transparent', color: 'var(--text)',
        cursor: onClick ? 'pointer' : 'help', display: 'flex', flexDirection: 'column', gap: 2, flex: 'none' }}>
      <span style={{ fontSize: 11, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{text}</span>
      {sub && <span style={{ fontSize: 10, color }}>{sub}</span>}
    </button>
  )
}

const plain = (md: string) => md.replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
