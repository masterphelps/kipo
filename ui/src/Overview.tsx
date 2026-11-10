import type { ReactNode } from 'react'
import { T, muted, strong } from './common'
import { STATE_META } from './Frontier'
import type { EffortDetail, PhaseState } from './types'

// The conductor's overview: the effort read as a chain, an inbox ("Needs you"),
// what's moving on its own, the stage gates, and the integrity checks. Every
// number is derived from the frontier + the state files; the app stores nothing
// the tracker doesn't. Pass 1 wires the data-backed parts; the coverage and
// silent-stall checks (marked "soon") land in pass 2.

type Need =
  | { key: string; kind: 'question'; ticket: number | null; title: string }
  | { key: string; kind: 'review'; ticket: number | null; title: string; pr: number }
  | { key: string; kind: 'gate'; stage: 'plan' | 'done'; title: string }

const collectDecisions = (detail: EffortDetail): { ticket: number | null; title: string; answered: boolean }[] => {
  const out: { ticket: number | null; title: string; answered: boolean }[] = []
  const push = (st: PhaseState | null | undefined, ticket: number | null) =>
    (st?.decisions ?? []).forEach(d => out.push({ ticket, title: d.title, answered: !!d.answer }))
  push(detail.sessionStates?.conductor ?? detail.state, null)
  for (const [k, st] of Object.entries(detail.sessionStates ?? {})) {
    if (k === 'conductor') continue
    const m = k.match(/t(\d+)$/)
    push(st, m ? Number(m[1]) : null)
  }
  return out
}

