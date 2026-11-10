import { useAppApi } from '@kirocrew/app-sdk'
import { Btn } from '@kirocrew/app-sdk/ui'
import { useEffect, useRef, useState } from 'react'
import { errorText } from './api'
import { T, muted, strong } from './common'
import { STATE_META } from './Frontier'
import type { Decision, PhaseState } from './types'

// A docked question bar at the bottom of the conversation: the open decisions
// the agent recorded, shown ONE AT A TIME with Back / Next, and a single Submit
// that sends every answer as ONE message — so the agent takes them all in one
// turn, never a queue of single replies (which kills parallel work). You don't
// have to answer all of them; the unanswered ones stay for later.
export function QuestionWizard({ state, slotKey, settled, onError }: {
  state: PhaseState | null
  slotKey: string | null
  settled: boolean // a done ticket's unanswered entries are history, not questions
  onError: (m: string) => void
}) {
  const api = useAppApi()
  const open = settled ? [] : (state?.decisions.filter(d => !d.answer) ?? [])
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [i, setI] = useState(0)
  const [sending, setSending] = useState(false)

  // Reset the stepper when the set of open questions changes (new conversation,
  // or the batch was answered and recorded).
  const sig = open.map(d => d.id).join(',')
  const lastSig = useRef(sig)
  useEffect(() => {
    if (lastSig.current === sig) return
    lastSig.current = sig
    setI(0); setPicks({})
  }, [sig])

  if (!open.length || !slotKey) return null
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
    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', padding: '9px 16px 11px', flexShrink: 0 }}>
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
