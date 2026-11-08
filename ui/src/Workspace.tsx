import { ChatEmbed, useAppApi, type ChatEmbedSendMeta } from '@kirocrew/app-sdk'
import { Badge, Btn, MarkdownRenderer } from '@kirocrew/app-sdk/ui'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BackendError, backend, errorText } from './api'
import {
  ActionButton, ErrorLine, PathChip, StartBadge, T, TextButton, fieldStyle, isUrl, muted, pathText, scrollRow, strong, timeAgo,
} from './common'
import { Divider, useStoredSize } from './layout'
import { openSession } from './sessions'
import {
  BUTTONS, CHIPS, COLUMNS, COLUMN_HINTS, COLUMN_LABELS, SESSION_CONTROLS, SKILL_HINTS,
  type Artifact, type Column, type Decision, type Doc, type EffortDetail, type PhaseState, type Ticket, type TicketInfo,
} from './types'

// The workspace, after Spec Builder's: the conversation in the middle at full
// height; on the right the column row, the column's skills, what it produces,
// and what it's waiting on. Every divider can be dragged.

type Focus =
  | { kind: 'column' }
  | { kind: 'ticket'; t: number }   // a /implement session for one ticket
  | { kind: 'spec' }                // the /implement-spec session across all tickets
  | { kind: 'decision'; t: number } // a wayfinder decision ticket in Shape

const focusKey = (f: Focus, column: Column) =>
  f.kind === 'ticket' ? `build-t${f.t}` : f.kind === 'spec' ? 'build-spec' : f.kind === 'decision' ? `shape-t${f.t}` : column

