import { useState } from 'react'
import { backend, errorText } from './api'
import { ErrorLine, StartBadge, T, TextButton, muted, strong, timeAgo } from './common'
import { LaneBars, frontierTotal, whoIsUp } from './Frontier'
import { STAGES, STAGE_HINTS, STAGE_LABELS, stageOfColumn, type Effort } from './types'

// The board: every effort in its stage (read from its tickets), for the whole
// picture at once. Each card shows its Decide and Deliver bars and who's up.
export function Board({ items, onOpen, onRemoved }: {
  items: Effort[] | null
  onOpen: (e: Effort) => void
  onRemoved: () => void
}) {
  const [error, setError] = useState('')
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ ...strong, fontSize: T.title }}>Board</span>
        <span style={{ ...muted, fontSize: T.small }}>{items ? `${items.length} open` : 'Loading…'}</span>
      </div>
      <ErrorLine>{error}</ErrorLine>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 8, overflowX: 'auto' }}>
        {STAGES.map(column => {
          const col = (items ?? []).filter(i => (i.stage ?? stageOfColumn(i.column)) === column)
          return (
            <div key={column} style={{ flex: '1 0 220px', maxWidth: 380, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-elevated)', color: 'var(--text)', borderRadius: 8 }}>
              <div style={{ padding: '8px 10px 6px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ ...strong, fontSize: T.small }}>{STAGE_LABELS[column]}</span>
                  <span style={{ ...muted, fontSize: T.tiny }}>{col.length || ''}</span>
                </div>
                <div style={{ ...muted, fontSize: T.tiny, marginTop: 2, lineHeight: 1.35 }}>{STAGE_HINTS[column]}</div>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 6px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {col.map(i => <Card key={`${i.repo}#${i.number}`} e={i} onOpen={() => onOpen(i)} onRemoved={onRemoved} onError={setError} />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Card({ e, onOpen, onRemoved, onError }: { e: Effort; onOpen: () => void; onRemoved: () => void; onError: (m: string) => void }) {
  const [hover, setHover] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const c = e.ticketCounts
  const remove = async () => {
    setBusy(true)
    try { await backend.removeInitiative(e.repo, e.number); onRemoved() } catch (err) {
      onError(`Couldn't remove “${e.title}”: ${errorText(err)}`); setBusy(false); setConfirming(false)
    }
  }
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', background: 'var(--card, var(--bg))', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }}>
      <button type="button" onClick={onOpen}
        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 26px 7px 9px', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>
        <div style={{ ...strong, fontSize: T.body, lineHeight: 1.3 }}>{e.title}</div>
        <div style={{ ...muted, fontSize: T.tiny, marginTop: 2 }}>{e.repo.split('/')[1]} #{e.number}, {timeAgo(e.updatedAt)}</div>
        {e.frontier && frontierTotal(e.frontier.counts, e.frontier.fog) > 0 ? (
          <div style={{ marginTop: 6 }}>
            <LaneBars frontier={e.frontier} height={5} />
            <div style={{ ...muted, fontSize: T.tiny, marginTop: 4 }}>{whoIsUp(e.frontier.counts)}</div>
          </div>
        ) : c && c.open + c.closed > 0 ? (
          <div style={{ ...muted, fontSize: T.tiny, marginTop: 3 }}>{c.closed} of {c.open + c.closed} tickets done</div>
        ) : null}
        <div style={{ marginTop: 5 }}><StartBadge start={e.start} /></div>
      </button>
      {!confirming && hover && (
        <button type="button" aria-label={`Remove ${e.title}`} title="Remove from KiPo" onClick={() => setConfirming(true)}
          style={{ position: 'absolute', top: 4, right: 4, padding: '0 6px', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, lineHeight: '20px' }}>×</button>
      )}
      {confirming && (
        <div style={{ padding: '0 9px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: T.small }}>
          <span style={{ ...muted, flex: 1 }}>Remove it?</span>
          <TextButton danger disabled={busy} onClick={remove}>{busy ? 'Removing…' : 'Remove'}</TextButton>
          <TextButton disabled={busy} onClick={() => setConfirming(false)}>Keep</TextButton>
        </div>
      )}
    </div>
  )
}
