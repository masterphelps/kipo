// node --test src/dispatch.test.ts (npm test): the page's Dispatch starter.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dispatchId, dispatchStarts } from './dispatch.ts'
import type { DispatchEntry, Tile } from './types.ts'

const tile = (number: number, state: Tile['state'], sessionKey: string | null = null) =>
  ({ number, state, lane: 'deliver', type: 'build', sessionKey }) as Tile

const build: DispatchEntry = { ticket: 1022, at: '2026-11-09T18:34:48Z' }
const review: DispatchEntry = { ticket: 1022, skill: 'kipo-review', at: '2026-11-10T09:00:00Z' }

test('a ticket review is started though its build already was', () => {
  // The build entry was started yesterday (its id is seen) and its session exists.
  const seen = new Set([dispatchId(build)])
  const { fresh, starts } = dispatchStarts(
    [build, review], id => seen.has(id), [tile(1022, 'review', 'build-t1022')],
    { 'build-t1022': 'kipo-x-995-build-t1022' })
  assert.deepEqual(fresh, [dispatchId(review)])
  assert.deepEqual(starts, [{ id: dispatchId(review), kind: 'review', t: 1022 }])
})

test('the started-marker tells a review from the build at the same time', () => {
  assert.notEqual(dispatchId(build), dispatchId({ ...build, skill: 'kipo-review' }))
  assert.equal(dispatchId(build), '1022@2026-11-09T18:34:48Z') // ids a browser already stored stay valid
})

test('a ticket review whose session exists is not started again', () => {
  const { starts } = dispatchStarts(
    [review], () => false, [tile(1022, 'review', 'build-t1022')],
    { 'build-t1022': 'a', 'review-t1022': 'b' })
  assert.deepEqual(starts, [])
})

test('a build entry is still skipped once the ticket has its conversation', () => {
  const { fresh, starts } = dispatchStarts([build], () => false, [tile(1022, 'building', 'build-t1022')], { 'build-t1022': 'a' })
  assert.deepEqual([fresh.length, starts], [1, []])
})

test('a fresh build entry starts the tile; kipo-build is the tile default', () => {
  const { starts } = dispatchStarts([{ ...build, skill: 'kipo-build' }], () => false, [tile(1022, 'afk')], {})
  assert.equal(starts.length, 1)
  assert.deepEqual(starts[0].kind === 'tile' && starts[0].skill, null)
})

test('a stage entry naming its own skill runs no extra skill', () => {
  const { starts } = dispatchStarts([{ stage: 'review', skill: 'kipo-review', at: 'x' }], () => false, [], {})
  assert.deepEqual(starts, [{ id: 'review/kipo-review@x', kind: 'stage', column: 'review', skill: null }])
})

test('a grill entry starts the effort grill conversation once', () => {
  const grill: DispatchEntry = { stage: 'grill', at: 'g' }
  assert.deepEqual(dispatchStarts([grill], () => false, [], {}).starts,
    [{ id: 'grill@g', kind: 'stage', column: 'grill', skill: null }])
  assert.deepEqual(dispatchStarts([grill], () => false, [], { grill: 'kipo-x-1054-grill' }).starts, [])
})

// A dead session (stuck, closed, never started) is replaced: the entry says
// which slot, the page closes it, then starts a fresh one. Never two at once.
const stuckReview: DispatchEntry = { stage: 'review', at: '2026-11-15T10:00:00Z', replace: 'kipo-x-201-review' }

test('a replacing entry starts the thread again, naming the slot to close', () => {
  const { starts } = dispatchStarts([stuckReview], () => false, [], { review: 'kipo-x-201-review' })
  assert.deepEqual(starts, [{ id: dispatchId(stuckReview), kind: 'stage', column: 'review', skill: null, replace: 'kipo-x-201-review' }])
})

test('a replacing entry whose slot was already replaced is skipped', () => {
  const { starts } = dispatchStarts([stuckReview], () => false, [], { review: 'kipo-x-201-review-r2' })
  assert.deepEqual(starts, [])
})

test('a replacing ticket review replaces only review-t<t>', () => {
  const e: DispatchEntry = { ticket: 1022, skill: 'kipo-review', at: 'y', replace: 'kipo-x-995-review-t1022' }
  const { starts } = dispatchStarts([e], () => false, [tile(1022, 'review', 'build-t1022')],
    { 'build-t1022': 'a', 'review-t1022': 'kipo-x-995-review-t1022' })
  assert.deepEqual(starts, [{ id: dispatchId(e), kind: 'review', t: 1022, replace: 'kipo-x-995-review-t1022' }])
})

test('a recorded session that never started is started again (#201 plan)', () => {
  const plan: DispatchEntry = { stage: 'plan', at: '2026-11-15T08:59:20Z' }
  const { starts } = dispatchStarts([plan], () => false, [], { plan: 'kipo-x-201-plan' }, { unstarted: ['plan'] })
  assert.deepEqual(starts, [{ id: dispatchId(plan), kind: 'stage', column: 'plan', skill: null, replace: 'kipo-x-201-plan' }])
})

test('a closed ticket gets its review while an open PR names it (#201 #208)', () => {
  const e: DispatchEntry = { ticket: 208, skill: 'kipo-review', at: 'z' }
  const done = [{ ...tile(208, 'done'), lane: 'decide', type: 'grilling' } as Tile]
  const open = { prs: [{ state: 'OPEN', tickets: [], refs: [208] }] }
  assert.deepEqual(dispatchStarts([e], () => false, done, {}, open).starts, [{ id: dispatchId(e), kind: 'review', t: 208 }])
  assert.deepEqual(dispatchStarts([e], () => false, done, {}).starts, [])
  assert.deepEqual(dispatchStarts([{ ticket: 208, at: 'w' }], () => false, done, {}, open).starts, [])
})