export function Workspace({ repo, number, active, autoStart, onRemoved, onChanged }: {
  repo: string
  number: number
  active: boolean
  autoStart?: boolean
  onRemoved: () => void
  onChanged: () => void
}) {
  const api = useAppApi()
  const [detail, setDetail] = useState<EffortDetail | null>(null)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [focus, setFocus] = useState<Focus>({ kind: 'column' })
  const [starting, setStarting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<'skip' | 'remove' | null>(null)
  const [wide, setWide] = useState(false)
  const [viewColumn, setViewColumn] = useState<Column | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [rightWidth, setRightWidth] = useStoredSize('right', 560, 340, 1200)
  const [statusHeight, setStatusHeight] = useStoredSize('status', 280, 90, 900)

  const load = useCallback(() => {
    backend.getInitiative(repo, number)
      .then(d => { setDetail(d); setLoadError('') })
      .catch(e => setLoadError(errorText(e)))
  }, [repo, number])

  useEffect(() => {
    load()
    if (!active) return
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [load, active])

  const column = detail?.column
  useEffect(() => { setConfirm(null); setActionError(''); setViewColumn(null) }, [column, focus])
  useEffect(() => { setFocus({ kind: 'column' }) }, [column])
  useEffect(() => { if (!sent) return; const id = setTimeout(() => setSent(null), 4000); return () => clearTimeout(id) }, [sent])

  const key = detail ? focusKey(focus, detail.column) : null
  const slotKey = detail && key ? detail.sessions[key] ?? null : null
  const ticket = detail && focus.kind === 'ticket' ? detail.tickets.find(t => t.number === focus.t) ?? null : null

  // Open (or continue) the session for the current focus, optionally starting a skill.
  const start = async (skill: string | null = null, override?: Focus) => {
    if (!detail) return
    const f = override ?? focus
    setStarting(true)
    setActionError('')
    try {
      const body = f.kind === 'ticket' ? { column: 'build' as Column, ticket: f.t, skill: skill ?? 'implement' }
        : f.kind === 'spec' ? { column: 'build' as Column, mode: 'implement-spec' as const, skill: skill ?? 'implement-spec' }
        : f.kind === 'decision' ? { column: 'shape' as Column, ticket: f.t, skill }
        : { column: detail.column, skill }
      const res = await backend.startSession(repo, number, body)
      const title = f.kind === 'ticket' ? `${detail.title}: #${f.t}`
        : f.kind === 'spec' ? `${detail.title}: implement-spec`
        : f.kind === 'decision' ? `${detail.title}: decision #${f.t}`
        : `${detail.title}: ${COLUMN_LABELS[detail.column]}`
      if (res.existing) {
        // Grill and Plan share one conversation: carry on in it.
        await api.post('/api/chat?ws=1', { slot: res.slotName, message: res.seed })
      } else {
        await openSession(api, repo, res.slotName, res.seed, title)
      }
      if (override) setFocus(override)
      load()
      onChanged()
    } catch (e) {
      setActionError(
        e instanceof BackendError && e.code === 'ticket_blocked' ? e.message : `Couldn't start the conversation: ${errorText(e)}`,
      )
    } finally {
      setStarting(false)
    }
  }

  // A skill button: into the open conversation, or start the conversation with it.
  const runSkill = async (skill: string) => {
    if (!detail) return
    if (skill === 'implement-spec') { await start('implement-spec', { kind: 'spec' }); return }
    if (skill === 'implement' && detail.tickets.length && focus.kind !== 'ticket') {
      setActionError('Pick a ticket below and use its Implement button: each ticket gets its own conversation.')
      return
    }
    if (!slotKey) { await start(skill); return }
    try {
      const { message } = await backend.skillMessage(repo, number, skill)
      await api.post('/api/chat?ws=1', { slot: slotKey, message })
      setSent(skill)
    } catch (e) {
      setActionError(`Couldn't start /${skill}: ${errorText(e)}`)
    }
  }

  const autoStarted = useRef(false)
  useEffect(() => {
    if (!autoStart || autoStarted.current || !detail) return
    autoStarted.current = true
    if (!detail.sessions[detail.column]) void start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, detail])

  const advance = async (force: boolean, to: Column | null = null) => {
    if (!detail) return
    setBusy(true)
    setConfirm(null)
    setActionError('')
    try {
      const wasLast = detail.column === 'done' && !to
      const d = await backend.advance(repo, number, force, to)
      if (wasLast) { onRemoved(); return }
      setDetail(d)
      onChanged()
    } catch (e) {
      setActionError(
        e instanceof BackendError && e.status === 409
          ? e.message || "The checklist isn't finished yet. Finish it, or use Skip."
          : `Couldn't move on: ${errorText(e)}`,
      )
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await backend.removeInitiative(repo, number)
      onRemoved()
    } catch (e) {
      setActionError(`Couldn't remove it: ${errorText(e)}`)
      setBusy(false)
      setConfirm(null)
    }
  }

  if (!detail) {
    return (
      <div style={{ flex: 1, padding: 24 }}>
        {loadError ? <ErrorLine>{loadError}</ErrorLine> : <span style={{ ...muted, fontSize: T.body }}>Loading…</span>}
      </div>
    )
  }

  const past = viewColumn && viewColumn !== detail.column ? viewColumn : null
  const pastState: PhaseState | null = past ? detail.history?.[past] ?? null : null
  const scopeState: PhaseState | null = past ? pastState : focus.kind === 'column' ? detail.state : null
  const shown: Column = past ?? detail.column
  const scopeLabel = focus.kind === 'ticket' ? `build #${focus.t}` : focus.kind === 'spec' ? 'implement-spec'
    : focus.kind === 'decision' ? `decision #${focus.t}` : COLUMN_LABELS[detail.column].toLowerCase()

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
      {/* Middle: the conversation. */}
      {!wide && (
        <section style={{ flex: '1 1 0', minWidth: 360, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)', minWidth: 0 }}>
            <span style={{ ...strong, fontSize: T.title, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{detail.title}</span>
            <span style={{ fontSize: T.tiny, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-elevated)', color: 'var(--accent)', border: '1px solid var(--accent)', whiteSpace: 'nowrap' }}>{scopeLabel}</span>
            <StartBadge start={detail.start} />
            <span style={{ flex: 1 }} />
            <span style={{ ...muted, fontSize: T.tiny, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260, direction: 'rtl' }} title={detail.repoPath}>
              {detail.repoPath}
            </span>
          </div>
          {focus.kind !== 'column' && (
            <div style={{ ...scrollRow, padding: '6px 16px', borderBottom: '1px solid var(--border)', fontSize: T.small, gap: 8 }}>
              <TextButton onClick={() => setFocus({ kind: 'column' })}>← {COLUMN_LABELS[detail.column]}</TextButton>
              {ticket && <a href={ticket.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>#{ticket.number}</a>}
              {ticket && <span>{ticket.title}</span>}
            </div>
          )}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {slotKey ? (
              <PhaseChat key={slotKey} slotKey={slotKey} onSkill={runSkill} sent={sent} />
            ) : (
              <NotStarted detail={detail} focus={focus} ticket={ticket} starting={starting} onStart={() => start()} />
            )}
          </div>
        </section>
      )}

      {!wide && (
        <Divider direction="vertical" label="Resize the conversation and the column panel"
          onDrag={d => setRightWidth(w => w - d)} onReset={() => setRightWidth(560)} />
      )}

      {/* Right: the columns, this column's skills, what it produces, what it waits on. */}
      <section style={{ flex: wide ? '1 1 0' : `0 0 ${rightWidth}px`, width: wide ? undefined : rightWidth, minWidth: 340, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 6px', borderBottom: '1px solid var(--border)', minWidth: 0 }}>
          <ColumnRow detail={detail} viewing={past} onPick={c => setViewColumn(c === detail.column ? null : c)} />
          <TextButton onClick={() => setWide(w => !w)} title={wide ? 'Show the conversation' : 'Widen this panel'}>{wide ? '⤡' : '⤢'}</TextButton>
          {!past && (
            <PrimaryAction detail={detail} busy={busy} confirm={confirm} setConfirm={setConfirm} onAdvance={advance} onRemove={remove} />
          )}
        </div>

        <SkillBar column={shown} used={scopeState?.skillsUsed ?? []} readOnly={!!past} disabled={starting} onRun={runSkill} />

        {actionError && <div style={{ padding: '8px 12px 0' }}><ErrorLine>{actionError}</ErrorLine></div>}

        <div style={{ flex: '1 1 0', minHeight: 80, overflowY: 'auto' }}>
          {past ? (
            <>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, fontSize: T.small }}>
                <span style={muted}>Looking back at {COLUMN_LABELS[past]}.</span>
                <span style={{ flex: 1 }} />
                <TextButton onClick={() => setViewColumn(null)}>Back to {COLUMN_LABELS[detail.column]}</TextButton>
              </div>
              <Docs repo={repo} number={number} artifacts={pastState?.artifacts ?? []}
                placeholder={pastState ? `${COLUMN_LABELS[past]} wrote no documents of its own.` : `Nothing was recorded for ${COLUMN_LABELS[past]}.`} />
            </>
          ) : detail.column === 'build' ? (
            <>
              <BuildPanel detail={detail} focus={focus} starting={starting}
                onOpen={f => setFocus(f)}
                onStart={f => start(null, f)} />
              <Docs repo={repo} number={number} artifacts={detail.artifacts} placeholder="" compact />
            </>
          ) : detail.column === 'review' ? (
            <>
              <PrPanel detail={detail} />
              <Docs repo={repo} number={number} artifacts={detail.artifacts} placeholder="" compact />
            </>
          ) : (
            <Docs repo={repo} number={number} artifacts={detail.artifacts} placeholder={COLUMN_HINTS[detail.column]} brief={detail} />
          )}
        </div>

        <Divider direction="horizontal" label="Resize the documents and the decisions"
          onDrag={d => setStatusHeight(h => h - d)} onReset={() => setStatusHeight(280)} />
        <div style={{ flex: `0 0 ${statusHeight}px`, height: statusHeight, minHeight: 0, overflowY: 'auto' }}>
          <Status detail={detail} scope={scopeState} slotKey={past ? null : slotKey} focus={focus} readOnly={!!past}
            onError={setActionError} onOpenDecisionTicket={t => setFocus({ kind: 'decision', t })} />
        </div>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------- middle column

function PhaseChat({ slotKey, onSkill, sent }: { slotKey: string; onSkill: (s: string) => void; sent: string | null }) {
  const api = useAppApi()
  const onSend = useCallback(
    (message: string, meta?: ChatEmbedSendMeta) => api.post('/api/chat?ws=1', { slot: slotKey, message, meta }),
    [api, slotKey],
  )
  // The session controls: skills that work in any column, one click above the chat box.
  const controls = (
    <div style={{ ...scrollRow, gap: 2, padding: '0 2px 4px' }}>
      <span style={{ ...muted, fontSize: T.tiny, marginRight: 4 }}>Any time:</span>
      {SESSION_CONTROLS.map(s => (
        <button key={s} type="button" onClick={() => onSkill(s)} title={SKILL_HINTS[s]}
          style={{ flexShrink: 0, height: 22, padding: '0 8px', borderRadius: 999, fontSize: T.tiny, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          /{s}
        </button>
      ))}
      {sent && <span style={{ ...muted, fontSize: T.tiny, marginLeft: 6 }}>Sent /{sent}</span>}
    </div>
  )
  return <ChatEmbed slotKey={slotKey} onSend={onSend} startAtBottom frameless aboveComposer={controls} placeholder="Reply to the agent…" />
}

function NotStarted({ detail, focus, ticket, starting, onStart }: {
  detail: EffortDetail
  focus: Focus
  ticket: TicketInfo | null
  starting: boolean
  onStart: () => void
}) {
  let title: string
  let body: string
  let action: string | null
  if (focus.kind === 'ticket') {
    if (ticket?.blockedBy.length) {
      title = `#${focus.t} is waiting on ${ticket.blockedBy.map(n => `#${n}`).join(', ')}`
      body = 'It can start once those are closed.'
      action = null
    } else if (ticket?.state === 'CLOSED') {
      title = `#${focus.t} is closed`
      body = 'Nothing left to build on this ticket.'
      action = null
    } else {
      title = `Build #${focus.t}`
      body = '/implement builds this one ticket test-first in a fresh conversation, then reviews it.'
      action = 'Implement this ticket'
    }
  } else if (focus.kind === 'spec') {
    title = 'Implement the whole spec'
    body = '/implement-spec builds every unblocked ticket in parallel on one integration branch, then one review.'
    action = 'Run /implement-spec'
  } else if (focus.kind === 'decision') {
    title = `Decision #${focus.t}`
    body = 'Work through this decision ticket from the map in its own conversation.'
    action = 'Start this decision'
  } else {
    const shared = detail.column === 'plan' && detail.sessions.grill
    title = `${COLUMN_LABELS[detail.column]} hasn't started`
    body = shared ? 'Plan continues the Grill conversation, so the spec and tickets are written with everything it learned.'
      : `${COLUMN_HINTS[detail.column]} Start it, or press one of the skill buttons on the right.`
    action = shared ? 'Continue in the Grill conversation' : `Start ${COLUMN_LABELS[detail.column]}`
  }
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ ...strong, fontSize: T.title }}>{title}</div>
        <div style={{ ...muted, fontSize: T.body, margin: '6px 0 14px', lineHeight: 1.5 }}>{body}</div>
        {action && <Btn primary disabled={starting} onClick={onStart}>{starting ? 'Starting…' : action}</Btn>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- right column: header

// The seven columns as a row of buttons that scrolls sideways when it doesn't fit.
// Columns off this effort's path are shown faded and can't be opened.
function ColumnRow({ detail, viewing, onPick }: { detail: EffortDetail; viewing: Column | null; onPick: (c: Column) => void }) {
  const row = useRef<HTMLDivElement>(null)
  const shown = viewing ?? detail.column
  const curIdx = COLUMNS.indexOf(detail.column)

  useEffect(() => {
    row.current?.querySelector<HTMLElement>('[data-shown="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [shown])

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = row.current
    if (el && Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) el.scrollLeft += e.deltaY
  }

  return (
    <div ref={row} role="tablist" aria-label="Columns" onWheel={onWheel} style={{ ...scrollRow, flex: 1, gap: 2, padding: '2px 0' }}>
      {COLUMNS.map((c, i) => {
        const onPath = detail.path.includes(c)
        const state = c === detail.column ? 'current' : i < curIdx ? (onPath ? 'done' : 'skipped') : onPath ? 'next' : 'off'
        const on = c === shown
        const clickable = state === 'done' || state === 'current'
        return (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={on}
            data-shown={on}
            disabled={!clickable}
            onClick={() => onPick(c)}
            title={state === 'skipped' || state === 'off' ? `${COLUMN_LABELS[c]} isn't on this effort's path` : COLUMN_HINTS[c]}
            style={{
              flexShrink: 0,
              height: 26,
              padding: '0 10px',
              borderRadius: 6,
              whiteSpace: 'nowrap',
              fontSize: T.small,
              fontWeight: on ? 600 : 400,
              border: `1px solid ${on ? 'var(--border)' : 'transparent'}`,
              background: on ? 'var(--bg-elevated)' : 'transparent',
              color: state === 'next' ? 'var(--muted)' : state === 'skipped' || state === 'off' ? 'var(--muted)' : 'var(--text)',
              opacity: state === 'skipped' || state === 'off' ? 0.45 : 1,
              textDecoration: state === 'skipped' ? 'line-through' : undefined,
              cursor: clickable ? 'pointer' : 'default',
            }}
          >
            <span aria-hidden style={{ color: state === 'done' ? 'var(--ok-text)' : state === 'current' ? 'var(--accent)' : 'var(--muted)', marginRight: 5, fontSize: T.tiny }}>
              {state === 'done' ? '✓' : '●'}
            </span>
            {COLUMN_LABELS[c]}
          </button>
        )
      })}
    </div>
  )
}

function PrimaryAction({ detail, busy, confirm, setConfirm, onAdvance, onRemove }: {
  detail: EffortDetail
  busy: boolean
  confirm: 'skip' | 'remove' | null
  setConfirm: (c: 'skip' | 'remove' | null) => void
  onAdvance: (force: boolean, to?: Column | null) => void
  onRemove: () => void
}) {
  const group = { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 } as const
  if (confirm) {
    return (
      <span style={{ ...group, fontSize: T.small }}>
        <span style={{ ...muted, whiteSpace: 'nowrap' }}>{confirm === 'remove' ? 'Close its issue as not planned?' : 'Move on unfinished?'}</span>
        <ActionButton danger disabled={busy} onClick={() => (confirm === 'remove' ? onRemove() : onAdvance(true))}>
          {confirm === 'remove' ? 'Remove' : 'Skip'}
        </ActionButton>
        <ActionButton disabled={busy} onClick={() => setConfirm(null)}>Cancel</ActionButton>
      </span>
    )
  }
  const idx = detail.path.indexOf(detail.column)
  const next = detail.path[idx + 1] ?? null
  const later = COLUMNS.filter(c => COLUMNS.indexOf(c) > COLUMNS.indexOf(detail.column) && c !== next)
  return (
    <span style={group}>
      {later.length > 0 && (
        <select
          value=""
          onChange={e => { if (e.target.value) onAdvance(true, e.target.value as Column) }}
          disabled={busy}
          title="Move this effort to a later column"
          style={{ ...fieldStyle, width: 'auto', height: 28, padding: '0 6px', fontSize: T.small, color: 'var(--muted)' }}
        >
          <option value="">Move to…</option>
          {later.map(c => <option key={c} value={c}>{COLUMN_LABELS[c]}</option>)}
        </select>
      )}
      <TextButton disabled={busy} onClick={() => setConfirm('remove')}>Remove</TextButton>
      {!detail.gatePassed && <TextButton disabled={busy} onClick={() => setConfirm('skip')}>Skip</TextButton>}
      <ActionButton primary disabled={busy || !detail.gatePassed} onClick={() => onAdvance(false)}>
        {busy ? 'Moving on…' : next ? `${COLUMN_LABELS[next]} →` : 'Finish'}
      </ActionButton>
    </span>
  )
}

// This column's skills: the ones you start are buttons, the ones the agent reaches
// for on its own are chips that tick once it has used them.
function SkillBar({ column, used, readOnly, disabled, onRun }: {
  column: Column
  used: string[]
  readOnly: boolean
  disabled: boolean
  onRun: (skill: string) => void
}) {
  const set = new Set(used)
  const buttons = BUTTONS[column]
  const chips = CHIPS[column]
  if (!buttons.length && !chips.length) return null
  return (
    <div style={{ ...scrollRow, gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
      {buttons.map(s => (
        <button
          key={s}
          type="button"
          disabled={readOnly || disabled}
          onClick={() => onRun(s)}
          title={SKILL_HINTS[s]}
          style={{
            flexShrink: 0,
            height: 26,
            padding: '0 10px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            fontSize: T.small,
            fontWeight: 500,
            border: `1px solid ${set.has(s) ? 'var(--ok-text)' : 'var(--accent)'}`,
            background: 'transparent',
            color: set.has(s) ? 'var(--ok-text)' : 'var(--accent)',
            cursor: readOnly || disabled ? 'default' : 'pointer',
            opacity: readOnly ? 0.7 : 1,
          }}
        >
          {set.has(s) ? '✓ ' : ''}/{s}
        </button>
      ))}
      {buttons.length > 0 && chips.length > 0 && <span aria-hidden style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />}
      {chips.map(s => (
        <span key={s} title={`${SKILL_HINTS[s] ?? ''} The agent uses this on its own.`}
          style={{ flexShrink: 0, fontSize: T.tiny, padding: '3px 8px', borderRadius: 999, background: 'var(--bg-elevated)', color: set.has(s) ? 'var(--ok-text)' : 'var(--muted)', whiteSpace: 'nowrap' }}>
          {set.has(s) ? '✓ ' : ''}{s}
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- right column: Build and Review

function BuildPanel({ detail, focus, starting, onOpen, onStart }: {
  detail: EffortDetail
  focus: Focus
  starting: boolean
  onOpen: (f: Focus) => void
  onStart: (f: Focus) => void
}) {
  const tickets = detail.tickets
  const open = tickets.filter(t => t.state === 'OPEN')
  const ready = open.filter(t => !t.blockedBy.length)
  const specLive = Boolean(detail.sessions['build-spec'])
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...strong, fontSize: T.small }}>Tickets</span>
        <span style={{ ...muted, fontSize: T.small }}>
          {tickets.length ? `${tickets.length - open.length} of ${tickets.length} closed, ${ready.length} ready to build` : 'None filed'}
        </span>
        <span style={{ flex: 1 }} />
        {tickets.length > 0 && (
          specLive
            ? <TextButton onClick={() => onOpen({ kind: 'spec' })}>Open /implement-spec</TextButton>
            : <ActionButton disabled={starting || !ready.length} onClick={() => onStart({ kind: 'spec' })} title="Build every unblocked ticket in parallel on one integration branch">Run /implement-spec</ActionButton>
        )}
      </div>
      {detail.ticketsError && <ErrorLine>Couldn't read the tickets: {detail.ticketsError}</ErrorLine>}
      {!tickets.length && (
        <div style={{ ...muted, fontSize: T.small, lineHeight: 1.5 }}>
          {detail.start === 'small' || detail.start === 'bug'
            ? 'This effort builds in the column conversation, without tickets.'
            : 'No tickets yet. Plan files them with /to-tickets; anything labelled with this effort shows up here.'}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {tickets.map(t => {
          const live = Boolean(t.sessionKey && detail.sessions[t.sessionKey])
          const on = focus.kind === 'ticket' && focus.t === t.number
          return (
            <div key={t.number} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, fontSize: T.small,
              border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: 'var(--card, var(--bg))', color: 'var(--text)',
            }}>
              <span aria-hidden style={{ color: t.state === 'CLOSED' ? 'var(--ok-text)' : t.blockedBy.length ? 'var(--muted)' : 'var(--accent)', width: 12 }}>
                {t.state === 'CLOSED' ? '✓' : t.blockedBy.length ? '○' : '●'}
              </span>
              <a href={t.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', flexShrink: 0 }}>#{t.number}</a>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(t.state === 'CLOSED' ? muted : {}) }}>{t.title}</span>
              {t.blockedBy.length > 0 && <span style={{ ...muted, fontSize: T.tiny, whiteSpace: 'nowrap' }}>waits on {t.blockedBy.map(n => `#${n}`).join(', ')}</span>}
              {t.prs.length > 0 && <span style={{ ...muted, fontSize: T.tiny, whiteSpace: 'nowrap' }}>PR {t.prs.map(n => `#${n}`).join(', ')}</span>}
              {t.state === 'OPEN' && (live
                ? <TextButton onClick={() => onOpen({ kind: 'ticket', t: t.number })}>Open</TextButton>
                : <TextButton disabled={starting || t.blockedBy.length > 0} onClick={() => onStart({ kind: 'ticket', t: t.number })}>Implement</TextButton>)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PrPanel({ detail }: { detail: EffortDetail }) {
  const prs = detail.prs
  const merged = prs.filter(p => p.state === 'MERGED').length
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ ...strong, fontSize: T.small }}>Pull requests</span>
        <span style={{ ...muted, fontSize: T.small }}>{prs.length ? `${merged} of ${prs.length} merged` : 'None yet'}</span>
      </div>
      {!prs.length && (
        <div style={{ ...muted, fontSize: T.small, lineHeight: 1.5 }}>
          PRs that close this effort's tickets, or that sit on a kipo/{detail.number} branch, show up here. Review is done when you've merged them.
        </div>
      )}
      {prs.map(p => (
        <div key={p.number} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: T.small, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card, var(--bg))', color: 'var(--text)' }}>
          <Badge variant={p.state === 'MERGED' ? 'ok' : p.state === 'CLOSED' ? 'muted' : 'aim'}>{p.state === 'OPEN' && p.isDraft ? 'draft' : p.state.toLowerCase()}</Badge>
          <a href={p.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', flexShrink: 0 }}>#{p.number}</a>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
          {p.tickets.length > 0 && <span style={{ ...muted, fontSize: T.tiny, whiteSpace: 'nowrap' }}>closes {p.tickets.map(n => `#${n}`).join(', ')}</span>}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- documents

function Docs({ repo, number, artifacts, placeholder, brief, compact }: {
  repo: string
  number: number
  artifacts: Artifact[]
  placeholder: string
  brief?: EffortDetail
  compact?: boolean
}) {
  const tabs = useMemo(() => {
    const list: { label: string; href: string | null }[] = []
    if (brief) list.push({ label: 'Brief', href: null })
    for (const a of artifacts) list.push(a)
    return list
  }, [artifacts, brief])
  const [tab, setTab] = useState(0)
  const [doc, setDoc] = useState<Doc | null>(null)
  const [error, setError] = useState('')
  const current = tabs[Math.min(tab, Math.max(0, tabs.length - 1))]
  const href = current?.href ?? null

  useEffect(() => {
    setDoc(null)
    setError('')
    if (!href) return
    let gone = false
    backend.doc(repo, number, href)
      .then(d => { if (!gone) setDoc(d) })
      .catch(e => { if (!gone) setError(errorText(e)) })
    return () => { gone = true }
  }, [repo, number, href])

  if (!tabs.length) {
    return placeholder && !compact
      ? <div style={{ padding: '12px 18px', ...muted, fontSize: T.body }}>{placeholder}</div>
      : null
  }

  return (
    <div>
      {tabs.length > 1 && (
        <div role="tablist" style={{ ...scrollRow, gap: 2, padding: '8px 12px 2px' }}>
          {tabs.map((t, i) => (
            <button key={`${t.label}-${t.href}`} role="tab" type="button" aria-selected={i === tab} onClick={() => setTab(i)}
              style={{
                flexShrink: 0, whiteSpace: 'nowrap', fontSize: T.small, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                background: i === tab ? 'var(--bg-elevated)' : 'transparent', color: i === tab ? 'var(--text)' : 'var(--muted)', fontWeight: i === tab ? 600 : 400,
              }}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div style={{ padding: '12px 18px 18px', fontSize: T.body, lineHeight: 1.55 }}>
        {!href && brief ? (
          <Brief detail={brief} placeholder={artifacts.length ? null : placeholder} />
        ) : !href ? (
          <span style={muted}>{placeholder}</span>
        ) : error ? (
          <ErrorLine>{error}</ErrorLine>
        ) : !doc ? (
          <span style={muted}>Opening {current.label}…</span>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ ...strong, fontSize: 16 }}>{doc.title}</span>
              <span style={{ flex: 1 }} />
              {doc.url && <a href={doc.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: T.small, whiteSpace: 'nowrap' }}>Open on GitHub</a>}
              {!doc.url && !isUrl(doc.href) && <PathChip path={doc.href} />}
            </div>
            <MarkdownRenderer content={doc.text} />
          </>
        )}
      </div>
    </div>
  )
}

function Brief({ detail, placeholder }: { detail: EffortDetail; placeholder: string | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ ...strong, fontSize: 16, marginBottom: 4 }}>{detail.title}</div>
        <div style={{ ...muted, fontSize: T.small }}>
          <a href={detail.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{detail.repo} #{detail.number}</a>
          <span style={{ marginLeft: 8 }}>updated {timeAgo(detail.updatedAt)}</span>
        </div>
      </div>
      <div>
        <div style={{ ...strong, fontSize: T.body, marginBottom: 2 }}>Destination</div>
        <div>{detail.destination}</div>
      </div>
      <div>
        <div style={{ ...strong, fontSize: T.body, marginBottom: 2 }}>Path</div>
        <div>{pathText(detail.path)}</div>
      </div>
      {detail.state?.summary && (
        <div>
          <div style={{ ...strong, fontSize: T.body, marginBottom: 2 }}>Where {COLUMN_LABELS[detail.column]} stands</div>
          <div>{detail.state.summary}</div>
        </div>
      )}
      {placeholder && <div style={{ ...muted, fontSize: T.small }}>{placeholder}</div>}
    </div>
  )
}

// ---------------------------------------------------------------- status (bottom of the right column)

function Status({ detail, scope, slotKey, focus, readOnly, onError, onOpenDecisionTicket }: {
  detail: EffortDetail
  scope: PhaseState | null
  slotKey: string | null
  focus: Focus
  readOnly: boolean
  onError: (m: string) => void
  onOpenDecisionTicket: (t: number) => void
}) {
  const open = scope?.decisions.filter(d => !d.answer) ?? []
  const decided = scope?.decisions.filter(d => d.answer) ?? []
  const gate = scope?.gate ?? []
  const showMap = !readOnly && focus.kind === 'column' && detail.column === 'shape' && Boolean(detail.mapIssue)

  return (
    <div style={{ padding: '10px 12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {open.length > 0 && (
        <Block title="Decisions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {open.map(d => <DecisionCard key={d.id} decision={d} slotKey={readOnly ? null : slotKey} onError={onError} />)}
          </div>
        </Block>
      )}

      {scope?.blocking && (
        <Block title="Waiting on">
          <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: T.body }}>{scope.blocking}</div>
        </Block>
      )}

      {showMap && <DecisionTickets detail={detail} onOpen={onOpenDecisionTicket} />}

      <Block title="Checklist" aside={gate.length ? `${gate.filter(g => g.done).length} of ${gate.length}` : undefined}>
        {detail.column === 'review' && !readOnly ? (
          <span style={{ ...muted, fontSize: T.small }}>
            {detail.gatePassed ? 'Every PR is merged.' : 'Done when every PR for this effort is merged.'}
          </span>
        ) : gate.length ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {gate.map(g => (
              <li key={g.id} style={{ display: 'flex', gap: 6, fontSize: T.small, lineHeight: 1.4 }}>
                <span aria-hidden style={{ color: g.done ? 'var(--ok-text)' : 'var(--muted)', width: 12, flexShrink: 0 }}>{g.done ? '✓' : '○'}</span>
                <span style={g.done ? muted : undefined}>{g.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span style={{ ...muted, fontSize: T.small }}>{focus.kind === 'column' ? 'The agent writes it when the column starts.' : 'This conversation has no checklist of its own; the column checklist covers it.'}</span>
        )}
      </Block>

      {decided.length > 0 && (
        <Block title="Decided" aside={decided.length} collapsible>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {decided.map(d => (
              <li key={d.id} style={{ fontSize: T.small, lineHeight: 1.4 }}>
                <div style={muted}>{d.title}</div>
                <div>{d.answer}</div>
              </li>
            ))}
          </ul>
        </Block>
      )}

      <Block title="Details" collapsible defaultOpen={false}>
        <div style={{ fontSize: T.small, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div><span style={muted}>Path </span>{pathText(detail.path)}</div>
          <div><span style={muted}>Checkout </span><PathChip path={detail.repoPath} /></div>
          {detail.phaseLog.length > 0 && (
            <div>
              <div style={muted}>History</div>
              {detail.phaseLog.map((l, i) => <div key={i} style={{ fontSize: T.tiny }}>{l}</div>)}
            </div>
          )}
        </div>
      </Block>
    </div>
  )
}

function Block({ title, aside, children, collapsible, defaultOpen = true }: {
  title: string
  aside?: ReactNode
  children: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const head = (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: T.tiny, marginBottom: open ? 6 : 0 }}>
      {collapsible && <span aria-hidden style={{ ...muted, fontSize: 9, width: 8 }}>{open ? '▾' : '▸'}</span>}
      <span style={{ ...strong, fontSize: T.small }}>{title}</span>
      <span style={{ flex: 1 }} />
      {aside != null && <span style={muted}>{aside}</span>}
    </div>
  )
  return (
    <div>
      {collapsible ? (
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
          style={{ width: '100%', textAlign: 'left', background: 'transparent', color: 'var(--text)', cursor: 'pointer', padding: 0 }}>
          {head}
        </button>
      ) : head}
      {open && children}
    </div>
  )
}

// A decision as Spec Builder shows one: the question, then its options as a radio
// list with the recommended one marked. A click sends the answer to the agent.
function DecisionCard({ decision: d, slotKey, onError }: { decision: Decision; slotKey: string | null; onError: (m: string) => void }) {
  const api = useAppApi()
  const [sent, setSent] = useState<string | null>(null)
  const [other, setOther] = useState('')

  const answer = async (choice: string) => {
    const text = choice.trim()
    if (!text || !slotKey) return
    setSent(text)
    try {
      await api.post('/api/chat?ws=1', { slot: slotKey, message: `${d.title}: ${text}` })
    } catch (e) {
      setSent(null)
      onError(`Couldn't send your answer: ${errorText(e)}`)
    }
  }

  return (
    <div style={{ border: '1px solid var(--accent)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 10px', fontSize: T.body }}>
        <span style={{ ...strong, flex: 1 }}>{d.title}</span>
        <Badge variant={sent ? 'muted' : 'aim'}>{sent ? 'sent' : 'pending'}</Badge>
      </div>
      {d.options.map(o => {
        const chosen = sent === o
        return (
          <button key={o} type="button" disabled={!!sent || !slotKey} onClick={() => answer(o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '7px 10px',
              borderTop: '1px solid var(--border)', background: chosen ? 'var(--bg-elevated)' : 'transparent', color: 'var(--text)',
              fontSize: T.small, cursor: sent ? 'default' : 'pointer',
            }}>
            <span aria-hidden style={{ width: 12, height: 12, borderRadius: 999, border: '1.5px solid var(--muted)', flexShrink: 0, background: chosen ? 'var(--accent)' : 'transparent' }} />
            <span style={{ flex: 1 }}>{o}</span>
            {o === d.recommended && <span style={{ fontSize: T.tiny, color: 'var(--accent)' }}>recommended</span>}
          </button>
        )
      })}
      {!sent && (
        <form onSubmit={e => { e.preventDefault(); void answer(other) }} style={{ borderTop: '1px solid var(--border)', padding: '5px 10px' }}>
          <input value={other} onChange={e => setOther(e.target.value)} disabled={!slotKey}
            placeholder={slotKey ? 'Something else… (Enter to send)' : 'Start the conversation to answer'}
            style={{ width: '100%', background: 'transparent', color: 'var(--text)', fontSize: T.small, border: 0, outline: 'none', padding: '2px 0' }} />
        </form>
      )}
    </div>
  )
}

function DecisionTickets({ detail, onOpen }: { detail: EffortDetail; onOpen: (t: number) => void }) {
  const [tickets, setTickets] = useState<Ticket[] | null>(null)
  const { repo, number } = detail
  useEffect(() => {
    backend.frontier(repo, number).then(r => setTickets(r.tickets)).catch(() => setTickets([]))
  }, [repo, number, detail.mapIssue])
  return (
    <Block title="Decisions to work through" aside={tickets ? tickets.length : undefined}>
      {!tickets ? <span style={{ ...muted, fontSize: T.small }}>Loading the map…</span>
        : !tickets.length ? <span style={{ ...muted, fontSize: T.small }}>Nothing on the frontier right now.</span>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {tickets.map(t => (
              <button key={t.number} type="button" onClick={() => onOpen(t.number)}
                style={{ textAlign: 'left', fontSize: T.small, padding: '4px 6px', borderRadius: 4, background: 'transparent', color: 'var(--text)', cursor: 'pointer', display: 'flex', gap: 6 }}>
                <span style={muted}>#{t.number}</span>
                <span style={{ flex: 1 }}>{t.title}</span>
                {t.type && <span style={{ ...muted, fontSize: T.tiny }}>{t.type}</span>}
              </button>
            ))}
          </div>
        )}
    </Block>
  )
}
