import { useAppApi } from '@kirocrew/app-sdk'
import { Btn } from '@kirocrew/app-sdk/ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Map as MapIcon, PanelRight } from 'lucide-react'
import { BackendError, backend, errorText } from './api'
import { ErrorLine, MapTag, T, muted, strong } from './common'
import { cached, remember } from './cache'
import { type SessionStatus } from './Frontier'
import { chain, TileGraph } from './Graph'
import { Divider, useFitSplit } from './layout'
import { StationsPanel } from './Stations'
import { QuestionWizard, TicketPanel } from './SessionPanel'
import { closeFinished, isClosed, openSession } from './sessions'
import { dispatchStarts } from './dispatch'
import { dueWakes, observation, wakeMessage, watched, wokeNote } from './stalls'
import {
  COLUMNS, COLUMN_HINTS, COLUMN_LABELS, SKILL_HINTS,
  type Column, type EffortDetail, type PhaseState, type SessionActivity, type TicketInfo, type Tile,
} from './types'

// The workspace, after Spec Builder's: the conversation in the middle at full
// height; on the right the column row, the column's skills, what it produces,
// and what it's waiting on. Every divider can be dragged.

type Focus =
  | { kind: 'column' }
  | { kind: 'ticket'; t: number }   // a /implement session for one ticket
  | { kind: 'spec' }                // the /implement-spec session across all tickets
  | { kind: 'decision'; t: number } // a Decide ticket: a map child, or the source issue being triaged
  | { kind: 'review'; t: number }   // one ticket's kipo-review session: its PR reviewed, fixed, merged
  | { kind: 'stage'; column: Column } // one column's own conversation: review, plan (the hand-over), done (retro)

const focusKey = (f: Focus) =>
  f.kind === 'ticket' ? `build-t${f.t}` : f.kind === 'spec' ? 'build-spec' : f.kind === 'decision' ? `shape-t${f.t}`
    : f.kind === 'review' ? `review-t${f.t}`
    : f.kind === 'stage' ? f.column : 'conductor' // the effort's own conversation is its conductor

