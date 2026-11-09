import type { ReactNode } from 'react'
import { STATE_META, TileButton, type SessionStatus } from './Frontier'
import { STATE_MEANING, TERM } from './glossary'
import type { PrInfo, Tile } from './types'

// The effort's tickets in seven columns, one per KiPo skill, in the order work
// flows, Done on the right. A ticket sits in the column of the skill that handles
// it now and carries its state (HITL, Agent, In progress, In review, Blocked,
// Done). Loose ends sit where they'd be dealt with: a PR that closes no ticket
// in Review, a closed map's unspecified leftovers in Shape.

export type ColId = 'intake' | 'shape' | 'grill' | 'plan' | 'build' | 'review' | 'done'
// Matt's 27 under the KiPo skill that runs them (4 + 6 + 5 + 3 + 5 + 2 + 2);
// `any` ones are also usable from any stage.
const COLUMNS: { id: ColId; label: string; skill: string; matt: string[]; any?: string[]; what: string }[] = [
  { id: 'intake', label: 'Intake', skill: 'kipo-intake', matt: ['setup-matt-pocock-skills', 'ask-matt', 'triage', 'improve-codebase-architecture'], what: 'Set the repo up, triage the issue, pick a start' },
  { id: 'shape', label: 'Shape', skill: 'kipo-shape', matt: ['wayfinder', 'research', 'prototype', 'to-questionnaire'], any: ['handoff', 'teach'], what: "Huge, foggy: chart the map, work its decision tickets" },
  { id: 'grill', label: 'Grill', skill: 'kipo-grill', matt: ['grill-with-docs', 'grill-me', 'grilling', 'domain-modeling'], any: ['wait-what'], what: "An idea: interview until it's sharp" },
  { id: 'plan', label: 'Plan', skill: 'kipo-plan', matt: ['to-spec', 'to-tickets', 'codebase-design'], what: 'Hand-over: spec, then tickets' },
  { id: 'build', label: 'Build', skill: 'kipo-build', matt: ['implement', 'implement-spec', 'tdd', 'diagnosing-bugs', 'wizard'], what: 'One ticket per session, test-first, open a PR' },
  { id: 'review', label: 'Review', skill: 'kipo-review', matt: ['code-review', 'pr'], what: 'Review, then merge by Merge Danger' },
  { id: 'done', label: 'Done', skill: 'kipo-done', matt: ['retro', 'writing-for-agents'], what: 'Retro the run, tidy the docs' },
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

export function StageBoard({ tiles, prs = [], fogItems = [], fogLeft = [], effort, openNumber, statuses, conductor = 'none', onTile, onSession, onFog, onSkill }: {
  tiles: Tile[]
  prs?: PrInfo[]
  fogItems?: string[]
  fogLeft?: string[] // a closed map's unspecified items
  effort: number
  openNumber: number | null
  statuses: Record<number, SessionStatus>
  conductor?: 'none' | 'idle' | 'running' // the effort's conductor session: none yet, waiting, or mid-turn
  onTile: (t: Tile) => void // a click: the ticket's details on the right
  onSession?: (t: Tile) => void // a double-click: the ticket's session
  onFog?: (at: { x: number; y: number }) => void
  onSkill?: (stage: ColId, skill: string) => void // run one of Matt's skills in that stage's own conversation
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
  // The conductor's five duties, each with this effort's numbers right now.
  const openTiles = tiles.filter(t => t.state !== 'done')
  const hitl = tiles.filter(t => t.state === 'you').length + (fogLeft.length ? 1 : 0) + (fogItems.length ? 1 : 0) + (plan?.state === 'you' ? 1 : 0)
  const ready = tiles.filter(t => t.state === 'afk').length + strayPrs.length
  const working = tiles.filter(t => t.state === 'building' || statuses[t.number] === 'running').length
  const openPrs = prs.filter(p => p.state === 'OPEN').length
  const open = openTiles.length + (fogItems.length ? 1 : 0) + (fogLeft.length ? 1 : 0) + strayPrs.length
  const duties = [
    { name: 'Watch', what: 'wakes when the frontier changes', now: `${open} open · ${tiles.length - openTiles.length} done`, lit: open > 0 },
    { name: 'Dispatch', what: 'starts a stage-skill session per ticket', now: working ? `${working} running${ready ? ` · ${ready} ready` : ''}` : ready ? `${ready} ready for an agent` : 'nothing to start', lit: ready + working > 0 },
    { name: 'Ask you', what: 'HITL tickets, one-way doors', now: hitl ? `${hitl} need${hitl === 1 ? 's' : ''} you` : 'nothing for you', lit: hitl > 0 },
    { name: 'Merge', what: 'two-way doors alone (Merge Danger)', now: openPrs ? `${openPrs} open PR${openPrs === 1 ? '' : 's'}` : 'no open PRs', lit: openPrs > 0 },
    { name: 'Close', what: 'hand-over, retro, close the effort', now: open ? `after ${open} open` : 'ready: retro, then close', lit: !open },
  ]
  const status = conductor === 'running' ? { text: 'RUNNING', hint: 'The conductor is working right now' }
    : conductor === 'idle' ? { text: 'WATCHING', hint: 'The conductor is waiting for the next change on the frontier' }
      : { text: 'NOT STARTED', hint: "Start the conductor from the effort's conversation below" }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 'min-content' }} aria-label={`Effort #${effort} by KiPo skill`}>
      {/* The conductor: one long-lived agent per effort that never does the work itself. */}
      <div style={{ border: `1.5px ${conductor === 'none' ? 'dashed' : 'solid'} color-mix(in srgb, var(--accent) 70%, transparent)`, borderRadius: 10, padding: '6px 8px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, whiteSpace: 'nowrap' }}>
          <b style={{ fontSize: 13, color: 'var(--text-strong, var(--text))' }}>Conductor</b>
          <span title={status.hint} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.05em', padding: '1px 7px', borderRadius: 99, cursor: 'help',
            color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 18%, transparent)' }}>
            {conductor === 'running' && <span className="kipo-pulse" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 9, background: 'var(--accent)', marginRight: 5 }} />}
            {status.text}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>one long-lived agent per effort · never does the work itself · reads GitHub, doesn't guess</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(110px, 1fr))', gap: 6 }}>
          {duties.map(d => (
            <div key={d.name} title={`${d.name}: ${d.what}`} style={{ padding: '5px 8px', borderRadius: 7, cursor: 'help',
              background: d.lit ? 'color-mix(in srgb, var(--accent) 16%, var(--bg-elevated))' : 'var(--bg-elevated)',
              border: `1px solid ${d.lit ? 'color-mix(in srgb, var(--accent) 50%, var(--border))' : 'var(--border)'}` }}>
              <div style={{ fontSize: 11.5, fontWeight: 650, color: 'var(--text-strong, var(--text))' }}>{d.name}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.3 }}>{d.what}</div>
              <div style={{ fontSize: 10.5, marginTop: 2, color: d.lit ? 'var(--text)' : 'var(--muted)', fontWeight: d.lit ? 600 : 400 }}>{d.now}</div>
            </div>
          ))}
        </div>
      </div>

      {/* The seven KiPo skills, Matt's skills under each, and the effort's tickets where they stand. */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
        {STAGES.map(s => (
          <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: `${s.cols.length} 1 0` }}>
            <div title={s.hint} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', cursor: 'help', whiteSpace: 'nowrap' }}>
              {s.label === 'Decide' || s.label === 'Deliver' ? `${s.label} lane` : s.label}
            </div>
            <div style={{ display: 'flex', gap: 6, flex: 1 }}>
              {s.cols.map(id => {
                const col = COLUMNS.find(c => c.id === id)!
                const ts = byCol.get(id)!
                const live = ts.some(t => t.state === 'you' || t.state === 'afk' || t.state === 'building' || statuses[t.number] === 'running')
                return (
                  <div key={id} style={{ flex: '1 1 0', minWidth: 132, maxWidth: id === 'done' ? 240 : undefined, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 5, padding: 7, borderRadius: 9,
                    background: 'var(--bg-elevated)', border: `1px solid ${live ? 'color-mix(in srgb, var(--accent) 55%, var(--border))' : 'var(--border)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-strong, var(--text))' }}>{col.skill}</span>
                      {ts.length > 0 && <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>{ts.length}</span>}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.3 }}>{col.what}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {col.matt.map(m => <Chip key={m} name={m} where={col.label} onSkill={onSkill && (s => onSkill(id, s))} />)}
                      {col.any?.map(m => <Chip key={m} name={m} where={col.label} any onSkill={onSkill && (s => onSkill(id, s))} />)}
                    </div>
                    {(ts.length > 0 || extras[id]) && <div style={{ borderTop: '1px solid var(--border)', margin: '2px 0' }} />}
                    {ts.map(t => <Card key={t.number} t={t} compact={id === 'done'} open={t.number === openNumber}
                      running={statuses[t.number] === 'running'} prs={prs.filter(p => p.tickets.includes(t.number))}
                      onClick={() => onTile(t)} onDoubleClick={onSession && (() => onSession(t))} />)}
                    {extras[id]}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: 'var(--muted)' }}>
        <Chip name="skill" /> one of Matt's 27, run by the KiPo skill above it · click to run it in that stage's conversation
        <Chip name="skill" any /> also usable from any stage
      </div>
    </div>
  )
}

// One of Matt's skills; click to run it in the effort's conversation.
function Chip({ name, any, where, onSkill }: { name: string; any?: boolean; where?: string; onSkill?: (s: string) => void }) {
  return (
    <button type="button" onClick={onSkill ? () => onSkill(name) : undefined} disabled={!onSkill}
      title={onSkill ? `/${name}${any ? ' · usable from any stage' : ''}\nClick to run it in the effort's ${where} conversation` : undefined}
      style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, cursor: onSkill ? 'pointer' : 'default', whiteSpace: 'nowrap', flex: 'none',
        background: any ? 'transparent' : 'var(--bg)', color: any ? 'var(--muted)' : 'var(--text)', border: `1px ${any ? 'dashed' : 'solid'} var(--border)` }}>
      {name}
    </button>
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

function Card({ t, compact, open, running, prs, onClick, onDoubleClick }: {
  t: Tile; compact: boolean; open: boolean; running: boolean; prs: PrInfo[]; onClick: () => void; onDoubleClick?: () => void
}) {
  const m = STATE_META[t.state]
  const act = t.state === 'you' || t.state === 'afk'
  const waits = t.state === 'blocked' && t.blockedBy.length ? `waits on ${t.blockedBy.map(b => `#${b}`).join(', ')}` : ''
  return (
    <button type="button" onClick={onClick} onDoubleClick={onDoubleClick}
      title={`#${t.number} ${t.title}\n\n${TYPE_LABEL[t.type]} · ${STATE_MEANING[t.state]}${waits ? `\nIt ${waits}` : ''}${running ? '\nAn agent is working on it now' : ''}${prs.length ? `\n${prs.map(p => `PR #${p.number} (${p.state.toLowerCase()})`).join(', ')}` : ''}${onDoubleClick ? '\n\nClick: its details on the right · double-click: its session' : ''}`}
      style={{ display: 'flex', width: '100%', minWidth: 0, textAlign: 'left', padding: 0, cursor: 'pointer', borderRadius: 7, overflow: 'hidden', background: 'var(--bg)', color: 'var(--text)',
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

// The session view's header: the conductor, then the seven stages as a thin row
// of columns, each with its tickets as small tiles. A tile opens that ticket's
// session; the conductor chip opens the conductor's.
export function StageStrip({ tiles, prs = [], fogItems = [], fogLeft = [], openNumber, statuses, conductor = 'none', conductorOpen, onConductor, onTile, onFog }: {
  tiles: Tile[]
  prs?: PrInfo[]
  fogItems?: string[]
  fogLeft?: string[]
  openNumber: number | null
  statuses: Record<number, SessionStatus>
  conductor?: 'none' | 'idle' | 'running'
  conductorOpen: boolean // the conductor's session is the one on screen
  onConductor: () => void
  onTile: (t: Tile) => void
  onFog?: (at: { x: number; y: number }) => void
}) {
  const byCol = new Map<ColId, Tile[]>(COLUMNS.map(c => [c.id, []]))
  for (const t of tiles) byCol.get(columnOf(t))!.push(t)
  for (const ts of byCol.values()) ts.sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state) || a.number - b.number)
  const known = new Set(tiles.map(t => t.number))
  const strayPrs = prs.filter(p => p.state === 'OPEN' && !p.tickets.some(n => known.has(n)))
  const status = conductor === 'running' ? 'running' : conductor === 'idle' ? 'watching' : 'not started'
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'stretch', minWidth: 'min-content' }}>
      <button type="button" onClick={onConductor} title={`The conductor (${status}). Click to open its conversation.`}
        style={{ flex: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, padding: '3px 9px', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
          background: conductorOpen ? 'color-mix(in srgb, var(--accent) 22%, var(--bg-elevated))' : 'var(--bg-elevated)', color: 'var(--text)',
          border: `1px ${conductor === 'none' ? 'dashed' : 'solid'} ${conductorOpen ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 50%, var(--border))'}` }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-strong, var(--text))' }}>Conductor</span>
        <span style={{ fontSize: 9.5, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
          {conductor !== 'none' && <span className={conductor === 'running' ? 'kipo-pulse' : undefined} style={{ width: 6, height: 6, borderRadius: 9, background: 'var(--accent)' }} />}
          {status}
        </span>
      </button>
      {COLUMNS.map(col => {
        const ts = byCol.get(col.id)!
        const loose: ReactNode[] = []
        if (col.id === 'shape' && fogItems.length) loose.push(<Mini key="fog" text={`☁ ${fogItems.length}`} title={`${STATE_MEANING.fog}\n\n${fogItems.map(f => `• ${plain(f)}`).join('\n')}`} onClick={onFog} />)
        if (col.id === 'shape' && fogLeft.length) loose.push(<Mini key="left" text={`${fogLeft.length} left`} color={STATE_META.you.color} title={`Left unspecified when the map closed. HITL: file each as an issue, or drop it.\n\n${fogLeft.map(f => `• ${plain(f)}`).join('\n')}`} onClick={onFog} />)
        if (col.id === 'review') for (const p of strayPrs) loose.push(<Mini key={p.number} text={`PR #${p.number}`} color={STATE_META.review.color} title={`PR #${p.number} · ${p.title}\nOpen, and it closes no ticket of this effort. Click to open it on GitHub.`} onClick={() => window.open(p.url, '_blank', 'noreferrer')} />)
        const empty = !ts.length && !loose.length
        const live = ts.some(t => t.state === 'you' || t.state === 'afk' || t.state === 'building' || statuses[t.number] === 'running')
        return (
          <div key={col.id} title={empty ? `${col.label} · ${col.skill}: nothing here now` : undefined}
            style={{ flex: empty ? '0 0 auto' : '1 1 auto', padding: '3px 6px 4px', borderRadius: 7, background: 'var(--bg-elevated)', minWidth: 0,
              border: `1px solid ${live ? 'color-mix(in srgb, var(--accent) 55%, var(--border))' : 'var(--border)'}`, opacity: empty ? 0.55 : 1 }}>
            <div title={`${col.label} · ${col.skill}\n${col.what}`} style={{ fontSize: 10, fontWeight: 650, color: empty ? 'var(--muted)' : 'var(--text-strong, var(--text))', whiteSpace: 'nowrap', cursor: 'help' }}>
              {col.label}{ts.length ? <span style={{ fontWeight: 400, color: 'var(--muted)' }}> {ts.length}</span> : null}
            </div>
            {!empty && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3, maxWidth: col.id === 'done' ? 200 : 260 }}>
                {ts.map(t => <TileButton key={t.number} tile={t} size={24} onClick={() => onTile(t)} open={t.number === openNumber} status={statuses[t.number]} />)}
                {loose}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Mini({ text, title, color, onClick }: { text: string; title: string; color?: string; onClick?: ((at: { x: number; y: number }) => void) | (() => void) }) {
  return (
    <button type="button" title={title} disabled={!onClick}
      onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onClick?.({ x: r.left, y: r.bottom + 4 }) }}
      style={{ height: 30, padding: '0 6px', borderRadius: 6, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', cursor: onClick ? 'pointer' : 'help',
        background: 'transparent', color: color ?? 'var(--muted)', border: `1px dashed ${color ?? 'var(--muted)'}` }}>
      {text}
    </button>
  )
}
