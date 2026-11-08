import { ChatEmbed, useAppApi, type ChatEmbedSendMeta } from '@kirocrew/app-sdk'
import { Badge, Btn, MarkdownRenderer } from '@kirocrew/app-sdk/ui'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BackendError, backend, errorText } from './api'
import {
  ActionButton, ErrorLine, PathChip, StartBadge, T, TextButton, fieldStyle, isUrl, muted, pathText, scrollRow, strong, timeAgo,
} from './common'
import { cached, remember } from './cache'
import { FrontierPanel, type SessionStatus } from './Frontier'
import { Divider, useStoredSize } from './layout'
import { openSession } from './sessions'
import {
  BUTTONS, CHIPS, COLUMN_HINTS, COLUMN_LABELS, SESSION_CONTROLS, SKILL_HINTS,
  STAGES, STAGE_COLUMNS, STAGE_HINTS, STAGE_LABELS, stageOfColumn,
  type Artifact, type Column, type Decision, type Doc, type EffortDetail, type PhaseState, type Stage, type Ticket, type TicketInfo, type Tile,
} from './types'

// The workspace, after Spec Builder's: the conversation in the middle at full
// height; on the right the column row, the column's skills, what it produces,
// and what it's waiting on. Every divider can be dragged.

type Focus =
  | { kind: 'column' }
  | { kind: 'ticket'; t: number }   // a /implement session for one ticket
  | { kind: 'spec' }                // the /implement-spec session across all tickets
  | { kind: 'decision'; t: number } // a Decide ticket: a map child, or the source issue being triaged
  | { kind: 'stage'; column: Column } // one column's own conversation: review, plan (the hand-over), done (retro)

const focusKey = (f: Focus, column: Column) =>
  f.kind === 'ticket' ? `build-t${f.t}` : f.kind === 'spec' ? 'build-spec' : f.kind === 'decision' ? `shape-t${f.t}`
    : f.kind === 'stage' ? f.column : column

