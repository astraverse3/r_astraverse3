import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planRematch, type RematchLine } from './purchase-order-rematch'

const line = (
  id: number,
  productTypeId: number | null,
  matchedTo: number | null,
  deducted = false,
): RematchLine => ({ id, productTypeId, matchedTo, deducted })

test('planRematch: 매칭실패 → 붙음 (예전 재매칭과 같은 경우)', () => {
  const p = planRematch([line(1, null, 7)])
  assert.deepEqual([...p.writes], [[7, [1]]])
  assert.equal(p.newlyMatched, 1)
  assert.equal(p.moved, 0)
})

test('planRematch: 이미 붙은 줄이 다른 SKU로 — 기본 포장지를 고친 경우(2026-10-01)', () => {
  const p = planRematch([line(1, 5, 9), line(2, 5, 9)])
  assert.deepEqual([...p.writes], [[9, [1, 2]]])
  assert.equal(p.moved, 2)
  assert.equal(p.newlyMatched, 0)
})

test('planRematch: 같은 SKU면 쓰지 않는다', () => {
  const p = planRematch([line(1, 5, 5)])
  assert.equal(p.writes.size, 0)
  assert.equal(p.moved, 0)
})

test('planRematch: 차감된 줄은 옮기지 않고, 옮겨 갈 뻔한 것만 센다', () => {
  const p = planRematch([line(1, 5, 9, true), line(2, 5, 5, true), line(3, 5, null, true)])
  assert.equal(p.writes.size, 0)
  // 1만 「차감만 없었으면 옮겨 갔을 줄」. 2는 그대로가 맞고, 3은 비교할 결과가 없다
  assert.equal(p.blockedByDeduction, 1)
  assert.equal(p.needsReview, 0)
})

test('planRematch: 붙어 있던 줄이 지금 실패하면 풀지 않고 확인 필요로 센다', () => {
  const p = planRematch([line(1, 5, null)])
  assert.equal(p.writes.size, 0)
  assert.equal(p.needsReview, 1)
  assert.equal(p.stillUnmatched, 0)
})

test('planRematch: 실패 → 실패는 그대로 남은 실패', () => {
  const p = planRematch([line(1, null, null)])
  assert.equal(p.stillUnmatched, 1)
  assert.equal(p.needsReview, 0)
})

test('planRematch: 섞인 묶음 — 목표 SKU별로 모은다', () => {
  const p = planRematch([
    line(1, null, 7),
    line(2, 5, 9),
    line(3, 5, 7),
    line(4, 5, 5),
    line(5, 5, 9, true),
    line(6, null, null),
  ])
  assert.deepEqual(
    [...p.writes].sort((a, b) => a[0] - b[0]),
    [
      [7, [1, 3]],
      [9, [2]],
    ],
  )
  assert.deepEqual(
    { n: p.newlyMatched, m: p.moved, d: p.blockedByDeduction, r: p.needsReview, u: p.stillUnmatched },
    { n: 1, m: 2, d: 1, r: 0, u: 1 },
  )
})
