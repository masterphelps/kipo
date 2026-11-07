// Draggable dividers between panes, like Spec Builder's. Sizes are remembered per
// browser so the layout stays the way you left it.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'

const KEY = 'kipo.layout.v1'

function readAll(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

export function useStoredSize(name: string, initial: number, min: number, max: number) {
  const clamp = useCallback((v: number) => Math.round(Math.min(max, Math.max(min, v))), [min, max])
  const [size, setSize] = useState(() => {
    const saved = readAll()[name]
    return clamp(typeof saved === 'number' ? saved : initial)
  })
  useEffect(() => {
    const all = readAll()
    all[name] = size
    try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* private mode: keep it in memory */ }
  }, [name, size])
  const set = useCallback((v: number | ((s: number) => number)) => {
    setSize(prev => clamp(typeof v === 'function' ? v(prev) : v))
  }, [clamp])
  return [size, set] as const
}

// A thin handle between two panes. `onDrag` receives the pointer's movement since
// the last event; the caller decides which pane grows. Double-click resets.
export function Divider({ direction, onDrag, onReset, label }: {
  direction: 'vertical' | 'horizontal' // vertical = a line between left and right panes
  onDrag: (delta: number) => void
  onReset?: () => void
  label: string
}) {
  const last = useRef<number | null>(null)
  const [active, setActive] = useState(false)
  const vertical = direction === 'vertical'

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    last.current = vertical ? e.clientX : e.clientY
    setActive(true)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (last.current == null) return
    const pos = vertical ? e.clientX : e.clientY
    const delta = pos - last.current
    if (delta) { last.current = pos; onDrag(delta) }
  }
  const end = (e: React.PointerEvent) => {
    last.current = null
    setActive(false)
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* already released */ }
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 40 : 10
    const back = vertical ? 'ArrowLeft' : 'ArrowUp'
    const fwd = vertical ? 'ArrowRight' : 'ArrowDown'
    if (e.key === back) { e.preventDefault(); onDrag(-step) }
    if (e.key === fwd) { e.preventDefault(); onDrag(step) }
  }

  const style: CSSProperties = vertical
    ? { width: 7, margin: '0 -3px', cursor: 'col-resize', alignSelf: 'stretch' }
    : { height: 7, margin: '-3px 0', cursor: 'row-resize', width: '100%' }

  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-label={label}
      tabIndex={0}
      title={`${label}. Drag to resize, double-click to reset.`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      style={{ ...style, flexShrink: 0, position: 'relative', zIndex: 2, touchAction: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
    >
      <span
        aria-hidden
        style={vertical
          ? { width: 1, height: '100%', background: active ? 'var(--accent)' : 'var(--border)' }
          : { height: 1, width: '100%', background: active ? 'var(--accent)' : 'var(--border)' }}
      />
    </div>
  )
}
