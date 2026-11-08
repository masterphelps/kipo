import { useState } from 'react'
import { T, muted } from './common'
import { TILE_STATES, type Frontier, type FrontierCounts, type Lane, type Tile, type TileState } from './types'

// The frontier bar: an effort's tickets as one bar of colored segments, like a
// storage meter. Done fills from the left; amber is your move, teal the agent's;
// the striped end is the fog, the questions not sharp enough to ticket yet.
// Click a segment to see its tickets as tiles; click a tile to open or start it.

export const STATE_META: Record<TileState | 'fog', { label: string; color: string; text: string }> = {
  done: { label: 'done', color: '#3fae6a', text: '#7fd39a' },
  review: { label: 'in review', color: '#a78bfa', text: '#a78bfa' },
  building: { label: 'building', color: '#60a5fa', text: '#60a5fa' },
  you: { label: 'your move', color: '#f5b14c', text: '#f5b14c' },
  afk: { label: "agent's move", color: '#2dd4bf', text: '#2dd4bf' },
  blocked: { label: 'blocked', color: '#4a4757', text: 'var(--muted)' },
  fog: { label: 'fog', color: 'transparent', text: 'var(--muted)' },
}

const FOG_FILL = 'repeating-linear-gradient(135deg, var(--border) 0 4px, transparent 4px 8px)'

export const frontierTotal = (counts: FrontierCounts, fog: number) =>
  TILE_STATES.reduce((n, s) => n + (counts[s] || 0), 0) + fog

export function FrontierBar({ counts, fog, height = 6, selected, onSelect }: {
  counts: FrontierCounts
  fog: number
  height?: number
  selected?: TileState | 'fog' | null
  onSelect?: (s: TileState | 'fog') => void
}) {
  const parts: [TileState | 'fog', number][] = [...TILE_STATES.map(s => [s, counts[s] || 0] as [TileState, number]), ['fog', fog]]
  const shown = parts.filter(([, n]) => n > 0)
  if (!shown.length) return null
  return (
    <div style={{ display: 'flex', gap: 2, height, borderRadius: height / 2, overflow: 'hidden', background: 'var(--bg-elevated)' }}>
      {shown.map(([s, n]) => {
        const on = selected === s
        const dim = !!selected && !on
        const style = {
          flex: n,
          minWidth: 4,
          height: '100%',
          background: s === 'fog' ? FOG_FILL : STATE_META[s].color,
          opacity: dim ? 0.35 : 1,
          transition: 'opacity .15s',
          cursor: onSelect ? 'pointer' : undefined,
          padding: 0,
          border: 0,
        }
        const title = `${n} ${STATE_META[s].label}`
        return onSelect
          ? <button key={s} type="button" aria-label={title} title={title} aria-pressed={on} onClick={() => onSelect(s)} style={style} />
          : <span key={s} title={title} style={style} />
      })}
    </div>
  )
}

// The list's view of an effort: one thin bar per half that has anything in it,
// Decide over Deliver. Falls back to one bar for frontiers saved before lanes.
type Saved = { counts: FrontierCounts; fog: number; lanes?: Record<Lane, FrontierCounts> }

export function LaneBars({ frontier, height = 4 }: { frontier: Saved; height?: number }) {
  if (!frontier.lanes) return <FrontierBar counts={frontier.counts} fog={frontier.fog} height={height + 2} />
  const rows = (['decide', 'deliver'] as Lane[]).filter(l =>
    frontierTotal(frontier.lanes![l], l === 'decide' ? frontier.fog : 0) > 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {rows.map(l => (
        <div key={l} title={l === 'decide' ? 'Decide: the front half' : 'Deliver: the back half'}>
          <FrontierBar counts={frontier.lanes![l]} fog={l === 'decide' ? frontier.fog : 0} height={height} />
        </div>
      ))}
    </div>
  )
}

// "2 for you · 4 for agents", or what the effort is doing when nobody's up.
export function whoIsUp(counts: FrontierCounts): string {
  const bits: string[] = []
  if (counts.you) bits.push(`${counts.you} for you`)
  if (counts.afk) bits.push(`${counts.afk} for agents`)
  if (bits.length) return bits.join(' · ')
  if (counts.building) return 'agent building'
  if (counts.review) return 'in review'
  if (counts.blocked) return 'blocked'
  return counts.done ? 'all done' : ''
}

