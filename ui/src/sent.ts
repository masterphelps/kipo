// Which answers were already sent to which session's chat, kept OUTSIDE any
// component and persisted to localStorage: the question card clears the moment
// you submit and STAYS cleared — across remounts, conversation switches, and a
// full reload — until the agent records the `answer` in its state file (which
// deletes the entry). Without the persistence a ⌘R resurrected questions you
// had already answered. Entries expire after two hours so a question an agent
// re-opens without recording can still come back.
//
// Shared with the counts (the spine's roll-up pill, the sidebar attention
// dot): a sent-but-not-yet-recorded answer is no longer "waiting on you", so
// the badge and the card can never disagree about it.

const KEY = 'kipo.sentAnswers.v1'
const SENT_TTL = 2 * 60 * 60 * 1000

const load = (): Map<string, number> => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, unknown>
    const now = Date.now()
    return new Map(Object.entries(raw).filter((e): e is [string, number] =>
      typeof e[1] === 'number' && now - e[1] < SENT_TTL))
  } catch {
    return new Map()
  }
}
const sent = load()
const persist = () => {
  try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(sent))) } catch { /* full or blocked: memory still has it */ }
}

export const markSent = (slot: string, id: string): void => {
  sent.set(`${slot}:${id}`, Date.now())
  persist()
}

export const clearSent = (slot: string, id: string): void => {
  if (sent.delete(`${slot}:${id}`)) persist()
}

export const wasSent = (slot: string, id: string): boolean => {
  const at = sent.get(`${slot}:${id}`)
  if (at && Date.now() - at >= SENT_TTL) { sent.delete(`${slot}:${id}`); persist() }
  return !!at && Date.now() - at < SENT_TTL
}
