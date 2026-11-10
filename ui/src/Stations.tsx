import { ChevronRight, MessageSquare } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ActionButton, T, muted, strong } from './common'
import { STATE_META, type SessionStatus } from './Frontier'
import { STATE_MEANING } from './glossary'
import { isClosed } from './sessions'
import { COLUMN_DEFS, columnOf, type ColId } from './StageBoard'
import type { EffortDetail, SessionActivity, Start, StationsSummary, Tile } from './types'

// ------------------------------------------------- the sidebar's view of it

// One effort in the rail: the same seven stations as a tiny segment row, each
// colored by what's loudest in it (HITL first), dim when empty, plus the
// "Front: X · what's open" line. The list and the conductor panel rhyme.
type Glance = { segs: { id: ColId; color: string | null; active: boolean }[]; front: string; bits: string }

export function stationGlance(s: StationsSummary): Glance {
  const loudest = (c: { you: number; afk: number; building: number; review: number; blocked: number; done: number }, fog = 0) => {
    if (c.you) return { color: STATE_META.you.color, active: true }
    if (c.blocked) return { color: STATE_META.blocked.color, active: true }
    if (c.building) return { color: STATE_META.building.color, active: true }
    if (c.afk) return { color: STATE_META.afk.color, active: true }
    if (c.review) return { color: STATE_META.review.color, active: true }
    if (fog) return { color: 'var(--muted)', active: true }
    if (c.done) return { color: STATE_META.done.color, active: false }
    return { color: null, active: false }
  }
  const segs: Glance['segs'] = [
    { id: 'intake', ...loudest(s.intake) },
    { id: 'shape', ...loudest(s.shape, s.fog) },
    { id: 'grill', ...loudest(s.grill) },
    {
      id: 'plan',
      ...(s.specCut ? { color: STATE_META.done.color, active: false }
        : s.handover ? { color: STATE_META.you.color, active: true } : { color: null, active: false }),
    },
    { id: 'build', ...loudest(s.build) },
    {
      id: 'review',
      ...(s.prs.open ? { color: STATE_META.review.color, active: true }
        : s.prs.merged ? { color: STATE_META.done.color, active: false } : { color: null, active: false }),
    },
    {
      id: 'done',
      ...(s.landed ? (s.retro ? { color: STATE_META.done.color, active: false } : { color: STATE_META.you.color, active: true })
        : { color: null, active: false }),
    },
  ]
  const names: Record<ColId, string> = { intake: 'Intake', shape: 'Shape', grill: 'Grill', plan: 'Plan', build: 'Build', review: 'Review', done: 'Done' }
  const frontSeg = [...segs].reverse().find(x => x.active)
  const front = frontSeg ? names[frontSeg.id] : s.total || s.prs.merged ? 'Done' : '—'
  const you = s.intake.you + s.shape.you + s.grill.you + s.build.you + (s.handover ? 1 : 0) + (s.landed && !s.retro ? 1 : 0)
  const agents = s.shape.building + s.grill.building + s.build.building + s.intake.building
  const ready = s.shape.afk + s.grill.afk + s.build.afk + s.intake.afk
  const pieces = [
    s.doneTiles ? `${s.doneTiles}/${s.total} done` : '',
    you ? `${you} HITL` : '',
    agents ? `${agents} in agents` : '',
    ready ? `${ready} ready` : '',
    s.prs.open ? `${s.prs.open} PR${s.prs.open === 1 ? '' : 's'}` : '',
    s.fog ? `${s.fog} fog` : '',
  ].filter(Boolean)
  return { segs, front, bits: pieces.slice(0, 4).join(' · ') }
}

export function StationGlanceBar({ glance }: { glance: Glance }) {
  return (
    <span style={{ display: 'flex', gap: 2, height: 5 }} aria-hidden>
      {glance.segs.map(x => (
        <span key={x.id} title={x.id} style={{
          flex: 1, borderRadius: 3,
          background: x.color ?? 'transparent',
          border: x.color ? '1px solid transparent' : '1px solid var(--border)',
          opacity: x.color && !x.active ? 0.75 : 1,
        }} />
      ))}
    </span>
  )
}

