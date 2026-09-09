import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMatrix,
  sortMatrixRows,
  cellStatusOf,
  columnKeyOf,
  rowLabelOf,
  unitWeightOf,
  type MatrixItemInput,
  type MatrixOrderInput,
  type MatrixSkuInput,
  type BuildMatrixInput,
} from './purchase-order-matrix'

// ------------------------------------------------------
// 만들기 도우미
// ------------------------------------------------------
const order = (id: number, vendor: string, recipient = '', createdAt = '2026-08-01'): MatrixOrderInput => ({
  id,
  vendor,
  recipient: recipient || vendor,
  createdAt,
})

const item = (o: Partial<MatrixItemInput> & { id: number; orderId: number }): MatrixItemInput => ({
  rawItemName: '가바백미',
  packageType: '10kg',
  rawPackaging: null,
  orderedQty: 1,
  unitWeightKg: null,
  productTypeId: 1,
  allocatedQty: 0,
  ...o,
})

const sku = (id: number, packageType: string, varietyName = '가바백미'): MatrixSkuInput => ({
  id,
  varietyName,
  millingType: '백미',
  packageType,
  packagingName: '자연주의',
})

const input = (o: Partial<BuildMatrixInput>): BuildMatrixInput => ({
  orders: [],
  items: [],
  skus: [],
  availability: {},
  ...o,
})

// ------------------------------------------------------
// 행 머리글 — 발주처≠수령인일 때만 화살표
// ------------------------------------------------------
test('rowLabelOf: 발주처와 수령인이 같으면 하나만', () => {
  assert.equal(rowLabelOf('농협', '농협'), '농협')
})

test('rowLabelOf: 수령인이 비면 발주처만', () => {
  assert.equal(rowLabelOf('농협', ''), '농협')
  assert.equal(rowLabelOf('농협', '   '), '농협')
})

test('rowLabelOf: 다르면 화살표로 잇는다', () => {
  assert.equal(rowLabelOf('농협', '서울지점'), '농협 → 서울지점')
})

// ------------------------------------------------------
// 규격 → kg
// ------------------------------------------------------
test('unitWeightOf: 규격 문자열에서 kg를 읽는다', () => {
  assert.equal(unitWeightOf('10kg', null), 10)
  assert.equal(unitWeightOf('420g', null), 0.42)
})

test('unitWeightOf: 톤백은 라인의 요구 자루중량이 이긴다 (#34)', () => {
  assert.equal(unitWeightOf('톤백', 1000), 1000)
  // 규격에서 못 읽어도 자루중량이 있으면 그것을 쓴다
  assert.equal(unitWeightOf('톤백', null), null)
})

// ------------------------------------------------------
// 열 키 — 매칭실패는 원본 조합으로 따로 선다
// ------------------------------------------------------
test('columnKeyOf: 매칭되면 SKU 하나로 모인다', () => {
  const a = columnKeyOf(item({ id: 1, orderId: 1, productTypeId: 7 }))
  const b = columnKeyOf(item({ id: 2, orderId: 2, productTypeId: 7, rawItemName: '다른이름' }))
  assert.equal(a, b)
})

test('columnKeyOf: 매칭실패는 원본이 다르면 다른 열', () => {
  const a = columnKeyOf(item({ id: 1, orderId: 1, productTypeId: null, rawItemName: '알수없는쌀' }))
  const b = columnKeyOf(item({ id: 2, orderId: 2, productTypeId: null, rawItemName: '또다른쌀' }))
  assert.notEqual(a, b)
})

// ------------------------------------------------------
// 셀 상태 — 우선순위가 핵심이다
// ------------------------------------------------------
test('cellStatusOf: 다 나갔으면 완료', () => {
  assert.equal(cellStatusOf(5, 5, 1, 0), 'COMPLETED')
  assert.equal(cellStatusOf(5, 7, 1, 0), 'COMPLETED') // 초과 배분도 완료
})

test('cellStatusOf: 완료가 매칭실패보다 앞이다', () => {
  // 매칭이 안 됐어도 이미 다 나갔으면 손댈 일이 없다
  assert.equal(cellStatusOf(5, 5, null, null), 'COMPLETED')
})

