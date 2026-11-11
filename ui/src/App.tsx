import { useAppApi, useAppInfo } from '@kirocrew/app-sdk'
import { useCallback, useEffect, useState } from 'react'
import { AddRepoModal } from './AddRepo'
import { backend, errorText } from './api'
import { Divider, useStoredSize } from './layout'
import { cached, remember } from './cache'
import { fileExistingSessions } from './folder'
import { Rail, RailStrip } from './Rail'
import { StartPlan } from './StartPlan'
import type { Effort, RepoMeta } from './types'
import { Workspace } from './Workspace'

type Main =
  | { kind: 'new' }
  | { kind: 'initiative'; repo: string; number: number; autoStart?: boolean }

// The page, after Spec Builder: a rail of initiatives on the left, and the
// selected one (or the start form) filling the rest of the window.
export default function KiPo() {
  const info = useAppInfo()
  const active = info?.active !== false
  const api = useAppApi()
  // Start from the last answer and the last open view, then refresh.
  const [items, setItems] = useState<Effort[] | null>(() => cached<Effort[]>('initiatives'))
  // The added repos: the sidebar's groups, every map and effort under its own.
  const [repos, setRepos] = useState<RepoMeta[] | null>(() => cached<RepoMeta[]>('repos'))
  const [addingRepo, setAddingRepo] = useState(false)
  const [error, setError] = useState('')
  const [main, setMain] = useState<Main | null>(() => {
    const m = cached<Main>('main')
    // Board and Repos pages are gone; a remembered one falls back to the first effort.
    if (!m || !['new', 'initiative'].includes(m.kind)) return null
    return m.kind === 'initiative' ? { ...m, autoStart: undefined } : m
  })
  useEffect(() => { if (main) remember('main', main) }, [main])
  const [railWidth, setRailWidth] = useStoredSize('rail', 300, 168, 620)
  // The open effort's spine (conductor + stations) renders inside the rail,
  // under its row: the Rail provides this element, the Workspace portals in.
  const [spineHost, setSpineHost] = useState<HTMLElement | null>(null)
  // The effort list can be folded to a narrow strip; remembered per browser.
  const [railOpen, setRailOpenState] = useState(() => localStorage.getItem('kipo.railOpen') !== '0')
  const setRailOpen = (on: boolean) => { setRailOpenState(on); localStorage.setItem('kipo.railOpen', on ? '1' : '0') }

  // Sessions started before KiPo filed them are moved into its folder once.
  useEffect(() => { void fileExistingSessions(api).catch(() => undefined) }, [api])

  const load = useCallback(() => {
    backend.listInitiatives()
      .then(r => {
        setItems(r.initiatives); remember('initiatives', r.initiatives)
        setRepos(r.repos ?? []); remember('repos', r.repos ?? [])
        setError('')
      })
      .catch(e => setError(errorText(e)))
  }, [])

  useEffect(() => {
    load()
    if (!active) return
    const id = setInterval(load, 15_000)
    return () => clearInterval(id)
  }, [load, active])

  // First load: open the most recently touched initiative, or the start form.
  // A remembered effort that has since left the board falls back the same way.
  useEffect(() => {
    if (items === null) return
    const gone = main?.kind === 'initiative' && !items.some(i => i.repo === main.repo && i.number === main.number)
    if (main && !gone) return
    const first = items[0]
    setMain(first ? { kind: 'initiative', repo: first.repo, number: first.number } : { kind: 'new' })
  }, [items, main])

  const open = (i: Effort, autoStart?: boolean) =>
    setMain({ kind: 'initiative', repo: i.repo, number: i.number, autoStart })

  // Off the sidebar (nothing changes on GitHub); the list drops it at once.
  const hide = (i: Effort) => {
    setItems(list => (list ?? []).filter(x => !(x.repo === i.repo && x.number === i.number)))
    backend.hide(i.repo, i.number).then(load).catch(e => { setError(errorText(e)); load() })
  }
  // Close a KiPo effort's issue as not planned (confirmed in the row's menu).
  const remove = (i: Effort) => {
    setItems(list => (list ?? []).filter(x => !(x.repo === i.repo && x.number === i.number)))
    backend.removeInitiative(i.repo, i.number).then(load).catch(e => { setError(errorText(e)); load() })
  }
  // A repo leaves KiPo (confirmed in its group's menu); GitHub isn't touched.
  const removeRepo = (slug: string) => {
    setRepos(list => (list ?? []).filter(r => r.slug !== slug))
    setItems(list => (list ?? []).filter(x => x.repo !== slug))
    backend.removeRepo(slug).then(load).catch(e => { setError(errorText(e)); load() })
  }
  // Bring back what was removed from a repo's list ("N removed · restore").
  const restore = (slug: string, numbers: number[]) => {
    void Promise.allSettled(numbers.map(n => backend.unhide(slug, n))).then(load)
  }

  const selected = main?.kind === 'initiative' ? `${main.repo}#${main.number}` : null

  return (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', display: 'flex', background: 'var(--bg)', color: 'var(--text)' }}>
      {railOpen ? (<>
      <Rail
        width={railWidth}
        onCollapse={() => setRailOpen(false)}
        items={items}
        repos={repos}
        error={error}
        selected={selected}
        spineSlot={setSpineHost}
        onNew={() => setMain({ kind: 'new' })}
        onAddRepo={() => setAddingRepo(true)}
        onRemoveRepo={removeRepo}
        onRestore={restore}
        onSelect={i => open(i)}
        onHide={hide}
        onRemove={remove}
      />
      <Divider direction="vertical" label="Resize the effort list" onDrag={d => setRailWidth(w => w + d)} onReset={() => setRailWidth(228)} />
      </>) : (
        <RailStrip items={items} selected={selected} onNew={() => setMain({ kind: 'new' })}
          onSelect={i => open(i)} onExpand={() => setRailOpen(true)} />
      )}
      <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflowX: 'auto' }}>
        {main?.kind === 'new' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '40px 24px' }}>
            <StartPlan
              onStarted={i => { load(); open(i, true) }}
              onCancel={items && items.length ? () => setMain(items[0] ? { kind: 'initiative', repo: items[0].repo, number: items[0].number } : { kind: 'new' }) : undefined}
            />
          </div>
        )}
        {main?.kind === 'initiative' && (
          <Workspace
            key={`${main.repo}#${main.number}`}
            repo={main.repo}
            number={main.number}
            autoStart={main.autoStart}
            active={active}
            spineHost={railOpen ? spineHost : null}
            spineCompact={railWidth < 340}
            onChanged={load}
            onRemoved={() => { load(); setMain(null) }}
          />
        )}
      </main>
      {addingRepo && <AddRepoModal onAdded={load} onClose={() => setAddingRepo(false)} />}
    </div>
  )
}
