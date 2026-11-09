import { MarkdownRenderer } from '@kirocrew/app-sdk/ui'
import { useEffect, useState, type ReactNode } from 'react'
import { backend, errorText } from './api'
import { ErrorLine, StartBadge, T, isUrl, muted, strong } from './common'
import { STATE_META, TileButton, type SessionStatus } from './Frontier'
import { Abbr, STATE_MEANING } from './glossary'
import { TileGraph, chain, opensUp } from './Graph'
import { STAGE_LABELS, type Artifact, type EffortDetail, type Stage, type Tile, type TicketCard } from './types'

// The right panel says what's open and what you can do with it: a ticket's card
// when a tile is open, the effort's overview when its own conversation is.

const TYPE_LABEL: Record<Tile['type'], string> = {
  grilling: 'Grill', prototype: 'Prototype', research: 'Research', task: 'Task', build: 'Build', issue: 'Issue',
}

export type SkillSet = { buttons: string[]; chips: string[] }

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ ...strong, fontSize: T.small }}>{title}</span>
        {aside != null && <span style={{ ...muted, fontSize: T.tiny }}>{aside}</span>}
      </div>
      {children}
    </section>
  )
}

function Pill({ color, text, children }: { color: string; text: string; children: ReactNode }) {
  return (
    <span style={{ fontSize: T.tiny, padding: '1px 8px', borderRadius: 999, border: `1px solid ${color}`, color: text, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

const btn = (bg: string, fg: string, disabled?: boolean) => ({
  height: 26, padding: '0 11px', borderRadius: 6, border: 0, flexShrink: 0, whiteSpace: 'nowrap' as const,
  background: bg, color: fg, fontWeight: 600, fontSize: T.small,
  cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
})
const quietBtn = {
  height: 26, padding: '0 11px', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0, whiteSpace: 'nowrap' as const,
  background: 'transparent', color: 'var(--text)', fontWeight: 500, fontSize: T.small, cursor: 'pointer',
}

const PR_STATE: Record<string, { label: string; color: string }> = {
  MERGED: { label: 'merged', color: STATE_META.done.color },
  OPEN: { label: 'open', color: STATE_META.review.color },
  CLOSED: { label: 'closed', color: 'var(--muted)' },
}

// ---------------------------------------------------------------- a ticket

// The top of a ticket's card: what it is, and where it sits. Its whole chain is
// drawn: everything it waits on, and everything waiting on it, with what closing
// it frees called out. Sits above a drag handle; the card's details scroll below.
export function TicketChain({ detail, tile, hasSession, onOpenTile, statuses }: {
  detail: EffortDetail
  tile: Tile
  hasSession: boolean
  onOpenTile: (t: Tile) => void
  statuses?: Record<number, SessionStatus>
}) {
  const tiles = detail.frontier?.tiles ?? []
  const prs = detail.prs.filter(p => tile.prs.includes(p.number))
  const meta = STATE_META[tile.state]
  const done = tile.state === 'done'
  const linked = chain(tiles, tile.number)
  const frees = opensUp(tiles, tile.number)
  const waitsOn = linked.filter(t => t.number !== tile.number && isUpstream(tiles, t.number, tile.number))
  const downstream = linked.filter(t => t.number !== tile.number && isUpstream(tiles, tile.number, t.number))

  let status: ReactNode
  if (done) status = prs.some(p => p.state === 'MERGED') ? 'Closed: its PR merged.' : 'Closed.'
  else if (tile.state === 'review') status = 'Its PR is open. Review merges it once it\'s clean (two-way doors on their own, one-way doors ask you).'
  else if (tile.state === 'blocked') status = `Waiting on ${tile.blockedBy.map(n => `#${n}`).join(', ')}. It can start once those close.`
  else if (tile.state === 'building') status = 'An agent is working on it.'
  else if (tile.who === 'you') status = <><Abbr term="HITL">HITL</Abbr>: {hasSession ? 'its conversation is open in the middle.' : 'start its conversation in the middle.'}</>
  else status = hasSession ? 'Its conversation is open in the middle.' : 'An agent can take it on its own: start it in the middle.'

  const list = (ts: Tile[]) => ts.map(t => `#${t.number}`).join(', ').replace(/, ([^,]*)$/, ' and $1')
  return (
    <div>
      <div style={{ padding: '14px 16px 12px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <TileButton tile={tile} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ ...muted, fontSize: T.small }}>#{tile.number} · {TYPE_LABEL[tile.type]} · {tile.lane === 'deliver' ? <Abbr term="Deliver">Deliver</Abbr> : <Abbr term="Decide">Decide</Abbr>}</span>
            <span title={STATE_MEANING[tile.state]} style={{ cursor: 'help', display: 'inline-flex' }}>
              <Pill color={meta.color === 'transparent' ? 'var(--border)' : meta.color} text={meta.text}>{meta.label}</Pill>
            </span>
            {tile.source && <Pill color="var(--border)" text="var(--muted)">source issue</Pill>}
            <span style={{ flex: 1 }} />
            <a href={tile.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: T.small }}>Open on GitHub</a>
          </div>
          <div style={{ ...strong, fontSize: T.title, marginTop: 4, lineHeight: 1.35 }}>{tile.title}</div>
          <div style={{ fontSize: T.small, marginTop: 6, lineHeight: 1.45 }}>{status}</div>
        </div>
      </div>

      <Section title="Where it sits"
        aside={linked.length > 1 ? `waits on ${waitsOn.length || 'nothing'} · ${downstream.length || 'nothing'} downstream` : 'nothing links to it'}>
        {frees.length > 0 && (
          <div style={{ fontSize: T.small, lineHeight: 1.45, marginBottom: 8 }}>
            <span style={{ color: STATE_META.afk.text, fontWeight: 600 }}>{done ? 'Opened up' : 'Opens up'}</span>{' '}
            {done ? `${list(frees)} when it closed.` : `${list(frees)}: closing it frees ${frees.length === 1 ? 'it' : 'them'} to start.`}
          </div>
        )}
        {linked.length > 1
          ? <TileGraph tiles={linked} focus={tile.number} onOpen={onOpenTile} labeled dimOthers={false} statuses={statuses} down />
          : <span style={{ ...muted, fontSize: T.small }}>Nothing blocks it and it blocks nothing.</span>}
      </Section>
    </div>
  )
}

// Is `a` somewhere upstream of `b` (does `b` wait on `a`, directly or not)?
function isUpstream(tiles: Tile[], a: number, b: number): boolean {
  const byNumber = new Map(tiles.map(t => [t.number, t]))
  const seen = new Set<number>()
  const stack = [b]
  while (stack.length) {
    const t = byNumber.get(stack.pop()!)
    for (const n of t ? (t.blockers ?? t.blockedBy) : []) {
      if (n === a) return true
      if (!seen.has(n)) { seen.add(n); stack.push(n) }
    }
  }
  return false
}

// The rest of a ticket's card, read-only: decisions, PRs, how it ended, what it
// asks. Starting it and running skills on it happen with its conversation.
export function TicketInspector({ repo, number, detail, tile, decisions }: {
  repo: string
  number: number
  detail: EffortDetail
  tile: Tile
  decisions: ReactNode // this ticket's conversation's decision cards
}) {
  const [card, setCard] = useState<TicketCard | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    setCard(null)
    setError('')
    backend.ticket(repo, number, tile.number)
      .then(c => { if (live) setCard(c) })
      .catch(e => { if (live) setError(errorText(e)) })
    return () => { live = false }
  }, [repo, number, tile.number, tile.state])

  const prs = detail.prs.filter(p => tile.prs.includes(p.number))
  const done = tile.state === 'done'

  return (
    <div>
      {decisions}

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

      <Section title={done ? 'What it asked' : 'What it asks'}>
        {error ? <ErrorLine>{error}</ErrorLine>
          : !card ? <span style={{ ...muted, fontSize: T.small }}>Loading…</span>
          : card.body.trim() ? <div style={{ fontSize: T.body, lineHeight: 1.55 }}><MarkdownRenderer content={card.body} /></div>
          : <span style={{ ...muted, fontSize: T.small }}>No description.</span>}
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------- the effort

export type NextStep = {
  text: ReactNode
  actions: { label: string; onClick: () => void; kind?: 'you' | 'afk' | 'done' | 'review' | 'quiet' }[]
}

// The single most useful thing to do next, read from the frontier.
export function nextStep(detail: EffortDetail, h: {
  openTile: (t: Tile) => void
  startTile: (t: Tile) => void
  startAgents: (t: Tile[]) => void
  handover: () => void
  review: () => void
  retro: () => void
  close: () => void
  startMain: () => void
  implementSpec: () => void
  hasMain: boolean
}): NextStep {
  const f = detail.frontier
  const tiles = f?.tiles ?? []
  if (f?.landed) {
    return {
      text: <><b>Everything delivered is merged.</b> Retro the run so the next one goes better, then close the effort.</>,
      // A wayfinder map closes on GitHub with its last ticket; KiPo doesn't close it.
      actions: [{ label: 'Run /retro', onClick: h.retro, kind: 'done' },
        ...(detail.kind === 'map' ? [] : [{ label: 'Close effort', onClick: h.close, kind: 'quiet' as const }])],
    }
  }
  if (f?.handover) {
    return {
      text: <><b>The map is clear.</b> Every decision is closed and nothing is left in the fog: write the spec and cut the tickets.</>,
      actions: [{ label: 'Write the spec', onClick: h.handover, kind: 'afk' }],
    }
  }
  const unblockCount = (t: Tile) => tiles.filter(o => (o.blockers ?? o.blockedBy).includes(t.number) && o.state !== 'done').length
  const yours = tiles.filter(t => t.state === 'you').sort((a, b) => unblockCount(b) - unblockCount(a) || a.number - b.number)
  if (yours.length) {
    const first = yours[0]
    const frees = unblockCount(first)
    return {
      text: <><b>{yours.length} <Abbr term="HITL">HITL</Abbr> ticket{yours.length === 1 ? '' : 's'} open.</b> Start with <b>#{first.number}</b>, {first.title}{frees ? <>: closing it frees {frees} more</> : null}.</>,
      actions: [{ label: first.sessionKey ? `Continue #${first.number}` : `Start #${first.number}`, onClick: () => h.startTile(first), kind: 'you' }],
    }
  }
  const ready = tiles.filter(t => t.state === 'afk')
  if (ready.length) {
    const deliver = ready.filter(t => t.lane === 'deliver')
    return {
      text: <><b>{ready.length} ready for <Abbr term="Agent">agents</Abbr>.</b> Nothing <Abbr term="HITL">HITL</Abbr> is open.</>,
      actions: [
        { label: `Start ${ready.length} agent${ready.length === 1 ? '' : 's'}`, onClick: () => h.startAgents(ready), kind: 'afk' },
        ...(deliver.length > 1 ? [{ label: 'Or /implement-spec', onClick: h.implementSpec, kind: 'quiet' as const }] : []),
      ],
    }
  }
  const review = tiles.filter(t => t.state === 'review').length || detail.prs.filter(p => p.state === 'OPEN').length
  const building = tiles.filter(t => t.state === 'building').length
  if (review || building) {
    return {
      text: <><b>Agents are working.</b> {building ? `${building} building` : ''}{building && review ? ', ' : ''}{review ? `${review} PR${review === 1 ? '' : 's'} to review` : ''}.</>,
      actions: review ? [{ label: 'Review the PRs', onClick: h.review, kind: 'review' }] : [],
    }
  }
  if (tiles.some(t => t.state === 'blocked')) {
    return { text: <><b>Everything left is blocked</b> on tickets outside this effort, or on fog that needs mapping.</>, actions: [] }
  }
  return h.hasMain
    ? { text: <>Nothing to start right now: the effort's conversation is open below.</>, actions: [] }
    : { text: <>Nothing has started yet.</>, actions: [{ label: 'Start the conversation', onClick: h.startMain, kind: 'afk' }] }
}

// The one next step, shown above the tickets whichever conversation is open.
export function NextStrip({ next, busy }: { next: NextStep; busy: boolean }) {
  const kindColor = { you: STATE_META.you.color, afk: STATE_META.afk.color, done: STATE_META.done.color, review: STATE_META.review.color }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8,
      border: '1px solid var(--border)', background: 'var(--bg-elevated)', flexWrap: 'wrap' }}>
      <span style={{ fontSize: T.tiny, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent)', flexShrink: 0 }}>Next</span>
      <span style={{ flex: 1, minWidth: 200, fontSize: T.body, lineHeight: 1.45 }}>{next.text}</span>
      {next.actions.map(a => (
        <button key={a.label} type="button" disabled={busy} onClick={a.onClick}
          style={a.kind && a.kind !== 'quiet' ? btn(kindColor[a.kind], '#14121c', busy) : quietBtn}>
          {a.label}
        </button>
      ))}
    </div>
  )
}

// A document the agents linked, with its live state when KiPo knows it.
function docRow(a: Artifact, detail: EffortDetail) {
  const pr = a.href.match(/\/pull\/(\d+)/)
  const issue = a.href.match(/\/issues\/(\d+)/)
  if (pr) {
    const p = detail.prs.find(x => x.number === Number(pr[1]))
    return { label: p ? `PR #${p.number} · ${p.title}` : a.label, state: p ? PR_STATE[p.state] : null, tile: null as Tile | null }
  }
  if (issue) {
    const t = detail.frontier?.tiles.find(x => x.number === Number(issue[1])) ?? null
    const isMap = detail.mapIssue === Number(issue[1])
    return {
      label: isMap ? `Wayfinder map #${issue[1]}` : t ? `#${t.number} · ${t.title}` : a.label,
      state: t ? { label: STATE_META[t.state].label, color: STATE_META[t.state].text, hint: STATE_MEANING[t.state] } : null,
      tile: t,
    }
  }
  return { label: a.label, state: null, tile: null }
}

function Documents({ repo, number, detail, onOpenTile }: { repo: string; number: number; detail: EffortDetail; onOpenTile: (t: Tile) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const [doc, setDoc] = useState<{ title: string; text: string } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setDoc(null)
    setError('')
    if (!open) return
    let live = true
    backend.doc(repo, number, open)
      .then(d => { if (live) setDoc({ title: d.title, text: d.text }) })
      .catch(e => { if (live) setError(errorText(e)) })
    return () => { live = false }
  }, [repo, number, open])

  const seen = new Set<string>()
  const rows = detail.artifacts.filter(a => !seen.has(a.href) && seen.add(a.href))
  // A file in the repo (a spec, an ADR) opens here; GitHub links open on GitHub;
  // a ticket of this effort opens its card.
  return (
    <Section title="Documents" aside={rows.length ? undefined : 'none yet'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map(a => {
          const r = docRow(a, detail)
          const file = !isUrl(a.href)
          const on = open === a.href
          const onClick = () => (r.tile ? onOpenTile(r.tile) : file ? setOpen(on ? null : a.href) : window.open(a.href, '_blank', 'noreferrer'))
          return (
            <button key={a.href} type="button" onClick={onClick} title={a.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', margin: '0 -6px', borderRadius: 6, textAlign: 'left',
                background: on ? 'var(--bg-elevated)' : 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: T.small,
              }}>
              <span aria-hidden style={{ width: 14, color: 'var(--muted)', flexShrink: 0 }}>{file ? (on ? '▾' : '▸') : '↗'}</span>
              <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
              {r.state && <span title={'hint' in r.state ? r.state.hint : undefined} style={{ fontSize: T.tiny, color: r.state.color, flexShrink: 0 }}>{r.state.label}</span>}
            </button>
          )
        })}
      </div>
      {open && (
        <div style={{ marginTop: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: T.body, lineHeight: 1.55 }}>
          {error ? <ErrorLine>{error}</ErrorLine> : !doc ? <span style={muted}>Opening…</span> : <MarkdownRenderer content={doc.text} />}
        </div>
      )}
    </Section>
  )
}

// The effort's facts. Its next step sits above the tickets in the middle;
// moving between conversations happens there too.
export function EffortInspector({ repo, number, detail, stage, autopilot, onAutopilot, showAutopilot, decisions, onOpenTile }: {
  repo: string
  number: number
  detail: EffortDetail
  stage: Stage
  autopilot: boolean
  onAutopilot: (on: boolean) => void
  showAutopilot: boolean
  decisions: ReactNode
  onOpenTile: (t: Tile) => void
}) {
  return (
    <div>
      <div style={{ padding: '14px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ ...muted, fontSize: T.small }}>Effort #{detail.number}</span>
          <Pill color="var(--accent)" text="var(--accent)">{STAGE_LABELS[stage]}</Pill>
          <StartBadge start={detail.start} />
          <span style={{ flex: 1 }} />
          <a href={detail.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: T.small }}>Open on GitHub</a>
        </div>
        <div style={{ ...strong, fontSize: T.title, marginTop: 4, lineHeight: 1.35 }}>{detail.title}</div>
      </div>

      {showAutopilot && (
        <Section title="Autopilot">
          <button type="button" aria-pressed={autopilot} onClick={() => onAutopilot(!autopilot)}
            title="When a ticket closes and frees the next Deliver ticket an agent can take, KiPo starts it. Runs while this effort is open in KiPo."
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', padding: 0, cursor: 'pointer',
              fontSize: T.small, color: autopilot ? STATE_META.afk.text : 'var(--muted)' }}>
            <span aria-hidden className={autopilot ? 'kipo-pulse' : undefined}
              style={{ width: 8, height: 8, borderRadius: 999, background: autopilot ? STATE_META.afk.color : 'var(--muted)' }} />
            Autopilot {autopilot ? 'on' : 'off'}: {autopilot ? 'new agent tickets start on their own' : 'start new agent tickets as they free up'}
          </button>
        </Section>
      )}

      {decisions}

      {(detail.frontier?.fogLeft?.length ?? 0) > 0 && (
        <Section title="Left unspecified" aside="when its map closed: not pending, kept so nothing is lost">
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {detail.frontier!.fogLeft!.map((t, i) => (
              <li key={i} style={{ fontSize: T.small, lineHeight: 1.45 }}><MarkdownRenderer content={t} /></li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Destination" aside="where this effort is going">
        <div style={{ fontSize: T.body, lineHeight: 1.55 }}>
          {detail.destination.trim() ? <MarkdownRenderer content={detail.destination} /> : <span style={muted}>Not written yet.</span>}
        </div>
      </Section>

      <Documents repo={repo} number={number} detail={detail} onOpenTile={onOpenTile} />
    </div>
  )
}