// The conductor's right panel: the effort as seven stations, each a counter in
// its own units (Grill counts questions, Build counts tickets), never a wall of
// cards. Every bar is normalized to its own station. Click a station for its
// queue; click a queue row for that ticket's session. An effort has a front and
// a tail, not one stage: the header says both.

const ORDER: ColId[] = ['intake', 'shape', 'grill', 'plan', 'build', 'review', 'done']
const ENTRY: Record<Start, ColId> = { idea: 'grill', small: 'grill', huge: 'shape', issue: 'intake', bug: 'build' }
const START_LABEL: Record<Start, string> = { idea: 'an idea', small: 'small', huge: 'huge', issue: 'an issue', bug: 'a bug' }
const UNITS: Record<ColId, string> = {
  intake: 'source issues', shape: 'map tickets', grill: 'questions', plan: 'spec → tickets',
  build: 'tickets', review: 'PRs', done: 'merged · retro',
}
const LABELS: Record<ColId, string> = {
  intake: 'Intake', shape: 'Shape', grill: 'Grill', plan: 'Plan', build: 'Build', review: 'Review', done: 'Done',
}

type Row = {
  key: string; number?: number; title: string; tile?: Tile
  chip: { label: string; color: string; solid?: boolean }
  url?: string; pulse?: boolean
  onOpen?: () => void // a stage conversation's row: opens that conversation
  questions?: number  // unanswered decisions waiting on the human in its conversation
  selKeys?: string[]  // focus keys that mean this row is the open conversation
  live?: SessionActivity // a running session's last output: elapsed + first line
  attention?: boolean // waiting on the human (trust prompt, question): pulse amber
}
type Station = {
  id: ColId
  state: 'skipped' | 'queued' | 'live' | 'full'
  count: ReactNode          // the right-hand counter, in this station's units
  ghost?: string            // queued stations: what will show here
  segments: { n: number; color: string; dashed?: boolean }[]
  rows: Row[]
  action?: { label: string; onClick: () => void; confirm?: () => void } // confirm: a cancel step is showing
}

const seg = (n: number, state: Tile['state']): Station['segments'][number] => ({ n, color: STATE_META[state].color })

