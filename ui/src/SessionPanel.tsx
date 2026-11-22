import { useAppApi } from '@kirocrew/app-sdk'
import { Btn, MarkdownRenderer } from '@kirocrew/app-sdk/ui'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { backend, errorText } from './api'
import { ErrorLine, Section, T, muted, strong } from './common'
import { STATE_META } from './Frontier'
import { Abbr, STATE_MEANING } from './glossary'
import { isOpenQuestion } from './types'
import type { Decision, EffortDetail, TailEvent, TicketCard, Tile } from './types'

// A read-only progress view for a session the dashboard never rendered as a
// page (a background review round the conductor spawned): the embedded chat is
// empty for it, so KiPo reads the transcript the agent is writing and shows its
// recent steps, polled. Not interactive — to type into it, open it in Kiro's
// main window (its slot is the title). The orange pulse still catches a trust
// prompt, so you won't miss when it needs you.
function elapsedShort(ts?: string): string {
  if (!ts) return ''
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function SessionProgress({ slot, active, ended }: { slot: string; active: boolean; ended?: boolean }) {
  const [events, setEvents] = useState<TailEvent[] | null>(null)
  const [error, setError] = useState('')
  const foot = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  useEffect(() => {
    let live = true
    const poll = () => backend.sessionTail(slot, 60)
      .then(r => { if (live) { setEvents(r.events); setError('') } })
      .catch(e => { if (live) setError(errorText(e)) })
    poll()
    // An ended session's transcript won't change; a running one's will.
    if (!active || ended) return () => { live = false }
    const id = setInterval(poll, 4000)
    return () => { live = false; clearInterval(id) }
  }, [slot, active, ended])
  // Stick to the newest step unless the reader has scrolled up.
  useEffect(() => { if (atBottom.current) foot.current?.scrollIntoView({ block: 'end' }) }, [events])

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderBottom: '1px solid var(--border)' }}>
        {!ended && <span className="kipo-pulse" aria-hidden style={{ width: 7, height: 7, borderRadius: 99, background: STATE_META.building.color, flexShrink: 0 }} />}
        <span style={{ ...muted, fontSize: T.tiny, lineHeight: 1.4 }}>
          {ended
            ? <>This session has ended — a read-only record of what it did, from its transcript. Its slot <code style={{ fontSize: T.tiny }}>{slot}</code> is closed in Kiro.</>
            : <>Running in the background — read-only progress from its transcript. To chat with it, open <code style={{ fontSize: T.tiny }}>{slot}</code> in Kiro's session window.</>}
        </span>
      </div>
      <div
        onScroll={e => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40 }}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 16px', scrollbarWidth: 'thin' }}>
        <ErrorLine>{error}</ErrorLine>
        {events === null && !error && <div style={{ ...muted, fontSize: T.small }}>Reading its transcript…</div>}
        {events !== null && events.length === 0 && !error && (
          <div style={{ ...muted, fontSize: T.small }}>No steps recorded yet.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(events ?? []).map((e, n) => (
            <div key={n} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ ...muted, fontSize: T.tiny, display: 'flex', gap: 6 }}>
                <span style={{ fontWeight: 700, color: e.role === 'user' ? STATE_META.you.text : 'var(--muted)' }}>
                  {e.role === 'user' ? 'You' : 'Agent'}
                </span>
                {e.ts && <span>{elapsedShort(e.ts)}</span>}
              </span>
              {e.tool
                ? <span style={{ fontSize: T.small, fontFamily: 'var(--font-mono, monospace)', color: 'var(--muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{e.text}</span>
                : <div style={{ fontSize: T.body, lineHeight: 1.5 }}><MarkdownRenderer content={e.text} /></div>}
            </div>
          ))}
        </div>
        <div ref={foot} />
      </div>
    </div>
  )
}

