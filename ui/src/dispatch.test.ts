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
