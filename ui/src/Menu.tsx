import { Btn } from '@kirocrew/app-sdk/ui'
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'

// A row menu that looks and behaves like Kiro's own (its sessions' ⋯ and
// right-click menu): same surface, item sizes, hover and danger colours, closes
// on a click outside, Escape or the window losing focus. Kept to the window.

export type MenuItem =
  | { separator: true }
  | { label: string; onSelect: () => void; icon?: ComponentType<{ size?: number }>; danger?: boolean }

const surface = {
  position: 'fixed' as const,
  zIndex: 99999,
  background: 'var(--bg-elevated, #2a2a2a)',
  border: '1px solid var(--border, rgba(255,255,255,0.15))',
  borderRadius: 6,
  boxShadow: '0 4px 12px var(--shadow, rgba(0,0,0,0.5))',
}

function usePopover(x: number, y: number, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({
      x: x + r.width > window.innerWidth ? Math.max(0, x - r.width) : x,
      y: y + r.height > window.innerHeight ? Math.max(0, y - r.height) : y,
    })
  }, [x, y])
  useEffect(() => {
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const t = setTimeout(() => {
      window.addEventListener('mousedown', down, true)
      window.addEventListener('keydown', key, true)
      window.addEventListener('blur', onClose)
    }, 50)
    return () => {
      clearTimeout(t)
      window.removeEventListener('mousedown', down, true)
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])
  return { ref, pos }
}

export function Menu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const { ref, pos } = usePopover(x, y, onClose)
  useEffect(() => { ref.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus() }, [ref])
  return (
    <div ref={ref} role="menu" style={{ ...surface, left: pos.x, top: pos.y, padding: '4px 0', minWidth: 160 }}>
      {items.map((item, i) => {
        if ('separator' in item) {
          return <div key={`sep-${i}`} role="separator" style={{ height: 1, background: 'var(--border, rgba(255,255,255,0.15))', margin: '2px 0' }} />
        }
        const Icon = item.icon
        const pick = () => { onClose(); item.onSelect() }
        return (
          <div key={item.label} role="menuitem" tabIndex={0}
            onClick={e => { e.stopPropagation(); pick() }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick() } }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            style={{ padding: '6px 16px', fontSize: 12, cursor: 'pointer', outline: 'none',
              color: item.danger ? 'var(--danger, #f38ba8)' : 'var(--text, #e0e0e0)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.85 }}>
                {Icon ? <Icon size={13} /> : null}
              </span>
              {item.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// A confirmation in the same surface, where the menu was.
export function Confirm({ x, y, title, children, action, onConfirm, onClose }: {
  x: number; y: number; title: string; children?: ReactNode; action: string
  onConfirm: () => void; onClose: () => void
}) {
  const { ref, pos } = usePopover(x, y, onClose)
  return (
    <div ref={ref} role="alertdialog" aria-label={title}
      style={{ ...surface, left: pos.x, top: pos.y, padding: '12px 14px', width: 280 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #e0e0e0)', lineHeight: 1.35 }}>{title}</div>
      {children && <div style={{ fontSize: 12, color: 'var(--text-muted, #888)', marginTop: 6, lineHeight: 1.45 }}>{children}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn danger onClick={() => { onClose(); onConfirm() }}>{action}</Btn>
      </div>
    </div>
  )
}
