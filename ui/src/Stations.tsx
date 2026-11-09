import { useState, type ReactNode } from 'react'
import { ActionButton, T, muted, strong } from './common'
import { STATE_META, type SessionStatus } from './Frontier'
import { STATE_MEANING } from './glossary'
import { COLUMN_DEFS, columnOf, type ColId } from './StageBoard'
import type { EffortDetail, Start, Tile } from './types'

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

type Row = { key: string; number?: number; title: string; tile?: Tile; chip: { label: string; color: string; solid?: boolean }; url?: string; pulse?: boolean }
type Station = {
  id: ColId
  state: 'skipped' | 'queued' | 'live' | 'full'
  count: ReactNode          // the right-hand counter, in this station's units
  ghost?: string            // queued stations: what will show here
  segments: { n: number; color: string; dashed?: boolean }[]
  rows: Row[]
  action?: { label: string; onClick: () => void }
}

const seg = (n: number, state: Tile['state']): Station['segments'][number] => ({ n, color: STATE_META[state].color })

export function StationsPanel({ detail, statuses, busy, onOpenTile, onHandover, onReview, onRetro }: {
  detail: EffortDetail
  statuses: Record<number, SessionStatus>
  busy: boolean
  onOpenTile: (t: Tile) => void
  onHandover: () => void
  onReview: () => void
  onRetro: () => void
}) {
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

  const tileRow = (t: Tile): Row => ({
    key: `t${t.number}`,
    number: t.number,
    title: t.title,
    tile: t,
    chip: { label: STATE_META[t.state].label, color: t.state === 'done' ? STATE_META.done.text : STATE_META[t.state].color, solid: t.state === 'you' || t.state === 'afk' },
    pulse: statuses[t.number] === 'running',
  })
  const counts = (ts: Tile[]) => {
    const by = (s: Tile['state']) => ts.filter(t => t.state === s).length
    return { done: by('done'), you: by('you'), afk: by('afk'), building: by('building'), review: by('review'), blocked: by('blocked') }
  }
  const sortRows = (ts: Tile[]) => {
    const order: Tile['state'][] = ['you', 'building', 'afk', 'review', 'blocked', 'done']
    return [...ts].sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state) || a.number - b.number)
  }

  const stations: Station[] = ORDER.map(id => {
    const own = byHome.get(id)!
    if (id === 'plan') {
      if (buildTiles.length || specArtifact) {
        return { id, state: 'full', count: <><b style={strong}>1 spec</b> → {buildTiles.length || '?'} tickets</>, segments: [{ n: 1, color: STATE_META.done.color }], rows: [] }
      }
      if (f?.handover) {
        return {
          id, state: 'live', count: <b style={{ color: STATE_META.you.color }}>at the handover</b>,
          segments: [{ n: 1, color: STATE_META.you.color }], rows: [],
          action: { label: 'Write the spec', onClick: onHandover },
        }
      }
      const waits = tiles.filter(t => t.lane === 'decide' && t.state !== 'done').length
      return { id, state: 'queued', count: '', ghost: `/to-spec then /to-tickets, in the grill's conversation · waits on ${waits || 'the'} decision${waits === 1 ? '' : 's'}${fogItems.length ? ` and ${fogItems.length} fog` : ''}`, segments: [], rows: [] }
    }
    if (id === 'review') {
      if (!openPrs.length && !mergedPrs.length) return { id, state: 'queued', count: '', ghost: 'each PR reviewed, clean ones merged by Merge Danger', segments: [], rows: [] }
      return {
        id,
        state: openPrs.length ? 'live' : 'full',
        count: <><b style={strong}>{mergedPrs.length} merged</b>{openPrs.length ? <> · {openPrs.length} waiting</> : null}</>,
        segments: [{ n: mergedPrs.length, color: STATE_META.done.color }, { n: openPrs.length, color: STATE_META.review.color }],
        rows: openPrs.map(p => ({
          key: `pr${p.number}`, number: p.number, title: p.title, url: p.url,
          chip: { label: 'open', color: STATE_META.review.color },
        })),
        action: openPrs.length ? { label: 'Review the PRs', onClick: onReview } : undefined,
      }
    }
    if (id === 'done') {
      const landed = !!f?.landed
      return {
        id,
        state: doneCount ? (landed ? 'live' : 'full') : 'queued',
        count: doneCount ? <><b style={strong}>{doneCount} of {tiles.length}</b> · {retroRan ? 'retro ran' : 'retro not yet'}</> : '',
        ghost: doneCount ? undefined : 'closes when the retro runs',
        segments: [{ n: doneCount, color: STATE_META.done.color }, { n: Math.max(0, tiles.length - doneCount), color: 'transparent' }],
        rows: [],
        action: landed && !retroRan ? { label: 'Run /retro', onClick: onRetro } : undefined,
      }
    }
    // Tile stations: intake, shape, grill, build.
    if (!own.length && !(id === 'shape' && fogItems.length)) {
      if (ORDER.indexOf(id) < entryAt) return { id, state: 'skipped', count: `entered at ${LABELS[entry]}`, segments: [], rows: [] }
      if (id === 'build') return { id, state: 'queued', count: '', ghost: 'cut from the spec · done, in agents, ready, blocked', segments: [], rows: [] }
      return { id, state: 'skipped', count: 'nothing here', segments: [], rows: [] }
    }
    const c = counts(own)
    const live = c.you + c.afk + c.building + c.review + c.blocked > 0
    const bits: string[] = []
    if (id === 'grill') { if (c.done) bits.push(`${c.done} answered`); if (c.you) bits.push(`${c.you} waiting`) }
    else { if (c.done) bits.push(`${c.done} done`) ; if (c.you) bits.push(`${c.you} HITL`) }
    if (c.building) bits.push(`${c.building} in agents`)
    if (c.afk) bits.push(`${c.afk} ready`)
    if (c.review) bits.push(`${c.review} in review`)
    if (c.blocked) bits.push(`${c.blocked} blocked`)
    const segments = [seg(c.done, 'done'), seg(c.building, 'building'), seg(c.review, 'review'), seg(c.you, 'you'), seg(c.afk, 'afk'), seg(c.blocked, 'blocked')]
    if (id === 'shape' && fogItems.length) segments.push({ n: fogItems.length, color: 'transparent', dashed: true })
    const rows = sortRows(own).map(tileRow)
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
  const tail = stations.find((s, i) => i < frontIdx && s.rows.some(r => r.tile?.state === 'you'))
  const waitingInTail = tail ? tail.rows.filter(r => r.tile?.state === 'you').length : 0

  const [open, setOpen] = useState<ColId | null>(() => (front ? front.id : null))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <div style={{ padding: '10px 16px 9px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ ...strong, fontSize: T.body, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={detail.title}>
            {detail.title}
          </span>
          <a href={detail.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: T.tiny, whiteSpace: 'nowrap' }}>Open on GitHub</a>
        </div>
        <div style={{ ...muted, fontSize: T.tiny, marginTop: 2 }}>entered at {LABELS[entry]} ({START_LABEL[detail.start] ?? detail.start})</div>
        <div style={{ fontSize: T.small, marginTop: 5 }}>
          Front: <b style={{ color: front ? STATE_META.you.color : STATE_META.done.text }}>{front ? LABELS[front.id] : 'Done'}</b>
          {' · '}
          {tail
            ? <>behind it: <b style={strong}>{waitingInTail} waiting in {LABELS[tail.id]}</b></>
            : <span style={muted}>behind it: nothing earlier open</span>}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {stations.map(s => <StationRow key={s.id} s={s} busy={busy} open={open === s.id}
          onToggle={() => setOpen(o => (o === s.id ? null : s.id))} onOpenTile={onOpenTile} />)}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '9px 16px', fontSize: T.tiny, color: 'var(--muted)', flexWrap: 'wrap' }}>
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

function StationRow({ s, open, busy, onToggle, onOpenTile }: {
  s: Station; open: boolean; busy: boolean; onToggle: () => void; onOpenTile: (t: Tile) => void
}) {
  const dim = s.state === 'skipped' || s.state === 'queued'
  const expandable = s.rows.length > 0 || !!s.action
  const col = COLUMN_DEFS.find(c => c.id === s.id)
  const total = s.segments.reduce((a, x) => a + x.n, 0)
  return (
    <div style={{ borderBottom: '1px solid var(--border)', background: open ? 'var(--bg-elevated)' : undefined,
      borderLeft: open ? `2px solid ${STATE_META.you.color}` : '2px solid transparent' }}>
      <button type="button" onClick={expandable ? onToggle : undefined} aria-expanded={expandable ? open : undefined}
        title={col ? `${LABELS[s.id]} · ${col.skill}\n${col.what}` : undefined}
        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px 9px 14px', background: 'transparent',
          color: 'var(--text)', cursor: expandable ? 'pointer' : 'default', opacity: dim ? 0.55 : 1 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ width: 56, flexShrink: 0, fontSize: T.small, fontWeight: 700, color: dim ? 'var(--muted)' : 'var(--text-strong, var(--text))' }}>{LABELS[s.id]}</span>
          <span style={{ width: 92, flexShrink: 0, fontSize: 10, color: 'var(--muted)' }}>{UNITS[s.id]}</span>
          <span style={{ flex: 1, textAlign: 'right', fontSize: T.small, minWidth: 0 }}>{s.count}</span>
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
        <div style={{ margin: '0 16px 10px 14px', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg)' }}>
          {s.action && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: s.rows.length ? '1px solid var(--border)' : undefined }}>
              <span style={{ ...muted, fontSize: T.tiny, flex: 1 }}>{LABELS[s.id]}'s next step</span>
              <ActionButton primary disabled={busy} onClick={s.action.onClick}>{s.action.label}</ActionButton>
            </div>
          )}
          {s.rows.map(r => {
            const open_ = () => { if (r.tile) onOpenTile(r.tile); else if (r.url) window.open(r.url, '_blank', 'noreferrer') }
            const clickable = !!r.tile || !!r.url
            return (
              <button key={r.key} type="button" onClick={clickable ? open_ : undefined} disabled={!clickable}
                title={r.tile ? `#${r.number} ${r.title}\n${STATE_MEANING[r.tile.state]}\nClick to open its session` : r.title}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '6px 10px',
                  borderTop: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: T.small,
                  cursor: clickable ? 'pointer' : 'default' }}
                onMouseEnter={e => { if (clickable) e.currentTarget.style.background = 'var(--bg-hover, var(--bg-elevated))' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <span style={{ ...muted, fontSize: T.tiny, width: 42, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {r.number != null ? `#${r.number}` : '☁'}
                </span>
                <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</span>
                {r.pulse && <span className="kipo-pulse" style={{ width: 6, height: 6, borderRadius: 9, background: STATE_META.building.color, flexShrink: 0 }} />}
                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', padding: '1px 6px',
                  borderRadius: 99, flexShrink: 0, whiteSpace: 'nowrap',
                  color: r.chip.solid ? '#14121c' : r.chip.color, background: r.chip.solid ? r.chip.color : 'transparent',
                  border: r.chip.solid ? '1px solid transparent' : `1px solid ${r.chip.color}` }}>
                  {r.chip.label}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const plain = (md: string) => md.replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
