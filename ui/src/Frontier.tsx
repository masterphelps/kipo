
import { useState, type ReactNode } from 'react'
import { Popover } from './Menu'
import { T } from './common'
import { tileMeaning } from './glossary'
import { StageBoard, StageStrip, type ColId } from './StageBoard'
import { TILE_STATES, type Frontier, type FrontierCounts, type Lane, type PrInfo, type Tile, type TileState } from './types'

// The frontier bar: an effort's tickets as one bar of colored segments, like a
// storage meter. Done fills from the left; amber is HITL, teal is agent (AFK);
// the striped end is the fog, the questions not sharp enough to ticket yet.
// Click a segment to see its tickets as tiles; click a tile to open or start it.

export const STATE_META: Record<TileState | 'fog', { label: string; color: string; text: string }> = {
  done: { label: 'done', color: '#3fae6a', text: '#7fd39a' },
  review: { label: 'in review', color: '#a78bfa', text: '#a78bfa' },
  building: { label: 'building', color: '#60a5fa', text: '#60a5fa' },
  you: { label: 'HITL', color: '#f5b14c', text: '#f5b14c' },
  afk: { label: 'agent', color: '#2dd4bf', text: '#2dd4bf' },
  blocked: { label: 'blocked', color: '#c2615b', text: '#e08a85' },
  fog: { label: 'fog', color: 'transparent', text: 'var(--muted)' },
}

export const frontierTotal = (counts: FrontierCounts, fog: number) =>
  TILE_STATES.reduce((n, s) => n + (counts[s] || 0), 0) + fog

// A lane's tickets as one bar, a segment per state: done (green), in review,
// building, HITL (amber), agent (teal), blocked (red). Only tickets: the map's
// fog isn't drawn, since it never closes, so a lane whose tickets are all closed
// is a full green bar. Hover for the counts.
const BAR_ORDER: TileState[] = ['done', 'review', 'building', 'you', 'afk', 'blocked']

