import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  planBatchAllocations,
  fingerprintBatchPlan,
  type BatchLine,
} from './purchase-order-batch'
import type { AvailablePackage } from './purchase-order-allocation'

const line = (
  itemId: number,
  orderId: number,
  productTypeId: number | null,
  orderedQty: number,
  allocatedQty = 0,
  unitWeightKg: number | null = null,
): BatchLine => ({ itemId, orderId, productTypeId, orderedQty, allocatedQty, unitWeightKg })

/** 가용 패키지. sortKey는 날짜 문자열 — 작을수록 오래된 것(FIFO 앞) */
const pkg = (packageId: number, available: number, sortKey: string): AvailablePackage => ({
  packageId,
  available,
  sortKey,
})

// ------------------------------------------------------
// 🔴 핵심 — 같은 SKU를 쓰는 라인들이 재고를 나눠 갖는가
// ------------------------------------------------------

test('같은 SKU 2라인: 앞 라인이 쓴 만큼 뒤 라인의 가용이 줄어든다', () => {
  const plan = planBatchAllocations(
    [line(1, 100, 7, 6), line(2, 200, 7, 6)],
    { 7: [pkg(50, 10, '2026-01-01')] },
  )

  assert.deepEqual(plan.lines, [
    {
      itemId: 1,
      orderId: 100,
      productTypeId: 7,
      need: 6,
      allocations: [{ packageId: 50, count: 6 }],
      shortage: 0,
    },
    {
      itemId: 2,
      orderId: 200,
      productTypeId: 7,
      need: 6,
      // 남은 4개만 — 독립 계산이었다면 여기도 6개가 나와 총 12개를 차감하려 들었다
      allocations: [{ packageId: 50, count: 4 }],
      shortage: 2,
    },
  ])
  assert.equal(plan.totals.units, 10)
  assert.equal(plan.totals.full, 1)
  assert.equal(plan.totals.partial, 1)
  assert.equal(plan.totals.none, 0)
  assert.deepEqual(plan.shortages, [
    { itemId: 2, orderId: 200, productTypeId: 7, need: 6, allocated: 4, shortage: 2 },
  ])
})

test('같은 SKU 3라인: 재고를 다 쓰면 뒤 라인은 한 개도 못 받는다(쓸 게 없어 lines에 안 들어감)', () => {
  const plan = planBatchAllocations(
    [line(1, 100, 7, 5), line(2, 200, 7, 5), line(3, 300, 7, 5)],
    { 7: [pkg(50, 10, '2026-01-01')] },
  )

  assert.equal(plan.lines.length, 2)
  assert.equal(plan.totals.units, 10)
  // 🔴 「부분」이 아니다 — 한 개도 못 받으므로 이번 차감에서 아무 일도 일어나지 않는다
  assert.equal(plan.totals.partial, 0)
  assert.equal(plan.totals.none, 1)
  // 한 개도 못 받은 라인도 부족 목록에는 남는다 — 게이트가 사유를 보여줘야 한다
  assert.deepEqual(plan.shortages, [
    { itemId: 3, orderId: 300, productTypeId: 7, need: 5, allocated: 0, shortage: 5 },
  ])
})

test('다른 SKU끼리는 서로의 재고에 영향이 없다', () => {
  const plan = planBatchAllocations(
    [line(1, 100, 7, 4), line(2, 100, 8, 4)],
    { 7: [pkg(50, 4, '2026-01-01')], 8: [pkg(60, 4, '2026-01-01')] },
  )

  assert.equal(plan.totals.full, 2)
  assert.equal(plan.totals.partial, 0)
  assert.equal(plan.totals.units, 8)
  assert.equal(plan.totals.lots, 2)
})

test('입력 pools를 변경하지 않는다', () => {
  const pools = { 7: [pkg(50, 10, '2026-01-01')] }
  planBatchAllocations([line(1, 100, 7, 6)], pools)
  assert.equal(pools[7][0].available, 10)
})

// ------------------------------------------------------
// FIFO 순서 · 라인 순서
// ------------------------------------------------------

test('FIFO: 오래된 재고부터 쓰고, 모자라면 다음 로트로 넘어간다', () => {
  const plan = planBatchAllocations([line(1, 100, 7, 7)], {
    7: [pkg(60, 5, '2026-03-01'), pkg(50, 4, '2026-01-01')],
  })
  assert.deepEqual(plan.lines[0].allocations, [
    { packageId: 50, count: 4 },
    { packageId: 60, count: 3 },
  ])
  assert.equal(plan.totals.lots, 2)
})

test('라인 순서는 itemId 오름차순 고정 — 입력 순서와 무관하다', () => {
  const plan = planBatchAllocations(
    [line(9, 100, 7, 6), line(2, 200, 7, 6)],
    { 7: [pkg(50, 10, '2026-01-01')] },
  )
  // 재고가 모자라므로 「누가 먼저 가져가는가」가 결과를 가른다 — 작은 id가 먼저
  assert.equal(plan.lines[0].itemId, 2)
  assert.equal(plan.lines[0].allocations[0].count, 6)
  assert.equal(plan.lines[1].itemId, 9)
  assert.equal(plan.lines[1].allocations[0].count, 4)
})

