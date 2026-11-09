import { useAppApi } from '@kirocrew/app-sdk'
import { Badge, Btn } from '@kirocrew/app-sdk/ui'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BackendError, backend, errorText } from './api'
import {
  ActionButton, ErrorLine, MapTag, T, TextButton, muted, strong,
} from './common'
import { cached, remember } from './cache'
import { FrontierSummary, type SessionStatus } from './Frontier'
import { Abbr } from './glossary'
import { EffortInspector, NextStrip, TicketChain, TicketInspector, nextStep } from './Inspector'
import { Divider, useFitSplit, useStoredSize } from './layout'
import { closeFinished, isClosed, openSession } from './sessions'
import {
  COLUMNS, COLUMN_HINTS, COLUMN_LABELS, SKILL_HINTS,
  STAGES, stageOfColumn,
  type Column, type Decision, type DispatchEntry, type EffortDetail, type PhaseState, type Stage, type TicketInfo, type Tile,
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

const focusKey = (f: Focus) =>
  f.kind === 'ticket' ? `build-t${f.t}` : f.kind === 'spec' ? 'build-spec' : f.kind === 'decision' ? `shape-t${f.t}`
    : f.kind === 'stage' ? f.column : 'conductor' // the effort's own conversation is its conductor

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
  // On the Board, a ticket's chain over its details.
  const chainSplit = useFitSplit('chain', 100, 0.75)
  // Two views, one at a time: the session (the default) or the board. Remembered per effort.
  const tabKey = `kipo.tab:${repo}#${number}`
  const [tab, setTabState] = useState<'session' | 'board'>(() => (localStorage.getItem(tabKey) === 'board' ? 'board' : 'session'))
  const setTab = (v: 'session' | 'board') => { setTabState(v); try { localStorage.setItem(tabKey, v) } catch { /* private mode */ } }

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
  // Opening a conversation (from the map, Next, or ← Effort) shows it.
  useEffect(() => { setConfirm(null); setActionError('') }, [column, focus])
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

  const key = detail ? focusKey(focus) : null
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
        : { column: detail.column, mode: 'conductor' as const }
      const res = await backend.startSession(repo, number, body)
      const title = f.kind === 'ticket' ? `${detail.title}: #${f.t}`
        : f.kind === 'spec' ? `${detail.title}: implement-spec`
        : f.kind === 'decision' ? `${detail.title}: decision #${f.t}`
        : f.kind === 'stage' ? `${detail.title}: ${COLUMN_LABELS[f.column]}`
        : `${detail.title}: conductor`
      if (res.existing) {
        // Grill and Plan share one conversation: carry on in it.
        await api.post('/api/chat?ws=1', { slot: res.slotName, message: res.seed })
      } else {
        await openSession(api, repo, res.slotName, res.seed, title, res.agent)
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

  // The conductor's Dispatch: start each session it queued (kipo_cli.py dispatch),
  // once, while this page is open. A ticket that's done, blocked or already has
  // its conversation, or a stage conversation that exists, is skipped.
  const dispatchSeenKey = `kipo.dispatched:${repo}#${number}`
  const dispatching = useRef(new Set<string>())
  useEffect(() => {
    if (!active || starting || startingAgents || !detail?.frontier) return
    const queue = detail.sessionStates?.conductor?.dispatch ?? []
    let seen: string[] = []
    try { seen = JSON.parse(localStorage.getItem(dispatchSeenKey) || '[]') } catch { seen = [] }
    const idOf = (e: DispatchEntry) => `${e.ticket ?? e.stage}@${e.at}`
    const todo = queue.filter(e => !seen.includes(idOf(e)) && !dispatching.current.has(idOf(e)))
    if (!todo.length) return
    for (const e of todo) { dispatching.current.add(idOf(e)); seen.push(idOf(e)) }
    try { localStorage.setItem(dispatchSeenKey, JSON.stringify(seen.slice(-300))) } catch { /* full: fine */ }
    void (async () => {
      let started = 0
      for (const e of todo) {
        if (e.ticket != null) {
          const t = detail.frontier!.tiles.find(x => x.number === e.ticket)
          if (!t || t.state === 'done' || t.state === 'blocked' || (t.sessionKey && detail.sessions[t.sessionKey])) continue
          await start(e.skill ?? tileSkill(t), tileFocus(t), false)
          started++
        } else if (e.stage) {
          if (detail.sessions[e.stage]) continue
          await start(e.skill ?? null, { kind: 'stage', column: e.stage }, false)
          started++
        }
      }
      if (started) { load(); onChanged() }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, starting, startingAgents, detail])

  // The conductor's Watch: when a ticket's or PR's state changed since it last
  // heard (remembered per effort, so changes while the page was closed count
  // too), tell it, unless it's mid-turn; it re-reads the frontier itself.
  const conductorSlot = detail?.sessions.conductor && !isClosed(detail.sessions.conductor) ? detail.sessions.conductor : null
  const frontierSig = detail?.frontier
    ? JSON.stringify({ t: detail.frontier.tiles.map(t => [t.number, t.state]), p: detail.prs.map(p => [p.number, p.state]) })
    : ''
  useEffect(() => {
    if (!frontierSig || !conductorSlot || !active) return
    const sigKey = `kipo.conductorSaw:${repo}#${number}`
    const prev = localStorage.getItem(sigKey)
    if (prev === frontierSig) return
    if (prev === null) { localStorage.setItem(sigKey, frontierSig); return } // it read the frontier when it started
    const changes: string[] = []
    try {
      const was = JSON.parse(prev) as { t: [number, string][]; p: [number, string][] }
      const now = JSON.parse(frontierSig) as typeof was
      const before = new Map(was.t), prBefore = new Map(was.p)
      for (const [n, s] of now.t) if (before.get(n) !== s) changes.push(`#${n} ${before.get(n) ?? 'new'} → ${s}`)
      for (const [n, s] of now.p) if (prBefore.get(n) !== s) changes.push(`PR #${n} ${(prBefore.get(n) ?? 'new').toLowerCase()} → ${s.toLowerCase()}`)
    } catch { /* an old shape: just say it changed */ }
    void (async () => {
      try {
        const info = await api.get<{ running?: boolean }>(`/api/chat/slots/${encodeURIComponent(conductorSlot)}?limit=1`)
        if (info?.running) return // mid-turn: it re-reads the frontier on its next wake
        await api.post('/api/chat?ws=1', {
          slot: conductorSlot,
          message: `[KiPo] Frontier changed${changes.length ? `: ${changes.slice(0, 12).join('; ')}` : ''}. Run the frontier and carry on.`,
        })
        localStorage.setItem(sigKey, frontierSig)
      } catch { /* try again on the next change */ }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frontierSig, conductorSlot, active])

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

  // A skill chip on the board: run it in that stage's own conversation (never the
  // conductor's): send it into the stage's conversation, or start the stage with it.
  const runStageSkill = async (stage: Column, skill: string) => {
    if (!detail) return
    const slot = detail.sessions[stage]
    if (!slot || isClosed(slot)) { await start(skill, { kind: 'stage', column: stage }); return }
    try {
      const { message } = await backend.skillMessage(repo, number, skill)
      await api.post('/api/chat?ws=1', { slot, message })
      setFocus({ kind: 'stage', column: stage })
      setSent(skill)
    } catch (e) {
      setActionError(`Couldn't start /${skill}: ${errorText(e)}`)
    }
  }

  // The conductor's status for the board: not started, waiting, or mid-turn.
  const [conductorRunning, setConductorRunning] = useState(false)
  useEffect(() => {
    if (!conductorSlot) { setConductorRunning(false); return }
    let live = true
    const poll = () => {
      api.get<{ running?: boolean }>(`/api/chat/slots/${encodeURIComponent(conductorSlot)}?limit=1`)
        .then(r => { if (live) setConductorRunning(!!r?.running) })
        .catch(() => { /* keep the last status */ })
    }
    poll()
    if (!active) return () => { live = false }
    const id = setInterval(poll, 5000)
    return () => { live = false; clearInterval(id) }
  }, [api, conductorSlot, active])

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

  // The effort's stage, read from its tickets (CONTRACT.md, "The two halves").
  const stage: Stage = (detail.frontier?.stage && STAGES.includes(detail.frontier.stage) ? detail.frontier.stage : null) ?? stageOfColumn(detail.column)
  // The open conversation's own state (CONTRACT.md: one state file per
  // conversation): the effort's own uses state.json, a ticket's its own file.
  const convState: PhaseState | null = key && !isColumn(key) ? detail.sessionStates?.[key] ?? null : detail.state
  const running = convState?.skillsUsed ?? []
  // A done ticket (or a conversation KiPo closed) is settled: its unanswered
  // decision cards are history, never questions still waiting on you.
  const settled = focusTile ? focusTile.state === 'done' : !!recorded && isClosed(recorded)
  const openDecisionCount = convState?.decisions.filter(d => !d.answer).length ?? 0
  const next = nextStep(detail, {
    openTile,
    startTile: t => { if (t.sessionKey) setFocus(tileFocus(t)); else void start(tileSkill(t), tileFocus(t)) },
    startAgents: t => { void startAgents(t) },
    handover,
    review: openReview,
    retro: runRetro,
    close: () => setConfirm('skip'),
    startMain: () => { setFocus({ kind: 'column' }); void start() },
    implementSpec: () => { void start('implement-spec', { kind: 'spec' }) },
    hasMain: !!detail.sessions[detail.column],
  })

  const conductorState = !conductorSlot ? 'none' as const : conductorRunning ? 'running' as const : 'idle' as const
  const mapUrl = detail.mapIssue ? `https://github.com/${detail.repo}/issues/${detail.mapIssue}` : null
  const toSession = (t: Tile) => { setFocus(tileFocus(t)); setTab('session') }

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Two views of the effort. Session (the default): a thin row of the seven
          stages with their tickets as tiles, then the open conversation in Kiro's
          own chat, side panel and all. Board: the conductor and the seven KiPo
          skills, every ticket as a card; a click shows it on the right, a
          double-click opens its session. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px 0', borderBottom: '1px solid var(--border)', minWidth: 0 }}>
        {(['session', 'board'] as const).map(v => {
          const on = tab === v
          return (
            <button key={v} type="button" role="tab" aria-selected={on} onClick={() => setTab(v)}
              style={{ background: 'transparent', padding: '6px 10px 8px', marginBottom: -1, cursor: 'pointer', fontSize: T.small,
                color: on ? 'var(--text)' : 'var(--muted)', fontWeight: on ? 600 : 400, borderBottom: `2px solid ${on ? 'var(--accent)' : 'transparent'}` }}>
              {v === 'session' ? 'Session' : 'Board'}
            </button>
          )
        })}
        <span style={{ ...strong, fontSize: T.small, marginLeft: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }} title={detail.title}>
          #{detail.number} {detail.title}
        </span>
        {(detail.kind === 'map' || detail.mapIssue) && (
          <a href={`https://github.com/${detail.repo}/issues/${detail.kind === 'map' ? detail.number : detail.mapIssue}`} target="_blank" rel="noreferrer"
            title="Open the wayfinder map on GitHub" style={{ textDecoration: 'none', display: 'inline-flex' }}>
            <MapTag kind={detail.kind} map={detail.kind === 'map' ? detail.number : detail.mapIssue} />
          </a>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ ...muted, fontSize: T.tiny, whiteSpace: 'nowrap' }} title={detail.repoPath}>{detail.repo}</span>
        <div style={{ paddingBottom: 4 }}>
          <StageAction detail={detail} stage={stage} busy={busy} confirm={confirm} setConfirm={setConfirm}
            onRetro={runRetro} onClose={closeEffort} onRemove={remove} />
        </div>
      </div>
      {actionError && <div style={{ padding: '6px 12px 0' }}><ErrorLine>{actionError}</ErrorLine></div>}

      {tab === 'session' ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {detail.frontier && (
            <FrontierSummary variant="strip" frontier={detail.frontier} prs={detail.prs} effort={detail.number}
              onTile={t => setFocus(tileFocus(t))} openNumber={focusTile?.number ?? null} statuses={statuses}
              conductor={conductorState} conductorOpen={focus.kind === 'column'} onConductor={() => setFocus({ kind: 'column' })}
              onMore={() => setTab('board')} mapUrl={mapUrl} />
          )}
          {/* The open conversation's own header. The embedded chat page carries the
              session's title (and renaming) itself, so with a session open this row
              holds only what the chat page doesn't: the way back, what's running,
              /wait-what, open decisions, and the ticket's details. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderBottom: '1px solid var(--border)', minWidth: 0 }}>
            {focus.kind !== 'column' && (
              <TextButton onClick={() => setFocus({ kind: 'column' })} title="Back to the conductor">← Conductor</TextButton>
            )}
            {!slotKey && (
              <span style={{ ...strong, fontSize: T.body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {focusTile ? `#${focusTile.number} ${focusTile.title}` : focus.kind === 'column' ? 'Conductor' : detail.title}
              </span>
            )}
            {slotKey && (
              <span style={{ ...muted, fontSize: T.small, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                {focusTile ? `#${focusTile.number}` : focus.kind === 'column' ? 'Conductor' : null}
              </span>
            )}
            {slotKey && running.length > 0 && <Running skills={running} />}
            <span style={{ flex: 1 }} />
            {slotKey && (
              <button type="button" onClick={() => void runSkill('wait-what')} title={SKILL_HINTS['wait-what']}
                style={{ background: 'transparent', padding: 0, color: 'var(--muted)', cursor: 'pointer', fontSize: T.tiny, textDecoration: 'underline dotted', whiteSpace: 'nowrap' }}>
                /wait-what
              </button>
            )}
            {sent && <span style={{ ...muted, fontSize: T.tiny, whiteSpace: 'nowrap' }}>sent /{sent}</span>}
            {/* Open decision cards have one home: the Board's right panel. */}
            {!settled && openDecisionCount > 0 && (
              <TextButton onClick={() => setTab('board')} title="This conversation is waiting on your answers. The cards are on the Board's right panel, answered together.">
                {openDecisionCount} decision{openDecisionCount === 1 ? '' : 's'} open →
              </TextButton>
            )}
            {focusTile && <TextButton onClick={() => setTab('board')} title="This ticket's details, where it sits and its decisions, on the Board">Details →</TextButton>}
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {slotKey ? (
              <KiroChatFrame key={slotKey} slotKey={slotKey} />
            ) : (
              <NotStarted detail={detail} focus={focus} ticket={ticket} tile={focusTile} starting={starting}
                onStart={() => start(focusTile ? tileSkill(focusTile) : null)}
                alternatives={startAlternatives(focusTile, focus.kind === 'column' ? detail.column : null)} onSkill={s => start(s)} />
            )}
          </div>
        </div>
      ) : (
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
      {/* Middle: the board. */}
      {!wide && (
        <section style={{ flex: '1 1 0', minWidth: 360, minHeight: 0, overflowY: 'auto' }}>
          {detail.frontier && (
            <FrontierSummary variant="board" frontier={detail.frontier} prs={detail.prs} effort={detail.number}
              onTile={openTile} onSession={toSession} openNumber={focusTile?.number ?? null} statuses={statuses}
              conductor={conductorState} onSkill={(s, k) => { void runStageSkill(s, k); setTab('session') }} mapUrl={mapUrl}
              next={<NextStrip next={next} busy={busy || starting || !!startingAgents} />} />
          )}
        </section>
      )}

      {!wide && (
        <Divider direction="vertical" label="Resize the board and the ticket panel"
          onDrag={d => setRightWidth(w => w - d)} onReset={() => setRightWidth(560)} />
      )}

      {/* Right: whatever is picked. A ticket's card for a card, the effort's overview otherwise. */}
      <section style={{ flex: wide ? '1 1 0' : `0 0 ${rightWidth}px`, width: wide ? undefined : rightWidth, minWidth: 340, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 12px', borderBottom: '1px solid var(--border)', minWidth: 0, minHeight: 37 }}>
          {focusTile
            ? <TextButton onClick={() => setTab('session')} title="Open this ticket's conversation">Session →</TextButton>
            : <TextButton onClick={() => { setFocus({ kind: 'column' }); setTab('session') }} title="Open the conductor's conversation">Conductor session →</TextButton>}
          <span style={{ flex: 1 }} />
          <TextButton onClick={() => setWide(w => !w)} title={wide ? 'Show the board' : 'Widen this panel'}>{wide ? '⤡' : '⤢'}</TextButton>
        </div>

        {focusTile && (<>
          <div ref={chainSplit.ref} style={chainSplit.style}>
            <TicketChain detail={detail} tile={focusTile} hasSession={!!slotKey} onOpenTile={openTile} statuses={statuses} />
          </div>
          <Divider direction="horizontal" label="Resize the ticket's chain and its details"
            onDrag={chainSplit.onDrag} onReset={chainSplit.reset} />
        </>)}
        <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto' }}>
          {focusTile ? (
            <TicketInspector key={focusTile.number} repo={repo} number={number} detail={detail} tile={focusTile}
              decisions={<Decisions key={slotKey ?? 'none'} state={convState} slotKey={slotKey} settled={settled} onError={setActionError} />} />
          ) : (
            <EffortInspector repo={repo} number={number} detail={detail} stage={stage} autopilot={autopilot} onAutopilot={setAutopilot}
              showAutopilot={autopilot || (detail.frontier?.tiles ?? []).some(t => t.lane === 'deliver' && t.state === 'afk')}
              decisions={<Decisions key={slotKey ?? 'none'} state={convState} slotKey={slotKey} settled={settled} onError={setActionError} />}
              onOpenTile={openTile} />
          )}
        </div>
      </section>
      </div>
      )}
    </div>
  )
}

// The open conversation's decision cards (the agent writes them to its state file),
// what it's waiting on, and what's been decided.
// The open questions are answered together: pick an answer on each card (in any
// order, change your mind freely), then send them all as one message. One reply
// lets the agent take every answer in one turn, instead of a queue of single
// answers it has to work through one at a time.
function Decisions({ state, slotKey, settled, onError }: {
  state: PhaseState | null
  slotKey: string | null
  settled?: boolean // the ticket is done (or its conversation closed): nothing here waits on you
  onError: (m: string) => void
}) {
  const api = useAppApi()
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [sent, setSent] = useState<Record<string, string>>({}) // sent, until the agent records them
  const [sending, setSending] = useState(false)
  const open = settled ? [] : state?.decisions.filter(d => !d.answer && !sent[d.id]) ?? []
  const waiting = settled ? [] : state?.decisions.filter(d => !d.answer && sent[d.id]) ?? []
  const decided = state?.decisions.filter(d => d.answer) ?? []
  // Settled work asks nothing: unanswered cards read as history, not questions.
  const unrecorded = settled ? state?.decisions.filter(d => !d.answer) ?? [] : []
  if (!open.length && !waiting.length && !decided.length && !unrecorded.length && !(state?.blocking && !settled)) return null

  const picked = open.filter(d => (picks[d.id] ?? '').trim())
  const withRecommendation = open.filter(d => d.recommended)
  const pick = (id: string, answer: string) => setPicks(p => ({ ...p, [id]: answer }))
  const takeRecommended = () => setPicks(p => {
    const next = { ...p }
    for (const d of withRecommendation) if (!(next[d.id] ?? '').trim()) next[d.id] = d.recommended!
    return next
  })

  const send = async () => {
    if (!slotKey || !picked.length) return
    const left = open.filter(d => !(picks[d.id] ?? '').trim())
    const lines = picked.map((d, i) => `${i + 1}. ${d.title} (${d.id}): ${picks[d.id].trim()}`)
    const message = [
      `My answers to your ${picked.length === 1 ? 'question' : `${picked.length} questions`}:`,
      '',
      ...lines,
      '',
      left.length
        ? `Still open, I'll answer later: ${left.map(d => d.title).join('; ')}.`
        : "That's all of them. Record each answer, then carry on.",
    ].join('\n')
    setSending(true)
    try {
      await api.post('/api/chat?ws=1', { slot: slotKey, message })
      setSent(s => ({ ...s, ...Object.fromEntries(picked.map(d => [d.id, picks[d.id].trim()])) }))
      setPicks({})
    } catch (e) {
      onError(`Couldn't send your answers: ${errorText(e)}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {open.length > 0 && (
        <Block title={<>Decisions (<Abbr term="HITL">HITL</Abbr>)</>}
          aside={picked.length ? `${picked.length} of ${open.length} picked` : `${open.length} open`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {open.map((d, i) => (
              <DecisionCard key={d.id} n={i + 1} decision={d} pick={picks[d.id] ?? null} disabled={!slotKey || sending}
                onPick={a => pick(d.id, a)} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <Btn primary disabled={!slotKey || !picked.length || sending} onClick={() => void send()}>
              {sending ? 'Sending…' : picked.length === open.length ? `Send all ${open.length} answers` : picked.length ? `Send ${picked.length} answer${picked.length === 1 ? '' : 's'}` : 'Send answers'}
            </Btn>
            {withRecommendation.some(d => !(picks[d.id] ?? '').trim()) && (
              <Btn disabled={!slotKey || sending} onClick={takeRecommended}>Take all recommendations</Btn>
            )}
            <span style={{ ...muted, fontSize: T.tiny }}>
              {!slotKey ? 'Start the conversation to answer.'
                : picked.length && picked.length < open.length ? 'Unanswered ones stay here for later.'
                : 'Sent together, as one message.'}
            </span>
          </div>
        </Block>
      )}
      {waiting.length > 0 && (
        <Block title="Sent, waiting for the agent" aside={waiting.length}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {waiting.map(d => (
              <li key={d.id} style={{ fontSize: T.small, lineHeight: 1.4 }}>
                <div style={muted}>{d.title}</div>
                <div>{sent[d.id]}</div>
              </li>
            ))}
          </ul>
        </Block>
      )}
      {state?.blocking && !settled && (
        <Block title="Waiting on">
          <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: T.body }}>{state.blocking}</div>
        </Block>
      )}
      {(decided.length > 0 || unrecorded.length > 0) && (
        <Block title="Decided" aside={`${decided.length}${unrecorded.length ? ` · ${unrecorded.length} settled in the conversation` : ''}`}
          collapsible defaultOpen={false}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {decided.map(d => (
              <li key={d.id} style={{ fontSize: T.small, lineHeight: 1.4 }}>
                <div style={muted}>{d.title}</div>
                <div>{d.answer}</div>
              </li>
            ))}
            {unrecorded.map(d => (
              <li key={d.id} style={{ fontSize: T.small, lineHeight: 1.4 }}>
                <div style={muted}>{d.title}</div>
                <div style={{ ...muted, fontStyle: 'italic' }}>Settled in the conversation; no answer was recorded.</div>
              </li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- middle column

// Kiro's full chat page for the session, right panel and all: subagents, browser,
// terminal, background work. The popout route is the one surface where Kiro keeps
// that panel working in an embedded chat (its /chat page suppresses it whenever
// the chat is embedded and not a popout), and it centers the conversation at
// Kiro's own reading width. Same origin, so it shares the dashboard's login.
function KiroChatFrame({ slotKey }: { slotKey: string }) {
  const src = `/popout/chat?sid=${encodeURIComponent(slotKey)}`
  const ref = useRef<HTMLIFrameElement>(null)
  // A control inside the page ("return to main") would navigate the frame to the
  // whole dashboard; put it back on the popout chat instead.
  const onLoad = () => {
    const frame = ref.current
    try {
      const path = frame?.contentWindow?.location.pathname
      if (frame && path && !path.startsWith('/popout/chat')) frame.src = src
    } catch { /* same origin, so never unreadable; just in case */ }
  }
  return (
    <iframe ref={ref} src={src} title="The session in Kiro's chat" onLoad={onLoad}
      style={{ flex: 1, minHeight: 0, width: '100%', border: 0, background: 'var(--bg)' }} />
  )
}

const TILE_ACTIONS: Record<Tile['type'], { what: string; action: string; body: string }> = {
  grilling: { what: 'Grill', action: 'Start the grill', body: 'An interview with you to settle this decision. It updates GLOSSARY.md and the ADRs as answers land.' },
  prototype: { what: 'Prototype', action: 'Start a prototype', body: 'Throwaway code or an outline to react to, so the decision gets made against something concrete.' },
  research: { what: 'Research', action: 'Run the research', body: 'The agent reads primary sources and leaves a cited note on a research branch. No HITL (human-in-the-loop) step.' },
  task: { what: 'Task', action: 'Start this task', body: 'Work that has to happen before a decision can be made. The agent does what it can and hands you a checklist for the rest.' },
  build: { what: 'Build', action: 'Implement this ticket', body: '/implement builds this ticket test-first in its own conversation, then reviews it.' },
  issue: { what: 'Issue', action: 'Triage it', body: 'A follow-up filed on the map. Triage moves it to an agent-ready brief, or asks you what it needs.' },
}

// Where a conversation would be, when there isn't one: why not, and the one
// button that starts it (plus a real alternative, where there is one). The
// ticket's own details are on the right; this doesn't repeat them.
function NotStarted({ detail, focus, ticket, tile, starting, onStart, alternatives, onSkill }: {
  detail: EffortDetail
  focus: Focus
  ticket: TicketInfo | null
  tile: Tile | null
  starting: boolean
  onStart: () => void
  alternatives: Alternative[]
  onSkill: (s: string) => void
}) {
  let title: string
  let body: string
  let action: string | null
  if (tile) {
    const a = TILE_ACTIONS[tile.type]
    if (tile.state === 'done') {
      title = 'Closed'
      body = tile.sessionKey
        ? 'Its conversation was closed when the ticket was. How it ended is on the Board (Details →).'
        : 'How it ended is on the Board (Details →).'
      action = null
    } else if (tile.state === 'blocked') {
      title = `Waiting on ${tile.blockedBy.map(n => `#${n}`).join(', ')}`
      body = 'It can start once those are closed.'
      action = null
    } else if (tile.state === 'review') {
      title = 'In review'
      body = 'Its PR is open. The effort\'s Review merges it once it\'s clean.'
      action = null
    } else {
      title = 'No conversation yet'
      body = `${tile.who === 'you' ? 'HITL (human in the loop): it needs you.' : 'Agent (AFK, away from keyboard): an agent can take it on its own.'} ${a.body}`
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
  } else if (focus.kind === 'column') {
    title = 'Start the conductor'
    body = "The conductor runs this effort: it reads the frontier from GitHub, starts one stage-skill conversation per open thread, "
      + 'asks you in one batched message, and closes the effort when the frontier is empty. It never does the work itself.'
    action = 'Start the conductor'
  } else {
    const col = focus.column
    const shared = col === 'plan' && detail.sessions.grill
    title = `${COLUMN_LABELS[col]} hasn't started`
    body = shared ? 'Plan continues the Grill conversation, so the spec and tickets are written with everything it learned.'
      : `${COLUMN_HINTS[col]}`
    action = shared ? 'Continue in the Grill conversation' : `Start ${COLUMN_LABELS[col]}`
  }
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ ...strong, fontSize: T.title }}>{title}</div>
        <div style={{ ...muted, fontSize: T.body, margin: '6px 0 14px', lineHeight: 1.5 }}>{body}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
          {action && <Btn primary disabled={starting} onClick={onStart}>{starting ? 'Starting…' : action}</Btn>}
        </div>
        {action && alternatives.map(a => (
          <div key={a.skill} style={{ marginTop: 10, fontSize: T.small }}>
            <span style={muted}>or </span>
            <button type="button" disabled={starting} onClick={() => onSkill(a.skill)} title={SKILL_HINTS[a.skill]}
              style={{ background: 'transparent', padding: 0, color: 'var(--accent)', cursor: starting ? 'default' : 'pointer', fontSize: T.small }}>
              /{a.skill}
            </button>
            <span style={muted}> {a.label}</span>
          </div>
        ))}
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
  // A wayfinder map isn't KiPo's: it only leaves the board here, and closes on
  // GitHub when its last ticket does.
  const isMap = detail.kind === 'map'
  if (confirm && isMap) {
    return (
      <span style={{ ...group, fontSize: T.small }}>
        <span style={{ ...muted, whiteSpace: 'nowrap' }}>Hide this map in KiPo? It stays open on GitHub.</span>
        <ActionButton danger disabled={busy} onClick={onRemove}>Hide</ActionButton>
        <ActionButton disabled={busy} onClick={() => setConfirm(null)}>Cancel</ActionButton>
      </span>
    )
  }
  if (isMap) {
    return (
      <span style={group}>
        <TextButton disabled={busy} onClick={() => setConfirm('remove')} title="Take this map off KiPo's board. The map stays open on GitHub.">Hide map</TextButton>
        {stage === 'done' && !detail.sessions.done && (
          <ActionButton disabled={busy} onClick={onRetro}>Run /retro</ActionButton>
        )}
      </span>
    )
  }
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
      <TextButton disabled={busy} onClick={() => setConfirm('remove')} title="Close this effort's issue as not planned and take it off the board">Remove effort</TextButton>
      {stage === 'done' && !detail.sessions.done && (
        <ActionButton disabled={busy} onClick={onRetro}>Run /retro</ActionButton>
      )}
      {stage === 'done' && (
        <ActionButton primary disabled={busy} onClick={() => setConfirm('skip')}>{busy ? 'Closing…' : 'Close effort'}</ActionButton>
      )}
    </span>
  )
}

const isColumn = (key: string) => (COLUMNS as readonly string[]).includes(key)

// The one real choice when starting: how to start it. Only where Matt's skills
// offer a genuine alternative; everywhere else Start runs the right skill.
type Alternative = { skill: string; label: string }
function startAlternatives(tile: Tile | null, column: Column | null): Alternative[] {
  const grill = tile ? tile.type === 'grilling' : column === 'grill'
  return grill ? [{ skill: 'grill-me', label: 'without writing docs' }] : []
}

// What the open conversation is running: the skills its agent has loaded, from
// its own state file. Hover a name for what it does.
function Running({ skills }: { skills: string[] }) {
  return (
    <span style={{ ...muted, fontSize: T.tiny, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
      Running{' '}
      {skills.map((s, i) => (
        <span key={s}>
          {i > 0 && ' · '}
          <span title={SKILL_HINTS[s] ?? s} style={{ color: 'var(--text)', cursor: 'help' }}>{s}</span>
        </span>
      ))}
    </span>
  )
}

function Block({ title, aside, children, collapsible, defaultOpen = true }: {
  title: ReactNode
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

// One question: its options as a radio list with the recommended one marked, and
// a box for any other answer. Picking only marks it; the answers go together.
function DecisionCard({ n, decision: d, pick, disabled, onPick }: {
  n: number; decision: Decision; pick: string | null; disabled: boolean; onPick: (answer: string) => void
}) {
  const custom = pick !== null && !d.options.includes(pick)
  const done = !!(pick ?? '').trim()
  return (
    <div style={{ border: `1px solid ${done ? 'var(--border)' : 'var(--accent)'}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 10px', fontSize: T.body }}>
        <span style={{ ...muted, fontSize: T.small, flexShrink: 0 }}>{n}.</span>
        <span style={{ ...strong, flex: 1 }}>{d.title}</span>
        <Badge variant={done ? 'muted' : 'aim'}>{done ? 'answered' : 'open'}</Badge>
      </div>
      {d.options.map(o => {
        const chosen = pick === o
        return (
          <button key={o} type="button" role="radio" aria-checked={chosen} disabled={disabled} onClick={() => onPick(o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '7px 10px',
              borderTop: '1px solid var(--border)', background: chosen ? 'var(--bg-elevated)' : 'transparent', color: 'var(--text)',
              fontSize: T.small, cursor: disabled ? 'default' : 'pointer',
            }}>
            <span aria-hidden style={{ width: 12, height: 12, borderRadius: 999, border: `1.5px solid ${chosen ? 'var(--accent)' : 'var(--muted)'}`,
              flexShrink: 0, background: chosen ? 'var(--accent)' : 'transparent', boxShadow: chosen ? 'inset 0 0 0 2px var(--bg)' : undefined }} />
            <span style={{ flex: 1 }}>{o}</span>
            {o === d.recommended && <span style={{ fontSize: T.tiny, color: 'var(--accent)' }}>recommended</span>}
          </button>
        )
      })}
      <div style={{ borderTop: '1px solid var(--border)', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 8,
        background: custom ? 'var(--bg-elevated)' : 'transparent' }}>
        <span aria-hidden style={{ width: 12, height: 12, borderRadius: 999, border: `1.5px solid ${custom ? 'var(--accent)' : 'var(--muted)'}`,
          flexShrink: 0, background: custom ? 'var(--accent)' : 'transparent', boxShadow: custom ? 'inset 0 0 0 2px var(--bg)' : undefined }} />
        <input value={custom ? pick! : ''} onChange={e => onPick(e.target.value)} disabled={disabled}
          aria-label={`Another answer to: ${d.title}`}
          placeholder="Something else…"
          style={{ flex: 1, background: 'transparent', color: 'var(--text)', fontSize: T.small, border: 0, outline: 'none', padding: '2px 0' }} />
      </div>
    </div>
  )
}