export function FrontierBar({ counts, fog, height = 6 }: {
  counts: FrontierCounts
  fog: number
  height?: number
}) {
  const parts = BAR_ORDER.map(st => [st, counts[st] || 0] as const).filter(([, n]) => n > 0)
  const total = parts.reduce((a, [, n]) => a + n, 0)
  if (!total) return null
  const title = [
    `${counts.done || 0} of ${total} done`,
    ...parts.filter(([st]) => st !== 'done').map(([st, n]) => `${n} ${STATE_META[st].label}`),
    ...(fog ? [`${fog} not yet specified (not in the bar)`] : []),
  ].join(' · ')
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={counts.done || 0} aria-label={title} title={title}
      style={{ display: 'flex', gap: 2, height, borderRadius: height / 2, overflow: 'hidden' }}>
      {parts.map(([st, n]) => (
        <span key={st} style={{ flex: n, minWidth: 4, background: STATE_META[st].color }} />
      ))}
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

// "2 HITL · 4 agent", or what the effort is doing when neither is ready.
export function whoIsUp(counts: FrontierCounts): string {
  const bits: string[] = []
  if (counts.you) bits.push(`${counts.you} HITL`)
  if (counts.afk) bits.push(`${counts.afk} agent`)
  if (bits.length) return bits.join(' · ')
  if (counts.building) return 'agent building'
  if (counts.review) return 'in review'
  if (counts.blocked) return 'blocked'
  return counts.done ? 'all done' : ''
}

// A session's status dot: pulsing blue while the agent works, amber when it has
// stopped and the conversation is waiting on you.
export type SessionStatus = 'running' | 'waiting'

export function TileButton({ tile, onClick, size = 34, open, status, bare, numberOnly, width }: {
  tile: Tile; onClick?: () => void; size?: number; open?: boolean; status?: SessionStatus
  bare?: boolean // no number in the corner: for small tiles next to their own label
  // Small tiles: just the number, centered (the type letters and a corner number
  // don't both fit under ~30px). The type stays in the hover text.
  numberOnly?: boolean
  width?: number
}) {
  const c = STATE_META[tile.state]
  const solid = tile.state !== 'blocked'
  const done = tile.state === 'done'
  const hint = tile.state === 'blocked' && tile.blockedBy.length
    ? `#${tile.number} ${tile.title}: waiting on ${tile.blockedBy.map(b => `#${b}`).join(', ')}`
    : `#${tile.number} ${tile.title}: ${c.label}`
  const sessionHint = status === 'running' ? ' · agent working' : status === 'waiting' ? ' · awaiting input' : ''
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${hint}${sessionHint}\n\n${tileMeaning(tile)}`}
      aria-current={open ? 'true' : undefined}
      style={{
        position: 'relative', width: width ?? size, height: numberOnly ? size : size + 6, flexShrink: 0, borderRadius: 6, padding: 0,
        outline: open ? '2px solid var(--text-strong, #fff)' : undefined, outlineOffset: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: onClick ? 'pointer' : 'default',
        fontWeight: numberOnly ? 700 : 800, fontSize: numberOnly ? 11 : 13, fontVariantNumeric: 'tabular-nums',
        background: done ? 'rgba(63,174,106,.22)' : solid ? c.color : 'transparent',
        color: done ? '#7fd39a' : solid ? '#14121c' : 'var(--muted)',
        border: solid ? '1px solid transparent' : `1.5px solid ${c.color}`,
      }}
    >
      {numberOnly ? tile.number : (<>
        {!bare && <span style={{ position: 'absolute', top: 2, left: 4, fontSize: 8.5, fontWeight: 600, opacity: 0.85 }}>{tile.number}</span>}
        {tile.code}
      </>)}
      {status && (
        // Inside the tile's top-right corner, in the tile's own text color so it
        // reads on every tile color: pulsing while the agent works, steady
        // when the conversation is waiting on you.
        <span
          className={status === 'running' ? 'kipo-pulse' : undefined}
          style={{
            position: 'absolute', top: numberOnly ? 2 : 4, right: numberOnly ? 2 : 4, width: numberOnly ? 5 : 6, height: numberOnly ? 5 : 6, borderRadius: 999,
            background: 'currentColor',
          }}
        />
      )}
    </button>
  )
}

// The effort's frontier, under its header: who's up, then Matt's two halves as
// two bars (Decide: the front half, ending in a spec and tickets; Deliver: the
// back half, ending in merged PRs), a legend that picks a segment, and that
// segment's tiles.
export const laneTotal = (f: Frontier, l: Lane) =>
  TILE_STATES.reduce((n, s) => n + (f.lanes[l][s] || 0), 0) + (l === 'decide' ? f.fog : 0)

// The summary over the conversation: the one thing to do now (`next`), then
// every ticket of the effort on the board, one column per KiPo skill, each
// with its state. A ticket opens its conversation.

export function FrontierSummary({ variant, frontier, prs, effort, onTile, onSession, openNumber, statuses, conductor, conductorOpen = false, onConductor, onMore, onSkill, next, mapUrl }: {
  onMore?: () => void // strip: "+N" and Done open the Board
  variant: 'board' | 'strip' // the Board tab, or the session view's thin header
  mapUrl?: string | null // the wayfinder map, for the fog popover
  frontier: Frontier
  prs: PrInfo[]
  effort: number
  onTile: (t: Tile) => void // board: a click shows its details; strip: opens its session
  onSession?: (t: Tile) => void // board: a double-click opens its session
  openNumber: number | null
  statuses: Record<number, SessionStatus>
  conductor: 'none' | 'idle' | 'running'
  conductorOpen?: boolean
  onConductor?: () => void
  onSkill?: (stage: ColId, skill: string) => void
  next?: ReactNode
}) {
  // Always shown, even before the effort has tickets: the conductor and the
  // seven skills are where an effort starts.
  const { fog, tiles } = frontier
  const [fogAt, setFogAt] = useState<{ x: number; y: number } | null>(null)
  const fogList = frontier.fogItems?.length ? frontier.fogItems : frontier.fogLeft ?? []
  const left = !frontier.fogItems?.length && !!frontier.fogLeft?.length
  const strip = variant === 'strip'
  return (
    <div style={{ padding: strip ? '6px 12px' : '8px 16px 10px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: strip ? '1px solid var(--border)' : undefined }}>
      <style>{'@keyframes kipo-pulse{0%,100%{opacity:1}50%{opacity:.35}}.kipo-pulse{animation:kipo-pulse 1.2s ease-in-out infinite}'}</style>
      {next}
      <div style={{ overflowX: 'auto', scrollbarWidth: 'thin', paddingBottom: 2 }}>
        {strip ? (
          <StageStrip tiles={tiles} prs={prs} fogItems={frontier.fogItems ?? []} fogLeft={frontier.fogLeft ?? []}
            openNumber={openNumber} statuses={statuses} conductor={conductor} conductorOpen={conductorOpen}
            onConductor={onConductor ?? (() => {})} onTile={onTile} onFog={setFogAt} onMore={onMore} />
        ) : (
          <StageBoard tiles={tiles} prs={prs} fogItems={frontier.fogItems ?? []} fogLeft={frontier.fogLeft ?? []} effort={effort}
            openNumber={openNumber} statuses={statuses} conductor={conductor} onTile={onTile} onSession={onSession} onFog={setFogAt} onSkill={onSkill} />
        )}
      </div>
      {fogAt && (
        <Popover x={fogAt.x} y={fogAt.y} label="Not yet specified" onClose={() => setFogAt(null)}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong, var(--text))' }}>{left ? 'Left unspecified' : 'Not yet specified'} · {fogList.length || fog}</div>
          <div style={{ fontSize: T.tiny, color: 'var(--muted)', marginTop: 3, lineHeight: 1.4 }}>
            {left
              ? 'The map closed with these never specified. HITL: file each as an issue, or drop it.'
              : 'Fog: in scope, but not sharp enough to ticket yet. Each becomes a ticket once the decisions ahead of it are made.'}
          </div>
          <ol style={{ margin: '10px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(fogList.length ? fogList : ['(The map describes it in prose.)']).map((t, i) => (
              <li key={i} style={{ fontSize: T.small, lineHeight: 1.45, color: 'var(--text)' }}>{plain(t)}</li>
            ))}
          </ol>
          {mapUrl && (
            <a href={mapUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 10, fontSize: T.small, color: 'var(--accent)' }}>
              Open the map on GitHub
            </a>
          )}
        </Popover>
      )}
    </div>
  )
}

// Markdown emphasis and links read as plain text in a small popover or tooltip.
const plain = (md: string) => md.replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
