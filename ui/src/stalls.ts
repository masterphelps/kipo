import type { SessionClose, SessionObservation } from './types'

// Waking stalled sessions (backend/kipo/stalls.py decides which). Pure, so it
// can be tested without React; Workspace does the sending.

// What a stalled session is sent, through the same chat websocket as the conductor.
export const wakeMessage = (why: string) =>
  `[KiPo] Carry on: ${why}. Re-read your ticket, its PR and comments, and your state file, ` +
  'then continue from where you stopped; report when you finish or block.'

// What the conductor is told, so it can relay it.
export const wokeNote = (key: string, why: string) => `[KiPo] Woke ${key}: ${why}`

// One session's activity from Kiro Crew's GET /api/chat/slots/<slot>?limit=1:
// the last message's time, whether the agent wrote it, and whether it's mid-turn.
export function observation(info: { running?: boolean; messages?: { ts?: string; role?: string }[] } | null | undefined): SessionObservation | null {
  if (!info) return null
  const last = info.messages?.[info.messages.length - 1]
  return {
    at: last?.ts || null,
    running: typeof info.running === 'boolean' ? info.running : null,
    agent: last?.role ? last.role !== 'user' && last.role !== 'system' : null,
  }
}

// The sessions to read activity for: every open one but the conductor.
export const watched = (rows: SessionClose[]) => rows.filter(r => r.status === 'open' && r.key !== 'conductor')

// The stalled sessions to wake now: not the one on screen, not one this
// browser already woke for this stall, never the conductor.
export function dueWakes(rows: SessionClose[], onScreen: string | null, wokeHere: (id: string) => boolean): SessionClose[] {
  return rows.filter(r => r.stall?.state === 'stalled' && r.key !== 'conductor' && r.slot !== onScreen
    && !wokeHere(`${r.key}/${r.stall.id}`))
}