test('cellStatusOf: 매칭실패가 재고부족보다 앞이다', () => {
  // 무엇을 낼지 모르는데 재고를 논할 수 없다
  assert.equal(cellStatusOf(5, 0, null, 0), 'UNMATCHED')
})

test('cellStatusOf: 남은 양보다 재고가 적으면 재고부족', () => {
  assert.equal(cellStatusOf(10, 0, 1, 3), 'SHORTAGE')
  // 이미 7개 나갔으면 남은 3개 — 재고 3이면 부족이 아니다
  assert.equal(cellStatusOf(10, 7, 1, 3), 'PARTIAL')
})

test('cellStatusOf: 재고가 충분하면 미차감/부분', () => {
  assert.equal(cellStatusOf(10, 0, 1, 10), 'PENDING')
  assert.equal(cellStatusOf(10, 4, 1, 10), 'PARTIAL')
})

// ------------------------------------------------------
// 피벗
// ------------------------------------------------------
test('buildMatrix: 행=수령처 · 열=규격으로 펼친다', () => {
  const m = buildMatrix(
    input({
      orders: [order(1, '농협'), order(2, '마트')],
      items: [
        item({ id: 11, orderId: 1, productTypeId: 1, orderedQty: 3 }),
        item({ id: 12, orderId: 1, productTypeId: 2, packageType: '20kg', orderedQty: 1 }),
        item({ id: 13, orderId: 2, productTypeId: 1, orderedQty: 5 }),
      ],
      skus: [sku(1, '10kg'), sku(2, '20kg')],
      availability: { 1: 100, 2: 100 },
    }),
  )
  assert.equal(m.rows.length, 2)
  assert.equal(m.columns.length, 2)
  assert.equal(m.rows[0].cells['pt:1'].orderedQty, 3)
  assert.equal(m.rows[1].cells['pt:1'].orderedQty, 5)
  // 마트는 20kg를 주문하지 않았다 — 칸이 아예 없다
  assert.equal(m.rows[1].cells['pt:2'], undefined)
})

test('buildMatrix: 열은 규격 무게 내림차순 (20kg가 10kg보다 왼쪽)', () => {
  const m = buildMatrix(
    input({
      orders: [order(1, '농협')],
      items: [
        item({ id: 11, orderId: 1, productTypeId: 1, packageType: '10kg' }),
        item({ id: 12, orderId: 1, productTypeId: 2, packageType: '20kg' }),
      ],
      skus: [sku(1, '10kg'), sku(2, '20kg')],
    }),
  )
  assert.deepEqual(
    m.columns.map((c) => c.packageType),
    ['20kg', '10kg'],
  )
})

test('buildMatrix: 무게를 못 읽는 열은 뒤로 간다', () => {
  const m = buildMatrix(
    input({
      orders: [order(1, '농협')],
      items: [
        item({ id: 11, orderId: 1, productTypeId: 1, packageType: '톤백' }),
        item({ id: 12, orderId: 1, productTypeId: 2, packageType: '10kg' }),
      ],
      skus: [sku(1, '톤백'), sku(2, '10kg')],
    }),
  )
  assert.deepEqual(
    m.columns.map((c) => c.packageType),
    ['10kg', '톤백'],
  )
})

test('buildMatrix: 같은 칸에 라인이 둘이면 합쳐서 판정한다', () => {
  // 🔴 라인마다 상태를 내면 「부분 2개」로 보이지만, 합치면 완료다
  const m = buildMatrix(
    input({
      orders: [order(1, '농협')],
      items: [
        item({ id: 11, orderId: 1, productTypeId: 1, orderedQty: 3, allocatedQty: 3 }),
        item({ id: 12, orderId: 1, productTypeId: 1, orderedQty: 2, allocatedQty: 2 }),
      ],
      skus: [sku(1, '10kg')],
      availability: { 1: 0 },
    }),
  )
  const cell = m.rows[0].cells['pt:1']
  assert.deepEqual(cell.itemIds, [11, 12])
  assert.equal(cell.orderedQty, 5)
  assert.equal(cell.status, 'COMPLETED')
  assert.equal(m.rows[0].needsWork, false)
})

