import { useAppApi } from '@kirocrew/app-sdk'
import { Badge, Btn, MarkdownRenderer } from '@kirocrew/app-sdk/ui'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { backend, errorText } from './api'
import { ErrorLine, Section, T, muted, strong } from './common'
import { STATE_META } from './Frontier'
import { Abbr, STATE_MEANING } from './glossary'
import type { Decision, EffortDetail, PhaseState, TicketCard, Tile } from './types'

// The session's right panel: everything the conversation in the middle is asking
// of you, answerable here. Its decision cards (radio options, one Send for all of
// them), what it's waiting on, what's been decided, and the ticket itself (what
// it asks, its PRs, how it ended).

export function SessionSidebar({ detail, tile, state, slotKey, settled, onError }: {
  detail: EffortDetail
  tile: Tile | null
  state: PhaseState | null
  slotKey: string | null
  settled: boolean
  onError: (m: string) => void
}) {
  const openQ = settled ? 0 : state?.decisions.filter(d => !d.answer).length ?? 0
  const hasDecisions = !!state && (state.decisions.length > 0 || (!!state.blocking && !settled))
  // Two tabs when there's a ticket: Questions and the Ticket. Each conversation
  // lands on Questions when any are open, else on its ticket.
  const [tab, setTab] = useState<'questions' | 'ticket'>(openQ || !tile ? 'questions' : 'ticket')
  const conv = `${slotKey ?? 'none'}:${tile?.number ?? ''}`
  const lastConv = useRef(conv)
  useEffect(() => {
    if (lastConv.current === conv) return
    lastConv.current = conv
    setTab(openQ || !tile ? 'questions' : 'ticket')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv])
  // A question arriving while the ticket tab is open pulls the panel over to it.
  const lastOpenQ = useRef(openQ)
  useEffect(() => {
    if (openQ > lastOpenQ.current) setTab('questions')
    lastOpenQ.current = openQ
  }, [openQ])

  const tabBtn = (id: 'questions' | 'ticket', label: ReactNode) => {
    const on = tab === id
    return (
      <button key={id} type="button" role="tab" aria-selected={on} onClick={() => setTab(id)}
        style={{ background: 'transparent', padding: '7px 10px 8px', marginBottom: -1, cursor: 'pointer', fontSize: T.small,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: on ? 'var(--text)' : 'var(--muted)', fontWeight: on ? 600 : 400,
          borderBottom: `2px solid ${on ? 'var(--accent)' : 'transparent'}` }}>
        {label}
      </button>
    )
  }

  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Always a tab strip, so every session's panel reads the same. The
          Questions tab is always present; the ticket tab only with a ticket. */}
      <div role="tablist" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 10px', borderBottom: '1px solid var(--border)', flexShrink: 0, minHeight: 33 }}>
        {tabBtn('questions', <>
          Questions
          {openQ > 0 && (
            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '0 6px', borderRadius: 99, background: 'var(--accent)', color: 'var(--accent-fg, #fff)' }}>{openQ}</span>
          )}
        </>)}
        {tile && tabBtn('ticket', <>#{tile.number}</>)}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'thin' }}>
        {tab === 'questions' || !tile ? (<>
          <Decisions key={slotKey ?? 'none'} state={state} slotKey={slotKey} settled={settled} onError={onError} />
          {!hasDecisions && (
            <div style={{ ...muted, fontSize: T.small, padding: '14px 16px', lineHeight: 1.5 }}>
              {slotKey
                ? 'No open questions. When this conversation asks you something, its cards appear here to answer.'
                : 'This conversation hasn’t started yet. Its questions will appear here once it does.'}
            </div>
          )}
        </>) : (
          <TicketPanel detail={detail} tile={tile} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- decisions

// The open conversation's decision cards (the agent writes them to its state file),
// what it's waiting on, and what's been decided.
// The open questions are answered together: pick an answer on each card (in any
// order, change your mind freely), then send them all as one message. One reply
// lets the agent take every answer in one turn, instead of a queue of single
// answers it has to work through one at a time.
export function Decisions({ state, slotKey, settled, onError }: {
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
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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

// The ticket under the open conversation: what it is, its PRs, what it asks, and
// how it ended. Read from GitHub; its map is over the chat, not repeated here.
function TicketPanel({ detail, tile }: { detail: EffortDetail; tile: Tile }) {
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
  else if (tile.who === 'you') status = <><Abbr term="HITL">HITL</Abbr>: it needs your answers, in the conversation or on the cards above.</>
  else status = 'An agent can take it on its own.'

  return (
    <div>
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ ...muted, fontSize: T.small }}>#{tile.number} · {TYPE_LABEL[tile.type]}</span>
          <span title={STATE_MEANING[tile.state]} style={{ cursor: 'help', display: 'inline-flex' }}>
            <Pill color={meta.color === 'transparent' ? 'var(--border)' : meta.color} text={meta.text}>{meta.label}</Pill>
          </span>
          <span style={{ flex: 1 }} />
          <a href={tile.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: T.small }}>Open on GitHub</a>
        </div>
        <div style={{ ...strong, fontSize: T.body, marginTop: 4, lineHeight: 1.35 }}>{tile.title}</div>
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
