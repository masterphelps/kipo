import type { Column, DispatchEntry, Tile } from './types'

// The conductor's Dispatch queue (kipo_cli.py dispatch), turned into the
// sessions the page starts. Pure, so it can be tested without React.

// A dispatch entry's started-marker: ticket or stage, skill and time. An entry
// without a skill keeps the id it had before skills counted, so entries a
// browser already started aren't started again.
export const dispatchId = (e: DispatchEntry) => `${e.ticket ?? e.stage}${e.skill ? `/${e.skill}` : ''}@${e.at}`

// `replace`: the thread's dead session (stuck, closed, never started) to close
// before this one starts, so a thread never has two live sessions.
export type DispatchStart =
  // The ticket's build or decision; skill null means the tile's default.
  | { id: string; kind: 'tile'; tile: Tile; skill: string | null; replace?: string }
  // The ticket's kipo-review session (review-t<t>), beside its build.
  | { id: string; kind: 'review'; t: number; replace?: string }
  | { id: string; kind: 'stage'; column: Column; skill: string | null; replace?: string }

export type DispatchContext = {
  // The effort's PRs (`prs` and `refPrs`): a closed ticket still gets its
  // kipo-review while an open PR closes or names it.
  prs?: { state: string; tickets?: number[]; refs?: number[] }[]
  // Session keys KiPo says never started (closing rows with started: false).
  unstarted?: string[]
}

// What to start from `queue`, given the ids already handled (`seen`), the
// frontier's tiles and the effort's sessions (key -> slot). `fresh` is every
// entry not seen before: each is handled once, started or skipped. A ticket
// that's done or blocked is skipped (unless it's a kipo-review and an open PR
// names the ticket), and so is a conversation that already exists: for
// kipo-review that's review-t<t>, not the ticket's build session. An existing
// one is replaced when the entry says so (`replace` is its slot) or it never
// started.
export function dispatchStarts(
  queue: DispatchEntry[], seen: (id: string) => boolean, tiles: Tile[], sessions: Record<string, string>,
  ctx: DispatchContext = {},
): { fresh: string[]; starts: DispatchStart[] } {
  const fresh: string[] = []
  const out: DispatchStart[] = []
  const unstarted = new Set(ctx.unstarted ?? [])
  // undefined: start it as new; a slot: replace that one; null: it exists, skip.
  const target = (e: DispatchEntry, key: string | null | undefined): string | null | undefined => {
    const slot = key ? sessions[key] : undefined
    if (!slot) return undefined
    if (e.replace === slot || (key && unstarted.has(key))) return slot
    return null
  }
  const withReplace = <T extends DispatchStart>(s: T, slot: string | undefined): T => (slot ? { ...s, replace: slot } : s)
  const openPrNames = (t: number) => (ctx.prs ?? []).some(p =>
    p.state === 'OPEN' && ((p.tickets ?? []).includes(t) || (p.refs ?? []).includes(t)))
  for (const e of queue) {
    const id = dispatchId(e)
    if (seen(id) || fresh.includes(id)) continue
    fresh.push(id)
    if (e.ticket != null) {
      const t = tiles.find(x => x.number === e.ticket)
      if (!t) continue
      const review = e.skill === 'kipo-review'
      if ((t.state === 'done' || t.state === 'blocked') && !(review && openPrNames(t.number))) continue
      if (review) {
        const slot = target(e, `review-t${t.number}`)
        if (slot !== null) out.push(withReplace({ id, kind: 'review', t: t.number }, slot))
      } else {
        const slot = target(e, t.sessionKey)
        // A KiPo stage skill (kipo-build) is the tile's own; any other is run in it.
        if (slot !== null) {
          out.push(withReplace({ id, kind: 'tile', tile: t, skill: e.skill && !e.skill.startsWith('kipo-') ? e.skill : null }, slot))
        }
      }
    } else if (e.stage) {
      const slot = target(e, e.stage)
      if (slot !== null) {
        out.push(withReplace({ id, kind: 'stage', column: e.stage, skill: e.skill && e.skill !== `kipo-${e.stage}` ? e.skill : null }, slot))
      }
    }
  }
  return { fresh, starts: out }
}
