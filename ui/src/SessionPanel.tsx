import { useAppApi } from '@kirocrew/app-sdk'
import { Btn, MarkdownRenderer } from '@kirocrew/app-sdk/ui'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { backend, errorText } from './api'
import { ErrorLine, Section, T, muted, strong } from './common'
import { STATE_META } from './Frontier'
import { Abbr, STATE_MEANING } from './glossary'
import type { Decision, EffortDetail, PhaseState, TicketCard, Tile } from './types'

// The question card, floating over the chat box like Kiro's own question card:
// the open decisions the agent recorded, shown ONE AT A TIME with Back / Next,
// and a single Submit that sends every answer as ONE message — so the agent
// takes them all in one turn, never a queue of single replies (which kills
// parallel work). You don't have to answer all of them; the unanswered ones
// stay. Submitted answers clear the card at once (the agent records them in
// its own time); Hide tucks it into a pill so the chat box comes back.
export function QuestionWizard({ state, slotKey, settled, onError }: {
  state: PhaseState | null
  slotKey: string | null
  settled: boolean // a done ticket's unanswered entries are history, not questions
  onError: (m: string) => void
}) {
  const api = useAppApi()
  // Answers already sent to the chat are gone from the card immediately, even
  // though the state file only shows them once the agent records each `answer`.
  const [sent, setSent] = useState<Set<string>>(() => new Set())
  const open = settled ? [] : (state?.decisions.filter(d => !d.answer && !sent.has(d.id)) ?? [])
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [i, setI] = useState(0)
  const [sending, setSending] = useState(false)
  const [hidden, setHidden] = useState(false)

  // Reset the stepper when the set of open questions changes (new conversation,
  // or the batch was answered and recorded), and bring the card back out.
  const sig = open.map(d => d.id).join(',')
  const lastSig = useRef(sig)
  useEffect(() => {
    if (lastSig.current === sig) return
    lastSig.current = sig
    setI(0); setPicks({})
    if (sig) setHidden(false)
  }, [sig])

  if (!open.length || !slotKey) return null
  if (hidden) return (
    <button type="button" className="kipo-pulse" onClick={() => setHidden(false)}
      title="Open the questions waiting on you"
      style={{ position: 'absolute', right: 16, bottom: 126, zIndex: 6, cursor: 'pointer',
        borderRadius: 99, padding: '4px 12px', fontSize: T.small, fontWeight: 600,
        border: `1px solid ${STATE_META.you.color}`, color: STATE_META.you.text,
        background: 'var(--bg-elevated)', boxShadow: '0 4px 14px rgba(0,0,0,.35)' }}>
      {open.length} question{open.length === 1 ? '' : 's'} →
    </button>
  )
  const idx = Math.min(i, open.length - 1)
  const d = open[idx]
  const answered = open.filter(x => (picks[x.id] ?? '').trim())
  const atFirst = idx === 0
  const atLast = idx === open.length - 1
  const custom = (picks[d.id] ?? '') !== '' && !d.options.includes(picks[d.id] ?? '')

  const pick = (a: string) => setPicks(p => ({ ...p, [d.id]: a }))
  const submit = async () => {
    if (!answered.length) return
    const left = open.filter(x => !(picks[x.id] ?? '').trim())
    const lines = answered.map((x, n) => `${n + 1}. ${x.title} (${x.id}): ${picks[x.id].trim()}`)
    const message = [
      `My answers to your ${answered.length === 1 ? 'question' : `${answered.length} questions`}:`, '',
      ...lines, '',
      left.length
        ? `Still open, I'll answer later: ${left.map(x => x.title).join('; ')}.`
        : "That's all of them. Record each answer, then carry on.",
    ].join('\n')
    setSending(true)
    try {
      await api.post('/api/chat?ws=1', { slot: slotKey, message })
      setSent(s => new Set([...s, ...answered.map(x => x.id)]))
      setPicks({}); setI(0)
    } catch (e) {
      onError(`Couldn't send your answers: ${errorText(e)}`)
    } finally {
      setSending(false)
    }
  }

  const pillBtn = (label: string, on: boolean, onClick: () => void, extra?: React.ReactNode) => (
    <button key={label} type="button" role="radio" aria-checked={on} disabled={sending} onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 99, cursor: 'pointer',
        fontSize: T.small, whiteSpace: 'nowrap',
        border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
        background: on ? 'var(--accent)' : 'transparent', color: on ? 'var(--accent-fg, #fff)' : 'var(--text)' }}>
      <span aria-hidden style={{ width: 10, height: 10, borderRadius: 99, flexShrink: 0,
        border: `1.5px solid ${on ? 'var(--accent-fg, #fff)' : 'var(--muted)'}`,
        background: on ? 'var(--accent-fg, #fff)' : 'transparent' }} />
      {label}{extra}
    </button>
  )

  const navBtn = (label: string, disabled: boolean, onClick: () => void) => (
    <button type="button" disabled={disabled} onClick={onClick}
      style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px',
        color: disabled ? 'var(--muted)' : 'var(--text)', cursor: disabled ? 'default' : 'pointer', fontSize: T.small,
        opacity: disabled ? 0.5 : 1 }}>{label}</button>
  )

  return (
    <div role="dialog" aria-label={`Question ${idx + 1} of ${open.length}`}
      // Above the chat entry box (the composer is ~120px of the frame's bottom),
      // where Kiro parks its own trust bar — never over the box itself.
      style={{ position: 'absolute', left: 12, right: 12, bottom: 122, zIndex: 6,
        background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12,
        boxShadow: '0 10px 30px rgba(0,0,0,.45)', padding: '10px 16px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: T.tiny, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: STATE_META.you.text }}>
          Question {idx + 1} of {open.length}
        </span>
        {/* The dots show which of the batch are answered. */}
        <span style={{ display: 'flex', gap: 3 }} aria-hidden>
          {open.map((x, n) => (
            <span key={x.id} title={x.title} onClick={() => setI(n)}
              style={{ width: 7, height: 7, borderRadius: 99, cursor: 'pointer',
                background: (picks[x.id] ?? '').trim() ? STATE_META.you.color : n === idx ? 'var(--text)' : 'var(--border)' }} />
          ))}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ ...muted, fontSize: T.tiny }}>{answered.length} of {open.length} answered</span>
        <button type="button" onClick={() => setHidden(true)}
          title="Tuck the questions away and get the chat box back"
          style={{ background: 'transparent', border: 'none', padding: '0 2px', cursor: 'pointer',
            color: 'var(--muted)', fontSize: T.tiny }}>
          Hide
        </button>
      </div>

      <div style={{ ...strong, fontSize: T.body, marginBottom: 8, lineHeight: 1.4 }}>{d.title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 9, alignItems: 'center' }}>
        {d.options.map(o => pillBtn(o, picks[d.id] === o, () => pick(o),
          o === d.recommended ? <span style={{ fontSize: T.tiny, opacity: 0.8 }}> · rec</span> : undefined))}
        <input value={custom ? (picks[d.id] ?? '') : ''} onChange={e => pick(e.target.value)} disabled={sending}
          placeholder="Something else…" aria-label={`Another answer to: ${d.title}`}
          style={{ flex: '1 1 140px', minWidth: 120, background: 'var(--bg)', color: 'var(--text)', fontSize: T.small,
            border: `1px solid ${custom ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 99, padding: '4px 11px', outline: 'none' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {navBtn('‹ Back', atFirst, () => setI(idx - 1))}
        {!atLast && navBtn('Next ›', false, () => setI(idx + 1))}
        {d.recommended && picks[d.id] !== d.recommended && navBtn('Use recommended', false, () => pick(d.recommended!))}
        <span style={{ flex: 1 }} />
        <Btn primary disabled={!answered.length || sending} onClick={() => void submit()}>
          {sending ? 'Sending…' : `Submit ${answered.length} answer${answered.length === 1 ? '' : 's'}`}
        </Btn>
      </div>
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
