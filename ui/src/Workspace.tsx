import { ChatEmbed, useAppApi, type ChatEmbedSendMeta } from '@kirocrew/app-sdk'
import { Badge, Btn } from '@kirocrew/app-sdk/ui'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BackendError, backend, errorText } from './api'
import {
  ActionButton, ErrorLine, StartBadge, T, TextButton, fieldStyle, muted, scrollRow, strong,
} from './common'
import { cached, remember } from './cache'
import { FrontierPanel, type SessionStatus } from './Frontier'
import { EffortInspector, TicketInspector, nextStep } from './Inspector'
import { Divider, useStoredSize } from './layout'
import { closeFinished, isClosed, openSession } from './sessions'
import {
  BUTTONS, CHIPS, COLUMN_HINTS, COLUMN_LABELS, SESSION_CONTROLS, SKILL_HINTS,
  STAGES, STAGE_COLUMNS, stageOfColumn,
  type Column, type Decision, type EffortDetail, type PhaseState, type Stage, type TicketInfo, type Tile,
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
  const [sent, setSent] = useState<string | null>(null)
  const [rightWidth, setRightWidth] = useStoredSize('right', 560, 340, 1200)

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
  useEffect(() => { setConfirm(null); setActionError(''); }, [column, focus])
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
  const recorded = detail && key ? detail.sessions[key] ?? null : null
  // A session KiPo closed (its ticket is done) isn't opened again: the card says
  // where its conversation went instead.
  const slotKey = recorded && !isClosed(recorded) ? recorded : null
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
          // A finished ticket's idle session isn't waiting on anyone: no dot.
          .then(r => (r?.running ? [t.number, 'running'] as const : t.state === 'done' ? null : [t.number, 'waiting'] as const))
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
      // The effort is closed: close every session it started.
      await closeFinished(api, Object.values(detail.sessions), null)
      onRemoved()
    } catch (e) {
      setActionError(`Couldn't close it: ${errorText(e)}`)
      setBusy(false)
    }
  }

  // Close sessions whose work is done: a ticket's session once the ticket is
  // closed, and the review and implement-spec sessions once everything landed.
  // Skips one that's still running or on screen; it closes on a later pass.
  const closingRef = useRef(false)
  useEffect(() => {
    if (!detail?.frontier || !active || closingRef.current) return
    const slots: string[] = []
    for (const t of detail.frontier.tiles) {
      if (t.state === 'done' && t.sessionKey && detail.sessions[t.sessionKey]) slots.push(detail.sessions[t.sessionKey])
    }
    if (detail.frontier.landed) {
      for (const k of ['review', 'build-spec']) if (detail.sessions[k]) slots.push(detail.sessions[k])
    }
    if (!slots.length) return
    closingRef.current = true
    void closeFinished(api, slots, slotKey).finally(() => { closingRef.current = false })
  }, [api, detail, active, slotKey])

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

  const scopeLabel = focus.kind === 'ticket' ? `deliver #${focus.t}` : focus.kind === 'spec' ? 'implement-spec'
    : focus.kind === 'decision' ? `decide #${focus.t}` : focus.kind === 'stage' ? COLUMN_LABELS[focus.column].toLowerCase()
    : COLUMN_LABELS[detail.column].toLowerCase()
  // The effort's stage, read from its tickets (CONTRACT.md, "The two halves").
  const stage: Stage = (detail.frontier?.stage && STAGES.includes(detail.frontier.stage) ? detail.frontier.stage : null) ?? stageOfColumn(detail.column)
  // Skills for what's open: the tile's type, else the effort's stage. The any-time
  // controls already sit above the chat box, so they aren't repeated.
  const rawSkills = (focusTile ? TILE_SKILLS[focusTile.type] : null) ?? stageSkills(stage)
  const skills = { buttons: rawSkills.buttons.filter(b => !SESSION_CONTROLS.includes(b)), chips: rawSkills.chips }
  const next = nextStep(detail, {
    openTile,
    startAgents: t => { void startAgents(t) },
    handover,
    review: openReview,
    retro: runRetro,
    close: () => setConfirm('skip'),
    startMain: () => { setFocus({ kind: 'column' }); void start() },
    implementSpec: () => { void start('implement-spec', { kind: 'spec' }) },
    hasMain: !!detail.sessions[detail.column],
  })

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
          {detail.frontier?.lanes && (
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

      {/* Right: whatever is open. A ticket's card for a tile, the effort's overview otherwise. */}
      <section style={{ flex: wide ? '1 1 0' : `0 0 ${rightWidth}px`, width: wide ? undefined : rightWidth, minWidth: 340, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 12px', borderBottom: '1px solid var(--border)', minWidth: 0, minHeight: 41 }}>
          {focusTile ? (
            <TextButton onClick={() => setFocus({ kind: 'column' })} title="Back to the effort's overview and its own conversation">← Effort</TextButton>
          ) : (
            <span style={{ ...muted, fontSize: T.small }}>Effort overview</span>
          )}
          <span style={{ flex: 1 }} />
          <TextButton onClick={() => setWide(w => !w)} title={wide ? 'Show the conversation' : 'Widen this panel'}>{wide ? '⤡' : '⤢'}</TextButton>
          <StageAction detail={detail} stage={stage} busy={busy} confirm={confirm} setConfirm={setConfirm}
            onRetro={runRetro} onClose={closeEffort} onRemove={remove} />
        </div>

        {actionError && <div style={{ padding: '8px 12px 0' }}><ErrorLine>{actionError}</ErrorLine></div>}

        <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto' }}>
          {focusTile ? (
            <TicketInspector key={focusTile.number} repo={repo} number={number} detail={detail} tile={focusTile}
              skills={skills} used={[]} starting={starting} hasSession={!!slotKey}
              onStart={() => start(tileSkill(focusTile))} onOpenTile={openTile} onRunSkill={runSkill} />
          ) : (
            <EffortInspector repo={repo} number={number} detail={detail} stage={stage} next={next}
              skills={skills} used={focus.kind === 'column' ? detail.state?.skillsUsed ?? [] : []} busy={busy || starting}
              decisions={focus.kind === 'column' ? <Decisions state={detail.state} slotKey={slotKey} onError={setActionError} /> : null}
              onOpenTile={openTile} onRunSkill={runSkill} />
          )}
        </div>
      </section>
    </div>
  )
}

// The open conversation's decision cards (the agent writes them to its state file),
// what it's waiting on, and what's been decided.
function Decisions({ state, slotKey, onError }: { state: PhaseState | null; slotKey: string | null; onError: (m: string) => void }) {
  const open = state?.decisions.filter(d => !d.answer) ?? []
  const decided = state?.decisions.filter(d => d.answer) ?? []
  if (!open.length && !decided.length && !state?.blocking) return null
  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {open.length > 0 && (
        <Block title="Decisions for you">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {open.map(d => <DecisionCard key={d.id} decision={d} slotKey={slotKey} onError={onError} />)}
          </div>
        </Block>
      )}
      {state?.blocking && (
        <Block title="Waiting on">
          <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: T.body }}>{state.blocking}</div>
        </Block>
      )}
      {decided.length > 0 && (
        <Block title="Decided" aside={decided.length} collapsible defaultOpen={false}>
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
      body = tile.sessionKey
        ? 'Closed. Its resolution is on the issue, and its conversation is in the sidebar\'s History.'
        : 'Closed. Its resolution is on the issue.'
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

