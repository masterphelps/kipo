import { ChatEmbed, useAppApi, type ChatEmbedSendMeta } from '@kirocrew/app-sdk'
import { Badge, Btn, MarkdownRenderer } from '@kirocrew/app-sdk/ui'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { BackendError, backend, errorText } from './api'
import { ActionButton, ErrorLine, PathChip, SizeBadge, T, TextButton, isUrl, muted, scrollRow, strong, timeAgo } from './common'
import { Divider, useStoredSize } from './layout'
import { openSession } from './sessions'
import {
  PHASES, PHASE_LABELS, ROUTED_SKILLS, STAGES, STAGE_LABELS, WORK_STAGES,
  type Artifact, type Decision, type Doc, type InitiativeDetail, type PhaseId, type PhaseState, type Stage, type Ticket, type TicketDetail,
} from './types'

// The workspace, after Spec Builder's: the conversation in the middle, at full
// height; on the right, what the phase is producing (its documents) above the
// decisions, the checklist and the rest. During delivery the right side becomes
// the ticket lanes, and picking a ticket puts its conversation in the middle.

type Focus = { kind: 'initiative' } | { kind: 'ticket'; t: number } | { kind: 'decision'; t: number }

const NEXT_STAGE: Partial<Record<Stage, Stage>> = { build: 'review', review: 'test', test: 'security', security: 'ready', ready: 'shipped' }

const pill = (on: boolean): CSSProperties => ({
  fontSize: T.tiny,
  padding: '2px 8px',
  borderRadius: 999,
  background: on ? 'var(--accent-subtle, var(--bg-elevated))' : 'var(--bg-elevated)',
  color: on ? 'var(--accent)' : 'var(--muted)',
  border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
  whiteSpace: 'nowrap',
})

