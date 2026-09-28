import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildGateGroups, gateRowOf, gateStateOf, pickableIds, type GateOrder } from './purchase-order-gate'
import type { OrderLine } from './purchase-order-matrix'

// ------------------------------------------------------
// 만들기 도우미
// ------------------------------------------------------
const line = (o: Partial<OrderLine> & { itemId: number }): OrderLine => ({
  title: '천지향 · 백미',
  packageType: '4kg',
  packagingName: null,
  orderedQty: 6,
  allocatedQty: 0,
  remainingQty: 6,
  availableQty: 100,
  shortage: 0,
  status: 'PENDING',
  productTypeId: 1,
  unitWeightKg: 4,
  bulk: false,
  ...o,
})

const order = (orderId: number, lines: OrderLine[], group: string | null = '땅끝'): GateOrder => ({
  orderId,
  group,
  name: `수령인${orderId}`,
  lines,
})

// ------------------------------------------------------
// gateRowOf
// ------------------------------------------------------
test('gateRowOf: 일괄 대상 한 품목 — 품목·규격·남은 개수', () => {
  const r = gateRowOf(order(1, [line({ itemId: 1 })]))
  assert.equal(r.summary, '천지향 · 백미 4kg 6개')
  assert.equal(r.batchLines, 1)
  assert.equal(r.skip, null)
})

test('gateRowOf: 여러 품목이면 첫 품목 + 외 n품목, 일괄 대상만 센다', () => {
  const r = gateRowOf(
    order(1, [
      line({ itemId: 1 }),
      line({ itemId: 2, title: '새청무 · 백미', packageType: '10kg', unitWeightKg: 10, remainingQty: 2 }),
      // 톤백·완료·매칭실패는 요약과 kg에서 빠진다
      line({ itemId: 3, bulk: true, unitWeightKg: 500, remainingQty: 1 }),
      line({ itemId: 4, status: 'COMPLETED', remainingQty: 0, allocatedQty: 6 }),
      line({ itemId: 5, status: 'UNMATCHED', productTypeId: null, availableQty: null }),
    ]),
  )
  assert.equal(r.summary, '천지향 · 백미 4kg 6개 외 1품목')
  assert.equal(r.batchLines, 2)
  assert.equal(r.skip, null)
})

test('gateRowOf: 단위 없는 규격은 원본 그대로 적는다', () => {
  const r = gateRowOf(order(1, [line({ itemId: 1, packageType: '500', unitWeightKg: null })]))
  assert.equal(r.summary, '천지향 · 백미 500 6개')
})

// ------------------------------------------------------
// gateStateOf — 행은 kg이 아니라 상태만 말한다
// ------------------------------------------------------
test('gateStateOf: 부족이 없으면 full', () => {
  assert.equal(gateStateOf(2, []), 'full')
})

test('gateStateOf: 🔴 일괄 대상 전부가 한 개도 못 받으면 none (차감 예정 0kg인데 행이 kg을 말하던 자리)', () => {
  assert.equal(gateStateOf(2, [{ allocated: 0 }, { allocated: 0 }]), 'none')
})

test('gateStateOf: 일부만 받거나, 일부 품목만 부족이면 partial', () => {
  assert.equal(gateStateOf(1, [{ allocated: 3 }]), 'partial')
  // 2품목 중 1품목만 재고없음 — 나머지 1품목은 나간다
  assert.equal(gateStateOf(2, [{ allocated: 0 }]), 'partial')
})

test('gateRowOf: 톤백만 있는 건 → skip bulk, 요약 없음', () => {
  const r = gateRowOf(order(1, [line({ itemId: 1, bulk: true, unitWeightKg: 1000, remainingQty: 1 })]))
  assert.equal(r.skip, 'bulk')
  assert.equal(r.summary, null)
})

test('gateRowOf: 매칭실패만 → unmatched, 톤백+실패 → mixed', () => {
  const failed = line({ itemId: 1, status: 'UNMATCHED', productTypeId: null, availableQty: null })
  assert.equal(gateRowOf(order(1, [failed])).skip, 'unmatched')
  assert.equal(
    gateRowOf(order(1, [failed, line({ itemId: 2, bulk: true, unitWeightKg: 1000 })])).skip,
    'mixed',
  )
})

test('gateRowOf: 전부 완료면 none (목록에 올 일은 없지만 체크박스를 주지 않는다)', () => {
  const r = gateRowOf(order(1, [line({ itemId: 1, status: 'COMPLETED', remainingQty: 0 })]))
  assert.equal(r.skip, 'none')
})

// ------------------------------------------------------
// buildGateGroups · pickableIds
// ------------------------------------------------------
test('buildGateGroups: 먼저 나온 그룹이 먼저 서고, 그룹 안은 들어온 차례 그대로다', () => {
  const groups = buildGateGroups([
    order(1, [line({ itemId: 1 })], '쿠팡'),
    order(2, [line({ itemId: 2 })], '땅끝'),
    order(3, [line({ itemId: 3 })], '쿠팡'),
  ])
  assert.deepEqual(
    groups.map((g) => [g.key, g.rows.map((r) => r.orderId)]),
    [
      ['쿠팡', [1, 3]],
      ['땅끝', [2]],
    ],
  )
})

test('buildGateGroups: 축이 없으면 한 그룹(key "", label null)', () => {
  const groups = buildGateGroups([order(1, [line({ itemId: 1 })], null), order(2, [line({ itemId: 2 })], null)])
  assert.equal(groups.length, 1)
  assert.equal(groups[0].key, '')
  assert.equal(groups[0].label, null)
})

test('pickableIds: 사유 있는 건은 빠진다', () => {
  const groups = buildGateGroups([
    order(1, [line({ itemId: 1 })]),
    order(2, [line({ itemId: 2, bulk: true, unitWeightKg: 1000 })]),
    order(3, [line({ itemId: 3 })]),
  ])
  assert.deepEqual(pickableIds(groups), [1, 3])
})