export function StationsPanel({ detail, statuses, activity, busy, autopilot, selectedKey, embedded, compact, onAutopilot, onOpenTile, onOpenConversation, onSelectConductor, onJumpQuestions, onHandover, onReview, onRetro, onClose }: {
  detail: EffortDetail
  statuses: Record<number, SessionStatus>
  // A running session's last output (time + first line), for the live line
  // under its row: what each agent is doing, without opening the session.
  activity?: Record<number, SessionActivity>
  busy: boolean
  autopilot: boolean
  selectedKey: string | null // the open conversation's focus key; its row reads as selected
  embedded?: boolean // inside the sidebar, under the effort's row: flows with the rail's scroll
  compact?: boolean  // a narrow rail: drop the units column and tighten padding
  onAutopilot: (on: boolean) => void
  onOpenTile: (t: Tile) => void
  onOpenConversation: (key: string) => void // back into a stage conversation (plan, review, done, …, build-spec)
  onSelectConductor: () => void
  onJumpQuestions: () => void // jump to the next conversation with open questions
  onHandover: () => void
  onReview: () => void
  onRetro: () => void
  onClose: () => void // close the effort and its issue (confirmed inline, Done station)
}) {
  const [confirmClose, setConfirmClose] = useState(false)
  // Unanswered decisions waiting on the human, per conversation. A done
  // ticket's unanswered entries are settled history, never counted.
  const qFor = (key?: string | null) =>
    key ? (detail.sessionStates?.[key]?.decisions ?? []).filter(d => !d.answer).length : 0
  const conductorQ = ((detail.sessionStates?.conductor ?? detail.state)?.decisions ?? []).filter(d => !d.answer).length
  const qChip = (n: number): Row['chip'] =>
    ({ label: n === 1 ? '1 question' : `${n} questions`, color: STATE_META.you.color })
  const f = detail.frontier
  const tiles = f?.tiles ?? []
  const fogItems = f?.fogItems?.length ? f.fogItems : f?.fogLeft ?? []
  const fogLeft = !f?.fogItems?.length && !!f?.fogLeft?.length
  const byCol = new Map<ColId, Tile[]>(ORDER.map(c => [c, []]))
  for (const t of tiles) byCol.get(columnOf(t))!.push(t)
  // Done tiles still belong to their home station's counter (Grill's "answered"
  // is its closed questions); the Done station counts them all.
  const home = (t: Tile): ColId => (t.source ? 'intake' : t.type === 'build' ? 'build' : t.type === 'grilling' ? 'grill' : 'shape')
  const byHome = new Map<ColId, Tile[]>(ORDER.map(c => [c, []]))
  for (const t of tiles) byHome.get(home(t))!.push(t)

  const entry = ENTRY[detail.start] ?? 'grill'
  const entryAt = ORDER.indexOf(entry)
  const buildTiles = byHome.get('build')!
  const specArtifact = detail.artifacts.find(a => a.label === 'Spec' || a.label.startsWith('Spec'))
  const openPrs = detail.prs.filter(p => p.state === 'OPEN')
  const mergedPrs = detail.prs.filter(p => p.state === 'MERGED')
  const doneCount = tiles.filter(t => t.state === 'done').length
  const retroRan = !!detail.sessions.done

  const tileRow = (t: Tile): Row => {
    const q = t.state !== 'done' ? qFor(t.sessionKey) : 0
    const st = statuses[t.number]
    const needs = st === 'attention' ? activity?.[t.number]?.needs ?? null : null
    const busy_ = st === 'running' || st === 'attention'
    return {
      key: `t${t.number}`,
      number: t.number,
      title: t.title,
      tile: t,
      // What needs the human outranks the state: a recorded question, then a
      // trust prompt or an unrecorded ask straight from the session.
      chip: q ? qChip(q)
        : needs === 'approval' ? { label: 'trust prompt', color: STATE_META.you.color }
        : needs === 'input' ? { label: 'asking', color: STATE_META.you.color }
        : { label: STATE_META[t.state].label, color: t.state === 'done' ? STATE_META.done.text : STATE_META[t.state].color, solid: t.state === 'you' || t.state === 'afk' },
      pulse: busy_,
      // Needing the human pulses amber (chip and dot), not the quiet blue.
      attention: st === 'attention' || q > 0,
      // Only a busy row carries its live line; idle ones stay one line tall.
      live: busy_ ? activity?.[t.number] : undefined,
      questions: q,
      selKeys: [`build-t${t.number}`, `shape-t${t.number}`, `review-t${t.number}`],
    }
  }
  const counts = (ts: Tile[]) => {
    const by = (s: Tile['state']) => ts.filter(t => t.state === s).length
    return { done: by('done'), you: by('you'), afk: by('afk'), building: by('building'), review: by('review'), blocked: by('blocked') }
  }
  const sortRows = (ts: Tile[]) => {
    const order: Tile['state'][] = ['you', 'building', 'afk', 'review', 'blocked', 'done']
    return [...ts].sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state) || a.number - b.number)
  }

  // A station's own conversation, as a row you can always get back into. The
  // ticket rows open ticket sessions; this row opens the stage's conversation.
  const CONV_LABEL: Record<string, string> = {
    intake: 'The intake conversation', shape: 'Charting the map', grill: 'The grill interview',
    plan: 'Writing the spec', 'build-spec': 'Building every ready ticket',
    review: 'Reviewing the PRs', done: 'The retro',
  }
  const convRow = (key: string): Row[] => {
    const slot = detail.sessions[key]
    if (!slot || isClosed(slot)) return []
    const q = qFor(key)
    return [{
      key: `conv-${key}`, title: CONV_LABEL[key] ?? 'Its conversation',
      chip: q ? qChip(q) : { label: 'conversation', color: 'var(--accent)' },
      onOpen: () => onOpenConversation(key),
      questions: q,
      selKeys: [key],
    }]
  }

  const stations: Station[] = ORDER.map(id => {
    const own = byHome.get(id)!
    const conv = convRow(id === 'build' ? 'build-spec' : id)
    if (id === 'plan') {
      if (buildTiles.length || specArtifact) {
        return { id, state: 'full', count: <><b style={strong}>1 spec</b> → {buildTiles.length || '?'} tickets</>, segments: [{ n: 1, color: STATE_META.done.color }], rows: conv }
      }
      if (f?.handover) {
        return {
          id, state: 'live', count: <b style={{ color: STATE_META.you.color }}>at the handover</b>,
          segments: [{ n: 1, color: STATE_META.you.color }], rows: conv,
          // Once the conversation exists, its row above is the way back in.
          action: conv.length ? undefined : { label: 'Write the spec', onClick: onHandover },
        }
      }
      const waits = tiles.filter(t => t.lane === 'decide' && t.state !== 'done').length
      return { id, state: 'queued', count: '', ghost: `/to-spec then /to-tickets, in the grill's conversation · waits on ${waits || 'the'} decision${waits === 1 ? '' : 's'}${fogItems.length ? ` and ${fogItems.length} fog` : ''}`, segments: [], rows: conv }
    }
    if (id === 'review') {
      if (!openPrs.length && !mergedPrs.length && !conv.length) return { id, state: 'queued', count: '', ghost: 'each PR reviewed, clean ones merged by Merge Danger', segments: [], rows: [] }
      return {
        id,
        state: openPrs.length ? 'live' : 'full',
        count: <><b style={strong}>{mergedPrs.length} merged</b>{openPrs.length ? <> · {openPrs.length} waiting</> : null}</>,
        segments: [{ n: mergedPrs.length, color: STATE_META.done.color }, { n: openPrs.length, color: STATE_META.review.color }],
        // A PR's row opens its ticket's review conversation; the PR itself is
        // linked from the right panel's ticket tab. GitHub only when KiPo
        // can't tell which ticket the PR belongs to.
        rows: [...conv, ...openPrs.map((p): Row => {
          const t = p.tickets[0]
          return {
            key: `pr${p.number}`, number: p.number, title: p.title,
            chip: { label: 'open', color: STATE_META.review.color },
            ...(t != null
              ? { onOpen: () => onOpenConversation(`review-t${t}`), selKeys: [`review-t${t}`] }
              : { url: p.url }),
          }
        })],
        action: openPrs.length && !conv.length ? { label: 'Review the PRs', onClick: onReview } : undefined,
      }
    }
    if (id === 'done') {
      const landed = !!f?.landed
      // The map closes on GitHub with its last ticket; only a KiPo effort closes here.
      const canClose = landed && retroRan && detail.kind !== 'map'
      return {
        id,
        state: doneCount ? (landed ? 'live' : 'full') : 'queued',
        count: doneCount ? <><b style={strong}>{doneCount} of {tiles.length}</b> · {retroRan ? 'retro ran' : 'retro not yet'}</> : '',
        ghost: doneCount ? undefined : 'closes when the retro runs',
        segments: [{ n: doneCount, color: STATE_META.done.color }, { n: Math.max(0, tiles.length - doneCount), color: 'transparent' }],
        // Every done ticket is listed here (its home station only counts it).
        rows: [...conv, ...tiles.filter(t => t.state === 'done').sort((a, b) => a.number - b.number).map(tileRow)],
        action: landed && !retroRan
          ? { label: 'Run /retro', onClick: onRetro }
          : canClose
            ? (confirmClose
              ? { label: 'Close the effort and its issue?', onClick: () => { setConfirmClose(false); onClose() }, confirm: () => setConfirmClose(false) }
              : { label: 'Close effort', onClick: () => setConfirmClose(true) })
            : undefined,
      }
    }
    // Tile stations: intake, shape, grill, build.
    if (!own.length && !(id === 'shape' && fogItems.length) && !conv.length) {
      if (ORDER.indexOf(id) < entryAt) return { id, state: 'skipped', count: `entered at ${LABELS[entry]}`, segments: [], rows: [] }
      if (id === 'build') return { id, state: 'queued', count: '', ghost: 'cut from the spec · done, in agents, ready, blocked', segments: [], rows: [] }
      return { id, state: 'skipped', count: 'nothing here', segments: [], rows: [] }
    }
    const c = counts(own)
    const live = c.you + c.afk + c.building + c.review + c.blocked > 0 || (!own.length && conv.length > 0)
    const bits: string[] = []
    if (id === 'grill') { if (c.done) bits.push(`${c.done} answered`); if (c.you) bits.push(`${c.you} waiting`) }
    else { if (c.done) bits.push(`${c.done} done`) ; if (c.you) bits.push(`${c.you} HITL`) }
    if (c.building) bits.push(`${c.building} in agents`)
    if (c.afk) bits.push(`${c.afk} ready`)
    if (c.review) bits.push(`${c.review} in review`)
    if (c.blocked) bits.push(`${c.blocked} blocked`)
    const segments = [seg(c.done, 'done'), seg(c.building, 'building'), seg(c.review, 'review'), seg(c.you, 'you'), seg(c.afk, 'afk'), seg(c.blocked, 'blocked')]
    if (id === 'shape' && fogItems.length) segments.push({ n: fogItems.length, color: 'transparent', dashed: true })
    // The queue is only the OPEN work (plus the station's conversation). Done
    // tickets are counted here ("5 answered") but listed in one place: Done.
    const rows = [...conv, ...sortRows(own.filter(t => t.state !== 'done')).map(tileRow)]
    if (id === 'shape') {
      fogItems.forEach((t, i) => rows.push({
        key: `fog${i}`, title: plain(t),
        chip: fogLeft ? { label: 'left unspecified', color: STATE_META.you.color } : { label: 'fog', color: 'var(--muted)' },
      }))
    }
    return {
      id, state: live ? 'live' : 'full',
      count: <>{bits.map((b, i) => i === 0 ? <b key={b} style={strong}>{b}</b> : <span key={b}> · {b}</span>)}{id === 'shape' && fogItems.length ? <span> · {fogItems.length} fog</span> : null}</>,
      segments, rows,
    }
  })

  // Front and tail: the furthest station with open work, and the earliest one
  // before it still waiting on a human.
  const hasOpen = (s: Station) => s.state === 'live'
  const frontIdx = stations.reduce((a, s, i) => (hasOpen(s) ? i : a), -1)
  const front = frontIdx >= 0 ? stations[frontIdx] : null

  // An effort with mixed tickets isn't "at" one stage — saying "Front: Review"
  // when work is spread across Build, Review and Done reads as nonsense. The
  // header is an honest roll-up of every ticket's state instead.
  const all = counts(tiles)
  const total = tiles.length
  const overview = [
    { n: all.building, label: 'in agents', color: STATE_META.building.color },
    { n: all.review, label: 'in review', color: STATE_META.review.color },
    { n: all.you, label: 'HITL', color: STATE_META.you.color },
    { n: all.afk, label: 'ready', color: STATE_META.afk.color },
    { n: all.blocked, label: 'blocked', color: STATE_META.blocked.color },
    { n: fogItems.length, label: 'fog', color: 'var(--muted)' },
  ].filter(x => x.n > 0)

  // Any number of stations open at once; the furthest active one starts open.
  const [open, setOpen] = useState<Set<ColId>>(() => new Set(front ? [front.id] : []))
  const toggle = (id: ColId) => setOpen(o => {
    const next = new Set(o)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const totalQ = conductorQ + stations.reduce((a, s) => a + s.rows.reduce((x, r) => x + (r.questions ?? 0), 0), 0)
  const conductorSelected = selectedKey === 'conductor'
  const conductorOpen = !!detail.sessions.conductor && !isClosed(detail.sessions.conductor)

  const pad = compact ? 10 : 16
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, ...(embedded ? {} : { height: '100%' }) }}>
      {/* The effort's title lives in its row (or the top bar); this header
          carries only what the spine itself says. */}
      <div style={{ padding: `10px ${pad}px 9px`, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ ...muted, fontSize: T.tiny, flex: 1 }}>entered at {LABELS[entry]} ({START_LABEL[detail.start] ?? detail.start})</span>
          {/* In the sidebar the row's ⋯ menu already opens GitHub. */}
          {!embedded && <a href={detail.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: T.tiny, whiteSpace: 'nowrap' }}>Open on GitHub</a>}
        </div>
        <div style={{ fontSize: T.small, marginTop: 5, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 10px' }}>
          {total > 0
            ? (<>
                <span style={{ whiteSpace: 'nowrap' }}>
                  <b style={{ color: STATE_META.done.text }}>{all.done} of {total}</b> <span style={muted}>done</span>
                </span>
                {overview.map(x => (
                  <span key={x.label} style={{ whiteSpace: 'nowrap' }}>
                    <b style={{ color: x.color }}>{x.n}</b> <span style={muted}>{x.label}</span>
                  </span>
                ))}
              </>)
            : <span style={muted}>{fogItems.length ? `${fogItems.length} in the fog, nothing cut yet` : 'nothing cut yet'}</span>}
        </div>
        {totalQ > 0 && (
          <button type="button" onClick={onJumpQuestions}
            title="Jump to the next conversation with open questions; answer them on the right"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '2px 9px', borderRadius: 99,
              background: STATE_META.you.color, color: '#14121c', fontSize: T.tiny, fontWeight: 700, cursor: 'pointer', border: 0 }}>
            {totalQ === 1 ? '1 question waiting on you' : `${totalQ} questions waiting on you`} →
          </button>
        )}
        <button type="button" aria-pressed={autopilot} onClick={() => onAutopilot(!autopilot)}
          title="When a ticket closes and frees the next Deliver ticket an agent can take, KiPo starts it. Runs while this effort is open in KiPo."
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', padding: 0, marginTop: 5, cursor: 'pointer',
            fontSize: T.tiny, color: autopilot ? STATE_META.afk.text : 'var(--muted)' }}>
          <span aria-hidden className={autopilot ? 'kipo-pulse' : undefined}
            style={{ width: 7, height: 7, borderRadius: 999, background: autopilot ? STATE_META.afk.color : 'var(--muted)' }} />
          Autopilot {autopilot ? 'on' : 'off'}: freed agent tickets {autopilot ? 'start on their own' : 'wait for you'}
        </button>
      </div>

      <div style={embedded ? undefined : { flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {/* The conductor: the one conversation you drive the effort from, so it
            reads as a button, not another row. Selected = filled accent. */}
        <div style={{ padding: `9px ${pad}px`, borderBottom: '1px solid var(--border)' }}>
          <button type="button" onClick={onSelectConductor}
            title="The conductor runs this effort: it watches the frontier, dispatches conversations and asks you in one batch. This is where you talk."
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 12px',
              borderRadius: 8, cursor: 'pointer', fontSize: T.small, fontWeight: 700,
              border: '1px solid var(--accent)',
              background: conductorSelected ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 12%, transparent)',
              color: conductorSelected ? 'var(--accent-fg, #fff)' : 'var(--accent)' }}>
            <MessageSquare size={14} aria-hidden style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>Conductor</span>
            {conductorQ > 0
              ? <span className="kipo-pulse" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', padding: '1px 6px',
                  borderRadius: 99, whiteSpace: 'nowrap',
                  border: `1px solid ${conductorSelected ? 'var(--accent-fg, #fff)' : STATE_META.you.color}`,
                  color: conductorSelected ? 'var(--accent-fg, #fff)' : STATE_META.you.color }}>
                  {conductorQ === 1 ? '1 question' : `${conductorQ} questions`}
                </span>
              : <span style={{ fontSize: T.tiny, fontWeight: 400, opacity: 0.75 }}>{conductorOpen ? 'conversation' : 'not started'}</span>}
          </button>
        </div>
        {stations.map(s => <StationRow key={s.id} s={s} busy={busy} open={open.has(s.id)} selectedKey={selectedKey} compact={compact}
          onToggle={() => toggle(s.id)} onOpenTile={onOpenTile} />)}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: `9px ${pad}px`, fontSize: T.tiny, color: 'var(--muted)', flexWrap: 'wrap' }}>
          <Sw color={STATE_META.done.color} label="done" />
          <Sw color={STATE_META.building.color} label="in agents" />
          <Sw color={STATE_META.you.color} label="HITL" />
          <Sw color={STATE_META.afk.color} label="ready" />
          <Sw color={STATE_META.blocked.color} label="blocked" />
        </div>
      </div>
    </div>
  )
}

