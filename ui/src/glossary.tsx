import type { ReactNode } from 'react'
import type { Tile, TileState } from './types'

// Every short word KiPo puts on screen, and what it means. Anything that shows
// one of these (a tile code, a state pill, a column header) puts the meaning in
// its hover text, so nobody has to remember them.

export const CODE_MEANING: Record<string, string> = {
  Gr: 'Gr = Grilling: a decision ticket, settled by an interview with you (HITL)',
  Pr: 'Pr = Prototype: a decision ticket, settled by building something throwaway to react to',
  Rs: 'Rs = Research: a decision ticket, settled by an agent reading primary sources',
  Tk: 'Tk = Task: a decision-side ticket of plain work on the wayfinder map',
  Bd: 'Bd = Build: a spec ticket that ships code (Deliver)',
  Is: 'Is = Issue: the source issue, or a plain follow-up filed on the map',
}

export const STATE_MEANING: Record<TileState | 'fog', string> = {
  you: 'HITL = human in the loop: open, unblocked, and it needs a person',
  afk: 'Agent (AFK = away from keyboard): open, unblocked, and an agent can take it on its own',
  building: 'In progress: an agent is building it',
  review: 'In review: its pull request is open',
  blocked: 'Blocked: waiting on a ticket that is still open',
  done: 'Done: closed',
  fog: "Fog: in scope but not yet specified — listed in the map's Not yet specified section, not a ticket yet",
}

export const TERM: Record<string, string> = {
  HITL: STATE_MEANING.you,
  AFK: STATE_MEANING.afk,
  Agent: STATE_MEANING.afk,
  PR: 'PR = pull request on GitHub',
  Fog: STATE_MEANING.fog,
  Decide: 'Decide: the wayfinder map — decision tickets that settle what to build',
  Deliver: 'Deliver: the spec tickets — the work that ships it',
  Origin: 'Origin: the issue the effort started from',
  'hand-over': 'Hand-over: the spec tickets were cut from the decided wayfinder map',
  spec: 'Spec tickets: the build tickets cut from the spec, labelled kipo:<effort number>',
  kipo: 'kipo:<n>: the label that ties a ticket to effort #<n>',
  map: 'Wayfinder map: the issue that lists the effort’s decision tickets and its fog',
}

export const tileMeaning = (t: Pick<Tile, 'code' | 'state'>) =>
  [CODE_MEANING[t.code], STATE_MEANING[t.state]].filter(Boolean).join('\n')

// A short word with its meaning on hover.
export function Abbr({ term, title, children }: { term?: string; title?: string; children: ReactNode }) {
  return (
    <abbr title={title ?? (term ? TERM[term] : undefined)}
      style={{ textDecoration: 'underline dotted', textDecorationColor: 'color-mix(in srgb, currentColor 45%, transparent)', textUnderlineOffset: 2, cursor: 'help' }}>
      {children}
    </abbr>
  )
}