// A session's status dot: pulsing blue while the agent works, amber when it has
// stopped and the conversation is waiting on you.
export type SessionStatus = 'running' | 'waiting'

export function TileButton({ tile, onClick, size = 34, open, status }: {
  tile: Tile; onClick?: () => void; size?: number; open?: boolean; status?: SessionStatus
}) {
  const c = STATE_META[tile.state]
  const solid = tile.state !== 'blocked'
  const done = tile.state === 'done'
  const hint = tile.state === 'blocked' && tile.blockedBy.length
    ? `#${tile.number} ${tile.title}: waiting on ${tile.blockedBy.map(b => `#${b}`).join(', ')}`
    : `#${tile.number} ${tile.title}: ${c.label}`
  const sessionHint = status === 'running' ? ' · agent working' : status === 'waiting' ? ' · waiting on you' : ''
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint + sessionHint}
      aria-current={open ? 'true' : undefined}
      style={{
        position: 'relative', width: size, height: size + 6, flexShrink: 0, borderRadius: 6, padding: 0,
        outline: open ? '2px solid var(--text-strong, #fff)' : undefined, outlineOffset: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: onClick ? 'pointer' : 'default',
        fontWeight: 800, fontSize: 13,
        background: done ? 'rgba(63,174,106,.22)' : solid ? c.color : 'transparent',
        color: done ? '#7fd39a' : solid ? '#14121c' : 'var(--muted)',
        border: solid ? '1px solid transparent' : `1.5px solid ${c.color}`,
      }}
    >
      <span style={{ position: 'absolute', top: 2, left: 4, fontSize: 8.5, fontWeight: 600, opacity: 0.85 }}>{tile.number}</span>
      {tile.code}
      {status && (
        <span
          className={status === 'running' ? 'kipo-pulse' : undefined}
          style={{
            position: 'absolute', top: -3, right: -3, width: 9, height: 9, borderRadius: 999,
            background: status === 'running' ? STATE_META.building.color : 'var(--text-strong, #fff)',
            boxShadow: '0 0 0 2px var(--bg)',
          }}
        />
      )}
    </button>
  )
}

// The effort's frontier, under its header: who's up, then Matt's two halves as
// two bars (Decide: the front half, ending in a spec and tickets; Deliver: the
// back half, ending in merged PRs), a legend that picks a segment, and that
// segment's tiles. Banners mark the two moments that matter: the hand-over from
// Decide to Deliver, and everything landed.
type Pick = { lane: Lane | null; state: TileState | 'fog' | 'open' }

const LANE_LABEL: Record<Lane, string> = { decide: 'Decide', deliver: 'Deliver' }
const LANE_HINT: Record<Lane, string> = {
  decide: 'The front half: grills, prototypes, research and tasks that settle what to build. Ends in a spec and tickets.',
  deliver: 'The back half: tickets that end in a PR. Implement, review, merge.',
}

const btn = (bg: string, fg: string, disabled?: boolean) => ({
  height: 24, padding: '0 10px', borderRadius: 6, border: 0, flexShrink: 0, whiteSpace: 'nowrap' as const,
  background: bg, color: fg, fontWeight: 600, fontSize: T.small,
  cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
})

