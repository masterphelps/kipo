// node --test src/stalls.test.ts (npm test): waking stalled sessions.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dueWakes, observation, wakeMessage, watched, wokeNote } from './stalls.ts'
import type { SessionClose } from './types.ts'

const row = (key: string, state?: 'stalled' | 'woken' | 'stuck', status: SessionClose['status'] = 'open'): SessionClose => ({
  key, slot: `slot-${key}`, status, reason: '', ...(state ? { stall: { state, why: 'idle 20 min', id: 'idle@x', wakes: 0 } } : {}),
})

test('the wake message says why and what to do', () => {
  assert.equal(wakeMessage('idle 42 min'),
    '[KiPo] Carry on: idle 42 min. Re-read your ticket, its PR and comments, and your state file, '
    + 'then continue from where you stopped; report when you finish or block.')
  assert.equal(wokeNote('review-t1024', 'idle 42 min'), '[KiPo] Woke review-t1024: idle 42 min')
})

test('observation reads the last message and running', () => {
  assert.deepEqual(observation({ running: false, messages: [{ ts: '2026-11-10T12:04:48Z', role: 'assistant' }] }),
    { at: '2026-11-10T12:04:48Z', running: false, agent: true })
  assert.deepEqual(observation({ running: true, messages: [{ ts: 't', role: 'user' }] }), { at: 't', running: true, agent: false })
  assert.deepEqual(observation({ messages: [] }), { at: null, running: null, agent: null })
  assert.equal(observation(null), null)
})

test('only stalled sessions are woken, never on screen, the conductor or twice here', () => {
  const rows = [row('review-t4', 'stalled'), row('build-t5', 'woken'), row('build-t6', 'stuck'), row('build-t7'),
    row('build-t8', 'stalled'), row('conductor', 'stalled')]
  assert.deepEqual(dueWakes(rows, 'slot-build-t8', () => false).map(r => r.key), ['review-t4'])
  assert.deepEqual(dueWakes(rows, null, id => id === 'review-t4/idle@x').map(r => r.key), ['build-t8'])
})

test('activity is read for open sessions but the conductor', () => {
  const rows = [row('conductor'), row('review-t4'), row('build-t4', undefined, 'closed'), row('plan', undefined, 'closable')]
  assert.deepEqual(watched(rows).map(r => r.key), ['review-t4'])
})
