import { test } from 'node:test'
import assert from 'node:assert/strict'
import { linesMissingPackaging, missingPackagingMessage, needsPackagingPick } from './packaging-required'

// ------------------------------------------------------
// 백로그 §54 — 일반 규격은 포장지가 있어야 SKU가 붙는다
// ------------------------------------------------------
test('needsPackagingPick: 일반 규격인데 포장지가 없으면 걸린다', () => {
  assert.equal(needsPackagingPick({ packageType: '10kg', packagingId: null }), true)
  assert.equal(needsPackagingPick({ packageType: '907g' }), true)
})

test('needsPackagingPick: 포장지가 있으면 통과', () => {
  assert.equal(needsPackagingPick({ packageType: '10kg', packagingId: 3 }), false)
})

test('needsPackagingPick: 톤백·잔량은 포장지를 고르지 않는다', () => {
  assert.equal(needsPackagingPick({ packageType: '톤백', packagingId: null }), false)
  assert.equal(needsPackagingPick({ packageType: '잔량', packagingId: null }), false)
})

test('linesMissingPackaging · missingPackagingMessage: 걸린 줄만, 규격은 한 번씩', () => {
  const lines = [
    { packageType: '10kg', packagingId: null },
    { packageType: '10kg', packagingId: null },
    { packageType: '5kg', packagingId: 2 },
    { packageType: '잔량', packagingId: null },
    { packageType: '4kg', packagingId: null },
  ]
  const missing = linesMissingPackaging(lines)
  assert.equal(missing.length, 3)
  assert.equal(missingPackagingMessage(missing), '10kg, 4kg 줄의 포장지를 골라 주세요.')
})