test('buildMatrix: 주문 중량을 합산한다 (톤백은 요구 자루중량)', () => {
  const m = buildMatrix(
    input({
      orders: [order(1, '농협')],
      items: [
        item({ id: 11, orderId: 1, productTypeId: 1, packageType: '10kg', orderedQty: 3 }),
        item({ id: 12, orderId: 1, productTypeId: 2, packageType: '톤백', unitWeightKg: 1000, orderedQty: 2 }),
      ],
      skus: [sku(1, '10kg'), sku(2, '톤백')],
    }),
  )
  assert.equal(m.rows[0].orderedKg, 30 + 2000)
  assert.equal(m.totals.orderedKg, 2030)
})

test('buildMatrix: 가용재고는 열 단위로 붙고 매칭실패 열은 null', () => {
  const m = buildMatrix(
    input({
      orders: [order(1, '농협')],
      items: [
        item({ id: 11, orderId: 1, productTypeId: 1 }),
        item({ id: 12, orderId: 1, productTypeId: null, rawItemName: '알수없는쌀' }),
      ],
      skus: [sku(1, '10kg')],
      availability: { 1: 42 },
    }),
  )
  const matched = m.columns.find((c) => c.productTypeId === 1)
  const unmatched = m.columns.find((c) => c.productTypeId === null)
  assert.equal(matched?.availableQty, 42)
  assert.equal(unmatched?.availableQty, null)
})

test('buildMatrix: 주문이 없는 행도 빠지지 않는다', () => {
  const m = buildMatrix(input({ orders: [order(1, '농협')], items: [] }))
  assert.equal(m.rows.length, 1)
  assert.equal(m.rows[0].orderedQty, 0)
  assert.equal(m.rows[0].needsWork, false)
})

test('buildMatrix: 합계와 작업필요 행 수', () => {
  const m = buildMatrix(
    input({
      orders: [order(1, '농협'), order(2, '마트')],
      items: [
        item({ id: 11, orderId: 1, productTypeId: 1, orderedQty: 3, allocatedQty: 3 }),
        item({ id: 12, orderId: 2, productTypeId: 1, orderedQty: 5, allocatedQty: 1 }),
      ],
      skus: [sku(1, '10kg')],
      availability: { 1: 100 },
    }),
  )
  assert.equal(m.totals.orderedQty, 8)
  assert.equal(m.totals.allocatedQty, 4)
  assert.equal(m.totals.needsWorkRows, 1)
})

// ------------------------------------------------------
// 정렬
// ------------------------------------------------------
const sortFixture = () =>
  buildMatrix(
    input({
      orders: [
        order(1, '하나로', '', '2026-08-01'),
        order(2, '가나다', '', '2026-08-03'),
        order(3, '마트', '', '2026-08-02'),
      ],
      items: [
        // 하나로만 손댈 일이 남는다
        item({ id: 11, orderId: 1, productTypeId: 1, orderedQty: 5, allocatedQty: 0 }),
        item({ id: 12, orderId: 2, productTypeId: 1, orderedQty: 1, allocatedQty: 1 }),
        item({ id: 13, orderId: 3, productTypeId: 1, orderedQty: 1, allocatedQty: 1 }),
      ],
      skus: [sku(1, '10kg')],
      availability: { 1: 100 },
    }),
  ).rows

test('sortMatrixRows: 수령처 가나다', () => {
  const r = sortMatrixRows(sortFixture(), 'recipient')
  assert.deepEqual(
    r.map((x) => x.label),
    ['가나다', '마트', '하나로'],
  )
})

test('sortMatrixRows: 최신순', () => {
  const r = sortMatrixRows(sortFixture(), 'latest')
  assert.deepEqual(
    r.map((x) => x.label),
    ['가나다', '마트', '하나로'],
  )
})

test('sortMatrixRows: 작업필요 우선 — 남은 행이 맨 위', () => {
  const r = sortMatrixRows(sortFixture(), 'needsWork')
  assert.equal(r[0].label, '하나로')
  assert.equal(r[0].needsWork, true)
})

test('sortMatrixRows: 원본 배열을 건드리지 않는다', () => {
  const rows = sortFixture()
  const before = rows.map((r) => r.label)
  sortMatrixRows(rows, 'recipient')
  assert.deepEqual(
    rows.map((r) => r.label),
    before,
  )
})
