import { useMemo, useState } from 'react'
import { T, fieldStyle, muted, strong, timeAgo } from './common'
import { COLUMNS, COLUMN_LABELS, type Column, type Effort } from './types'

// The left rail, after Spec Builder's spec list: one place to start something new,
// filter, and jump between efforts, grouped by column, in the board's order.
const GROUPS: { title: string; columns: Column[] }[] = COLUMNS.map(c => ({ title: COLUMN_LABELS[c], columns: [c] }))

export type RailView = 'board' | 'repos'

// The heading already names the column, so the row shows the repo and tickets.
function progress(e: Effort): string {
  const repo = e.repo.split('/').pop() || e.repo
  const c = e.ticketCounts
  if (!c || !(c.open + c.closed)) return repo
  return `${repo}, ${c.closed} of ${c.open + c.closed} tickets done`
}

export function Rail({ width, items, error, selected, view, onNew, onSelect, onView }: {
  width: number
  items: Effort[] | null
  error: string
  selected: string | null
  view: RailView | null
  onNew: () => void
  onSelect: (i: Effort) => void
  onView: (v: RailView) => void
}) {
  const [filter, setFilter] = useState('')
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return (items ?? []).filter(i => !q || i.title.toLowerCase().includes(q) || i.repo.toLowerCase().includes(q))
  }, [items, filter])

  return (
    <nav
      aria-label="Efforts"
      style={{
        width,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <div style={{ padding: '12px 12px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          type="button"
          onClick={onNew}
          style={{
            alignSelf: 'flex-start',
            background: 'var(--accent)',
            color: 'var(--accent-fg, #fff)',
            fontSize: T.body,
            fontWeight: 600,
            padding: '5px 12px',
            borderRadius: 999,
            cursor: 'pointer',
          }}
        >
          + New effort
        </button>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter efforts"
          aria-label="Filter efforts"
          style={{ ...fieldStyle, fontSize: T.small, padding: '4px 8px' }}
        />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 6px 8px' }}>
        {error && <div style={{ color: 'var(--danger-text)', fontSize: T.small, padding: '4px 6px' }}>{error}</div>}
        {items === null && !error && <div style={{ ...muted, fontSize: T.small, padding: '4px 6px' }}>Loading…</div>}
        {items !== null && items.length === 0 && (
          <div style={{ ...muted, fontSize: T.small, padding: '4px 6px' }}>No efforts yet.</div>
        )}
        {GROUPS.map(g => {
          const rows = shown.filter(i => g.columns.includes(i.column))
          if (!rows.length) return null
          return (
            <div key={g.title} style={{ marginTop: 8 }}>
              <div style={{ ...muted, fontSize: T.tiny, padding: '4px 6px', display: 'flex' }}>
                <span style={{ flex: 1 }}>{g.title}</span>
                <span>{rows.length}</span>
              </div>
              {rows.map(i => {
                const key = `${i.repo}#${i.number}`
                const on = key === selected
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onSelect(i)}
                    aria-current={on ? 'page' : undefined}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 8px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: on ? 'var(--bg-elevated)' : 'transparent',
                      color: 'var(--text)',
                      border: on ? '1px solid var(--border)' : '1px solid transparent',
                    }}
                  >
                    <div style={{ ...(on ? strong : {}), fontSize: T.body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {i.title}
                    </div>
                    <div style={{ ...muted, fontSize: T.tiny, marginTop: 1, display: 'flex', gap: 6 }}>
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{progress(i)}</span>
                      <span style={{ flexShrink: 0 }}>{timeAgo(i.updatedAt)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', padding: '6px 8px', display: 'flex', gap: 2 }}>
        {(['board', 'repos'] as RailView[]).map(v => (
          <button
            key={v}
            type="button"
            onClick={() => onView(v)}
            style={{
              fontSize: T.small,
              padding: '4px 8px',
              borderRadius: 4,
              cursor: 'pointer',
              background: view === v ? 'var(--bg-elevated)' : 'transparent',
              color: view === v ? 'var(--text)' : 'var(--muted)',
            }}
          >
            {v === 'board' ? 'Board' : 'Repos'}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <span style={{ ...muted, fontSize: T.tiny, alignSelf: 'center' }}>KiPo</span>
      </div>
    </nav>
  )
}
