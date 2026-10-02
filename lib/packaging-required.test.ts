import { test } from 'node:test'
import assert from 'node:assert/strict'
import { duplicatePackagingLines, duplicatePackagingMessage, linesMissingPackaging, missingPackagingMessage, needsPackagingPick } from './packaging-required'

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

// ------------------------------------------------------
// 백로그 §98 — 같은 규격도 포장지가 다르면 다른 줄이다.
// 포장지까지 같은 두 줄은 새 줄이 섞였을 때만 막는다
// ------------------------------------------------------
test('duplicatePackagingLines: 새 줄이 기존 줄과 재고·규격·포장지가 같으면 걸린다', () => {
  const lines = [
    { id: 1, stockId: 7, packageType: '10kg', packagingId: 3 },
    { stockId: 7, packageType: '10kg', packagingId: 3 },
  ]
  assert.equal(duplicatePackagingLines(lines).length, 2)
})

test('duplicatePackagingLines: 포장지가 다르면 같은 규격이어도 통과', () => {
  const lines = [
    { id: 1, stockId: 7, packageType: '10kg', packagingId: 3 },
    { stockId: 7, packageType: '10kg', packagingId: 4 },
  ]
  assert.equal(duplicatePackagingLines(lines).length, 0)
})

test('duplicatePackagingLines: 재고가 다르면 겹침이 아니다', () => {
  const lines = [
    { stockId: 7, packageType: '10kg', packagingId: 3 },
    { stockId: 8, packageType: '10kg', packagingId: 3 },
  ]
  assert.equal(duplicatePackagingLines(lines).length, 0)
})

test('duplicatePackagingLines: 이미 저장된 줄끼리 겹친 건 막지 않는다', () => {
  // 둘 다 차감이 붙어 있으면 합칠 방법이 없다 — 막으면 저장이 영영 막힌다
  const lines = [
    { id: 1, stockId: 7, packageType: '10kg', packagingId: 3 },
    { id: 2, stockId: 7, packageType: '10kg', packagingId: 3 },
  ]
  assert.equal(duplicatePackagingLines(lines).length, 0)
})

test('duplicatePackagingLines: 톤백·잔량은 여러 줄이 정상이다', () => {
  const lines = [
    { stockId: 7, packageType: '톤백', packagingId: 9 },
    { stockId: 7, packageType: '톤백', packagingId: 9 },
    { stockId: 7, packageType: '잔량', packagingId: null },
    { stockId: 7, packageType: '잔량', packagingId: null },
  ]
  assert.equal(duplicatePackagingLines(lines).length, 0)
})

test('duplicatePackagingLines: 포장지 없는 줄끼리는 겹침이 아니다(포장지 없음 검사가 따로 잡는다)', () => {
  const lines = [
    { stockId: 7, packageType: '10kg', packagingId: null },
    { stockId: 7, packageType: '10kg', packagingId: null },
  ]
  assert.equal(duplicatePackagingLines(lines).length, 0)
})

test('duplicatePackagingMessage: 규격은 한 번씩', () => {
  const lines = [
    { stockId: 7, packageType: '10kg', packagingId: 3 },
    { stockId: 7, packageType: '10kg', packagingId: 3 },
    { stockId: 7, packageType: '5kg', packagingId: 3 },
    { id: 4, stockId: 7, packageType: '5kg', packagingId: 3 },
  ]
  assert.equal(
    duplicatePackagingMessage(duplicatePackagingLines(lines)),
    '10kg, 5kg 줄 중에 포장지까지 같은 줄이 있어요. 한 줄로 합쳐 주세요.',
  )
})