export function Workspace({ repo, number, active, autoStart, onRemoved, onChanged }: {
  repo: string
  number: number
  active: boolean
  autoStart?: boolean
  onRemoved: () => void
  onChanged: () => void
}) {
  const api = useAppApi()
  const [detail, setDetail] = useState<InitiativeDetail | null>(null)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [focus, setFocus] = useState<Focus>({ kind: 'initiative' })
  const [starting, setStarting] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<'skip' | 'skip-ticket' | 'remove' | null>(null)
  const [wide, setWide] = useState(false)
  // An earlier phase picked in the phase row, shown read-only; null = the current phase.
  const [viewPhase, setViewPhase] = useState<PhaseId | null>(null)
  const [rightWidth, setRightWidth] = useStoredSize('right', 560, 340, 1200)
  const [statusHeight, setStatusHeight] = useStoredSize('status', 300, 90, 900)

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

  const phase = detail?.phase
  useEffect(() => { setConfirm(null); setActionError('') }, [phase, focus])
  useEffect(() => { setViewPhase(null) }, [phase, focus])

  // In delivery there's no initiative conversation: put the most useful ticket in view.
  useEffect(() => {
    if (!detail || detail.phase !== 'delivery' || focus.kind !== 'initiative') return
    const working = detail.tickets.find(t => t.sessionKey && detail.sessions[t.sessionKey] && t.stage && WORK_STAGES.includes(t.stage))
    const next = working ?? detail.tickets.find(t => t.stage === 'build' && !t.blockedBy.length)
    if (next) setFocus({ kind: 'ticket', t: next.number })
  }, [detail, focus.kind])

  const ticket = detail && focus.kind === 'ticket' ? detail.tickets.find(t => t.number === focus.t) ?? null : null

  // The conversation shown in the middle for the current focus.
  const slotKey = !detail ? null
    : focus.kind === 'ticket' ? (ticket?.sessionKey ? detail.sessions[ticket.sessionKey] ?? null : null)
    : focus.kind === 'decision' ? detail.sessions[`discovery-t${focus.t}`] ?? null
    : detail.sessions[detail.phase] ?? null

  const start = async () => {
    if (!detail) return
    const id = focus.kind === 'initiative' ? detail.phase : `${focus.kind}-${focus.t}`
    setStarting(id)
    setActionError('')
    try {
      let res, title
      if (focus.kind === 'ticket' && ticket) {
        res = await backend.ticketSession(repo, number, ticket.number)
        title = `${detail.title}: #${ticket.number} ${STAGE_LABELS[ticket.stage ?? 'build']}`
      } else if (focus.kind === 'decision') {
        res = await backend.startSession(repo, number, 'discovery', focus.t)
        title = `${detail.title}: decision #${focus.t}`
      } else {
        res = await backend.startSession(repo, number, detail.phase, null)
        title = `${detail.title}: ${PHASE_LABELS[detail.phase]}`
      }
      await openSession(api, res.slotName, res.seed, title)
      load()
      onChanged()
    } catch (e) {
      setActionError(`Couldn't start the conversation: ${errorText(e)}`)
    } finally {
      setStarting(null)
    }
  }

  const autoStarted = useRef(false)
  useEffect(() => {
    if (!autoStart || autoStarted.current || !detail) return
    autoStarted.current = true
    if (!detail.sessions[detail.phase]) void start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, detail])

  const advance = async (force: boolean) => {
    if (!detail) return
    setBusy(true)
    setConfirm(null)
    setActionError('')
    try {
      if (focus.kind === 'ticket' && ticket) {
        setDetail(await backend.ticketAdvance(repo, number, ticket.number, force))
      } else {
        const wasLast = detail.phase === 'operate'
        const d = await backend.advance(repo, number, force)
        if (wasLast) { onRemoved(); return }
        setDetail(d)
        setFocus({ kind: 'initiative' })
      }
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

  const past = viewPhase && viewPhase !== detail.phase ? viewPhase : null
  const pastState: PhaseState | null = past ? detail.history?.[past] ?? null : null
  const scopeState: PhaseState | null = past ? pastState : ticket ? ticket.ticketState : focus.kind === 'initiative' ? detail.state : null
  const scopeLabel = ticket ? `#${ticket.number} ${STAGE_LABELS[ticket.stage ?? 'build']}` : focus.kind === 'decision' ? `Decision #${focus.t}` : PHASE_LABELS[detail.phase]

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
      {/* Middle: the conversation. */}
      {!wide && (
        <section style={{ flex: '1 1 0', minWidth: 360, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)', minWidth: 0 }}>
            <span style={{ ...strong, fontSize: T.title, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {detail.title}
            </span>
            <span style={pill(true)}>{scopeLabel.toLowerCase()}</span>
            <SizeBadge size={detail.size} />
            <span style={{ flex: 1 }} />
            <span style={{ ...muted, fontSize: T.tiny, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260, direction: 'rtl' }} title={detail.repoPath}>
              {detail.repoPath}
            </span>
          </div>
          {focus.kind !== 'initiative' && (
            <div style={{ padding: '6px 16px', borderBottom: '1px solid var(--border)', fontSize: T.small, display: 'flex', gap: 8, alignItems: 'center' }}>
              <TextButton onClick={() => setFocus({ kind: 'initiative' })}>← {PHASE_LABELS[detail.phase]}</TextButton>
              {ticket && <a href={ticket.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>#{ticket.number}</a>}
              {ticket && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ticket.title}</span>}
            </div>
          )}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {slotKey ? (
              <PhaseChat key={slotKey} slotKey={slotKey} />
            ) : (
              <NotStarted
                detail={detail}
                ticket={ticket}
                focus={focus}
                starting={starting !== null}
                onStart={start}
              />
            )}
          </div>
        </section>
      )}

      {!wide && (
        <Divider
          direction="vertical"
          label="Resize the conversation and the phase panel"
          onDrag={d => setRightWidth(w => w - d)}
          onReset={() => setRightWidth(560)}
        />
      )}

      {/* Right: what this phase produces, and what it's waiting on. */}
      <section
        style={{
          flex: wide ? '1 1 0' : `0 0 ${rightWidth}px`,
          width: wide ? undefined : rightWidth,
          minWidth: 340,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 6px', borderBottom: '1px solid var(--border)', minWidth: 0 }}>
          <Stepper detail={detail} viewing={past} onPick={p => setViewPhase(p === detail.phase ? null : p)} />
          <TextButton onClick={() => setWide(w => !w)} title={wide ? 'Show the conversation' : 'Widen this panel'}>{wide ? '⤡' : '⤢'}</TextButton>
          <PrimaryAction
            detail={detail}
            ticket={past ? null : ticket}
            focus={focus}
            busy={busy}
            confirm={confirm}
            setConfirm={setConfirm}
            onAdvance={advance}
            onRemove={remove}
            hidden={!!past}
          />
        </div>
        {actionError && <div style={{ padding: '8px 12px 0' }}><ErrorLine>{actionError}</ErrorLine></div>}

        <div style={{ flex: '1 1 0', minHeight: 80, overflowY: 'auto' }}>
          {past ? (
            <>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, fontSize: T.small }}>
                <span style={muted}>Looking back at {PHASE_LABELS[past]}, which is finished.</span>
                <span style={{ flex: 1 }} />
                <TextButton onClick={() => setViewPhase(null)}>Back to {PHASE_LABELS[detail.phase]}</TextButton>
              </div>
              <Docs
                repo={repo}
                number={number}
                artifacts={pastState?.artifacts ?? []}
                placeholder={pastState ? `${PHASE_LABELS[past]} produced no documents of its own.` : `Nothing was recorded for ${PHASE_LABELS[past]}.`}
              />
            </>
          ) : detail.phase === 'delivery' && focus.kind !== 'ticket' ? (
            <Lanes detail={detail} onPick={t => setFocus({ kind: 'ticket', t })} />
          ) : ticket ? (
            <>
              <TicketStrip ticket={ticket} tickets={detail.tickets} onBack={() => setFocus({ kind: 'initiative' })} />
              <Docs repo={repo} number={number} artifacts={ticketArtifacts(ticket)} placeholder={ticketPlaceholder(ticket)} />
            </>
          ) : (
            <Docs repo={repo} number={number} artifacts={detail.artifacts} placeholder={phasePlaceholder(detail)} brief={detail} />
          )}
        </div>

        <Divider
          direction="horizontal"
          label="Resize the documents and the decisions"
          onDrag={d => setStatusHeight(h => h - d)}
          onReset={() => setStatusHeight(300)}
        />
        <div style={{ flex: `0 0 ${statusHeight}px`, height: statusHeight, minHeight: 0, overflowY: 'auto' }}>
          <Status
            detail={detail}
            scope={scopeState}
            stage={past ? null : ticket?.stage ?? null}
            slotKey={past ? null : slotKey}
            onError={setActionError}
            onOpenDecisionTicket={t => setFocus({ kind: 'decision', t })}
            focus={focus}
            phaseOverride={past}
          />
        </div>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------- middle column

function PhaseChat({ slotKey }: { slotKey: string }) {
  const api = useAppApi()
  const onSend = useCallback(
    (message: string, meta?: ChatEmbedSendMeta) => api.post('/api/chat?ws=1', { slot: slotKey, message, meta }),
    [api, slotKey],
  )
  return <ChatEmbed slotKey={slotKey} onSend={onSend} startAtBottom frameless placeholder="Reply to the agent…" />
}

function NotStarted({ detail, ticket, focus, starting, onStart }: {
  detail: InitiativeDetail
  ticket: TicketDetail | null
  focus: Focus
  starting: boolean
  onStart: () => void
}) {
  let title: string
  let body: string
  let action: string | null
  if (ticket) {
    const stage = ticket.stage ?? 'build'
    if (ticket.blockedBy.length) {
      title = `#${ticket.number} is waiting on ${ticket.blockedBy.map(n => `#${n}`).join(', ')}`
      body = 'It can start once those tickets are through Security.'
      action = null
    } else if (stage === 'shipped') {
      title = `#${ticket.number} has shipped`
      body = 'Nothing left to do on this ticket.'
      action = null
    } else if (stage === 'ready') {
      title = `#${ticket.number} is ready to ship`
      body = detail.ship === 'each' ? 'Release it on its own whenever you like.' : 'It ships with the rest of the tickets in Release.'
      action = detail.ship === 'each' ? 'Release this ticket' : null
    } else {
      title = `${STAGE_LABELS[stage]} hasn't started for #${ticket.number}`
      body = `The agent works on this ticket alone, on its own branch, with the ${stage} skill.`
      action = `Start ${STAGE_LABELS[stage]}`
    }
  } else if (focus.kind === 'decision') {
    title = `Decision #${focus.t}`
    body = 'Work through this decision ticket from the map in its own conversation.'
    action = 'Start this decision'
  } else if (detail.phase === 'delivery') {
    title = 'Pick a ticket'
    body = 'Each ticket moves through Build, Review, Test and Security on its own. Choose one on the right.'
    action = null
  } else {
    title = `${PHASE_LABELS[detail.phase]} hasn't started`
    body = 'The agent opens this phase with the right skill, repo and issue, and asks its questions here.'
    action = `Start ${PHASE_LABELS[detail.phase]}`
  }
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 380, textAlign: 'center' }}>
        <div style={{ ...strong, fontSize: T.title }}>{title}</div>
        <div style={{ ...muted, fontSize: T.body, margin: '6px 0 14px', lineHeight: 1.5 }}>{body}</div>
        {action && <Btn primary disabled={starting} onClick={onStart}>{starting ? 'Starting…' : action}</Btn>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- right column header

// The phases as a row of buttons. It never squashes: when the panel is narrow it
// scrolls sideways, and the current phase is kept in view. An earlier phase opens
// what was recorded there; a later one isn't reachable yet.
function Stepper({ detail, viewing, onPick }: {
  detail: InitiativeDetail
  viewing: PhaseId | null
  onPick: (p: PhaseId) => void
}) {
  const idx = PHASES.indexOf(detail.phase)
  const row = useRef<HTMLDivElement>(null)
  const shown = viewing ?? detail.phase

  useEffect(() => {
    const el = row.current?.querySelector<HTMLElement>('[data-shown="true"]')
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [shown])

  // A mouse wheel scrolls the row sideways, as a trackpad already does.
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = row.current
    if (el && Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) el.scrollLeft += e.deltaY
  }

  return (
    <div ref={row} role="tablist" aria-label="Phases" onWheel={onWheel} style={{ ...scrollRow, flex: 1, gap: 2, padding: '2px 0' }}>
      {PHASES.map((p, i) => {
        if (detail.ship === 'each' && p === 'release') return null
        const state = i < idx ? 'done' : i === idx ? 'current' : 'next'
        const on = p === shown
        return (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={on}
            aria-current={state === 'current' ? 'step' : undefined}
            data-shown={on}
            disabled={state === 'next'}
            onClick={() => onPick(p)}
            title={state === 'done' ? `See what ${PHASE_LABELS[p]} recorded` : state === 'next' ? `${PHASE_LABELS[p]} comes later` : PHASE_LABELS[p]}
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
              color: state === 'next' ? 'var(--muted)' : 'var(--text)',
              cursor: state === 'next' ? 'default' : 'pointer',
            }}
          >
            <span aria-hidden style={{ color: state === 'done' ? 'var(--ok-text)' : state === 'current' ? 'var(--accent)' : 'var(--muted)', marginRight: 5, fontSize: T.tiny }}>
              {state === 'done' ? '✓' : '●'}
            </span>
            {PHASE_LABELS[p]}
          </button>
        )
      })}
    </div>
  )
}

function PrimaryAction({ detail, ticket, focus, busy, confirm, setConfirm, onAdvance, onRemove, hidden }: {
  detail: InitiativeDetail
  ticket: TicketDetail | null
  focus: Focus
  busy: boolean
  confirm: 'skip' | 'skip-ticket' | 'remove' | null
  setConfirm: (c: 'skip' | 'skip-ticket' | 'remove' | null) => void
  onAdvance: (force: boolean) => void
  onRemove: () => void
  hidden?: boolean
}) {
  if (hidden) return null
  const group: CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }

  if (confirm) {
    const text = confirm === 'remove' ? 'Close its issue as not planned?'
      : confirm === 'skip-ticket' ? 'Move on unfinished?'
      : 'Move on unfinished?'
    return (
      <span style={{ ...group, fontSize: T.small }}>
        <span style={{ ...muted, whiteSpace: 'nowrap' }}>{text}</span>
        <ActionButton danger disabled={busy} onClick={() => (confirm === 'remove' ? onRemove() : onAdvance(true))}>
          {confirm === 'remove' ? 'Remove' : 'Skip'}
        </ActionButton>
        <ActionButton disabled={busy} onClick={() => setConfirm(null)}>Cancel</ActionButton>
      </span>
    )
  }

  if (ticket) {
    const stage = ticket.stage ?? 'build'
    const next = NEXT_STAGE[stage]
    const canShip = stage === 'ready' && detail.ship === 'each'
    if (!next || (stage === 'ready' && !canShip)) return null
    return (
      <span style={group}>
        {!ticket.gatePassed && <TextButton disabled={busy} onClick={() => setConfirm('skip-ticket')}>Skip</TextButton>}
        <ActionButton primary disabled={busy || !ticket.gatePassed} onClick={() => onAdvance(false)}>
          {busy ? 'Moving…' : `${STAGE_LABELS[next]} →`}
        </ActionButton>
      </span>
    )
  }

  if (focus.kind === 'decision') return null
  const idx = PHASES.indexOf(detail.phase)
  let nextPhase = PHASES[idx + 1]
  if (detail.phase === 'delivery' && detail.ship === 'each') nextPhase = 'operate'
  const label = detail.phase === 'operate' ? 'Finish' : `${PHASE_LABELS[nextPhase]} →`
  return (
    <span style={group}>
      <TextButton disabled={busy} onClick={() => setConfirm('remove')}>Remove</TextButton>
      {!detail.gatePassed && <TextButton disabled={busy} onClick={() => setConfirm('skip')}>Skip</TextButton>}
      <ActionButton primary disabled={busy || !detail.gatePassed} onClick={() => onAdvance(false)} title={detail.delivery?.reason ?? undefined}>
        {busy ? 'Moving on…' : label}
      </ActionButton>
    </span>
  )
}

// ---------------------------------------------------------------- documents

function ticketArtifacts(t: TicketDetail): Artifact[] {
  const list = [...(t.ticketState?.artifacts ?? [])]
  if (t.prUrl && !list.some(a => a.href === t.prUrl)) list.unshift({ label: 'PR', href: t.prUrl })
  return [{ label: 'Ticket', href: t.url }, ...list]
}

const EXPECTED: Record<string, string> = {
  intake: 'Intake sharpens the destination and sizes the work. It writes no documents of its own.',
  discovery: 'The glossary, decision records (ADRs), research notes and, for a big effort, the wayfinder map appear here as the agent writes them.',
  refinement: 'Prototypes and the answers to open questions appear here.',
  design: 'The spec and the tickets appear here.',
  release: 'The changelog, release notes and merged PRs appear here.',
  operate: 'The health checks, the retro and follow-up initiatives appear here.',
}

function phasePlaceholder(d: InitiativeDetail): string {
  return EXPECTED[d.phase] ?? 'Documents appear here as the agent writes them.'
}

function ticketPlaceholder(t: TicketDetail): string {
  return `The PR, the acceptance report and the security report for #${t.number} appear here as each stage writes them.`
}

function Docs({ repo, number, artifacts, placeholder, brief }: {
  repo: string
  number: number
  artifacts: Artifact[]
  placeholder: string
  brief?: InitiativeDetail
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
  const current = tabs[Math.min(tab, tabs.length - 1)]
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

  return (
    <div>
      {tabs.length > 1 && (
        <div role="tablist" style={{ ...scrollRow, gap: 2, padding: '8px 12px 2px' }}>
          {tabs.map((t, i) => (
            <button
              key={`${t.label}-${t.href}`}
              role="tab"
              type="button"
              aria-selected={i === tab}
              onClick={() => setTab(i)}
              style={{
                flexShrink: 0,
                whiteSpace: 'nowrap',
                fontSize: T.small,
                padding: '4px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                background: i === tab ? 'var(--bg-elevated)' : 'transparent',
                color: i === tab ? 'var(--text)' : 'var(--muted)',
                fontWeight: i === tab ? 600 : 400,
              }}
            >
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
              {doc.url && <a href={doc.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: T.small }}>Open on GitHub</a>}
              {!doc.url && !isUrl(doc.href) && <PathChip path={doc.href} />}
            </div>
            <MarkdownRenderer content={doc.text} />
          </>
        )}
      </div>
    </div>
  )
}

function Brief({ detail, placeholder }: { detail: InitiativeDetail; placeholder: string | null }) {
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
      {detail.state?.summary && (
        <div>
          <div style={{ ...strong, fontSize: T.body, marginBottom: 2 }}>Where {PHASE_LABELS[detail.phase]} stands</div>
          <div>{detail.state.summary}</div>
        </div>
      )}
      {placeholder && <div style={{ ...muted, fontSize: T.small }}>{placeholder}</div>}
    </div>
  )
}

// ---------------------------------------------------------------- delivery lanes

function Lanes({ detail, onPick }: { detail: InitiativeDetail; onPick: (t: number) => void }) {
  const lanes = STAGES
  const d = detail.delivery
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: T.small, display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={strong}>Tickets</span>
        <span style={muted}>
          {d ? `${(d.byStage.ready ?? 0) + (d.byStage.shipped ?? 0)} of ${d.total} through Security` : ''}
          {detail.ship ? `, ${detail.ship === 'each' ? 'shipping each as it clears' : 'shipping together'}` : ''}
        </span>
      </div>
      {d?.reason && <div style={{ ...muted, fontSize: T.small }}>{d.reason}</div>}
      {detail.ticketsError && <ErrorLine>Couldn't read the tickets: {detail.ticketsError}</ErrorLine>}
      {detail.ticketsNote && <div style={{ ...muted, fontSize: T.small }}>{detail.ticketsNote}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${lanes.length}, minmax(96px, 1fr))`, gap: 6, overflowX: 'auto' }}>
        {lanes.map(stage => {
          const col = detail.tickets.filter(t => (t.stage ?? 'build') === stage && !(t.state === 'CLOSED' && stage !== 'shipped'))
          return (
            <div key={stage} style={{ background: 'var(--bg-elevated)', color: 'var(--text)', borderRadius: 6, padding: 6, minHeight: 80 }}>
              <div style={{ fontSize: T.tiny, display: 'flex', marginBottom: 6, padding: '0 2px' }}>
                <span style={strong}>{STAGE_LABELS[stage]}</span>
                <span style={{ flex: 1 }} />
                <span style={muted}>{col.length || ''}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {col.map(t => {
                  const gate = t.ticketState?.gate ?? []
                  const live = Boolean(t.sessionKey && detail.sessions[t.sessionKey])
                  return (
                    <button
                      key={t.number}
                      type="button"
                      onClick={() => onPick(t.number)}
                      style={{
                        textAlign: 'left',
                        padding: '5px 6px',
                        borderRadius: 5,
                        cursor: 'pointer',
                        background: 'var(--card, var(--bg))',
                        color: 'var(--text)',
                        border: '1px solid var(--border)',
                        fontSize: T.small,
                        lineHeight: 1.3,
                      }}
                    >
                      <div style={{ ...muted, fontSize: T.tiny, display: 'flex', gap: 4 }}>
                        <span>#{t.number}</span>
                        <span style={{ flex: 1 }} />
                        {live && <span title="Conversation open" style={{ color: 'var(--accent)' }}>●</span>}
                      </div>
                      <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.title}</div>
                      {t.blockedBy.length > 0 && (
                        <div style={{ ...muted, fontSize: T.tiny, marginTop: 2 }}>waits on {t.blockedBy.map(n => `#${n}`).join(', ')}</div>
                      )}
                      {gate.length > 0 && WORK_STAGES.includes(stage) && (
                        <div style={{ ...muted, fontSize: T.tiny, marginTop: 2 }}>{gate.filter(g => g.done).length} of {gate.length} done</div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TicketStrip({ ticket, tickets, onBack }: { ticket: TicketDetail; tickets: TicketDetail[]; onBack: () => void }) {
  const idx = STAGES.indexOf(ticket.stage ?? 'build')
  return (
    <div style={{ ...scrollRow, padding: '6px 12px', borderBottom: '1px solid var(--border)', gap: 8 }}>
      <TextButton onClick={onBack}>← All {tickets.length} tickets</TextButton>
      <span style={{ flex: 1, minWidth: 8 }} />
      {STAGES.map((s, i) => (
        <span key={s} style={{ fontSize: T.tiny, color: i < idx ? 'var(--text)' : i === idx ? 'var(--accent)' : 'var(--muted)', fontWeight: i === idx ? 600 : 400 }}>
          {i < idx ? '✓ ' : ''}{STAGE_LABELS[s]}
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- status (bottom of the right column)

function Status({ detail, scope, stage, slotKey, onError, onOpenDecisionTicket, focus, phaseOverride }: {
  detail: InitiativeDetail
  scope: PhaseState | null
  stage: Stage | null
  slotKey: string | null
  onError: (m: string) => void
  onOpenDecisionTicket: (t: number) => void
  focus: Focus
  // An earlier phase being looked back at: shown read-only.
  phaseOverride?: PhaseId | null
}) {
  const routedKey = phaseOverride ?? stage ?? (focus.kind === 'decision' ? 'discovery' : detail.phase)
  const open = scope?.decisions.filter(d => !d.answer) ?? []
  const decided = scope?.decisions.filter(d => d.answer) ?? []
  const gate = scope?.gate ?? []
  const showMap = !phaseOverride && focus.kind === 'initiative' && detail.phase === 'discovery' && detail.size === 'foggy'

  return (
    <div style={{ padding: '10px 12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {open.length > 0 && (
        <Block title="Decisions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {open.map(d => <DecisionCard key={d.id} decision={d} slotKey={slotKey} onError={onError} />)}
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
        {gate.length ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {gate.map(g => (
              <li key={g.id} style={{ display: 'flex', gap: 6, fontSize: T.small, lineHeight: 1.4 }}>
                <span aria-hidden style={{ color: g.done ? 'var(--ok-text)' : 'var(--muted)', width: 12, flexShrink: 0 }}>{g.done ? '✓' : '○'}</span>
                <span style={g.done ? muted : undefined}>{g.label}</span>
              </li>
            ))}
          </ul>
        ) : !phaseOverride && detail.phase === 'delivery' && focus.kind === 'initiative' ? (
          <span style={{ ...muted, fontSize: T.small }}>{detail.delivery?.reason ?? 'Every ticket needs to clear Security.'}</span>
        ) : (
          <span style={{ ...muted, fontSize: T.small }}>The agent writes it when the work starts.</span>
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

      <Skills routed={ROUTED_SKILLS[routedKey] ?? []} used={scope?.skillsUsed ?? []} self={`phase-${routedKey}`} started={!!scope} />

      <Block title="Details" collapsible defaultOpen={false}>
        <div style={{ fontSize: T.small, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div><span style={muted}>Checkout </span><PathChip path={detail.repoPath} /></div>
          {detail.ship && <div><span style={muted}>Shipping </span>{detail.ship === 'each' ? 'each ticket as it clears Security' : 'all tickets together'}</div>}
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
          <button
            key={o}
            type="button"
            disabled={!!sent || !slotKey}
            onClick={() => answer(o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              textAlign: 'left',
              padding: '7px 10px',
              borderTop: '1px solid var(--border)',
              background: chosen ? 'var(--bg-elevated)' : 'transparent',
              color: 'var(--text)',
              fontSize: T.small,
              cursor: sent ? 'default' : 'pointer',
            }}
          >
            <span aria-hidden style={{ width: 12, height: 12, borderRadius: 999, border: '1.5px solid var(--muted)', flexShrink: 0, background: chosen ? 'var(--accent)' : 'transparent' }} />
            <span style={{ flex: 1 }}>{o}</span>
            {o === d.recommended && <span style={{ fontSize: T.tiny, color: 'var(--accent)' }}>recommended</span>}
          </button>
        )
      })}
      {!sent && (
        <form onSubmit={e => { e.preventDefault(); void answer(other) }} style={{ borderTop: '1px solid var(--border)', padding: '5px 10px' }}>
          <input
            value={other}
            onChange={e => setOther(e.target.value)}
            disabled={!slotKey}
            placeholder={slotKey ? 'Something else… (Enter to send)' : 'Start the conversation to answer'}
            style={{ width: '100%', background: 'transparent', color: 'var(--text)', fontSize: T.small, border: 0, outline: 'none', padding: '2px 0' }}
          />
        </form>
      )}
    </div>
  )
}

function DecisionTickets({ detail, onOpen }: { detail: InitiativeDetail; onOpen: (t: number) => void }) {
  const [tickets, setTickets] = useState<Ticket[] | null>(null)
  const { repo, number } = detail
  useEffect(() => {
    if (!detail.mapIssue) return
    backend.frontier(repo, number).then(r => setTickets(r.tickets)).catch(() => setTickets([]))
  }, [repo, number, detail.mapIssue])
  if (!detail.mapIssue) return null
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

function Skills({ routed, used, self, started }: { routed: string[]; used: string[]; self: string; started: boolean }) {
  const set = new Set(used)
  if (started) set.add(self)
  const extra = [...set].filter(k => !routed.includes(k))
  return (
    <Block title="Skills" aside={`${routed.filter(k => set.has(k)).length} of ${routed.length} used`} collapsible defaultOpen={false}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {routed.map(k => <Badge key={k} variant={set.has(k) ? 'ok' : 'muted'}>{set.has(k) ? '✓ ' : ''}{k}</Badge>)}
        {extra.map(k => <Badge key={k} variant="ok">✓ {k}</Badge>)}
      </div>
    </Block>
  )
}
