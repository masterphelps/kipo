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

// A handle between two panes. `onDrag` receives the pointer's movement since the
// last event; the caller decides which pane grows. Double-click resets.
//
// While dragging, a transparent layer covers the whole window and takes the
// pointer: an embedded chat (or any frame) under the cursor would otherwise
// swallow the moves and the drag would stop dead.
export function Divider({ direction, onDrag, onReset, label }: {
  direction: 'vertical' | 'horizontal' // vertical = a line between left and right panes
  onDrag: (delta: number) => void
  onReset?: () => void
  label: string
}) {
  const last = useRef<number | null>(null)
  const [active, setActive] = useState(false)
  const [hover, setHover] = useState(false)
  const vertical = direction === 'vertical'
  const pos = (e: { clientX: number; clientY: number }) => (vertical ? e.clientX : e.clientY)

  useEffect(() => {
    if (!active) return
    const move = (e: PointerEvent) => {
      if (last.current == null) return
      const p = pos(e)
      const delta = p - last.current
      if (delta) { last.current = p; onDrag(delta) }
    }
    const up = () => { last.current = null; setActive(false) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, onDrag])

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    last.current = pos(e)
    setActive(true)
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 40 : 10
    const back = vertical ? 'ArrowLeft' : 'ArrowUp'
    const fwd = vertical ? 'ArrowRight' : 'ArrowDown'
    if (e.key === back) { e.preventDefault(); onDrag(-step) }
    if (e.key === fwd) { e.preventDefault(); onDrag(step) }
  }

  const lit = active || hover
  const style: CSSProperties = vertical
    ? { width: 9, margin: '0 -4px', cursor: 'col-resize', alignSelf: 'stretch' }
    : { height: 9, margin: '-4px 0', cursor: 'row-resize', width: '100%' }

  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-label={label}
      tabIndex={0}
      title={`${label}. Drag to resize, double-click to reset.`}
      onPointerDown={onPointerDown}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      style={{ ...style, flexShrink: 0, position: 'relative', zIndex: 2, touchAction: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
    >
      <span
        aria-hidden
        style={vertical
          ? { width: lit ? 3 : 1, height: '100%', borderRadius: 2, background: lit ? 'var(--accent)' : 'var(--border)', transition: 'width .1s' }
          : { height: lit ? 3 : 1, width: '100%', borderRadius: 2, background: lit ? 'var(--accent)' : 'var(--border)', transition: 'height .1s' }}
      />
      {/* A grip in the middle so the handle can be found without hunting. */}
      <span aria-hidden style={{
        position: 'absolute', borderRadius: 3, background: lit ? 'var(--accent)' : 'var(--border)',
        ...(vertical ? { width: 5, height: 28, top: 'calc(50% - 14px)' } : { height: 5, width: 28, left: 'calc(50% - 14px)' }),
      }} />
      {active && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: vertical ? 'col-resize' : 'row-resize' }} />
      )}
    </div>
  )
}

// A pane above a horizontal divider. It fits its content until you drag the
// divider; after that it keeps the height you gave it (remembered). Double-click
// the divider to go back to fitting. `maxShare` caps it at a share of the window.
export function useFitSplit(name: string, min: number, maxShare = 0.75) {
  const [size, setSize] = useStoredSize(name, 0, 0, 4000) // 0 = fit the content
  const ref = useRef<HTMLDivElement>(null)
  const onDrag = useCallback((d: number) => {
    const max = Math.round(window.innerHeight * maxShare)
    setSize(s => {
      const from = s || ref.current?.offsetHeight || min
      return Math.max(min, Math.min(max, from + d))
    })
  }, [min, maxShare, setSize])
  const style: CSSProperties = size
    ? { flex: `0 0 ${size}px`, minHeight: 0, overflowY: 'auto' }
    : { flex: '0 1 auto', minHeight: 0, maxHeight: `${Math.round(maxShare * 100)}%`, overflowY: 'auto' }
  return { ref, style, onDrag, reset: () => setSize(0) }
}