// Which answers were already sent to which session's chat, kept OUTSIDE the
// component: the card clears the moment you submit and stays cleared across
// remounts and conversation switches, until the agent records the `answer` in
// the state file (which deletes the entry). Entries expire after two hours so
// a question an agent re-opens without recording can still come back.
const SENT_TTL = 2 * 60 * 60 * 1000
const sentAnswers = new Map<string, number>() // `${slot}:${decision id}` → when sent
const wasSent = (slot: string, id: string) => {
  const at = sentAnswers.get(`${slot}:${id}`)
  if (at && Date.now() - at >= SENT_TTL) sentAnswers.delete(`${slot}:${id}`)
  return !!at && Date.now() - at < SENT_TTL
}

// One open question across the effort: which Kiro slot its answer routes back
// into, where it came from (`from` is unset for the conversation on screen),
// and the decisions entry itself. Answered entries ride along so the card can
// clear its sent-memory once the agent records them.
export type WizItem = { slot: string; from?: string; d: Decision }
// A session stopped on a Kiro trust prompt, relayed into the card. The fields
// come from the slot list's pending_approval_info (already redacted by Kiro);
// only a native-origin prompt with a request id can be decided from here — the
// rest get an Open button into their session instead.
export type PromptItem = {
  key: string // the effort's session key (build-t624…), for Open
  slot: string
  from: string
  tool: string
  input?: string
  purpose?: string
  requestId?: string
  canDecide: boolean
}