// ------------------------------------------------------
// 제외 3종 (결정 D)
// ------------------------------------------------------

test('제외: 매칭실패 · 톤백 · 이미 전량 차감', () => {
  const plan = planBatchAllocations(
    [
      line(1, 100, null, 5), // 매칭실패
      line(2, 100, 7, 5, 0, 1000), // 톤백
      line(3, 100, 7, 5, 5), // 이미 전량 차감
      line(4, 100, 7, 5), // 정상
    ],
    { 7: [pkg(50, 10, '2026-01-01')] },
  )

  assert.deepEqual(plan.skipped, [
    { itemId: 1, orderId: 100, reason: 'UNMATCHED' },
    { itemId: 2, orderId: 100, reason: 'BULK' },
    { itemId: 3, orderId: 100, reason: 'DONE' },
  ])
  assert.equal(plan.totals.unmatched, 1)
  assert.equal(plan.totals.bulk, 1)
  assert.equal(plan.totals.done, 1)
  assert.equal(plan.lines.length, 1)
  assert.equal(plan.lines[0].itemId, 4)
})

test('부분차감된 라인은 남은 수량만 채운다', () => {
  const plan = planBatchAllocations([line(1, 100, 7, 10, 4)], {
    7: [pkg(50, 10, '2026-01-01')],
  })
  assert.equal(plan.lines[0].need, 6)
  assert.equal(plan.lines[0].allocations[0].count, 6)
})

test('과차감된 라인(allocated > ordered)도 DONE으로 빠진다', () => {
  const plan = planBatchAllocations([line(1, 100, 7, 5, 7)], {
    7: [pkg(50, 10, '2026-01-01')],
  })
  assert.deepEqual(plan.skipped, [{ itemId: 1, orderId: 100, reason: 'DONE' }])
  assert.equal(plan.lines.length, 0)
})

// ------------------------------------------------------
// 합계
// ------------------------------------------------------

test('kg은 SKU별 단중으로 계산하고, 로트 수는 중복을 뺀다', () => {
  const plan = planBatchAllocations(
    [line(1, 100, 7, 6), line(2, 200, 7, 4), line(3, 300, 8, 2)],
    { 7: [pkg(50, 10, '2026-01-01')], 8: [pkg(60, 5, '2026-01-01')] },
    { 7: 10, 8: 5 },
  )
  assert.equal(plan.totals.units, 12)
  assert.equal(plan.totals.kg, 110) // (6+4)×10 + 2×5
  assert.equal(plan.totals.lots, 2) // 라인은 3개지만 로트는 50·60 둘
})

test('단중을 모르는 SKU는 kg에 0으로 들어간다(개수는 그대로 센다)', () => {
  const plan = planBatchAllocations([line(1, 100, 7, 3)], {
    7: [pkg(50, 5, '2026-01-01')],
  })
  assert.equal(plan.totals.units, 3)
  assert.equal(plan.totals.kg, 0)
})

test('재고가 아예 없는 SKU — 「부분」이 아니라 「차감 없음」으로 잡힌다', () => {
  const plan = planBatchAllocations([line(1, 100, 7, 5)], {})
  assert.deepEqual(plan.lines, [])
  assert.equal(plan.totals.partial, 0)
  assert.equal(plan.totals.none, 1)
  assert.equal(plan.shortages[0].allocated, 0)
})

test('빈 입력', () => {
  const plan = planBatchAllocations([], {})
  assert.deepEqual(plan.lines, [])
  assert.deepEqual(plan.skipped, [])
  assert.deepEqual(plan.shortages, [])
  assert.equal(plan.totals.units, 0)
  assert.equal(plan.totals.kg, 0)
  assert.equal(plan.totals.lots, 0)
})

// ------------------------------------------------------
// 지문 (결정 G)
// ------------------------------------------------------

test('fingerprint: 같은 계획이면 같다', () => {
  const pools = { 7: [pkg(50, 10, '2026-01-01')] }
  const a = planBatchAllocations([line(1, 100, 7, 6)], pools)
  const b = planBatchAllocations([line(1, 100, 7, 6)], pools)
  assert.equal(fingerprintBatchPlan(a), fingerprintBatchPlan(b))
})

test('fingerprint: 총량이 같아도 로트가 바뀌면 다르다', () => {
  const a = planBatchAllocations([line(1, 100, 7, 4)], {
    7: [pkg(50, 4, '2026-01-01')],
  })
  const b = planBatchAllocations([line(1, 100, 7, 4)], {
    7: [pkg(60, 4, '2026-01-01')],
  })
  assert.equal(a.totals.units, b.totals.units)
  assert.notEqual(fingerprintBatchPlan(a), fingerprintBatchPlan(b))
})

test('fingerprint: 수량이 줄면 다르다 (다른 사람이 먼저 가져간 경우)', () => {
  const before = planBatchAllocations([line(1, 100, 7, 6)], {
    7: [pkg(50, 10, '2026-01-01')],
  })
  const after = planBatchAllocations([line(1, 100, 7, 6)], {
    7: [pkg(50, 2, '2026-01-01')],
  })
  assert.notEqual(fingerprintBatchPlan(before), fingerprintBatchPlan(after))
})
