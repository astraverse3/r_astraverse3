import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requiredKgOf, bulkDelta, sortBulkCandidates } from './purchase-order-bulk'

test('requiredKgOf: 자루 수 × 요구 자루중량, 톤백 아니면 0', () => {
  assert.equal(requiredKgOf({ orderedQty: 1, unitWeightKg: 1000 }), 1000)
  assert.equal(requiredKgOf({ orderedQty: 3, unitWeightKg: 200 }), 600)
  assert.equal(requiredKgOf({ orderedQty: 5, unitWeightKg: null }), 0)
})

test('bulkDelta: 1% 안이면 exact', () => {
  const d = bulkDelta(1000, 1005)
  assert.equal(d.deltaKg, 5)
  assert.equal(d.level, 'exact')
  assert.equal(bulkDelta(1000, 1010).level, 'exact') // 정확히 1%도 안
  assert.equal(bulkDelta(1000, 990).level, 'exact')
})

test('bulkDelta: 1% 넘으면 over / under', () => {
  assert.equal(bulkDelta(1000, 1014).level, 'over')
  assert.equal(bulkDelta(1000, 985).level, 'under')
  assert.equal(bulkDelta(1000, 1037).deltaPct, 0.037)
})

test('bulkDelta: 요구 0이면 비율 null, 실제 0이면 exact', () => {
  assert.deepEqual(bulkDelta(0, 0), { deltaKg: 0, deltaPct: null, level: 'exact' })
  assert.equal(bulkDelta(0, 203).level, 'over')
})

test('bulkDelta: 소수 첫째 자리로 반올림', () => {
  assert.equal(bulkDelta(1000, 1004.26).deltaKg, 4.3)
})

const row = (packageId: number, weightPerUnit: number, sortKey: string) => ({ packageId, weightPerUnit, sortKey })

test('sortBulkCandidates: 요구 중량 근접순', () => {
  const r = sortBulkCandidates(1000, [
    row(1, 203, '2026-08-10'),
    row(2, 1014, '2026-08-03'),
    row(3, 1005, '2026-08-10'),
    row(4, 887, '2026-08-27'),
  ])
  assert.deepEqual(
    r.map((x) => x.packageId),
    [3, 2, 4, 1],
  )
})

test('sortBulkCandidates: 차이가 같으면 오래된 순, 그다음 id', () => {
  const r = sortBulkCandidates(1000, [
    row(9, 1010, '2026-08-10'),
    row(2, 990, '2026-08-10'),
    row(5, 1010, '2026-07-01'),
  ])
  assert.deepEqual(
    r.map((x) => x.packageId),
    [5, 2, 9],
  )
})

test('sortBulkCandidates: 원본 배열을 건드리지 않는다', () => {
  const src = [row(1, 500, '2026-01-01'), row(2, 1000, '2026-01-01')]
  sortBulkCandidates(1000, src)
  assert.deepEqual(
    src.map((x) => x.packageId),
    [1, 2],
  )
})