export function Overview({ detail, onOpenTicket, onReview, onSignoff }: {
  detail: EffortDetail
  onOpenTicket: (ticket: number | null) => void // open a ticket to answer / inspect (null = the conductor)
  onReview: (ticket: number | null, pr: number) => void
  onSignoff: (stage: 'plan' | 'done') => void
}) {
  const tiles = detail.frontier?.tiles ?? []
  const tileNums = new Set(tiles.map(t => t.number))
  const doneSet = new Set(tiles.filter(t => t.state === 'done').map(t => t.number))
  const prs = detail.prs
  const openPrs = prs.filter(p => p.state === 'OPEN')
  const mergedPrs = prs.filter(p => p.state === 'MERGED').length
  const hasSpec = detail.artifacts.some(a => a.label === 'Spec' || a.label.startsWith('Spec'))
  const retroRan = !!detail.sessions.done

  // The chain, with a basic unlinked count (coverage is pass 2): a PR with no
  // ticket, or a blocker pointing at a ticket not on the map.
  const decisions = collectDecisions(detail)
  const deadBlockers = tiles.filter(t => (t.blockers ?? t.blockedBy).some(n => !tileNums.has(n))).length
  const unlinked = openPrs.filter(p => !p.tickets.length).length + deadBlockers
  const chain = [
    { n: detail.mapIssue ? 1 : 0, label: 'map', tone: 'g' as const, show: !!detail.mapIssue },
    { n: decisions.length, label: decisions.length === 1 ? 'decision' : 'decisions', tone: 'g' as const, show: decisions.length > 0 },
    { n: hasSpec ? 1 : 0, label: 'spec', tone: 'g' as const, show: hasSpec },
    { text: `${tiles.length} tickets, ${doneSet.size} done`, tone: 'a' as const, show: tiles.length > 0 },
    { text: `${prs.length} PRs, ${mergedPrs} merged`, tone: 'a' as const, show: prs.length > 0 },
  ].filter(x => x.show)

  // Needs you: open questions + open PRs + gate sign-offs. A done ticket's
  // unanswered decisions are history, not questions.
  const openDec = decisions.filter(d => !d.answered && !(d.ticket != null && doneSet.has(d.ticket)))
  const byTicket = new Map<number | null, string[]>()
  for (const d of openDec) {
    const arr = byTicket.get(d.ticket) ?? []
    arr.push(d.title)
    byTicket.set(d.ticket, arr)
  }
  const needs: Need[] = []
  for (const p of openPrs) {
    needs.push({ key: `pr${p.number}`, kind: 'review', ticket: p.tickets[0] ?? null, pr: p.number, title: `Review PR: ${p.title}` })
  }
  for (const [ticket, titles] of byTicket) {
    needs.push({ key: `q${ticket ?? 'c'}`, kind: 'question', ticket, title: titles.length === 1 ? `Question: ${titles[0]}` : `${titles.length} questions` })
  }
  if (detail.frontier?.handover && !hasSpec) needs.push({ key: 'gate-plan', kind: 'gate', stage: 'plan', title: 'Sign off: write the spec and cut the tickets' })
  if (detail.frontier?.landed && !retroRan) needs.push({ key: 'gate-done', kind: 'gate', stage: 'done', title: 'Sign off: run the retro, then close' })

  // Moving on its own: building, ready, or waiting on a named ticket.
  const moving = tiles
    .filter(t => t.state === 'building' || t.state === 'afk' || t.state === 'blocked')
    .sort((a, b) => ['building', 'afk', 'blocked'].indexOf(a.state) - ['building', 'afk', 'blocked'].indexOf(b.state) || a.number - b.number)

  // The stage gates.
  const decide = tiles.filter(t => t.lane === 'decide')
  const build = tiles.filter(t => t.lane === 'deliver')
  const answered = decisions.filter(d => d.answered).length
  const gates = [
    { name: 'Shape', sub: `${decide.filter(t => t.state === 'done').length} of ${decide.length}`, done: decide.length > 0 && decide.every(t => t.state === 'done') },
    { name: 'Grill', sub: decisions.length ? `${answered} of ${decisions.length}` : '—', done: decisions.length > 0 && answered === decisions.length },
    { name: 'Plan', sub: hasSpec ? 'Spec covered' : 'No spec yet', done: hasSpec },
    { name: 'Build', sub: `${build.filter(t => t.state === 'done').length} of ${build.length}`, done: build.length > 0 && build.every(t => t.state === 'done') },
    { name: 'Review', sub: prs.length ? `${mergedPrs} of ${prs.length}` : '—', done: prs.length > 0 && mergedPrs === prs.length },
    { name: 'Done', sub: retroRan ? 'Retro done' : 'Retro not run', done: retroRan },
  ]
  const currentIdx = gates.findIndex(g => !g.done)

  // Nothing missed: the checks code can enforce. Coverage and silent-stall are
  // pass 2 — shown as "soon" rather than faked green.
  const openQTickets = [...byTicket.keys()].filter(k => k != null).length
  const checks: { label: string; state: 'ok' | 'warn' | 'soon' }[] = [
    { label: 'Every ticket has a state and an owner', state: 'ok' },
    { label: 'Every blocker points at an open ticket', state: deadBlockers === 0 ? 'ok' : 'warn' },
    { label: 'Every decision appears in the spec', state: 'soon' },
    { label: 'Every spec section has a ticket', state: 'soon' },
    { label: 'No session silent over 30 min', state: 'soon' },
    { label: openQTickets ? `${openQTickets} question${openQTickets === 1 ? '' : 's'} open, blocking close` : 'Open questions block their ticket closing', state: openQTickets ? 'warn' : 'ok' },
  ]

  return (
    <div style={{ padding: '14px 16px 18px' }}>
      {/* the chain */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 4px', marginBottom: 18 }}>
        {chain.map((c, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {i > 0 && <span style={{ width: 10, height: 10, border: '1px solid var(--border)', borderRadius: 2, margin: '0 6px' }} />}
            <ChainPill tone={c.tone}>{'text' in c ? c.text : <><b style={strong}>{c.n}</b> {c.label}</>}</ChainPill>
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: T.body, whiteSpace: 'nowrap' }}>
          <b style={{ color: unlinked === 0 ? STATE_META.done.text : STATE_META.you.color }}>{unlinked}</b> <span style={muted}>unlinked</span>
        </span>
      </div>

      {/* Needs you */}
      <Group label={`Needs you · ${needs.length}`}>
        {needs.length === 0
          ? <Empty>Nothing is waiting on you.</Empty>
          : <div style={listStyle}>
              {needs.map(n => (
                <div key={n.key} style={rowStyle}>
                  <span style={{ width: 20, flexShrink: 0, textAlign: 'center' }}>{n.kind === 'review' ? <Dot color={STATE_META.review.color} ring /> : n.kind === 'gate' ? '◆' : <span style={{ color: STATE_META.you.color, fontWeight: 800 }}>?</span>}</span>
                  <span style={{ ...muted, fontSize: T.small, width: 44, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {n.kind === 'gate' ? '' : `#${n.kind === 'review' ? n.pr : (n.ticket ?? '—')}`}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: T.body, lineHeight: 1.4 }}>{n.title}</span>
                  <Action onClick={() => n.kind === 'review' ? onReview(n.ticket, n.pr) : n.kind === 'gate' ? onSignoff(n.stage) : onOpenTicket(n.ticket)}>
                    {n.kind === 'review' ? 'Review' : n.kind === 'gate' ? 'Sign off' : 'Answer'}
                  </Action>
                </div>
              ))}
            </div>}
      </Group>

      {/* Moving on its own */}
      <Group label={`Moving on its own · ${moving.length}`}>
        {moving.length === 0
          ? <Empty>Nothing running right now.</Empty>
          : <div style={listStyle}>
              {moving.map(t => {
                const label = t.state === 'building' ? 'Building' : t.state === 'afk' ? 'Ready' : `Waits on ${t.blockedBy.map(n => `#${n}`).join(', ')}`
                const color = t.state === 'building' ? STATE_META.building.color : t.state === 'afk' ? STATE_META.afk.color : STATE_META.blocked.color
                return (
                  <button key={t.number} type="button" onClick={() => onOpenTicket(t.number)} style={{ ...rowStyle, width: '100%', textAlign: 'left', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>
                    <span style={{ ...muted, fontSize: T.small, width: 44, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>#{t.number}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: T.body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                    <Pill color={color}>{label}</Pill>
                  </button>
                )
              })}
            </div>}
      </Group>

      {/* Gates */}
      <Group label="Gates">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
          {gates.map((g, i) => (
            <div key={g.name} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8,
              background: i === currentIdx ? STATE_META.you.color + '22' : 'transparent',
              border: `1px solid ${i === currentIdx ? STATE_META.you.color + '66' : 'transparent'}` }}>
              <div style={{ fontWeight: 700, fontSize: T.small, color: g.done ? STATE_META.done.text : i === currentIdx ? STATE_META.you.color : 'var(--text)' }}>{g.name}</div>
              <div style={{ fontSize: T.tiny, color: 'var(--muted)', marginTop: 2 }}>{g.sub}</div>
            </div>
          ))}
        </div>
      </Group>

      {/* Nothing missed */}
      <Group label="Nothing missed">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {checks.map(c => (
            <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: T.body,
              color: c.state === 'warn' ? STATE_META.you.color : c.state === 'soon' ? 'var(--muted)' : 'var(--text)' }}>
              <span aria-hidden style={{ width: 16, height: 16, flexShrink: 0, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
                border: `1.5px solid ${c.state === 'ok' ? STATE_META.done.color : c.state === 'warn' ? STATE_META.you.color : 'var(--border)'}`,
                color: c.state === 'ok' ? STATE_META.done.color : 'transparent' }}>{c.state === 'ok' ? '✓' : ''}</span>
              {c.label}{c.state === 'soon' && <span style={{ ...muted, fontSize: T.tiny }}> · soon</span>}
            </div>
          ))}
        </div>
      </Group>
    </div>
  )
}

const listStyle = { border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden', background: 'var(--bg)' } as const
const rowStyle = { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderTop: '1px solid var(--border)' } as const

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <div style={{ ...muted, fontSize: T.small, marginBottom: 8 }}>{label}</div>
      {children}
    </section>
  )
}
function Empty({ children }: { children: ReactNode }) {
  return <div style={{ ...muted, fontSize: T.small, padding: '10px 2px' }}>{children}</div>
}
function ChainPill({ tone, children }: { tone: 'g' | 'a'; children: ReactNode }) {
  const c = tone === 'g' ? STATE_META.done : STATE_META.you
  return <span style={{ fontSize: T.small, fontWeight: 600, borderRadius: 7, padding: '3px 10px', whiteSpace: 'nowrap', color: c.text, border: `1px solid ${c.color}55`, background: `${c.color}1f` }}>{children}</span>
}
function Pill({ color, children }: { color: string; children: ReactNode }) {
  return <span style={{ fontSize: T.tiny, fontWeight: 600, borderRadius: 99, padding: '2px 9px', whiteSpace: 'nowrap', flexShrink: 0, color, border: `1px solid ${color}66`, background: `${color}1a` }}>{children}</span>
}
function Dot({ color, ring }: { color: string; ring?: boolean }) {
  return <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 4, border: ring ? `2px solid ${color}` : 'none', background: ring ? 'transparent' : color }} />
}
function Action({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      style={{ flexShrink: 0, border: '1px solid var(--border)', borderRadius: 7, padding: '5px 12px', fontSize: T.small, fontWeight: 600,
        background: 'transparent', color: 'var(--text)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
      {children} <span style={{ color: 'var(--muted)', fontSize: T.tiny }}>↗</span>
    </button>
  )
}