function Sw({ color, label }: { color: string; label: string }) {
  return <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: color, marginRight: 4, verticalAlign: -1 }} />{label}</span>
}

function StationRow({ s, open, busy, selectedKey, compact, onToggle, onOpenTile }: {
  s: Station; open: boolean; busy: boolean; selectedKey: string | null; compact?: boolean; onToggle: () => void; onOpenTile: (t: Tile) => void
}) {
  const dim = s.state === 'skipped' || s.state === 'queued'
  const expandable = s.rows.length > 0 || !!s.action
  const col = COLUMN_DEFS.find(c => c.id === s.id)
  const total = s.segments.reduce((a, x) => a + x.n, 0)
  const stationQ = s.rows.reduce((a, r) => a + (r.questions ?? 0), 0)
  return (
    <div style={{ borderBottom: '1px solid var(--border)', background: open ? 'var(--bg-elevated)' : undefined,
      borderLeft: open ? `2px solid ${STATE_META.you.color}` : '2px solid transparent' }}>
      <button type="button" onClick={expandable ? onToggle : undefined} aria-expanded={expandable ? open : undefined}
        title={col ? `${LABELS[s.id]} · ${col.skill}\n${col.what}` : undefined}
        style={{ display: 'block', width: '100%', textAlign: 'left', padding: compact ? '8px 10px 9px 6px' : '8px 16px 9px 10px', background: 'transparent',
          color: 'var(--text)', cursor: expandable ? 'pointer' : 'default', opacity: dim ? 0.55 : 1 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <ChevronRight size={12} aria-hidden style={{
            flexShrink: 0, alignSelf: 'center', color: 'var(--muted)',
            transform: open ? 'rotate(90deg)' : undefined, transition: 'transform .12s',
            visibility: expandable ? 'visible' : 'hidden',
          }} />
          <span style={{ width: compact ? 48 : 56, flexShrink: 0, fontSize: T.small, fontWeight: 700, color: dim ? 'var(--muted)' : 'var(--text-strong, var(--text))' }}
            title={compact ? UNITS[s.id] : undefined}>{LABELS[s.id]}</span>
          {!compact && <span style={{ width: 92, flexShrink: 0, fontSize: 10, color: 'var(--muted)' }}>{UNITS[s.id]}</span>}
          <span style={{ flex: 1, textAlign: 'right', fontSize: T.small, minWidth: 0 }}>
            {stationQ > 0 && (
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', padding: '1px 6px',
                borderRadius: 99, border: `1px solid ${STATE_META.you.color}`, color: STATE_META.you.color, whiteSpace: 'nowrap', marginRight: 6 }}>
                {stationQ === 1 ? '1 question' : `${stationQ} questions`}
              </span>
            )}
            {s.count}
          </span>
        </span>
        {total > 0 && (
          <span style={{ display: 'flex', gap: 1, height: 6, borderRadius: 4, overflow: 'hidden', marginTop: 6, background: 'var(--bg)' }}>
            {s.segments.filter(x => x.n > 0).map((x, i) => (
              <span key={i} style={{ flex: x.n, background: x.color, ...(x.dashed ? { border: '1px dashed var(--muted)', borderRadius: 3 } : {}) }} />
            ))}
          </span>
        )}
        {s.ghost && <span style={{ display: 'block', fontSize: T.tiny, color: 'var(--muted)', marginTop: 3, lineHeight: 1.4 }}>{s.ghost}</span>}
      </button>
      {open && expandable && (
        <div style={{ margin: compact ? '0 10px 10px 8px' : '0 16px 10px 14px', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg)' }}>
          {s.action && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: s.rows.length ? '1px solid var(--border)' : undefined }}>
              <span style={{ ...muted, fontSize: T.tiny, flex: 1 }}>{s.action.confirm ? '' : `${LABELS[s.id]}'s next step`}</span>
              <ActionButton primary disabled={busy} onClick={s.action.onClick}>{s.action.label}</ActionButton>
              {s.action.confirm && <ActionButton disabled={busy} onClick={s.action.confirm}>Cancel</ActionButton>}
            </div>
          )}
          {s.rows.map(r => {
            const open_ = () => { if (r.onOpen) r.onOpen(); else if (r.tile) onOpenTile(r.tile); else if (r.url) window.open(r.url, '_blank', 'noreferrer') }
            const clickable = !!r.onOpen || !!r.tile || !!r.url
            const selected = !!selectedKey && !!r.selKeys?.includes(selectedKey)
            return (
              <button key={r.key} type="button" onClick={clickable ? open_ : undefined} disabled={!clickable}
                title={r.tile ? `#${r.number} ${r.title}\n${STATE_MEANING[r.tile.state]}\nClick to open its session`
                  : r.onOpen ? `${r.title}\nClick to open this conversation` : r.title}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px',
                  borderTop: '1px solid var(--border)', color: 'var(--text)', fontSize: T.small,
                  background: selected ? 'var(--bg-elevated)' : 'transparent',
                  boxShadow: selected ? 'inset 2px 0 0 var(--accent)' : undefined,
                  cursor: clickable ? 'pointer' : 'default' }}
                onMouseEnter={e => { if (clickable && !selected) e.currentTarget.style.background = 'var(--bg-hover, var(--bg-elevated))' }}
                onMouseLeave={e => { e.currentTarget.style.background = selected ? 'var(--bg-elevated)' : 'transparent' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ ...muted, fontSize: T.tiny, width: 42, flexShrink: 0, fontVariantNumeric: 'tabular-nums', display: 'inline-flex', alignItems: 'center' }}>
                    {r.number != null ? `#${r.number}` : r.onOpen ? <MessageSquare size={11} aria-hidden /> : '☁'}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</span>
                  {r.pulse && <span className="kipo-pulse" style={{ width: 6, height: 6, borderRadius: 9,
                    background: r.attention ? STATE_META.you.color : STATE_META.building.color, flexShrink: 0 }} />}
                  <span className={r.attention ? 'kipo-pulse' : undefined}
                    style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', padding: '1px 6px',
                    borderRadius: 99, flexShrink: 0, whiteSpace: 'nowrap',
                    color: r.chip.solid ? '#14121c' : r.chip.color, background: r.chip.solid ? r.chip.color : 'transparent',
                    border: r.chip.solid ? '1px solid transparent' : `1px solid ${r.chip.color}` }}>
                    {r.chip.label}
                  </span>
                </span>
                {/* The live line: what this running agent last said, and when. */}
                {r.live && (
                  <span title={r.live.line ?? undefined}
                    style={{ display: 'block', marginTop: 3, paddingLeft: 50, fontSize: T.tiny, color: 'var(--muted)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ color: STATE_META.building.color }}>{elapsed(r.live.at)}</span>
                    {r.live.line ? <> · {r.live.line}</> : null}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const plain = (md: string) => md.replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

// How long since a running session's last output: "2m", "1h", "just now".
function elapsed(at: string | null): string {
  const t = at ? Date.parse(at) : NaN
  if (Number.isNaN(t)) return 'running'
  const mins = Math.round((Date.now() - t) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  return `${Math.round(mins / 60)}h`
}
