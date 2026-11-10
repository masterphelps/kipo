import type { Column, DispatchEntry, Tile } from './types'

// The conductor's Dispatch queue (kipo_cli.py dispatch), turned into the
// sessions the page starts. Pure, so it can be tested without React.

// A dispatch entry's started-marker: ticket or stage, skill and time. An entry
// without a skill keeps the id it had before skills counted, so entries a
// browser already started aren't started again.
export const dispatchId = (e: DispatchEntry) => `${e.ticket ?? e.stage}${e.skill ? `/${e.skill}` : ''}@${e.at}`

export type DispatchStart =
  // The ticket's build or decision; skill null means the tile's default.
  | { id: string; kind: 'tile'; tile: Tile; skill: string | null }
  // The ticket's kipo-review session (review-t<t>), beside its build.
  | { id: string; kind: 'review'; t: number }
  | { id: string; kind: 'stage'; column: Column; skill: string | null }

// What to start from `queue`, given the ids already handled (`seen`), the
// frontier's tiles and the effort's sessions (key -> slot). `fresh` is every
// entry not seen before: each is handled once, started or skipped. A ticket
// that's done or blocked is skipped, and so is a conversation that already
// exists: for kipo-review that's review-t<t>, not the ticket's build session.
export function dispatchStarts(
  queue: DispatchEntry[], seen: (id: string) => boolean, tiles: Tile[], sessions: Record<string, string>,
): { fresh: string[]; starts: DispatchStart[] } {
  const fresh: string[] = []
  const out: DispatchStart[] = []
  for (const e of queue) {
    const id = dispatchId(e)
    if (seen(id) || fresh.includes(id)) continue
    fresh.push(id)
    if (e.ticket != null) {
      const t = tiles.find(x => x.number === e.ticket)
      if (!t || t.state === 'done' || t.state === 'blocked') continue
      if (e.skill === 'kipo-review') {
        if (!sessions[`review-t${t.number}`]) out.push({ id, kind: 'review', t: t.number })
      } else if (!(t.sessionKey && sessions[t.sessionKey])) {
        // A KiPo stage skill (kipo-build) is the tile's own; any other is run in it.
        out.push({ id, kind: 'tile', tile: t, skill: e.skill && !e.skill.startsWith('kipo-') ? e.skill : null })
      }
    } else if (e.stage) {
      if (!sessions[e.stage]) out.push({ id, kind: 'stage', column: e.stage, skill: e.skill && e.skill !== `kipo-${e.stage}` ? e.skill : null })
    }
  }
  return { fresh, starts: out }
}
