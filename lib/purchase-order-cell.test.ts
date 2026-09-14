import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitAllocationsByLine, cellRemainingQty, type CellLine } from './purchase-order-cell'

const line = (itemId: number, orderedQty: number, allocatedQty = 0): CellLine => ({
  itemId,
  orderedQty,
  allocatedQty,
})

test('splitAllocationsByLine: 라인 1개면 그대로 통과', () => {
  const r = splitAllocationsByLine([line(10, 12)], [
    { packageId: 1, count: 8 },
    { packageId: 2, count: 4 },
  ])
  assert.deepEqual(r, [
    { itemId: 10, allocations: [{ packageId: 1, count: 8 }, { packageId: 2, count: 4 }] },
  ])
})

test('splitAllocationsByLine: 라인 2개 — id 오름차순으로 채운다 (입력 순서 무관)', () => {
  const r = splitAllocationsByLine(
    [line(20, 5), line(10, 3)],
    [{ packageId: 1, count: 3 }, { packageId: 2, count: 5 }],
  )
  assert.deepEqual(r, [
    { itemId: 10, allocations: [{ packageId: 1, count: 3 }] },
    { itemId: 20, allocations: [{ packageId: 2, count: 5 }] },
  ])
})

test('splitAllocationsByLine: 배분 1건이 라인 경계에 걸치면 쪼갠다', () => {
  const r = splitAllocationsByLine([line(10, 3), line(20, 5)], [{ packageId: 7, count: 8 }])
  assert.deepEqual(r, [
    { itemId: 10, allocations: [{ packageId: 7, count: 3 }] },
    { itemId: 20, allocations: [{ packageId: 7, count: 5 }] },
  ])
})

test('splitAllocationsByLine: 부분차감 후 재차감 — 남은 수량만 채운다', () => {
  // 라인 10은 이미 3/3 완료, 라인 20은 2/5 → 남은 3
  const r = splitAllocationsByLine(
    [line(10, 3, 3), line(20, 5, 2)],
    [{ packageId: 1, count: 3 }],
  )
  assert.deepEqual(r, [{ itemId: 20, allocations: [{ packageId: 1, count: 3 }] }])
})

test('splitAllocationsByLine: 배분이 남은 수량보다 적으면 뒤 라인은 비워 둔다', () => {
  const r = splitAllocationsByLine([line(10, 3), line(20, 5)], [{ packageId: 1, count: 2 }])
  assert.deepEqual(r, [{ itemId: 10, allocations: [{ packageId: 1, count: 2 }] }])
})

test('splitAllocationsByLine: 남은 수량 초과는 던진다', () => {
  assert.throws(
    () => splitAllocationsByLine([line(10, 3), line(20, 5)], [{ packageId: 1, count: 9 }]),
    /초과/,
  )
})

test('splitAllocationsByLine: 음수·소수 개수는 던진다', () => {
  assert.throws(() => splitAllocationsByLine([line(10, 3)], [{ packageId: 1, count: -1 }]), /올바르지/)
  assert.throws(() => splitAllocationsByLine([line(10, 3)], [{ packageId: 1, count: 1.5 }]), /올바르지/)
})

test('splitAllocationsByLine: 빈 배분·0개 배분은 빈 결과', () => {
  assert.deepEqual(splitAllocationsByLine([line(10, 3)], []), [])
  assert.deepEqual(splitAllocationsByLine([line(10, 3)], [{ packageId: 1, count: 0 }]), [])
})

test('cellRemainingQty: 과차감 라인은 0으로 친다', () => {
  assert.equal(cellRemainingQty([line(10, 3, 5), line(20, 5, 2)]), 3)
})
