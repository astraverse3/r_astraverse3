import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  suggestAllocation,
  computeLineStatus,
  computeOrderStatus,
  bundleDuplicateKey,
  orderDuplicateKey,
  detectDuplicateOrders,
  type AvailablePackage,
} from './purchase-order-allocation'

// ------------------------------------------------------
// FIFO 배분
// ------------------------------------------------------
const pkg = (packageId: number, available: number, sortKey: string): AvailablePackage => ({
  packageId,
  available,
  sortKey,
})

test('suggestAllocation: FIFO 순서로 충분히 배분', () => {
  const r = suggestAllocation(8, [
    pkg(2, 5, '2026-03-10'),
    pkg(1, 10, '2026-01-05'), // 가장 오래됨 → 먼저
  ])
  assert.deepEqual(r.allocations, [{ packageId: 1, count: 8 }])
  assert.equal(r.allocatedQty, 8)
  assert.equal(r.shortage, 0)
})

test('suggestAllocation: 첫 재고 소진 후 다음으로 넘어감', () => {
  const r = suggestAllocation(12, [
    pkg(1, 10, '2026-01-05'),
    pkg(2, 5, '2026-03-10'),
  ])
  assert.deepEqual(r.allocations, [
    { packageId: 1, count: 10 },
    { packageId: 2, count: 2 },
  ])
  assert.equal(r.allocatedQty, 12)
  assert.equal(r.shortage, 0)
})

test('suggestAllocation: 가용 부족 시 부분배분 + shortage', () => {
  const r = suggestAllocation(20, [pkg(1, 10, '2026-01-05'), pkg(2, 5, '2026-03-10')])
  assert.equal(r.allocatedQty, 15)
  assert.equal(r.shortage, 5)
})

test('suggestAllocation: available<=0 제외, 동일 날짜는 id 오름차순', () => {
  const r = suggestAllocation(3, [
    pkg(5, 0, '2026-01-01'), // 가용 0 → 제외
    pkg(4, 2, '2026-02-02'),
    pkg(3, 2, '2026-02-02'), // 동일 날짜 → id 작은 3 먼저
  ])
  assert.deepEqual(r.allocations, [
    { packageId: 3, count: 2 },
    { packageId: 4, count: 1 },
  ])
})

// ------------------------------------------------------
// 라인/건 status
// ------------------------------------------------------
test('computeLineStatus: 경계값', () => {
  assert.equal(computeLineStatus(10, 0), 'PENDING')
  assert.equal(computeLineStatus(10, 4), 'PARTIAL')
  assert.equal(computeLineStatus(10, 10), 'COMPLETED')
  assert.equal(computeLineStatus(10, 12), 'COMPLETED') // 초과도 완료
})

test('computeOrderStatus: 라인 집계 파생', () => {
  assert.equal(computeOrderStatus([]), 'PENDING')
  assert.equal(
    computeOrderStatus([
      { orderedQty: 10, allocatedQty: 10 },
      { orderedQty: 5, allocatedQty: 5 },
    ]),
    'COMPLETED',
  )
  assert.equal(
    computeOrderStatus([
      { orderedQty: 10, allocatedQty: 10 },
      { orderedQty: 5, allocatedQty: 0 }, // 한 라인 미차감 → PARTIAL
    ]),
    'PARTIAL',
  )
  assert.equal(
    computeOrderStatus([
      { orderedQty: 10, allocatedQty: 3 }, // 부분만 있어도 PARTIAL
    ]),
    'PARTIAL',
  )
  assert.equal(
    computeOrderStatus([
      { orderedQty: 10, allocatedQty: 0 },
      { orderedQty: 5, allocatedQty: 0 },
    ]),
    'PENDING',
  )
})

// ------------------------------------------------------
// 중복 감지
// ------------------------------------------------------
test('bundleDuplicateKey: 파일명+시트명+발주일(날짜까지)로 묶음을 식별', () => {
  assert.equal(
    bundleDuplicateKey('발주서.xlsx', '택배_260818', '2026-08-18T00:00:00Z'),
    '발주서.xlsx|택배_260818|2026-08-18',
  )
  // 발주일을 못 뽑은 시트는 빈 문자열 — 같은 파일에서 시트명이 다르면 별개 묶음
  assert.notEqual(
    bundleDuplicateKey('발주서.xlsx', '택배_260818', null),
    bundleDuplicateKey('발주서.xlsx', '이마트_260818', null),
  )
  // 같은 시트명이라도 파일이 다르면 별개 묶음
  assert.notEqual(
    bundleDuplicateKey('8월.xlsx', '택배_260818', '2026-08-18'),
    bundleDuplicateKey('9월.xlsx', '택배_260818', '2026-08-18'),
  )
})

test('orderDuplicateKey: 발주일 날짜까지만 비교', () => {
  assert.equal(
    orderDuplicateKey('2026-05-22T09:30:00Z', '하나로', '홍길동'),
    '2026-05-22|하나로|홍길동',
  )
  assert.equal(orderDuplicateKey(null, '하나로', '홍길동'), '|하나로|홍길동')
})

test('detectDuplicateOrders: 기존 키집합과 겹치는 건만 반환', () => {
  const existing = new Set([
    orderDuplicateKey('2026-05-22', '하나로', '홍길동'),
  ])
  const incoming = [
    { orderDate: '2026-05-22', vendor: '하나로', recipient: '홍길동' }, // 중복
    { orderDate: '2026-05-22', vendor: '이마트', recipient: '여주' }, // 신규
  ]
  const dups = detectDuplicateOrders(incoming, existing)
  assert.equal(dups.length, 1)
  assert.equal(dups[0].vendor, '하나로')
})