export function Workspace({ repo, number, active, autoStart, onRemoved, onChanged }: {
  repo: string
  number: number
  active: boolean
  autoStart?: boolean
  onRemoved: () => void
  onChanged: () => void
}) {
  const api = useAppApi()
  // Show the last answer for this effort straight away; the first load replaces it.
  const cacheKey = `effort:${repo}#${number}`
  const [detail, setDetail] = useState<EffortDetail | null>(() => cached<EffortDetail>(cacheKey))
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [focus, setFocus] = useState<Focus>(() => cached<Focus>(`${cacheKey}:focus`) ?? { kind: 'column' })
  useEffect(() => { remember(`${cacheKey}:focus`, focus) }, [cacheKey, focus])
  const [starting, setStarting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<'skip' | 'remove' | null>(null)
  const [wide, setWide] = useState(false)
  const [viewColumn, setViewColumn] = useState<Column | null>(null)
  const [viewStage, setViewStage] = useState<Stage | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [rightWidth, setRightWidth] = useStoredSize('right', 560, 340, 1200)
  const [statusHeight, setStatusHeight] = useStoredSize('status', 280, 90, 900)

  const load = useCallback(() => {
    backend.getInitiative(repo, number)
      .then(d => { setDetail(d); remember(cacheKey, d); setLoadError('') })
      .catch(e => setLoadError(errorText(e)))
  }, [repo, number, cacheKey])

  useEffect(() => {
    load()
    if (!active) return
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [load, active])

  const column = detail?.column
  useEffect(() => { setConfirm(null); setActionError(''); setViewColumn(null); setViewStage(null) }, [column, focus])
  // Back to the column view when the effort moves on, but not on first load, so
  // the remembered ticket or decision stays open when you come back to KiPo.
  const lastColumn = useRef(column)
  useEffect(() => {
    if (column === undefined || lastColumn.current === column) { lastColumn.current = column; return }
    const moved = lastColumn.current !== undefined
    lastColumn.current = column
    if (moved) setFocus({ kind: 'column' })
  }, [column])
  useEffect(() => { if (!sent) return; const id = setTimeout(() => setSent(null), 4000); return () => clearTimeout(id) }, [sent])

  const key = detail ? focusKey(focus, detail.column) : null
  const slotKey = detail && key ? detail.sessions[key] ?? null : null
  const ticket = detail && focus.kind === 'ticket' ? detail.tickets.find(t => t.number === focus.t) ?? null : null

  // Open (or continue) the session for the current focus, optionally starting a skill.
  const start = async (skill: string | null = null, override?: Focus, moveFocus = true) => {
    if (!detail) return
    const f = override ?? focus
    setStarting(true)
    setActionError('')
    try {
      const body = f.kind === 'ticket' ? { column: 'build' as Column, ticket: f.t, skill: skill ?? 'implement' }
        : f.kind === 'spec' ? { column: 'build' as Column, mode: 'implement-spec' as const, skill: skill ?? 'implement-spec' }
        : f.kind === 'decision' ? { column: 'shape' as Column, ticket: f.t, skill }
        : f.kind === 'stage' ? { column: f.column, skill }
        : { column: detail.column, skill }
      const res = await backend.startSession(repo, number, body)
      const title = f.kind === 'ticket' ? `${detail.title}: #${f.t}`
        : f.kind === 'spec' ? `${detail.title}: implement-spec`
        : f.kind === 'decision' ? `${detail.title}: decision #${f.t}`
        : f.kind === 'stage' ? `${detail.title}: ${COLUMN_LABELS[f.column]}`
        : `${detail.title}: ${COLUMN_LABELS[detail.column]}`
      if (res.existing) {
        // Grill and Plan share one conversation: carry on in it.
        await api.post('/api/chat?ws=1', { slot: res.slotName, message: res.seed })
      } else {
        await openSession(api, repo, res.slotName, res.seed, title)
      }
      if (override && moveFocus) setFocus(override)
      if (moveFocus) { load(); onChanged() }
    } catch (e) {
      setActionError(
        e instanceof BackendError && e.code === 'ticket_blocked' ? e.message : `Couldn't start the conversation: ${errorText(e)}`,
      )
    } finally {
      setStarting(false)
    }
  }

  // The frontier's tiles. A build ticket opens as a ticket session, a map child
  // as a decision session; its skill follows its wayfinder type.
  // Deliver tiles build (a build-t<t> session running /implement); Decide tiles
  // decide (a shape-t<t> session running their type's skill).
  const tileFocus = (t: Tile): Focus => (t.lane === 'deliver' ? { kind: 'ticket', t: t.number } : { kind: 'decision', t: t.number })
  const tileSkill = (t: Tile): string | null =>
    t.lane === 'deliver' ? 'implement'
      : t.type === 'research' ? 'research' : t.type === 'prototype' ? 'prototype' : t.type === 'issue' ? 'triage' : null
  const [startingAgents, setStartingAgents] = useState<string | null>(null)

  // Clicking a tile only shows its ticket; starting it is the Start button on
  // the card that appears (or "Start N agents" for the whole AFK frontier).
  const openTile = (t: Tile) => { setFocus(tileFocus(t)) }
  const focusTile = detail?.frontier && (focus.kind === 'ticket' || focus.kind === 'decision')
    ? detail.frontier.tiles.find(t => t.number === focus.t) ?? null
    : null

  // Each tile's session status, for the dots: is its agent working right now?
  const [statuses, setStatuses] = useState<Record<number, SessionStatus>>({})
  const sessionTiles = useMemo(
    () => (detail?.frontier?.tiles ?? []).filter(t => t.sessionKey && detail?.sessions[t.sessionKey]),
    [detail],
  )
  useEffect(() => {
    if (!sessionTiles.length) { setStatuses({}); return }
    let live = true
    const poll = () => {
      void Promise.all(sessionTiles.map(t =>
        api.get<{ running?: boolean }>(`/api/chat/slots/${encodeURIComponent(detail!.sessions[t.sessionKey!])}?limit=1`)
          .then(r => [t.number, r?.running ? 'running' : 'waiting'] as const)
          .catch(() => null),
      )).then(rows => {
        if (!live) return
        const next: Record<number, SessionStatus> = {}
        for (const row of rows) if (row) next[row[0]] = row[1]
        setStatuses(next)
      })
    }
    poll()
    if (!active) return () => { live = false }
    const id = setInterval(poll, 5000)
    return () => { live = false; clearInterval(id) }
  }, [api, sessionTiles, active, detail])

  // "Start N agents": one session per AFK ticket on the frontier, in parallel,
  // leaving this conversation where it is.
  const startAgents = async (tiles: Tile[]) => {
    for (let i = 0; i < tiles.length; i++) {
      setStartingAgents(`Starting ${i + 1} of ${tiles.length}…`)
      await start(tileSkill(tiles[i]), tileFocus(tiles[i]), false)
    }
    setStartingAgents(null)
    load()
    onChanged()
  }

  // Keep agents on the frontier: Matt's deterministic loop, run by KiPo. When a
  // Deliver ticket an agent can take appears (a blocker closed), start it.
  // Only while this page is open; each ticket is started at most once here.
  const autopilotKey = `kipo.autopilot:${repo}#${number}`
  const [autopilot, setAutopilotState] = useState(() => localStorage.getItem(autopilotKey) === '1')
  const setAutopilot = (on: boolean) => { setAutopilotState(on); localStorage.setItem(autopilotKey, on ? '1' : '0') }
  const autoStartedTiles = useRef(new Set<number>())
  useEffect(() => {
    if (!autopilot || !active || startingAgents || !detail?.frontier) return
    const fresh = detail.frontier.tiles.filter(t =>
      t.lane === 'deliver' && t.state === 'afk' && !t.sessionKey && !autoStartedTiles.current.has(t.number))
    if (!fresh.length) return
    fresh.forEach(t => autoStartedTiles.current.add(t.number))
    void startAgents(fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autopilot, active, startingAgents, detail])

  // A column's own conversation: open it if it exists, else start it with a skill.
  const openStage = (column: Column, skill: string | null) => {
    if (!detail) return
    if (detail.sessions[column]) { setFocus({ kind: 'stage', column }); return }
    void start(skill, { kind: 'stage', column })
  }
  const handover = () => openStage('plan', 'to-spec')
  const openReview = () => openStage('review', null)
  const runRetro = () => openStage('done', 'retro')

  // Closing the effort: it moves to Done (if it isn't there) and its issue closes.
  const closeEffort = async () => {
    if (!detail) return
    setBusy(true)
    setActionError('')
    try {
      if (detail.column !== 'done') await backend.advance(repo, number, true, 'done')
      await backend.advance(repo, number, true, null)
      onRemoved()
    } catch (e) {
      setActionError(`Couldn't close it: ${errorText(e)}`)
      setBusy(false)
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
  const scopeLabel = focus.kind === 'ticket' ? `deliver #${focus.t}` : focus.kind === 'spec' ? 'implement-spec'
    : focus.kind === 'decision' ? `decide #${focus.t}` : focus.kind === 'stage' ? COLUMN_LABELS[focus.column].toLowerCase()
    : COLUMN_LABELS[detail.column].toLowerCase()
  // The effort's stage, read from its tickets (CONTRACT.md, "The two halves").
  const stage: Stage = detail.frontier?.stage ?? stageOfColumn(detail.column)
  // Whose skills the panel shows: the open tile's, else the stage picked in the track.
  const skillStage: Stage = viewStage ?? (focusTile ? focusTile.lane : stage)
  const skills = focusTile && !viewStage ? TILE_SKILLS[focusTile.type] : stageSkills(skillStage)

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
      {/* Middle: the conversation. */}
      {!wide && (
        <section style={{ flex: '1 1 0', minWidth: 360, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)', minWidth: 0 }}>
            {slotKey
              ? <SessionName key={slotKey} slotKey={slotKey} fallback={detail.title} />
              : <span style={{ ...strong, fontSize: T.title, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{detail.title}</span>}
            <span style={{ fontSize: T.tiny, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-elevated)', color: 'var(--accent)', border: '1px solid var(--accent)', whiteSpace: 'nowrap' }}>{scopeLabel}</span>
            <StartBadge start={detail.start} />
            <span style={{ flex: 1 }} />
            <span style={{ ...muted, fontSize: T.tiny, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260, direction: 'rtl' }} title={detail.repoPath}>
              {detail.repoPath}
            </span>
          </div>
          {detail.frontier && (
            <FrontierPanel frontier={detail.frontier} onTile={openTile} onStartAgents={startAgents} starting={startingAgents}
              openNumber={focusTile?.number ?? null} statuses={statuses}
              autopilot={autopilot} onAutopilot={setAutopilot}
              onHandover={handover} onReview={openReview} onRetro={runRetro} reviewOpen={!!detail.sessions.review} />
          )}
          {focus.kind !== 'column' && (
            <div style={{ ...scrollRow, padding: '6px 16px', borderBottom: '1px solid var(--border)', fontSize: T.small, gap: 8 }}>
              <TextButton onClick={() => setFocus({ kind: 'column' })} title="Back to the effort's own conversation">← Effort</TextButton>
              {(focusTile ?? ticket) && <a href={(focusTile ?? ticket)!.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>#{(focusTile ?? ticket)!.number}</a>}
              {(focusTile ?? ticket) && <span>{(focusTile ?? ticket)!.title}</span>}
            </div>
          )}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {slotKey ? (
              <PhaseChat key={slotKey} slotKey={slotKey} onSkill={runSkill} sent={sent} />
            ) : (
              <NotStarted detail={detail} focus={focus} ticket={ticket} tile={focusTile} starting={starting}
                onStart={() => start(focusTile ? tileSkill(focusTile) : null)} />
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
          <StageTrack detail={detail} stage={stage} picked={viewStage} onPick={st => { setViewStage(st); setViewColumn(null) }} />
          <TextButton onClick={() => setWide(w => !w)} title={wide ? 'Show the conversation' : 'Widen this panel'}>{wide ? '⤡' : '⤢'}</TextButton>
          {!past && (
            <StageAction detail={detail} stage={stage} busy={busy} confirm={confirm} setConfirm={setConfirm}
              onRetro={runRetro} onClose={closeEffort} onRemove={remove} />
          )}
        </div>
        <StepRow detail={detail} stage={skillStage} viewing={past} onPick={c => setViewColumn(c === detail.column ? null : c)} />

        <SkillBar buttons={skills.buttons} chips={skills.chips} used={scopeState?.skillsUsed ?? []} readOnly={!!past} disabled={starting} onRun={runSkill} />

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
          ) : skillStage === 'deliver' && (detail.tickets.length > 0 || detail.prs.length === 0) ? (
            <>
              <BuildPanel detail={detail} focus={focus} starting={starting}
                onOpen={f => setFocus(f)}
                onStart={f => start(null, f)} />
              <Docs repo={repo} number={number} artifacts={detail.artifacts} placeholder="" compact />
            </>
          ) : skillStage === 'deliver' || (skillStage === 'done' && detail.prs.length > 0) ? (
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

// The open session's name. Click it to rename: the new name is saved as a manual
// title, which the dashboard keeps instead of the automatic one.
function SessionName({ slotKey, fallback }: { slotKey: string; fallback: string }) {
  const api = useAppApi()
  const [name, setName] = useState<string | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState('')
  const cancelled = useRef(false)

  useEffect(() => {
    let live = true
    api.get<{ title?: string }>(`/api/chat/slots/${encodeURIComponent(slotKey)}?limit=1`)
      .then(r => { if (live && r?.title) setName(r.title) })
      .catch(() => undefined)
    return () => { live = false }
  }, [api, slotKey])

  const shown = name ?? fallback
  const save = async () => {
    const next = (draft ?? '').trim()
    setDraft(null)
    if (cancelled.current) { cancelled.current = false; return }
    if (!next || next === shown) return
    const before = name
    setName(next)
    setError('')
    try {
      await api.patch(`/api/chat/slots/${encodeURIComponent(slotKey)}/title`, { title: next })
    } catch (e) {
      setName(before)
      setError(`Couldn't rename: ${errorText(e)}`)
    }
  }

  if (draft !== null) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={200}
        aria-label="Session name"
        onChange={e => setDraft(e.target.value)}
        onFocus={e => e.target.select()}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') { cancelled.current = true; e.currentTarget.blur() }
        }}
        style={{ ...fieldStyle, ...strong, fontSize: T.title, padding: '2px 6px', flex: '1 1 auto', maxWidth: 520 }}
      />
    )
  }
  return (
    <button
      type="button"
      onClick={() => setDraft(shown)}
      title={error || 'Click to rename this session'}
      style={{
        ...strong, fontSize: T.title, minWidth: 0, maxWidth: 520, padding: '2px 6px', margin: '0 -6px',
        borderRadius: 4, background: 'transparent', cursor: 'text', textAlign: 'left',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        color: error ? 'var(--danger-text)' : 'var(--text-strong, var(--text))',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {shown}
    </button>
  )
}

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

const TILE_ACTIONS: Record<Tile['type'], { what: string; action: string; body: string }> = {
  grilling: { what: 'Grill', action: 'Start the grill', body: 'An interview with you to settle this decision. It updates GLOSSARY.md and the ADRs as answers land.' },
  prototype: { what: 'Prototype', action: 'Start a prototype', body: 'Throwaway code or an outline to react to, so the decision gets made against something concrete.' },
  research: { what: 'Research', action: 'Run the research', body: 'The agent reads primary sources and leaves a cited note on a research branch. Nothing for you to do.' },
  task: { what: 'Task', action: 'Start this task', body: 'Work that has to happen before a decision can be made. The agent does what it can and hands you a checklist for the rest.' },
  build: { what: 'Build', action: 'Implement this ticket', body: '/implement builds this ticket test-first in its own conversation, then reviews it.' },
  issue: { what: 'Issue', action: 'Triage it', body: 'A follow-up filed on the map. Triage moves it to an agent-ready brief, or asks you what it needs.' },
}

function NotStarted({ detail, focus, ticket, tile, starting, onStart }: {
  detail: EffortDetail
  focus: Focus
  ticket: TicketInfo | null
  tile: Tile | null
  starting: boolean
  onStart: () => void
}) {
  let title: string
  let body: string
  let action: string | null
  if (tile) {
    const a = TILE_ACTIONS[tile.type]
    const who = tile.who === 'you' ? 'Your move' : "Agent's move"
    title = `${a.what} #${tile.number}: ${tile.title}`
    if (tile.state === 'done') {
      body = 'Closed. Its resolution is on the issue.'
      action = null
    } else if (tile.state === 'blocked') {
      body = `Waiting on ${tile.blockedBy.map(n => `#${n}`).join(', ')}. It can start once those are closed.`
      action = null
    } else if (tile.state === 'review') {
      body = `PR ${tile.prs.map(n => `#${n}`).join(', ')} is open for it. Review merges it once it's clean.`
      action = null
    } else {
      body = `${who}. ${a.body}`
      action = a.action
    }
  } else if (focus.kind === 'ticket') {
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
    const col = focus.kind === 'stage' ? focus.column : detail.column
    const shared = col === 'plan' && detail.sessions.grill
    title = `${COLUMN_LABELS[col]} hasn't started`
    body = shared ? 'Plan continues the Grill conversation, so the spec and tickets are written with everything it learned.'
      : `${COLUMN_HINTS[col]} Start it, or press one of the skill buttons on the right.`
    action = shared ? 'Continue in the Grill conversation' : `Start ${COLUMN_LABELS[col]}`
  }
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ ...strong, fontSize: T.title }}>{title}</div>
        <div style={{ ...muted, fontSize: T.body, margin: '6px 0 14px', lineHeight: 1.5 }}>{body}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
          {action && <Btn primary disabled={starting} onClick={onStart}>{starting ? 'Starting…' : action}</Btn>}
          {tile && <a href={tile.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: T.small }}>Open on GitHub</a>}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- right column: header

// The track: Intake, then Matt's two halves, then Done. The stage is read from
// the effort's tickets, so there's no Next: Decide and Deliver can both be lit
// at once. Click a stage to see its skills and its steps.
function StageTrack({ detail, stage, picked, onPick }: {
  detail: EffortDetail
  stage: Stage
  picked: Stage | null
  onPick: (s: Stage | null) => void
}) {
  const activeLanes = detail.frontier?.active
  const curIdx = STAGES.indexOf(stage)
  return (
    <div role="tablist" aria-label="Stages" style={{ ...scrollRow, flex: 1, gap: 2, padding: '2px 0' }}>
      {STAGES.map((st, i) => {
        const lit = st === stage || (st === 'decide' && activeLanes?.decide) || (st === 'deliver' && activeLanes?.deliver)
        const done = !lit && i < curIdx
        const on = picked === st
        return (
          <button key={st} type="button" role="tab" aria-selected={on}
            onClick={() => onPick(on ? null : st)}
            title={`${STAGE_HINTS[st]} Steps: ${STAGE_COLUMNS[st].map(c => COLUMN_LABELS[c]).join(', ')}.`}
            style={{
              flexShrink: 0, height: 26, padding: '0 10px', borderRadius: 6, whiteSpace: 'nowrap', fontSize: T.small,
              fontWeight: on || lit ? 600 : 400,
              border: `1px solid ${on ? 'var(--border)' : 'transparent'}`,
              background: on ? 'var(--bg-elevated)' : 'transparent',
              color: lit || done ? 'var(--text)' : 'var(--muted)', cursor: 'pointer',
            }}>
            <span aria-hidden style={{ color: done ? 'var(--ok-text)' : lit ? 'var(--accent)' : 'var(--muted)', marginRight: 5, fontSize: T.tiny }}>
              {done ? '✓' : '●'}
            </span>
            {STAGE_LABELS[st]}
          </button>
        )
      })}
    </div>
  )
}

// The steps inside the shown stage (the old columns). One with a record opens it.
function StepRow({ detail, stage, viewing, onPick }: {
  detail: EffortDetail
  stage: Stage
  viewing: Column | null
  onPick: (c: Column) => void
}) {
  const cols = STAGE_COLUMNS[stage]
  if (cols.length < 2 && !detail.history?.[cols[0]] && cols[0] !== detail.column) return null
  return (
    <div style={{ ...scrollRow, gap: 4, padding: '4px 12px', borderBottom: '1px solid var(--border)', fontSize: T.tiny }}>
      <span style={muted}>Steps:</span>
      {cols.map(c => {
        const has = c === detail.column || !!detail.history?.[c]
        const on = (viewing ?? detail.column) === c
        return (
          <button key={c} type="button" disabled={!has} onClick={() => onPick(c)}
            title={has ? `${COLUMN_HINTS[c]} Click to see what it recorded.` : `${COLUMN_HINTS[c]} Nothing recorded yet.`}
            style={{
              background: on ? 'var(--bg-elevated)' : 'transparent', borderRadius: 4, padding: '2px 6px',
              color: has ? 'var(--text)' : 'var(--muted)', cursor: has ? 'pointer' : 'default', fontWeight: on ? 600 : 400,
            }}>
            {COLUMN_LABELS[c]}
          </button>
        )
      })}
    </div>
  )
}

// Remove, and once everything has landed, Close (which runs through Done).
function StageAction({ detail, stage, busy, confirm, setConfirm, onRetro, onClose, onRemove }: {
  detail: EffortDetail
  stage: Stage
  busy: boolean
  confirm: 'skip' | 'remove' | null
  setConfirm: (c: 'skip' | 'remove' | null) => void
  onRetro: () => void
  onClose: () => void
  onRemove: () => void
}) {
  const group = { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 } as const
  if (confirm) {
    const closing = confirm === 'skip'
    return (
      <span style={{ ...group, fontSize: T.small }}>
        <span style={{ ...muted, whiteSpace: 'nowrap' }}>{closing ? 'Close the effort and its issue?' : 'Close its issue as not planned?'}</span>
        <ActionButton danger={!closing} primary={closing} disabled={busy} onClick={() => (closing ? onClose() : onRemove())}>
          {closing ? 'Close' : 'Remove'}
        </ActionButton>
        <ActionButton disabled={busy} onClick={() => setConfirm(null)}>Cancel</ActionButton>
      </span>
    )
  }
  return (
    <span style={group}>
      <TextButton disabled={busy} onClick={() => setConfirm('remove')}>Remove</TextButton>
      {stage === 'done' && !detail.sessions.done && (
        <ActionButton disabled={busy} onClick={onRetro}>Run /retro</ActionButton>
      )}
      {stage === 'done' && (
        <ActionButton primary disabled={busy} onClick={() => setConfirm('skip')}>{busy ? 'Closing…' : 'Close effort'}</ActionButton>
      )}
    </span>
  )
}

// Skills for what's open: a tile's type, or a stage (its columns' buttons and chips).
type SkillSet = { buttons: string[]; chips: string[] }
const TILE_SKILLS: Record<Tile['type'], SkillSet> = {
  grilling: { buttons: ['grill-with-docs', 'grill-me'], chips: ['grilling', 'domain-modeling'] },
  prototype: { buttons: [], chips: ['prototype', 'codebase-design'] },
  research: { buttons: [], chips: ['research'] },
  task: { buttons: [], chips: ['wizard'] },
  build: { buttons: ['implement'], chips: ['tdd', 'diagnosing-bugs', 'code-review', 'pr'] },
  issue: { buttons: ['triage', 'implement'], chips: ['tdd', 'code-review'] },
}
const uniq = (xs: string[]) => [...new Set(xs)]
function stageSkills(stage: Stage): SkillSet {
  const cols = STAGE_COLUMNS[stage]
  const buttons = uniq(cols.flatMap(c => BUTTONS[c]))
  const chips = uniq(cols.flatMap(c => CHIPS[c])).filter(c => !buttons.includes(c))
  // Matt retros each run, not only the whole effort.
  if (stage === 'deliver' && !buttons.includes('retro')) buttons.push('retro')
  return { buttons, chips }
}

// The skills you start are buttons; the ones the agent reaches for on its own are
// chips that tick once it has used them.
function SkillBar({ buttons, chips, used, readOnly, disabled, onRun }: {
  buttons: string[]
  chips: string[]
  used: string[]
  readOnly: boolean
  disabled: boolean
  onRun: (skill: string) => void
}) {
  const set = new Set(used)
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
          PRs that close this effort's tickets, or that sit on a kipo/{detail.number} branch, show up here. The agent merges each one once it's reviewed and green, and asks first if it needs something from you.
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
