import { useState } from 'react'
import { backend, errorText } from './api'
import { ErrorLine, SizeBadge, T, TextButton, muted, strong, timeAgo } from './common'
import { PHASES, PHASE_LABELS, STAGES, STAGE_LABELS, type Initiative } from './types'

// The overview: every initiative by phase, for when you want the whole picture
// rather than one initiative's workspace.
export function Board({ items, onOpen, onRemoved }: {
  items: Initiative[] | null
  onOpen: (i: Initiative) => void
  onRemoved: () => void
}) {
  const [error, setError] = useState('')
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ ...strong, fontSize: T.title }}>All initiatives</span>
        <span style={{ ...muted, fontSize: T.small }}>{items ? `${items.length} open` : 'Loading…'}</span>
      </div>
      <ErrorLine>{error}</ErrorLine>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 8, overflowX: 'auto' }}>
        {PHASES.map(phase => {
          const col = (items ?? []).filter(i => i.phase === phase)
          return (
            <div key={phase} style={{ flex: '1 0 170px', maxWidth: 280, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-elevated)', color: 'var(--text)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '8px 10px 6px' }}>
                <span style={{ ...strong, fontSize: T.small }}>{PHASE_LABELS[phase]}</span>
                <span style={{ ...muted, fontSize: T.tiny }}>{col.length || ''}</span>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 6px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {col.map(i => <Card key={`${i.repo}#${i.number}`} i={i} onOpen={() => onOpen(i)} onRemoved={onRemoved} onError={setError} />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Card({ i, onOpen, onRemoved, onError }: { i: Initiative; onOpen: () => void; onRemoved: () => void; onError: (m: string) => void }) {
  const [hover, setHover] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const counts = i.ticketsByStage
  const remove = async () => {
    setBusy(true)
    try { await backend.removeInitiative(i.repo, i.number); onRemoved() } catch (e) {
      onError(`Couldn't remove “${i.title}”: ${errorText(e)}`); setBusy(false); setConfirming(false)
    }
  }
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', background: 'var(--card, var(--bg))', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }}>
      <button type="button" onClick={onOpen}
        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 26px 7px 9px', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>
        <div style={{ ...strong, fontSize: T.body, lineHeight: 1.3 }}>{i.title}</div>
        <div style={{ ...muted, fontSize: T.tiny, marginTop: 2 }}>{i.repo.split('/')[1]} #{i.number}, {timeAgo(i.updatedAt)}</div>
        {counts && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, fontSize: T.tiny }}>
            {STAGES.filter(s => counts[s]).map(s => <span key={s} style={muted}>{STAGE_LABELS[s]} {counts[s]}</span>)}
          </div>
        )}
        <div style={{ marginTop: 5 }}><SizeBadge size={i.size} /></div>
      </button>
      {!confirming && hover && (
        <button type="button" aria-label={`Remove ${i.title}`} title="Remove from KiPo" onClick={() => setConfirming(true)}
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
