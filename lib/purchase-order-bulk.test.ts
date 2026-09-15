import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requiredKgOf, bulkDelta, fitsUnit, suggestBulkWhole, BULK_FIT_KG } from './purchase-order-bulk'

test('requiredKgOf: 자루 수 × 요구 자루중량, 톤백 아니면 0', () => {
  assert.equal(requiredKgOf({ orderedQty: 3, unitWeightKg: 1000 }), 3000)
  assert.equal(requiredKgOf({ orderedQty: 2, unitWeightKg: 200 }), 400)
  assert.equal(requiredKgOf({ orderedQty: 5, unitWeightKg: null }), 0)
})

test('bulkDelta: 0 이상 tolerance 이하면 exact, 넘으면 over, 모자라면 under', () => {
  assert.equal(bulkDelta(1000, 1005, 10).level, 'exact')
  assert.equal(bulkDelta(1000, 1010, 10).level, 'exact')
  assert.equal(bulkDelta(1000, 1011, 10).level, 'over')
  assert.equal(bulkDelta(1000, 999, 10).level, 'under')
  assert.equal(bulkDelta(1000, 1000).level, 'exact')
  assert.equal(bulkDelta(1000, 1001).level, 'over')
})

test('bulkDelta: 요구 0이면 비율 null, 실제 0이면 exact', () => {
  assert.deepEqual(bulkDelta(0, 0), { deltaKg: 0, deltaPct: null, level: 'exact' })
  assert.equal(bulkDelta(0, 5).level, 'over')
})

test('bulkDelta: 소수 첫째 자리로 반올림', () => {
  const d = bulkDelta(1000, 1005.26)
  assert.equal(d.deltaKg, 5.3)
  assert.equal(d.deltaPct, 0.0053)
})

// ------------------------------------------------------
// 맞는 자루 판정 · 추천 (결정 M)
// ------------------------------------------------------
const bag = (packageId: number, weightPerUnit: number, available = 1) => ({ packageId, weightPerUnit, available })

test('fitsUnit: 발주 자루중량 이상 +10kg 이하 — 1,000이면 1,000~1,010, 200이면 200~210', () => {
  assert.equal(BULK_FIT_KG, 10)
  assert.equal(fitsUnit(1000, 1000), true)
  assert.equal(fitsUnit(1005, 1000), true)
  assert.equal(fitsUnit(1010, 1000), true)
  assert.equal(fitsUnit(999, 1000), false)
  assert.equal(fitsUnit(1011, 1000), false)
  assert.equal(fitsUnit(1014, 1000), false)
  assert.equal(fitsUnit(203, 200), true)
  assert.equal(fitsUnit(210, 200), true)
  assert.equal(fitsUnit(211, 200), false)
})

test('suggestBulkWhole: 실데이터 pt18 1,000×1 — 587·332·450·1014는 건너뛰고 1,005만', () => {
  const r = suggestBulkWhole(1000, 1, [bag(870, 587), bag(871, 332), bag(1017, 450), bag(1089, 1014), bag(1131, 1005)])
  assert.deepEqual(r.whole, [{ packageId: 1131, count: 1 }])
  assert.equal(r.totalKg, 1005)
  assert.equal(r.shortUnits, 0)
})

test('suggestBulkWhole: 사용자 예시 1,000×3에 1003·1005·890·350 → 둘만 통째, 1자루 부족', () => {
  const r = suggestBulkWhole(1000, 3, [bag(1, 1003), bag(2, 1005), bag(3, 890), bag(4, 350)])
  assert.deepEqual(r.whole, [
    { packageId: 1, count: 1 },
    { packageId: 2, count: 1 },
  ])
  assert.equal(r.totalKg, 2008)
  assert.equal(r.shortUnits, 1)
})

test('suggestBulkWhole: 맞는 자루가 하나도 없으면 아무것도 안 고르고 전부 부족', () => {
  const r = suggestBulkWhole(1000, 1, [bag(1, 587), bag(2, 450), bag(3, 1014)])
  assert.deepEqual(r.whole, [])
  assert.equal(r.shortUnits, 1)
})

test('suggestBulkWhole: 오래된 순 — 맞는 자루가 여럿이면 앞의 것부터', () => {
  const r = suggestBulkWhole(1000, 1, [bag(1, 1008), bag(2, 1002)])
  assert.deepEqual(r.whole, [{ packageId: 1, count: 1 }])
})

test('suggestBulkWhole: count>1 행 — 발주 2자루에 1,005×3이면 2개만', () => {
  const r = suggestBulkWhole(1000, 2, [bag(1, 1005, 3)])
  assert.deepEqual(r.whole, [{ packageId: 1, count: 2 }])
  assert.equal(r.totalKg, 2010)
  assert.equal(r.shortUnits, 0)
})

test('suggestBulkWhole: 발주 0이면 아무것도 안 고른다', () => {
  const r = suggestBulkWhole(1000, 0, [bag(1, 1005)])
  assert.deepEqual(r.whole, [])
  assert.equal(r.shortUnits, 0)
})

test('suggestBulkWhole: 가용 0 행은 건너뛴다', () => {
  const r = suggestBulkWhole(1000, 1, [bag(1, 1005, 0), bag(2, 1003)])
  assert.deepEqual(r.whole, [{ packageId: 2, count: 1 }])
})