export function Workspace({ repo, number, active, autoStart, spineHost, spineCompact, onRemoved, onChanged }: {
  repo: string
  number: number
  active: boolean
  autoStart?: boolean
  // The sidebar's slot under this effort's row: the spine (conductor + seven
  // stations) portals into it, so the stations live in the existing sidebar.
  spineHost?: HTMLElement | null
  spineCompact?: boolean
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
  // The spine lives in the sidebar; the conversation fills the rest, and its
  // right panel is Kiro's own native side panel inside the chat.
  // A ticket's map ("Where it sits") over its conversation.
  const chainSplit = useFitSplit('chain', 100, 0.75)

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
  useEffect(() => { setActionError('') }, [column, focus])
  // Back to the column view when the effort moves on, but not on first load, so
  // the remembered ticket or decision stays open when you come back to KiPo.
  const lastColumn = useRef(column)
  useEffect(() => {
    if (column === undefined || lastColumn.current === column) { lastColumn.current = column; return }
    const moved = lastColumn.current !== undefined
    lastColumn.current = column
    if (moved) setFocus({ kind: 'column' })
  }, [column])

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
        : f.kind === 'review' ? { column: 'review' as Column, ticket: f.t, skill }
        : f.kind === 'stage' ? { column: f.column, skill }
        : { column: detail.column, mode: 'conductor' as const }
      const res = await backend.startSession(repo, number, body)
      const title = f.kind === 'ticket' ? `${detail.title}: #${f.t}`
        : f.kind === 'spec' ? `${detail.title}: implement-spec`
        : f.kind === 'decision' ? `${detail.title}: decision #${f.t}`
        : f.kind === 'review' ? `${detail.title}: review #${f.t}`
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
  // And, for the running ones, what it's doing: the last message's time and
  // first line, so the spine can say "running 12m · tests green, wiring the
  // endpoint" without opening the session.
  const [statuses, setStatuses] = useState<Record<number, SessionStatus>>({})
  const [activity, setActivity] = useState<Record<number, SessionActivity>>({})
  const sessionTiles = useMemo(
    () => (detail?.frontier?.tiles ?? []).filter(t => t.sessionKey && detail?.sessions[t.sessionKey]),
    [detail],
  )
  useEffect(() => {
    if (!sessionTiles.length) { setStatuses({}); setActivity({}); return }
    let live = true
    type SlotInfo = {
      running?: boolean
      pending_approval?: boolean // stopped on a trust prompt
      needs_input?: boolean      // asked and is waiting for an answer
      messages?: { ts?: string; role?: string; content?: unknown; text?: unknown }[]
    }
    // The last message's first line, whatever shape its content takes; null when
    // the field isn't there (then the row shows only the elapsed time).
    const lineOf = (m: { content?: unknown; text?: unknown } | undefined): string | null => {
      const c = m?.content ?? m?.text
      const s = typeof c === 'string' ? c
        : Array.isArray(c) ? c.map(x => (typeof x === 'string' ? x : (x as { text?: string })?.text ?? '')).join(' ')
        : null
      const t = s?.replace(/\s+/g, ' ').trim()
      return t ? t.slice(0, 140) : null
    }
    const poll = () => {
      void Promise.all(sessionTiles.map(t =>
        api.get<SlotInfo>(`/api/chat/slots/${encodeURIComponent(detail!.sessions[t.sessionKey!])}?limit=1`)
          .then(r => {
            const last = r?.messages?.[r.messages.length - 1]
            const needs = r?.pending_approval ? 'approval' as const : r?.needs_input ? 'input' as const : null
            const act: SessionActivity = { at: last?.ts ?? null, line: last && last.role !== 'user' ? lineOf(last) : null, needs }
            // A trust prompt or a question outranks running; a finished
            // ticket's idle session isn't waiting on anyone: no dot.
            const status = needs ? 'attention' as const : r?.running ? 'running' as const : t.state === 'done' ? null : 'waiting' as const
            return [t.number, status, act] as const
          })
          .catch(() => null),
      )).then(rows => {
        if (!live) return
        const next: Record<number, SessionStatus> = {}
        const acts: Record<number, SessionActivity> = {}
        for (const row of rows) {
          if (!row) continue
          if (row[1]) next[row[0]] = row[1]
          acts[row[0]] = row[2]
        }
        setStatuses(next)
        setActivity(acts)
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
  // An entry's skill picks the conversation: kipo-review on a ticket is that
  // ticket's review (review-t<t>), beside its build; none, or kipo-build, is
  // its build or decision. Entries are told apart by ticket or stage, skill and
  // time, so a ticket's review isn't taken for its build that already started.
  const dispatchSeenKey = `kipo.dispatched:${repo}#${number}`
  const dispatching = useRef(new Set<string>())
  useEffect(() => {
    if (!active || starting || startingAgents || !detail?.frontier) return
    const queue = detail.sessionStates?.conductor?.dispatch ?? []
    let seen: string[] = []
    try { seen = JSON.parse(localStorage.getItem(dispatchSeenKey) || '[]') } catch { seen = [] }
    const { fresh, starts } = dispatchStarts(
      queue, id => seen.includes(id) || dispatching.current.has(id), detail.frontier.tiles, detail.sessions)
    if (!fresh.length) return
    for (const id of fresh) { dispatching.current.add(id); seen.push(id) }
    try { localStorage.setItem(dispatchSeenKey, JSON.stringify(seen.slice(-300))) } catch { /* full: fine */ }
    if (!starts.length) return
    void (async () => {
      for (const s of starts) {
        if (s.kind === 'tile') await start(s.skill ?? tileSkill(s.tile), tileFocus(s.tile), false)
        else if (s.kind === 'review') await start(null, { kind: 'review', t: s.t }, false)
        else await start(s.skill, { kind: 'stage', column: s.column }, false)
      }
      load(); onChanged()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, starting, startingAgents, detail])

  // The conductor's Watch: when a ticket's or PR's state changed since it last
  // heard (remembered per effort, so changes while the page was closed count
  // too), tell it, unless it's mid-turn; it re-reads the frontier itself.
  const conductorSlot = detail?.sessions.conductor && !isClosed(detail.sessions.conductor) ? detail.sessions.conductor : null
  // A session turning stuck (backend/kipo/stalls.py: woken twice, no answer) is a change too.
  const stuckKeys = (detail?.closing ?? []).filter(r => r.stall?.state === 'stuck').map(r => r.key)
  const frontierSig = detail?.frontier
    ? JSON.stringify({
      t: detail.frontier.tiles.map(t => [t.number, t.state]), p: detail.prs.map(p => [p.number, p.state]),
      ...(stuckKeys.length ? { s: stuckKeys } : {}),
    })
    : ''
  useEffect(() => {
    if (!frontierSig || !conductorSlot || !active) return
    const sigKey = `kipo.conductorSaw:${repo}#${number}`
    const prev = localStorage.getItem(sigKey)
    if (prev === frontierSig) return
    if (prev === null) { localStorage.setItem(sigKey, frontierSig); return } // it read the frontier when it started
    const changes: string[] = []
    try {
      const was = JSON.parse(prev) as { t: [number, string][]; p: [number, string][]; s?: string[] }
      const now = JSON.parse(frontierSig) as typeof was
      const before = new Map(was.t), prBefore = new Map(was.p)
      for (const [n, s] of now.t) if (before.get(n) !== s) changes.push(`#${n} ${before.get(n) ?? 'new'} → ${s}`)
      for (const [n, s] of now.p) if (prBefore.get(n) !== s) changes.push(`PR #${n} ${(prBefore.get(n) ?? 'new').toLowerCase()} → ${s.toLowerCase()}`)
      for (const k of now.s ?? []) if (!(was.s ?? []).includes(k)) changes.push(`${k} stuck (woken twice, no answer)`)
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

  // The conductor's Reports: every stage session reports to it (kipo_cli.py
  // report). Wake it with the ones it hasn't read yet, unless it's mid-turn
  // (then on a later poll; its frontier carries them anyway). Each report is
  // sent once per browser; one it already read in its frontier isn't sent.
  useEffect(() => {
    const r = detail?.reports
    if (!r || !conductorSlot || !active) return
    const sentKey = `kipo.reportsSent:${repo}#${number}`
    const sent = Number(localStorage.getItem(sentKey) || '0')
    const fresh = r.reports.filter(x => x.id > Math.max(sent, r.read))
    if (!fresh.length) return
    void (async () => {
      try {
        const info = await api.get<{ running?: boolean }>(`/api/chat/slots/${encodeURIComponent(conductorSlot)}?limit=1`)
        if (info?.running) return
        const what = (x: typeof fresh[number]) =>
          `${x.event}: ${x.text}${x.items?.length ? ` (${x.items.join('; ')})` : ''}`
        const head = fresh.length === 1
          ? `[KiPo] Report from ${fresh[0].from}: ${what(fresh[0])}`
          : `[KiPo] Reports from the sessions:\n${fresh.slice(-12).map(x => `- ${x.from} ${what(x)}`).join('\n')}`
        await api.post('/api/chat?ws=1', { slot: conductorSlot, message: `${head}\nRun the frontier and carry on.` })
        localStorage.setItem(sentKey, String(fresh[fresh.length - 1].id))
      } catch { /* try again on the next poll */ }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, conductorSlot, active])

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

  // Close the sessions the close rule calls closable (backend/kipo/closing.py:
  // finished, thread settled, no open cards, never the conductor), on this 5 s
  // refresh, and tell KiPo which closed so `kipo_cli.py sessions` shows them.
  // Skips one that's still running or on screen; it closes on a later pass.
  const closingRef = useRef(false)
  useEffect(() => {
    if (!detail?.closing || !active || closingRef.current) return
    const due = detail.closing.filter(s => s.status === 'closable')
    if (!due.length) return
    closingRef.current = true
    void closeFinished(api, due.map(s => s.slot), slotKey)
      .then(slots => {
        const keys = due.filter(s => slots.includes(s.slot)).map(s => s.key)
        return keys.length ? backend.sessionsClosed(repo, number, keys).then(() => load()) : undefined
      })
      .catch(() => { /* try again on the next refresh */ })
      .finally(() => { closingRef.current = false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, detail, active, slotKey])

  // Stalled sessions (backend/kipo/stalls.py). Every 30 s, read what Kiro Crew
  // says of each open stage session (GET /api/chat/slots/<slot>?limit=1: the
  // last message's time and author, mid-turn or not) and give it to KiPo, which
  // decides which have stalled: idle 15 min with work unfinished, or their
  // blocker cleared.
  const watchSig = JSON.stringify(watched(detail?.closing ?? []).filter(r => !isClosed(r.slot)).map(r => [r.key, r.slot]))
  useEffect(() => {
    const rows = JSON.parse(watchSig) as [string, string][]
    if (!active || !rows.length) return
    let live = true
    const poll = () => {
      void Promise.all(rows.map(([key, slot]) =>
        api.get<{ running?: boolean; messages?: { ts?: string; role?: string }[] }>(`/api/chat/slots/${encodeURIComponent(slot)}?limit=1`)
          .then(info => [key, observation(info)] as const)
          .catch(() => null),
      )).then(got => {
        if (!live) return
        const activity = Object.fromEntries(got.filter(g => g && g[1]).map(g => [g![0], g![1]!]))
        if (Object.keys(activity).length) void backend.sessionsActivity(repo, number, activity).catch(() => { /* next poll */ })
      })
    }
    poll()
    const id = setInterval(poll, 30000)
    return () => { live = false; clearInterval(id) }
  }, [api, watchSig, active, repo, number])

  // Wake each stalled session once per stall, through the same chat websocket
  // as the conductor, unless it's mid-turn or on screen (closing's guards).
  // KiPo records the wake (.kipo/<n>/wakes.json); after two unanswered it is
  // stuck, never woken again, and the conductor puts it to the human. The
  // conductor is told of each wake ("[KiPo] Woke …") when it isn't mid-turn.
  const wokeKey = `kipo.woke:${repo}#${number}`
  const notesKey = `kipo.wokeNotes:${repo}#${number}`
  const wakingRef = useRef(false)
  useEffect(() => {
    if (!detail?.closing || !active || wakingRef.current) return
    let woke: string[] = []
    try { woke = JSON.parse(localStorage.getItem(wokeKey) || '[]') } catch { woke = [] }
    let notes: string[] = []
    try { notes = JSON.parse(localStorage.getItem(notesKey) || '[]') } catch { notes = [] }
    const due = dueWakes(detail.closing, slotKey, id => woke.includes(id)).filter(r => !isClosed(r.slot))
    if (!due.length && !(notes.length && conductorSlot)) return
    wakingRef.current = true
    void (async () => {
      for (const r of due) {
        const s = r.stall!
        try {
          const info = await api.get<{ running?: boolean }>(`/api/chat/slots/${encodeURIComponent(r.slot)}?limit=1`)
          if (info?.running) continue // mid-turn: not stalled after all
          await api.post('/api/chat?ws=1', { slot: r.slot, message: wakeMessage(s.why) })
          woke = [...woke, `${r.key}/${s.id}`].slice(-300)
          localStorage.setItem(wokeKey, JSON.stringify(woke))
          notes = [...notes, wokeNote(r.key, s.why)]
          localStorage.setItem(notesKey, JSON.stringify(notes))
          await backend.sessionsWoken(repo, number, r.key, s.id ?? '', s.why)
        } catch { /* try again on the next refresh */ }
      }
      if (notes.length && conductorSlot) {
        try {
          const info = await api.get<{ running?: boolean }>(`/api/chat/slots/${encodeURIComponent(conductorSlot)}?limit=1`)
          if (!info?.running) {
            await api.post('/api/chat?ws=1', { slot: conductorSlot, message: `${notes.slice(-12).join('\n')}\nRun the frontier and carry on.` })
            localStorage.setItem(notesKey, '[]')
          }
        } catch { /* told on a later refresh */ }
      }
      if (due.length) load()
    })().finally(() => { wakingRef.current = false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, detail, active, slotKey, conductorSlot])

  const autoStarted = useRef(false)
  useEffect(() => {
    if (!autoStart || autoStarted.current || !detail) return
    autoStarted.current = true
    if (!detail.sessions[detail.column]) void start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, detail])

  if (!detail) {
    return (
      <div style={{ flex: 1, padding: 24 }}>
        {loadError ? <ErrorLine>{loadError}</ErrorLine> : <span style={{ ...muted, fontSize: T.body }}>Loading…</span>}
      </div>
    )
  }

  // The open conversation's own state (CONTRACT.md: one state file per
  // conversation): the effort's own uses state.json, a ticket's its own file.
  const convState: PhaseState | null = key && !isColumn(key) ? detail.sessionStates?.[key] ?? null : detail.state
  const running = convState?.skillsUsed ?? []
  // Every conversation with open questions, in spine order: the conductor,
  // then the tickets, then the stage conversations. The spine's amber chip
  // walks them: each click jumps to the next one, cycling.
  const openQCount = (s?: PhaseState | null) => s?.decisions.filter(d => !d.answer).length ?? 0
  const questionStops: Focus[] = []
  if (openQCount(detail.sessionStates?.conductor ?? detail.state)) questionStops.push({ kind: 'column' })
  for (const t of detail.frontier?.tiles ?? []) {
    if (t.state === 'done' || !t.sessionKey || !openQCount(detail.sessionStates?.[t.sessionKey])) continue
    questionStops.push(t.sessionKey.startsWith('review-t') ? { kind: 'review', t: t.number }
      : t.lane === 'deliver' ? { kind: 'ticket', t: t.number } : { kind: 'decision', t: t.number })
  }
  for (const c of ['plan', 'review', 'done', 'intake', 'shape', 'grill'] as Column[]) {
    if (detail.sessions[c] && openQCount(detail.sessionStates?.[c])) questionStops.push({ kind: 'stage', column: c })
  }
  if (detail.sessions['build-spec'] && openQCount(detail.sessionStates?.['build-spec'])) questionStops.push({ kind: 'spec' })
  const jumpQuestions = () => {
    if (!questionStops.length) return
    const idx = questionStops.findIndex(f => focusKey(f) === key)
    setFocus(questionStops[(idx + 1) % questionStops.length])
  }

  // Kiro hides its side-panel toggle on every embedded surface (the button is
  // guarded by `!embedMode`, and the popout sets embedMode:'chat'). But the chat
  // page toggles that panel from a window event — `window.dispatchEvent(new
  // Event('toggle-activity-panel'))` is exactly what its own toggle fires — and
  // the popout is same-origin, so KiPo's own button can fire it into the frame
  // to show AND hide Kiro's real native panel (browser, +, Changes, Terminal…).
  const chatFrameRef = useRef<HTMLIFrameElement>(null)
  const toggleKiroPanel = () => {
    try { chatFrameRef.current?.contentWindow?.dispatchEvent(new Event('toggle-activity-panel')) } catch { /* same origin */ }
  }
  // A ticket's "Where it sits" map is shown on demand, not stacked over the chat.
  const [mapOpen, setMapOpen] = useState(false)
  // The question card's height: the chat's transcript is padded by it (inside
  // the same-origin frame), so the conversation scrolls clear of the card
  // instead of hiding behind it.
  const [wizardH, setWizardH] = useState(0)
  const onWizardSize = useCallback((h: number) => setWizardH(p => (Math.abs(p - h) > 4 ? h : p)), [])
  // The conductor's overview panel width (the right side of the conductor screen).
  // A done ticket (or a closed conversation) is settled: its unanswered
  // decisions are history, so the question wizard stays closed on it.
  const settled = focusTile ? focusTile.state === 'done' : !!recorded && isClosed(recorded)
  // The open conversation's own state drives the question wizard. A ticket uses
  // its own file; the conductor its own, falling back to the effort's.
  const wizardState = focus.kind === 'column' ? (convState ?? detail.state) : convState

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* One view. The conductor screen: its conversation, with its question
          cards and the effort as seven stations on the right. A ticket's
          session: its map over its conversation, with its question cards and
          the ticket on the right. */}
      <style>{'@keyframes kipo-pulse{0%,100%{opacity:1}50%{opacity:.35}}.kipo-pulse{animation:kipo-pulse 1.2s ease-in-out infinite}'}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid var(--border)', minWidth: 0 }}>
        <span style={{ ...strong, fontSize: T.small, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }} title={detail.title}>
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
      </div>
      {actionError && <div style={{ padding: '6px 12px 0' }}><ErrorLine>{actionError}</ErrorLine></div>}

      {(() => {
          // The slim header: what's open and what it's running. The embedded
          // chat page carries the session's title, renaming and Kiro's side
          // panel (subagents, browser, terminal, changes) itself.
          const chatHead = (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 16px', borderBottom: '1px solid var(--border)', minWidth: 0, minHeight: 30 }}>
              <span style={{ ...(slotKey ? muted : strong), fontSize: slotKey ? T.small : T.body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                {focusTile ? `#${focusTile.number}${slotKey ? '' : ` ${focusTile.title}`}` : focus.kind === 'column' ? 'Conductor' : detail.title}
              </span>
              {slotKey && running.length > 0 && <Running skills={running} />}
              <span style={{ flex: 1 }} />
              {focusTile && (detail.frontier ? chain(detail.frontier.tiles, focusTile.number).length > 1 : false) && (
                <button type="button" onClick={() => setMapOpen(o => !o)} aria-pressed={mapOpen}
                  title="Show or hide this ticket's map — what it waits on and what it unblocks"
                  aria-label="Show or hide the map"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 24, padding: '0 8px',
                    borderRadius: 6, background: mapOpen ? 'var(--bg-elevated)' : 'transparent',
                    color: mapOpen ? 'var(--text)' : 'var(--muted)', cursor: 'pointer', flexShrink: 0, fontSize: T.small,
                    border: `1px solid ${mapOpen ? 'var(--border)' : 'transparent'}` }}>
                  <MapIcon size={14} /> Map
                </button>
              )}
              {slotKey && (
                <button type="button" onClick={toggleKiroPanel}
                  title="Show or hide the side panel — browser, Changes, Terminal, Subagents"
                  aria-label="Show or hide the side panel"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24,
                    borderRadius: 6, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover, var(--bg-elevated))'; e.currentTarget.style.color = 'var(--text)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' }}>
                  <PanelRight size={15} />
                </button>
              )}
            </div>
          )
          // A ticket you can still start (ready, or HITL) shows a Start button
          // over its details; done / blocked / in-review ones just show details.
          const canStartTile = focusTile && (focusTile.state === 'you' || focusTile.state === 'afk')
          const chatBody = slotKey ? (
            <KiroChatFrame key={slotKey} slotKey={slotKey} frameRef={chatFrameRef} padBottom={wizardH ? wizardH + 24 : 0} />
          ) : focusTile ? (
            // No live conversation: the ticket's own details fill the centre
            // (where the chat would be), since there's no chat and no panel.
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'thin' }}>
              {canStartTile && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', padding: '16px', borderBottom: '1px solid var(--border)' }}>
                  <Btn primary disabled={starting} onClick={() => start(tileSkill(focusTile))}>
                    {starting ? 'Starting…' : (TILE_ACTIONS[focusTile.type]?.action ?? 'Start this ticket')}
                  </Btn>
                  {startAlternatives(focusTile, null).map(a => (
                    <button key={a.skill} type="button" disabled={starting} onClick={() => start(a.skill)} title={SKILL_HINTS[a.skill]}
                      style={{ background: 'transparent', padding: 0, color: 'var(--accent)', cursor: starting ? 'default' : 'pointer', fontSize: T.small }}>
                      /{a.skill} <span style={muted}>{a.label}</span>
                    </button>
                  ))}
                </div>
              )}
              <TicketPanel detail={detail} tile={focusTile} />
            </div>
          ) : (
            <NotStarted detail={detail} focus={focus} ticket={ticket} tile={null} starting={starting}
              onStart={() => start(null)}
              alternatives={startAlternatives(null, focus.kind === 'column' ? detail.column : null)} onSkill={s => start(s)} />
          )
          const chainTiles = focusTile && detail.frontier ? chain(detail.frontier.tiles, focusTile.number) : []

          // One screen, no modes. The spine (conductor + seven stations) lives
          // in the sidebar under this effort's row; clicking any of its rows
          // swaps only the conversation here and its questions on the right.
          const spine = spineHost ? createPortal(
            <StationsPanel detail={detail} statuses={statuses} activity={activity} busy={busy || starting || !!startingAgents}
              autopilot={autopilot} selectedKey={key} embedded compact={spineCompact} onAutopilot={setAutopilot}
              onOpenTile={openTile}
              onOpenConversation={k => setFocus(k === 'build-spec' ? { kind: 'spec' }
                : /^review-t\d+$/.test(k) ? { kind: 'review', t: Number(k.slice(8)) }
                : { kind: 'stage', column: k as Column })}
              onSelectConductor={() => setFocus({ kind: 'column' })}
              onJumpQuestions={jumpQuestions}
              onHandover={handover} onReview={openReview} onRetro={runRetro} onClose={closeEffort} />,
            spineHost,
          ) : null
          // The conversation fills the width. The ONE right panel is Kiro's own
          // native side panel (browser, +, Changes, Terminal), which lives
          // inside the popout chat with its own show/hide toggle — KiPo adds no
          // right panel of its own. A ticket's map sits over the chat.
          return (
            <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
              {spine}
              <section style={{ flex: '1 1 0', minWidth: 360, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {chatHead}
                {/* The ticket's map, only when toggled on (the Map button). */}
                {focusTile && chainTiles.length > 1 && mapOpen && (<>
                  <div ref={chainSplit.ref} style={{ ...chainSplit.style }}>
                    <div style={{ padding: '6px 16px 0', fontSize: T.tiny, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                      Where it sits
                    </div>
                    <TileGraph tiles={chainTiles} focus={focusTile.number} onOpen={openTile} labeled dimOthers={false} statuses={statuses} down />
                  </div>
                  <Divider direction="horizontal" label="Resize the ticket's map and its conversation"
                    onDrag={chainSplit.onDrag} onReset={chainSplit.reset} />
                </>)}
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                  {chatBody}
                  {/* The question card floats over the chat box, the way Kiro's
                      own question card replaces the entry box: open decisions
                      one at a time, Submit sends them as one message, Hide
                      tucks it into a pill. Keyed by session so one session's
                      sent answers never hide another's questions. */}
                  <QuestionWizard key={slotKey ?? 'none'} state={wizardState} slotKey={slotKey} settled={settled} onError={setActionError} onSize={onWizardSize} />
                </div>
              </section>
            </div>
          )
      })()}
    </div>
  )
}

// ---------------------------------------------------------------- middle column

// The conversation itself. `/popout/chat?sid=` is the one embedded surface that
// binds to a single session and renders ONLY that conversation (the plain
// `/embed/chat` surface shows the session list). Whether Kiro's own side panel
// shows inside it is governed by Kiro's "Keep Side Panel Open" setting, which
// the popout honors: with it OFF, the panel stays closed and this session has a
// single right panel — KiPo's, next door. Same origin, shares the login.
function KiroChatFrame({ slotKey, frameRef, padBottom = 0 }: {
  slotKey: string; frameRef: React.RefObject<HTMLIFrameElement>
  // Extra bottom padding for the chat's transcript, the question card's height:
  // the card overlays the frame, and this keeps the conversation scrolling
  // clear of it instead of hiding behind it.
  padBottom?: number
}) {
  const src = `/popout/chat?sid=${encodeURIComponent(slotKey)}`
  // Keep the frame on the session's chat, and hide the popout's dead "Return to
  // the main window" control. Same-origin, so we can read the path and style
  // the frame's own document.
  const snaps = useRef(0)
  // The chat's scroll container, found once and re-found if the page replaces
  // it; its paddingBottom is ours to keep in step with the card.
  const scroller = useRef<HTMLElement | null>(null)
  const pad = useRef(padBottom)
  pad.current = padBottom
  const applyPad = useCallback(() => {
    try {
      const doc = frameRef.current?.contentDocument
      if (!doc) return
      let el = scroller.current
      if (!el || !el.isConnected || el.ownerDocument !== doc) {
        const view = doc.defaultView
        const candidates = [...doc.querySelectorAll('div')].filter(n => {
          if (n.clientHeight < 200) return false
          const s = view?.getComputedStyle(n)
          return !!s && (s.overflowY === 'auto' || s.overflowY === 'scroll')
        }) as HTMLElement[]
        el = candidates.sort((a, b) => b.clientHeight - a.clientHeight)[0] ?? null
        scroller.current = el
      }
      if (!el) return
      const want = pad.current ? `${pad.current}px` : ''
      if (el.style.paddingBottom !== want) el.style.paddingBottom = want
    } catch { /* same origin */ }
  }, [frameRef])
  useEffect(() => { applyPad() }, [applyPad, padBottom])
  const onLoad = () => {
    const frame = frameRef.current
    try {
      const path = frame?.contentWindow?.location.pathname
      if (frame && path && !path.startsWith('/popout/chat')) { frame.src = src; return }
      const doc = frame?.contentDocument
      if (doc && !doc.getElementById('kipo-popout-css')) {
        const style = doc.createElement('style')
        style.id = 'kipo-popout-css'
        // Hide, on this embedded surface: the dead "Return to the main window"
        // / split-view links (there is no main window to return to), and Kiro's
        // own in-panel collapse — the session's one panel toggle is KiPo's
        // header button, which drives the panel both ways. Match any element
        // (the controls are not <button>s); English labels, locale-tolerant via
        // the substring match on the stable aria-label/title.
        style.textContent = [
          '[title*="main window" i]', '[aria-label*="main window" i]',
          '[title*="split view" i]', '[aria-label*="split view" i]',
          '[aria-label="Close panel"]', '[title="Close panel"]',
        ].join(',') + '{display:none !important}'
        doc.head.appendChild(style)
      }
    } catch { /* same origin, so never unreadable; just in case */ }
  }
  // The popout is a single-page app: when its session ends it can navigate
  // itself back to the stacked main view WITHOUT a load event, so onLoad's
  // guard never sees it and the centre fills with every session. Watch the
  // frame's path and snap it back (a few times only — if it keeps leaving,
  // the session is gone, and the next detail poll swaps this frame out for
  // the ticket's own panel).
  useEffect(() => {
    snaps.current = 0
    const id = window.setInterval(() => {
      const frame = frameRef.current
      try {
        const path = frame?.contentWindow?.location.pathname
        if (frame && path && !path.startsWith('/popout/chat') && snaps.current < 5) {
          snaps.current += 1
          frame.src = src
          return
        }
      } catch { /* same origin */ }
      // Keep the transcript's padding in step (the page re-renders freely).
      if (pad.current) applyPad()
    }, 2000)
    return () => window.clearInterval(id)
  }, [src, frameRef, applyPad])
  return (
    <iframe ref={frameRef} src={src} title="The session in Kiro's chat" onLoad={onLoad}
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
        ? 'Its conversation was closed when the ticket was. How it ended is on the right.'
        : 'How it ended is on the right.'
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
  } else if (focus.kind === 'review') {
    title = `Review #${focus.t}`
    body = "kipo-review reviews this ticket's PR, fixes what it finds, and merges it if it's a two-way door."
    action = 'Review this ticket'
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