export function FrontierPanel({
  frontier, onTile, onStartAgents, starting, openNumber, statuses,
  autopilot, onAutopilot, onHandover, onReview, onRetro, reviewOpen,
}: {
  frontier: Frontier
  onTile: (t: Tile) => void
  onStartAgents: (tiles: Tile[]) => void
  starting: string | null
  openNumber: number | null               // the tile whose ticket is showing
  statuses: Record<number, SessionStatus> // tiles with a session, by ticket number
  autopilot: boolean                      // keep agents on the Deliver frontier
  onAutopilot: (on: boolean) => void
  onHandover: () => void                  // /to-spec then /to-tickets
  onReview: () => void                    // the effort's review conversation
  onRetro: () => void
  reviewOpen: boolean                     // a review conversation already exists
}) {
  const { counts, fog, tiles, lanes, handover, landed } = frontier
  const [picked, setPicked] = useState<Pick | null>(null)
  const withSession = tiles.filter(t => t.sessionKey)
  const auto: Pick | null = counts.you ? { lane: null, state: 'you' } : counts.afk ? { lane: null, state: 'afk' } : null
  const sel = picked ?? auto
  const ready = tiles.filter(t => t.state === 'afk')
  const readyDeliver = ready.filter(t => t.lane === 'deliver')
  const total = frontierTotal(counts, fog)
  if (!total && !handover && !landed) return null

  const toggle = (p: Pick) => setPicked(cur => (cur && cur.lane === p.lane && cur.state === p.state ? null : p))
  const isSel = (lane: Lane | null, state: Pick['state']) => !!sel && sel.state === state && (sel.lane === null || sel.lane === lane)
  const tilesShown = !sel ? []
    : sel.state === 'open' ? withSession
    : sel.state === 'fog' ? []
    : tiles.filter(t => t.state === sel.state && (sel.lane === null || t.lane === sel.lane))
  const laneTotal = (l: Lane) => TILE_STATES.reduce((n, s) => n + (lanes[l][s] || 0), 0) + (l === 'decide' ? fog : 0)

  return (
    <div style={{ padding: '8px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <style>{'@keyframes kipo-pulse{0%,100%{opacity:1}50%{opacity:.35}}.kipo-pulse{animation:kipo-pulse 1.2s ease-in-out infinite}'}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: T.body, minWidth: 0 }}>
        {counts.you > 0 && <span style={{ whiteSpace: 'nowrap' }}><b style={{ color: STATE_META.you.text }}>Your move:</b> {counts.you}</span>}
        {counts.afk > 0 && <span style={{ whiteSpace: 'nowrap' }}><b style={{ color: STATE_META.afk.text }}>Agent's move:</b> {counts.afk}</span>}
        <span style={{ ...muted, fontSize: T.small, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
          {counts.done} of {tiles.length} done{fog ? ` · ${fog} in the fog` : ''}
        </span>
        <span style={{ flex: 1 }} />
        {lanes.deliver.review > 0 && (
          <button type="button" onClick={onReview} title="Review the open PRs, fix what it finds, merge the two-way doors"
            style={btn(STATE_META.review.color, '#160b33')}>
            {reviewOpen ? 'Open review' : `Review ${lanes.deliver.review} PR${lanes.deliver.review === 1 ? '' : 's'}`}
          </button>
        )}
        {(readyDeliver.length > 0 || autopilot) && (
          <button type="button" aria-pressed={autopilot} onClick={() => onAutopilot(!autopilot)}
            title="Autopilot: when a ticket closes and frees the next Deliver ticket an agent can take, KiPo starts it. Runs while this effort is open in KiPo."
            style={{
              ...btn(autopilot ? 'rgba(45,212,191,.14)' : 'transparent', autopilot ? STATE_META.afk.text : 'var(--muted)'),
              border: `1px solid ${autopilot ? STATE_META.afk.color : 'var(--border)'}`, fontWeight: 500,
            }}>
            <span aria-hidden style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 999, marginRight: 6,
              background: autopilot ? STATE_META.afk.color : 'var(--muted)' }} className={autopilot ? 'kipo-pulse' : undefined} />
            Autopilot {autopilot ? 'on' : 'off'}
          </button>
        )}
        {ready.length > 0 && (
          <button type="button" disabled={!!starting} onClick={() => onStartAgents(ready)}
            title={`Start a session for each: ${ready.map(t => `#${t.number}`).join(', ')}`}
            style={btn(STATE_META.afk.color, '#062621', !!starting)}>
            {starting ?? `Start ${ready.length} agent${ready.length === 1 ? '' : 's'}`}
          </button>
        )}
      </div>

      {handover && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 8, fontSize: T.small,
          border: `1px solid ${STATE_META.afk.color}`, background: 'var(--bg-elevated)' }}>
          <span style={{ flex: 1 }}><b>The map is clear.</b> <span style={muted}>Every decision is closed and the fog is gone: write the spec and cut the tickets.</span></span>
          <button type="button" onClick={onHandover} style={btn(STATE_META.afk.color, '#062621')}>Write the spec</button>
        </div>
      )}
      {landed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 8, fontSize: T.small,
          border: `1px solid ${STATE_META.done.color}`, background: 'var(--bg-elevated)' }}>
          <span style={{ flex: 1 }}><b>Everything delivered is merged.</b> <span style={muted}>Retro the run, then close the effort.</span></span>
          <button type="button" onClick={onRetro} style={btn(STATE_META.done.color, '#062010')}>Run /retro</button>
        </div>
      )}

      {(['decide', 'deliver'] as Lane[]).map(lane => {
        const c = lanes[lane]
        const n = laneTotal(lane)
        return (
          <div key={lane} style={{ display: 'grid', gridTemplateColumns: '58px minmax(0, 1fr)', alignItems: 'center', gap: 10, minHeight: 16 }}>
            <span title={LANE_HINT[lane]} style={{ fontSize: T.small, fontWeight: 600, color: frontier.active[lane] ? 'var(--text)' : 'var(--muted)' }}>
              {LANE_LABEL[lane]}
            </span>
            {n > 0 ? (
              <FrontierBar counts={c} fog={lane === 'decide' ? fog : 0} height={10}
                selected={sel && (sel.lane === lane || sel.lane === null) && sel.state !== 'open' ? sel.state : null}
                onSelect={s => toggle({ lane, state: s })} />
            ) : (
              <span style={{ ...muted, fontSize: T.tiny }}>
                {lane === 'deliver' ? (handover ? 'No tickets yet: write the spec first.' : 'No tickets yet.') : 'Nothing left to decide.'}
              </span>
            )}
          </div>
        )
      })}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: T.tiny, paddingLeft: 68 }}>
        {([...TILE_STATES, 'fog'] as const).map(s => {
          const n = s === 'fog' ? fog : counts[s]
          if (!n) return null
          const on = isSel(null, s) && (!sel || sel.lane === null)
          return (
            <button key={s} type="button" onClick={() => toggle({ lane: null, state: s })}
              style={{ background: 'transparent', padding: 0, cursor: 'pointer', color: on ? STATE_META[s].text : 'var(--muted)', fontWeight: on ? 600 : 400 }}>
              <span style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: 2, marginRight: 5,
                background: s === 'fog' ? FOG_FILL : STATE_META[s].color, border: s === 'fog' ? '1px dashed var(--muted)' : undefined,
              }} />
              {n} {STATE_META[s].label}
            </button>
          )
        })}
        {withSession.length > 0 && (
          <button type="button" onClick={() => toggle({ lane: null, state: 'open' })}
            title="Tickets with a conversation: flip between them"
            style={{ background: 'transparent', padding: 0, cursor: 'pointer', marginLeft: 'auto', color: sel?.state === 'open' ? 'var(--text)' : 'var(--muted)', fontWeight: sel?.state === 'open' ? 600 : 400 }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 999, marginRight: 5, background: STATE_META.building.color }} />
            {withSession.length} conversation{withSession.length === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {sel?.state === 'fog' && (
        <div style={{ ...muted, fontSize: T.small, paddingLeft: 68 }}>
          {fog} question{fog === 1 ? '' : 's'} in the map's "Not yet specified": in scope, not sharp enough to ticket yet.
        </div>
      )}
      {tilesShown.length > 0 && sel && (
        <div style={{ paddingLeft: 68 }}>
          <div style={{ fontSize: T.tiny, marginBottom: 2, color: sel.state === 'open' ? 'var(--text)' : STATE_META[sel.state].text }}>
            {sel.state === 'open' ? 'Conversations' : STATE_META[sel.state].label[0].toUpperCase() + STATE_META[sel.state].label.slice(1)}
            {sel.lane ? ` · ${LANE_LABEL[sel.lane]}` : ''}
            <span style={muted}> · click a tile to open it</span>
          </div>
          {/* Padding inside the scroller leaves room for the open tile's outline and
              the status dots, which sit outside each tile's box. */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '6px 6px 6px 4px', margin: '0 -6px 0 -4px', scrollbarWidth: 'thin' }}>
            {tilesShown.map(t => (
              <TileButton key={t.number} tile={t} onClick={() => onTile(t)} open={t.number === openNumber} status={statuses[t.number]} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
