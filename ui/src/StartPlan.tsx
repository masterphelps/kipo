import { Btn } from '@kirocrew/app-sdk/ui'
import { useEffect, useState } from 'react'
import { backend, errorText } from './api'
import { ErrorLine, PathChip, T, fieldStyle, muted, strong } from './common'
import { FolderPicker } from './Settings'
import type { FoundRepo, Initiative, Size } from './types'

// "Let's plan something", after Spec Builder's start form. KiPo takes work of
// any size, so instead of a work type it asks how big the work is: that picks the
// path (a quick plan, a full spec, or a decision map for a whole product).
type Scale = Size | 'unsure'

const SCALES: { id: Scale; title: string; hint: string }[] = [
  { id: 'small', title: 'Quick change', hint: 'One sitting: a goal, a short chat, the change.' },
  { id: 'feature', title: 'Feature', hint: 'A spec, a technical design and tickets.' },
  { id: 'foggy', title: 'Product or platform', hint: 'Map the big decisions first, one at a time.' },
  { id: 'bug', title: 'Bug', hint: 'Find the root cause, then plan the fix.' },
  { id: 'unsure', title: 'Not sure yet', hint: 'Size it together in the first conversation.' },
]

const label = (text: string) => (
  <span style={{ ...strong, fontSize: T.body, display: 'block', marginBottom: 6 }}>{text}</span>
)

export function StartPlan({ onStarted, onCancel }: {
  onStarted: (i: Initiative) => void
  onCancel?: () => void
}) {
  const [description, setDescription] = useState('')
  const [repos, setRepos] = useState<FoundRepo[] | null>(null)
  const [path, setPath] = useState('')
  const [picking, setPicking] = useState(false)
  const [worktree, setWorktree] = useState(false)
  const [scale, setScale] = useState<Scale>('unsure')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    backend.discoverRepos()
      .then(r => setRepos(
        r.repos
          .filter(x => x.slug && !x.worktree)
          .sort((a, b) => Number(b.configured) - Number(a.configured) || a.name.localeCompare(b.name)),
      ))
      .catch(e => { setError(errorText(e)); setRepos([]) })
  }, [])

  const pickFolder = (p: string) => {
    setPicking(false)
    setPath(p)
    if (repos && !repos.some(r => r.path === p)) {
      setRepos([...repos, { path: p, name: p.split('/').pop() || p, slug: null, remote: null, worktree: false, configured: false }])
    }
  }

  const start = async () => {
    if (!description.trim()) { setError('Say what you want to do first.'); return }
    if (!path) { setError('Choose which project this is for.'); return }
    setBusy(true)
    setError('')
    try {
      onStarted(await backend.startInitiative({
        path,
        description: description.trim(),
        size: scale === 'unsure' ? null : scale,
        worktree,
      }))
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 460, margin: '0 auto 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ ...strong, fontSize: 18 }}>Let's plan something</div>
        <div style={{ ...muted, fontSize: T.body, marginTop: 4, maxWidth: 520 }}>
          Describe it, and the agent asks a few questions here, then takes it through each phase with you.
        </div>
      </div>
      <ErrorLine>{error}</ErrorLine>

      <label>
        {label('What do you want to do?')}
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          autoFocus
          placeholder="e.g. Add login with Google, the export button crashes on large files, or a billing platform our products can share"
          style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.45 }}
        />
      </label>

      <div>
        {label('Which project is this for?')}
        <select
          value={path}
          onChange={e => (e.target.value === '__pick' ? setPicking(true) : setPath(e.target.value))}
          style={fieldStyle}
          disabled={repos === null}
        >
          <option value="">{repos === null ? 'Looking for your projects…' : 'Choose a project…'}</option>
          {repos?.map(r => (
            <option key={r.path} value={r.path}>{r.slug ?? r.name}</option>
          ))}
          <option value="__pick">Another folder…</option>
        </select>
        {path && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div><PathChip path={path} /></div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: T.body }}>
              <input type="checkbox" checked={worktree} onChange={e => setWorktree(e.target.checked)} style={{ marginTop: 3 }} />
              <span>
                Work in a fresh worktree
                <span style={muted}> so your main checkout stays untouched</span>
              </span>
            </label>
          </div>
        )}
        {picking && <div style={{ marginTop: 8 }}><FolderPicker busy={null} onAdd={pickFolder} actionLabel="Use" /></div>}
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ padding: 0 }}>{label('How big is it?')}</legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {SCALES.map(s => {
            const on = scale === s.id
            return (
              <label
                key={s.id}
                style={{
                  display: 'block',
                  padding: '8px 10px 9px',
                  cursor: 'pointer',
                  borderRadius: 8,
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                  background: on ? 'var(--accent-subtle, var(--bg-elevated))' : 'var(--card, var(--bg))',
                  color: 'var(--text)',
                }}
              >
                <input type="radio" name="scale" checked={on} onChange={() => setScale(s.id)}
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
                <div style={{ ...strong, fontSize: T.body }}>{s.title}</div>
                <div style={{ ...muted, fontSize: T.small, marginTop: 3, lineHeight: 1.4 }}>{s.hint}</div>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Btn primary disabled={busy} onClick={start}>{busy ? 'Starting…' : 'Start the conversation'}</Btn>
        {onCancel && <Btn onClick={onCancel}>Never mind</Btn>}
      </div>
      <div style={{ ...muted, fontSize: T.small, lineHeight: 1.5 }}>
        Each initiative is a GitHub issue in the project. Its decisions, spec and tickets live there and in the repo, so they also work outside KiPo.
      </div>
    </div>
  )
}
