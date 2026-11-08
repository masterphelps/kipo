import { Btn } from '@kirocrew/app-sdk/ui'
import { useEffect, useState } from 'react'
import { backend, errorText } from './api'
import { ErrorLine, PathChip, T, fieldStyle, muted, strong } from './common'
import { FolderPicker } from './FolderPicker'
import type { Effort, FoundRepo, Start } from './types'

// The start form, after Spec Builder's. KiPo asks where the work starts, because
// that picks which columns it walks through (CONTRACT.md, "Start points").
const STARTS: { id: Start; title: string; hint: string; begins: string }[] = [
  { id: 'idea', title: 'An idea', hint: 'Grill it, spec and ticket it, build it.', begins: 'a grilling: an interview that sharpens the idea. Then the spec and tickets, then the build.' },
  { id: 'small', title: 'A small change', hint: 'Grill briefly, then build in the same session.', begins: 'a short grilling, then the build in the same conversation. No spec or tickets.' },
  { id: 'huge', title: 'A huge effort', hint: 'Too many unknowns: map the decisions first.', begins: 'a wayfinder map. Its decision tickets fill the Decide lane.' },
  { id: 'issue', title: 'An incoming issue', hint: 'Triage it until an agent can pick it up.', begins: 'triaging the issue. Once an agent can take it, it moves to the Deliver lane.' },
  { id: 'bug', title: 'A hard bug', hint: 'Diagnose it with a tight loop, then fix it.', begins: 'a diagnosis: a command that goes red on the bug, then the fix.' },
]

const label = (text: string) => (
  <span style={{ ...strong, fontSize: T.body, display: 'block', marginBottom: 6 }}>{text}</span>
)

const issueNumber = (text: string): number | null => {
  const m = text.trim().match(/(?:issues\/|#)?(\d+)\s*$/)
  return m ? Number(m[1]) : null
}

export function StartPlan({ onStarted, onCancel }: {
  onStarted: (e: Effort) => void
  onCancel?: () => void
}) {
  const [description, setDescription] = useState('')
  const [repos, setRepos] = useState<FoundRepo[] | null>(null)
  const [path, setPath] = useState('')
  const [picking, setPicking] = useState(false)
  const [worktree, setWorktree] = useState(false)
  const [start, setStart] = useState<Start>('idea')
  const [source, setSource] = useState('')
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

  const go = async () => {
    const sourceIssue = start === 'issue' && source.trim() ? issueNumber(source) : null
    if (start === 'issue' && source.trim() && sourceIssue == null) { setError('Give the issue as a number or its link.'); return }
    if (!description.trim() && !sourceIssue) { setError('Say what you want to do first.'); return }
    if (!path) { setError('Choose which project this is for.'); return }
    setBusy(true)
    setError('')
    try {
      onStarted(await backend.startInitiative({
        path,
        description: description.trim() || `Issue #${sourceIssue}`,
        start,
        worktree,
        sourceIssue,
      }))
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }

  const chosen = STARTS.find(s => s.id === start)!

  return (
    <div style={{ maxWidth: 460, margin: '0 auto 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ ...strong, fontSize: 18 }}>Start an effort</div>
        <div style={{ ...muted, fontSize: T.body, marginTop: 4 }}>
          Describe it, pick where it starts, and the agent takes it through Matt Pocock's flow with you, one column at a time.
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
        <legend style={{ padding: 0 }}>{label('Where does this start?')}</legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {STARTS.map(s => {
            const on = start === s.id
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
                <input type="radio" name="start" checked={on} onChange={() => setStart(s.id)}
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
                <div style={{ ...strong, fontSize: T.body }}>{s.title}</div>
                <div style={{ ...muted, fontSize: T.small, marginTop: 3, lineHeight: 1.4 }}>{s.hint}</div>
              </label>
            )
          })}
        </div>
        <div style={{ ...muted, fontSize: T.small, marginTop: 8 }}>Starts with {chosen.begins}</div>
      </fieldset>

      {start === 'issue' && (
        <label>
          {label('Which issue? (optional)')}
          <input
            value={source}
            onChange={e => setSource(e.target.value)}
            placeholder="#42 or its link, if it's already filed"
            style={fieldStyle}
          />
        </label>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Btn primary disabled={busy} onClick={go}>{busy ? 'Starting…' : 'Start the conversation'}</Btn>
        {onCancel && <Btn onClick={onCancel}>Never mind</Btn>}
      </div>
      <div style={{ ...muted, fontSize: T.small, lineHeight: 1.5 }}>
        Each effort is a GitHub issue in the project. Its decisions, spec and tickets live there and in the repo, so they also work outside KiPo.
      </div>
    </div>
  )
}
