import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requiredKgOf, bulkDelta, suggestBulkAllocation } from './purchase-order-bulk'

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

// ------------------------------------------------------
// kg FIFO 추천 — 입력은 FIFO 순
// ------------------------------------------------------
const bag = (packageId: number, weightPerUnit: number, available = 1) => ({ packageId, weightPerUnit, available })

test('suggestBulkAllocation: 오래된 자루부터 통째로 담고, 넘기는 자루 하나만 쪼갠다 (실데이터 pt18)', () => {
  // 587(7/15) · 332(7/15) · 450(7/23) · 1014(8/3) · 1005(8/10) …
  const r = suggestBulkAllocation(1000, [bag(870, 587), bag(871, 332), bag(1017, 450), bag(1089, 1014), bag(1131, 1005)])
  assert.deepEqual(r.whole, [
    { packageId: 870, count: 1 },
    { packageId: 871, count: 1 },
  ])
  assert.deepEqual(r.split, { packageId: 1017, kg: 81 })
  assert.equal(r.totalKg, 1000)
  assert.equal(r.shortageKg, 0)
})

test('suggestBulkAllocation: 딱 맞아떨어지면 split 없음', () => {
  const r = suggestBulkAllocation(1000, [bag(1, 400), bag(2, 600), bag(3, 900)])
  assert.deepEqual(r.whole, [
    { packageId: 1, count: 1 },
    { packageId: 2, count: 1 },
  ])
  assert.equal(r.split, null)
  assert.equal(r.totalKg, 1000)
})

test('suggestBulkAllocation: 첫 자루가 요구량보다 크면 그 자루를 바로 쪼갠다', () => {
  const r = suggestBulkAllocation(200, [bag(1, 1014), bag(2, 203)])
  assert.deepEqual(r.whole, [])
  assert.deepEqual(r.split, { packageId: 1, kg: 200 })
})

test('suggestBulkAllocation: count>1 행은 맞는 만큼 통째, 나머지 한 자루를 쪼갠다', () => {
  // 1,005kg × 4자루 행에서 2,500kg → 통째 2자루(2,010) + 490 쪼개기
  const r = suggestBulkAllocation(2500, [bag(1277, 1005, 4)])
  assert.deepEqual(r.whole, [{ packageId: 1277, count: 2 }])
  assert.deepEqual(r.split, { packageId: 1277, kg: 490 })
  assert.equal(r.totalKg, 2500)
})

test('suggestBulkAllocation: 재고가 모자라면 shortageKg, split 없음', () => {
  const r = suggestBulkAllocation(1000, [bag(1, 300), bag(2, 200)])
  assert.deepEqual(r.whole, [
    { packageId: 1, count: 1 },
    { packageId: 2, count: 1 },
  ])
  assert.equal(r.split, null)
  assert.equal(r.totalKg, 500)
  assert.equal(r.shortageKg, 500)
})

test('suggestBulkAllocation: 요구 0이면 아무것도 안 담는다', () => {
  const r = suggestBulkAllocation(0, [bag(1, 300)])
  assert.deepEqual(r, { whole: [], split: null, totalKg: 0, shortageKg: 0 })
})

test('suggestBulkAllocation: 가용 0 행은 건너뛴다', () => {
  const r = suggestBulkAllocation(300, [bag(1, 300, 0), bag(2, 300)])
  assert.deepEqual(r.whole, [{ packageId: 2, count: 1 }])
})
