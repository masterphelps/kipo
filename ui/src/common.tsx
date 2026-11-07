import { Badge } from '@kirocrew/app-sdk/ui'
import { useState, type CSSProperties, type ReactNode } from 'react'
import type { Size } from './types'

// Layout is written as inline styles on purpose: the page inherits the dashboard's
// stylesheet, which only carries the utility classes the dashboard itself uses.
// Colors always come from the host's theme variables, background and text together.

export const T = {
  body: 13,
  small: 12,
  tiny: 11,
  title: 15,
} as const

export const fieldStyle: CSSProperties = {
  background: 'var(--bg)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '5px 8px',
  fontSize: T.body,
  width: '100%',
  minWidth: 0,
}

export const muted: CSSProperties = { color: 'var(--muted)' }
export const strong: CSSProperties = { color: 'var(--text-strong, var(--text))', fontWeight: 600 }

// A bordered surface with no built-in padding, for dense lists and panes.
export const surface: CSSProperties = {
  background: 'var(--card, var(--bg))',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 8,
}

export function ErrorLine({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <div
      role="alert"
      style={{
        background: 'var(--danger-subtle)',
        color: 'var(--danger-text)',
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: T.body,
      }}
    >
      {children}
    </div>
  )
}

export function PathChip({ path }: { path: string }) {
  return (
    <code
      title={path}
      style={{
        background: 'var(--bg-elevated)',
        color: 'var(--text)',
        fontSize: T.tiny,
        borderRadius: 4,
        padding: '1px 5px',
        wordBreak: 'break-all',
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
      }}
    >
      {path}
    </code>
  )
}

export const SIZE_LABELS: Record<Size, string> = {
  small: 'Quick change',
  feature: 'Feature',
  foggy: 'Product / platform',
  bug: 'Bug',
}

const SIZE_VARIANT: Record<Size, 'ok' | 'aim' | 'err' | 'muted'> = {
  small: 'ok',
  feature: 'aim',
  foggy: 'aim',
  bug: 'err',
}

export function SizeBadge({ size }: { size: Size | null }) {
  if (!size) return <Badge variant="muted">Not sized</Badge>
  return <Badge variant={SIZE_VARIANT[size]}>{SIZE_LABELS[size]}</Badge>
}

// A button sized like the dashboard's normal buttons: one line, fixed height, never
// stretched by its row or wrapped by a narrow column.
export function ActionButton({ children, onClick, disabled, primary, danger, title }: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  danger?: boolean
  title?: string
}) {
  const bg = primary ? 'var(--accent)' : danger ? 'var(--danger-subtle)' : 'var(--bg-elevated)'
  const fg = primary ? 'var(--accent-fg, #fff)' : danger ? 'var(--danger-text)' : 'var(--text)'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        height: 28,
        padding: '0 12px',
        flexShrink: 0,
        alignSelf: 'center',
        whiteSpace: 'nowrap',
        fontSize: T.body,
        fontWeight: primary ? 600 : 500,
        lineHeight: '28px',
        borderRadius: 6,
        border: primary ? '1px solid transparent' : '1px solid var(--border)',
        background: bg,
        color: fg,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}

// A row that scrolls sideways when its items don't fit, instead of squashing them.
export const scrollRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  overflowX: 'auto',
  overflowY: 'hidden',
  minWidth: 0,
  scrollbarWidth: 'thin',
  whiteSpace: 'nowrap',
}

// A plain text button for secondary actions that shouldn't shout.
export function TextButton({ children, onClick, disabled, danger, title }: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: 'transparent',
        color: danger ? 'var(--danger-text)' : 'var(--muted)',
        fontSize: T.small,
        padding: '4px 6px',
        borderRadius: 4,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}

// One collapsible block in a side column: a thin header row, then its content.
export function Section({ title, aside, children, defaultOpen = true }: {
  title: string
  aside?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section style={{ borderTop: '1px solid var(--border)' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          background: 'transparent',
          color: 'var(--text)',
          cursor: 'pointer',
          fontSize: T.small,
        }}
      >
        <span aria-hidden style={{ ...muted, width: 10, fontSize: 9 }}>{open ? '▾' : '▸'}</span>
        <span style={strong}>{title}</span>
        <span style={{ flex: 1 }} />
        {aside != null && <span style={{ ...muted, fontSize: T.tiny }}>{aside}</span>}
      </button>
      {open && <div style={{ padding: '0 12px 10px 28px', fontSize: T.body }}>{children}</div>}
    </section>
  )
}

export function timeAgo(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const secs = Math.max(0, Math.round((Date.now() - t) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} d ago`
  return new Date(t).toLocaleDateString()
}

export const isUrl = (href: string) => /^https?:\/\//i.test(href)