// The question card, in Kiro Crew's own question style — and, on the conductor
// screen, the effort's whole inbox: every session's open questions (labelled
// with where each came from) and every session stopped on a trust prompt, with
// Allow / Deny once right here. Questions show ONE AT A TIME with Back / Next,
// and one Submit sends every answer — grouped into ONE message per origin
// session, so each agent takes its batch in one turn, never a queue of single
// replies. You don't have to answer all of them; the unanswered ones stay.
// Submitted answers clear at once (each agent records them in its own time);
// Hide tucks the card into a pill. It sits above the chat box; onSize tells
// the Workspace its height so the conversation scrolls clear of it.
export function QuestionWizard({ items, prompts = [], onOpenPrompt, onError, onSize, bottomOffset = 122 }: {
  items: WizItem[]
  prompts?: PromptItem[]
  onOpenPrompt?: (sessionKey: string) => void
  onError: (m: string) => void
  onSize?: (h: number) => void
  bottomOffset?: number // px above the frame bottom: clears the composer + pills
}) {
  const api = useAppApi()
  const kOf = (x: WizItem) => `${x.slot}:${x.d.id}`
  // Answers already sent to the chat are gone from the card immediately, even
  // though a state file only shows them once its agent records each `answer`.
  // (The memory of what was sent lives outside the component — see sentAnswers —
  // so a remount can't make an answered question pop back up.)
  for (const x of items) if (x.d.answer) sentAnswers.delete(kOf(x))
  const open = items.filter(x => isOpenQuestion(x.d) && !wasSent(x.slot, x.d.id))
  const [picks, setPicks] = useState<Record<string, string>>({})
  // "Something else…" chosen (clicked into) for a question, even before any
  // text is typed — so its radio selects on click/focus, not on the first key.
  const [customOn, setCustomOn] = useState<Record<string, boolean>>({})
  const [i, setI] = useState(0)
  const [sending, setSending] = useState(false)
  const [hidden, setHidden] = useState(false)
  // A prompt decided here disappears at once; the next status poll confirms it.
  const [decided, setDecided] = useState<Record<string, boolean>>({})
  // Must sit with the other hooks, above the early returns below — a hook
  // after `return null` renders fewer hooks than expected (React #300).
  const customRef = useRef<HTMLInputElement>(null)

  // Reset the stepper when the set of open questions changes (new conversation,
  // or the batch was answered and recorded), and bring the card back out.
  const livePrompts = prompts.filter(p => !decided[p.slot])
  const sig = open.map(kOf).join(',') + '|' + livePrompts.map(p => p.slot).join(',')
  const lastSig = useRef(sig)
  useEffect(() => {
    if (lastSig.current === sig) return
    lastSig.current = sig
    setI(0); setPicks({}); setCustomOn({})
    if (sig !== '|') setHidden(false)
  }, [sig])
  // Report the card's height (it changes as options and questions change), so
  // the conversation behind it gets padded instead of covered.
  const ro = useRef<ResizeObserver | null>(null)
  const sizeRef = useCallback((el: HTMLDivElement | null) => {
    ro.current?.disconnect()
    ro.current = null
    if (!el) { onSize?.(0); return }
    const report = () => onSize?.(el.offsetHeight)
    report()
    ro.current = new ResizeObserver(report)
    ro.current.observe(el)
  }, [onSize])

  if (!open.length && !livePrompts.length) return null
  const waiting = open.length + livePrompts.length
  if (hidden) return (
    <button type="button" className="kipo-pulse" onClick={() => setHidden(false)}
      title="Open what's waiting on you"
      style={{ position: 'absolute', right: 16, bottom: bottomOffset + 4, zIndex: 6, cursor: 'pointer',
        borderRadius: 99, padding: '4px 12px', fontSize: T.small, fontWeight: 600,
        border: `1px solid ${STATE_META.you.color}`, color: STATE_META.you.text,
        background: 'var(--bg-elevated)', boxShadow: '0 4px 14px rgba(0,0,0,.35)' }}>
      {waiting} waiting on you →
    </button>
  )
  const idx = Math.min(i, Math.max(0, open.length - 1))
  const q = open.length ? open[idx] : null
  const k = q ? kOf(q) : ''
  const answered = open.filter(x => (picks[kOf(x)] ?? '').trim())
  const atFirst = idx === 0
  const atLast = idx === open.length - 1
  const customText = !!q && (picks[k] ?? '') !== '' && !(q.d.options ?? []).includes(picks[k] ?? '')
  const custom = customText || !!customOn[k]

  // Every open question that carries a recommendation — the Accept-all target.
  const recommendable = open.filter(x => x.d.recommended)
  const pick = (a: string) => { if (k) setPicks(p => ({ ...p, [k]: a })) }
  // Clicking the "Something else…" radio or its field selects it right away
  // (not on the first keystroke). A previously picked option is let go of —
  // its text must not leak into the free-text field as the answer.
  const chooseCustom = () => {
    if (sending || !q) return
    setCustomOn(c => ({ ...c, [k]: true }))
    setPicks(p => ((q.d.options ?? []).includes(p[k] ?? '') ? { ...p, [k]: '' } : p))
    customRef.current?.focus()
  }
  // One message per origin session, each listing only its own answers — every
  // agent takes its batch in one turn, nothing is relayed by hand.
  const submit = async (usePicks: Record<string, string> = picks) => {
    const ans = open.filter(x => (usePicks[kOf(x)] ?? '').trim())
    if (!ans.length) return
    const bySlot = new Map<string, WizItem[]>()
    for (const x of ans) { const l = bySlot.get(x.slot) ?? []; l.push(x); bySlot.set(x.slot, l) }
    setSending(true)
    try {
      for (const [slot, list] of bySlot) {
        const left = open.filter(x => x.slot === slot && !(usePicks[kOf(x)] ?? '').trim())
        const lines = list.map((x, n) => `${n + 1}. ${x.d.title} (${x.d.id}): ${usePicks[kOf(x)].trim()}`)
        const message = [
          `My answers to your ${list.length === 1 ? 'question' : `${list.length} questions`}:`, '',
          ...lines, '',
          left.length
            ? `Still open, I'll answer later: ${left.map(x => x.d.title).join('; ')}.`
            : "That's all of them. Record each answer, then carry on.",
        ].join('\n')
        await api.post('/api/chat?ws=1', { slot, message })
        for (const x of list) sentAnswers.set(kOf(x), Date.now())
      }
      setPicks({}); setI(0)
    } catch (e) {
      onError(`Couldn't send your answers: ${errorText(e)}`)
    } finally {
      setSending(false)
    }
  }
  // Fill every recommended answer across all open questions and send at once.
  const acceptAll = () => {
    const rec = { ...picks }
    for (const x of recommendable) rec[kOf(x)] = x.d.recommended!
    setPicks(rec)
    void submit(rec)
  }
  // Rule on a trust prompt from here: the same call Kiro's own composer card
  // makes. Allow approves this one call; Deny is reject-once. Never durable
  // trust from KiPo — standing grants stay a decision made inside Kiro.
  const decide = async (p: PromptItem, action: 'approved' | 'rejected_once') => {
    try {
      await api.post(`/api/chat/slots/${encodeURIComponent(p.slot)}/approve`, { action, request_id: p.requestId })
      setDecided(x => ({ ...x, [p.slot]: true }))
    } catch (e) {
      onError(`Couldn't ${action === 'approved' ? 'allow' : 'deny'} ${p.from}: ${errorText(e)}`)
    }
  }

  const radio = (on: boolean) => (
    <span aria-hidden style={{ width: 13, height: 13, borderRadius: 99, flexShrink: 0, marginTop: 2,
      border: `1.5px solid ${on ? 'var(--accent)' : 'var(--muted)'}`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {on && <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--accent)' }} />}
    </span>
  )

  const optionRow = (o: string) => {
    const on = picks[k] === o && !customOn[k]
    return (
      <button key={o} type="button" role="radio" aria-checked={on} disabled={sending}
        onClick={() => { setCustomOn(c => ({ ...c, [k]: false })); pick(o) }}
        onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'var(--bg-hover, rgba(255,255,255,0.05))' }}
        onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}
        style={{ display: 'flex', alignItems: 'flex-start', gap: 9, width: '100%', textAlign: 'left',
          padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontSize: T.small, lineHeight: 1.4,
          border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
          background: on ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
          color: 'var(--text)' }}>
        {radio(on)}
        <span style={{ flex: 1, minWidth: 0 }}>{o}</span>
        {!!q && o === q.d.recommended && (
          <span style={{ ...muted, fontSize: T.tiny, flexShrink: 0, marginTop: 1 }}>Recommended</span>
        )}
      </button>
    )
  }

  const miniBtn = (label: string, title: string, onClick: () => void) => (
    <button type="button" title={title} onClick={onClick} disabled={sending}
      style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 9px',
        color: 'var(--text)', cursor: 'pointer', fontSize: T.tiny, whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</button>
  )

  const navBtn = (label: string, disabled: boolean, onClick: () => void) => (
    <button type="button" disabled={disabled} onClick={onClick}
      style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px',
        color: disabled ? 'var(--muted)' : 'var(--text)', cursor: disabled ? 'default' : 'pointer', fontSize: T.small,
        opacity: disabled ? 0.5 : 1 }}>{label}</button>
  )

  return (
    <div ref={sizeRef} role="dialog" aria-label={`${waiting} waiting on you`}
      // Just above the chat entry box (bottomOffset is the composer's measured
      // height), centred like Kiro's own question card — never over the box or
      // its pills, and the conversation is padded (onSize) so nothing hides
      // behind it.
      style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: bottomOffset, zIndex: 6,
        width: 'min(680px, calc(100% - 24px))',
        background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12,
        boxShadow: '0 10px 30px rgba(0,0,0,.45)', padding: '10px 14px 11px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
        <span style={{ fontSize: T.tiny, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: STATE_META.you.text }}>
          {open.length === 0 ? (livePrompts.length === 1 ? 'Trust prompt' : 'Trust prompts')
            : open.length === 1 ? 'Question' : `Question ${idx + 1} of ${open.length}`}
        </span>
        {open.length > 1 && (
          // The dots show which of the batch are answered.
          <span style={{ display: 'flex', gap: 3 }} aria-hidden>
            {open.map((x, n) => (
              <span key={kOf(x)} title={`${x.from ? `${x.from} — ` : ''}${x.d.title ?? x.d.id}`} onClick={() => setI(n)}
                style={{ width: 7, height: 7, borderRadius: 99, cursor: 'pointer',
                  background: (picks[kOf(x)] ?? '').trim() ? STATE_META.you.color : n === idx ? 'var(--text)' : 'var(--border)' }} />
            ))}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setHidden(true)}
          title="Tuck the questions away and get the chat box back"
          style={{ background: 'transparent', border: 'none', padding: '0 2px', cursor: 'pointer',
            color: 'var(--muted)', fontSize: T.tiny }}>
          Hide
        </button>
      </div>

      {/* Sessions stopped on a trust prompt, rulable right here. */}
      {livePrompts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: open.length ? 10 : 2 }}>
          {livePrompts.map(p => (
            <div key={p.slot} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 8,
              border: `1px solid ${STATE_META.you.color}`, background: 'color-mix(in srgb, #f5b14c 8%, transparent)' }}>
              <span className="kipo-pulse" aria-hidden style={{ width: 7, height: 7, borderRadius: 99, background: STATE_META.you.color, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: T.small }}
                title={[p.tool, p.input, p.purpose].filter(Boolean).join('\n\n')}>
                <b>{p.from}</b> <span style={muted}>wants to run:</span>
                <span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  color: 'var(--muted)', fontSize: T.tiny, fontFamily: 'ui-monospace, monospace' }}>{p.tool}</span>
              </span>
              {p.canDecide && <Btn primary onClick={() => void decide(p, 'approved')}>Allow</Btn>}
              {p.canDecide && miniBtn('Deny once', 'Reject this one call; the session continues without it', () => void decide(p, 'rejected_once'))}
              {onOpenPrompt && miniBtn('Open', 'Open this session to see the prompt in full', () => onOpenPrompt(p.key))}
            </div>
          ))}
        </div>
      )}

      {q && (<>
      {q.from && <div style={{ ...muted, fontSize: T.tiny, marginBottom: 3 }}>from {q.from}</div>}
      <div style={{ ...strong, fontSize: T.body, marginBottom: 8, lineHeight: 1.4 }}>{q.d.title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 9 }}>
        {/* A question can come with no options at all: just the free-text row. */}
        {(q.d.options ?? []).map(optionRow)}
        <div role="radio" aria-checked={custom} onClick={chooseCustom}
          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '2px 10px', cursor: 'text' }}>
          {radio(custom)}
          <input ref={customRef} value={custom ? (picks[k] ?? '') : ''} onChange={e => pick(e.target.value)}
            onFocus={chooseCustom} disabled={sending}
            placeholder="Something else…" aria-label={`Another answer to: ${q.d.title}`}
            style={{ flex: 1, minWidth: 0, background: 'var(--bg)', color: 'var(--text)', fontSize: T.small,
              border: `1px solid ${custom ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, padding: '5px 10px', outline: 'none' }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {open.length > 1 && navBtn('‹ Back', atFirst, () => setI(idx - 1))}
        {!atLast && navBtn('Next ›', false, () => setI(idx + 1))}
        <span style={{ flex: 1 }} />
        {open.length > 1 && <span style={{ ...muted, fontSize: T.tiny }}>{answered.length} of {open.length} answered</span>}
        {/* One click: take every recommendation and send. */}
        {recommendable.length > 0 && (
          <button type="button" disabled={sending} onClick={acceptAll}
            title={open.length > 1
              ? `Answer all ${recommendable.length} with their recommendation and send`
              : 'Take the recommendation and send'}
            style={{ background: 'transparent', border: `1px solid ${STATE_META.you.color}`, borderRadius: 6,
              padding: '3px 10px', color: STATE_META.you.text, cursor: sending ? 'default' : 'pointer',
              fontSize: T.small, whiteSpace: 'nowrap', opacity: sending ? 0.5 : 1 }}>
            {open.length > 1 ? 'Accept all recommendations' : 'Accept recommendation'}
          </button>
        )}
        <Btn primary disabled={!answered.length || sending} onClick={() => void submit()}>
          {sending ? 'Sending…' : answered.length > 1 ? `Submit ${answered.length} answers` : 'Submit'}
        </Btn>
      </div>
      </>)}
    </div>
  )
}

export type { Decision }

// ---------------------------------------------------------------- the ticket

const TYPE_LABEL: Record<Tile['type'], string> = {
  grilling: 'Grill', prototype: 'Prototype', research: 'Research', task: 'Task', build: 'Build', issue: 'Issue',
}

const PR_STATE: Record<string, { label: string; color: string }> = {
  MERGED: { label: 'merged', color: 'var(--ok, #3fb950)' },
  OPEN: { label: 'open', color: 'var(--accent)' },
  CLOSED: { label: 'closed', color: 'var(--muted)' },
}

function Pill({ color, text, children }: { color: string; text: string; children: ReactNode }) {
  return (
    <span style={{ fontSize: T.tiny, padding: '1px 8px', borderRadius: 999, border: `1px solid ${color}`, color: text, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

// A ticket with no live conversation (closed, blocked, in review, or not yet
// started): what it is, its PRs, how it ended, and what it asks — read from
// GitHub. Shown in the centre, where its chat would be if it had one.
export function TicketPanel({ detail, tile }: { detail: EffortDetail; tile: Tile }) {
  const [card, setCard] = useState<TicketCard | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    setCard(null)
    setError('')
    backend.ticket(detail.repo, detail.number, tile.number)
      .then(c => { if (live) setCard(c) })
      .catch(e => { if (live) setError(errorText(e)) })
    return () => { live = false }
  }, [detail.repo, detail.number, tile.number, tile.state])

  const prs = detail.prs.filter(p => tile.prs.includes(p.number))
  const done = tile.state === 'done'
  const meta = STATE_META[tile.state]

  let status: ReactNode
  if (done) status = prs.some(p => p.state === 'MERGED') ? 'Closed: its PR merged.' : 'Closed.'
  else if (tile.state === 'review') status = 'Its PR is open. The effort\'s Review merges it once it\'s clean.'
  else if (tile.state === 'blocked') status = `Waiting on ${tile.blockedBy.map(n => `#${n}`).join(', ')}. It can start once those close.`
  else if (tile.state === 'building') status = 'An agent is working on it.'
  else if (tile.who === 'you') status = <><Abbr term="HITL">HITL</Abbr>: it needs you. Start it to open its conversation.</>
  else status = 'An agent can take it on its own.'

  return (
    <div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ ...muted, fontSize: T.small }}>#{tile.number} · {TYPE_LABEL[tile.type]}</span>
          <span title={STATE_MEANING[tile.state]} style={{ cursor: 'help', display: 'inline-flex' }}>
            <Pill color={meta.color === 'transparent' ? 'var(--border)' : meta.color} text={meta.text}>{meta.label}</Pill>
          </span>
          <span style={{ flex: 1 }} />
          <a href={tile.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: T.small }}>Open on GitHub</a>
        </div>
        <div style={{ ...strong, fontSize: T.title, marginTop: 4, lineHeight: 1.35 }}>{tile.title}</div>
        <div style={{ fontSize: T.small, marginTop: 5, lineHeight: 1.45 }}>{status}</div>
      </div>

      {prs.length > 0 && (
        <Section title={prs.length === 1 ? 'Pull request' : 'Pull requests'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {prs.map(p => (
              <a key={p.number} href={p.url} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', fontSize: T.small, textDecoration: 'none' }}>
                <Pill color={PR_STATE[p.state]?.color ?? 'var(--border)'} text={PR_STATE[p.state]?.color ?? 'var(--muted)'}>{PR_STATE[p.state]?.label ?? p.state}</Pill>
                <span style={{ color: 'var(--accent)' }}>#{p.number}</span>
                <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</span>
              </a>
            ))}
          </div>
        </Section>
      )}

      {done && (
        <Section title="How it ended" aside={card?.lastComment ? `latest of ${card.comments} comment${card.comments === 1 ? '' : 's'}` : undefined}>
          {error ? <ErrorLine>{error}</ErrorLine>
            : !card ? <span style={{ ...muted, fontSize: T.small }}>Loading…</span>
            : card.lastComment ? <div style={{ fontSize: T.body, lineHeight: 1.55 }}><MarkdownRenderer content={card.lastComment.body} /></div>
            : <span style={{ ...muted, fontSize: T.small }}>Closed with no comment.</span>}
        </Section>
      )}

      <Section title={done ? 'What it asked' : 'What it asks'} defaultOpen={!done}>
        {error ? <ErrorLine>{error}</ErrorLine>
          : !card ? <span style={{ ...muted, fontSize: T.small }}>Loading…</span>
          : card.body.trim() ? <div style={{ fontSize: T.body, lineHeight: 1.55 }}><MarkdownRenderer content={card.body} /></div>
          : <span style={{ ...muted, fontSize: T.small }}>No description.</span>}
      </Section>
    </div>
  )
}
