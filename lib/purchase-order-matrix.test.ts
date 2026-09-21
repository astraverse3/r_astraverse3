import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMatrix,
  sortMatrixRows,
  cellStatusOf,
  columnKeyOf,
  isColumnShort,
  unitWeightOf,
  groupTitleOf,
  applyMatchPatches,
  buildOrderLines,
  sumOrderLines,
  type MatrixItemInput,
  type MatrixOrderInput,
  type MatrixSkuInput,
  type BuildMatrixInput,
} from './purchase-order-matrix'

// ------------------------------------------------------
// 만들기 도우미
// ------------------------------------------------------
const order = (id: number, vendor: string, recipient = ''): MatrixOrderInput => ({
  id,
  vendor,
  recipient: recipient || vendor,
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

const sku = (
  id: number,
  packageType: string,
  o: Partial<MatrixSkuInput> = {},
): MatrixSkuInput => ({
  id,
  varietyName: '가바백미',
  millingType: '백미',
  varietyType: 'URUCHI',
  packageType,
  packagingName: '자연주의',
  ...o,
})

const input = (o: Partial<BuildMatrixInput>): BuildMatrixInput => ({
  orders: [],
  items: [],
  skus: [],
  availability: {},
  availabilityKg: {},
  ...o,
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
test('buildMatrix: 행=수령인 · 열=규격으로 펼친다', () => {
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

test('buildMatrix: 🔴 열은 등장 순서를 지킨다 (발주서 원본 그대로)', () => {
  // 무게순으로 재배열하면 사람이 엑셀 원본과 대조할 수 없다
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
    ['10kg', '20kg'],
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
        order(1, '하나로'),
        order(2, '가나다'),
        order(3, '마트'),
        order(4, '바다'),
        order(5, '사과'),
      ],
      items: [
        // 상태가 전부 다르다 — 하나로=대기 · 가나다=완료 · 마트=재고부족 · 바다=매칭실패 · 사과=부분
        item({ id: 11, orderId: 1, productTypeId: 1, orderedQty: 5, allocatedQty: 0 }),
        item({ id: 12, orderId: 2, productTypeId: 1, orderedQty: 1, allocatedQty: 1 }),
        item({ id: 13, orderId: 3, productTypeId: 2, orderedQty: 50, allocatedQty: 0 }),
        item({ id: 14, orderId: 4, productTypeId: null, orderedQty: 1 }),
        item({ id: 15, orderId: 5, productTypeId: 1, orderedQty: 4, allocatedQty: 2 }),
      ],
      skus: [sku(1, '10kg'), sku(2, '5kg')],
      availability: { 1: 100, 2: 3 },
    }),
  ).rows

test('sortMatrixRows: 수령인 가나다', () => {
  const r = sortMatrixRows(sortFixture(), 'recipient')
  assert.deepEqual(
    r.map((x) => x.recipient),
    ['가나다', '마트', '바다', '사과', '하나로'],
  )
})

test('sortMatrixRows: 작업필요 = 행 상태 심각도순 (매칭실패 → 재고부족 → 부분 → 대기 → 완료)', () => {
  const r = sortMatrixRows(sortFixture(), 'needsWork')
  assert.deepEqual(
    r.map((x) => `${x.recipient}:${x.status}`),
    ['바다:UNMATCHED', '마트:SHORTAGE', '사과:PARTIAL', '하나로:PENDING', '가나다:COMPLETED'],
  )
  assert.equal(r[0].needsWork, true)
  assert.equal(r[4].needsWork, false)
})

test('sortMatrixRows: 작업필요 — 같은 상태 안에서는 수령인 가나다', () => {
  const rows = buildMatrix(
    input({
      orders: [order(1, '하나'), order(2, '가나'), order(3, '다라')],
      items: [
        item({ id: 11, orderId: 1, productTypeId: 1, orderedQty: 1 }),
        item({ id: 12, orderId: 2, productTypeId: 1, orderedQty: 1 }),
        item({ id: 13, orderId: 3, productTypeId: 1, orderedQty: 1 }),
      ],
      skus: [sku(1, '10kg')],
      availability: { 1: 100 },
    }),
  ).rows
  assert.deepEqual(
    sortMatrixRows(rows, 'needsWork').map((x) => x.recipient),
    ['가나', '다라', '하나'],
  )
})

test('sortMatrixRows: 원본 배열을 건드리지 않는다', () => {
  const rows = sortFixture()
  const before = rows.map((r) => r.recipient)
  sortMatrixRows(rows, 'recipient')
  assert.deepEqual(
    rows.map((r) => r.recipient),
    before,
  )
})

// 택배 실데이터 모양 — 발주처 하나에 수령인 여럿, 시트 원본에서는 발주처가 흩어져 있다
const vendorFixture = () =>
  buildMatrix(
    input({
      orders: [
        order(1, '네이버스토어', '최지애'),
        order(2, '해남미소', '임수진'),
        order(3, '네이버스토어', '김성욱'),
        order(4, '해남로컬푸드'), // recipient = vendor
      ],
      items: [
        item({ id: 11, orderId: 1, productTypeId: 1, orderedQty: 1 }),
        item({ id: 12, orderId: 2, productTypeId: 1, orderedQty: 1 }),
        item({ id: 13, orderId: 3, productTypeId: 1, orderedQty: 1 }),
        item({ id: 14, orderId: 4, productTypeId: 1, orderedQty: 1 }),
      ],
      skus: [sku(1, '10kg')],
      availability: { 1: 100 },
    }),
  ).rows

test('sortMatrixRows: 발주처별 — 흩어진 발주처가 뭉치고 그 안은 수령인 가나다', () => {
  const r = sortMatrixRows(vendorFixture(), 'vendor')
  assert.deepEqual(
    r.map((x) => `${x.vendor}/${x.recipient}`),
    ['네이버스토어/김성욱', '네이버스토어/최지애', '해남로컬푸드/해남로컬푸드', '해남미소/임수진'],
  )
})

test('sortMatrixRows: 수령인 가나다는 발주처를 무시한다 — 조합 문자열 정렬이던 결함', () => {
  const r = sortMatrixRows(vendorFixture(), 'recipient')
  assert.deepEqual(
    r.map((x) => x.recipient),
    ['김성욱', '임수진', '최지애', '해남로컬푸드'],
  )
})

// 서울급식 모양 — 발주처가 변수, 수령인은 행복플러스 고정, 「여유」는 발주처 자리에 온다
const seoulFixture = () =>
  buildMatrix(
    input({
      orders: [
        order(1, '여유', '행복플러스'),
        order(2, '은평구', '행복플러스'),
        order(3, '서대문구', '행복플러스'),
      ],
      items: [
        // 여유만 손댈 일이 남는다 — 작업필요 정렬에서 맨 위여야 한다
        item({ id: 11, orderId: 1, productTypeId: 1, orderedQty: 2, allocatedQty: 0 }),
        item({ id: 12, orderId: 2, productTypeId: 1, orderedQty: 1, allocatedQty: 1 }),
        item({ id: 13, orderId: 3, productTypeId: 1, orderedQty: 1, allocatedQty: 1 }),
      ],
      skus: [sku(1, '10kg')],
      availability: { 1: 100 },
    }),
  ).rows

test('sortMatrixRows: 「여유」는 발주처별·수령인 가나다에서 맨 아래', () => {
  assert.deepEqual(
    sortMatrixRows(seoulFixture(), 'vendor').map((x) => x.vendor),
    ['서대문구', '은평구', '여유'],
  )
  assert.deepEqual(
    sortMatrixRows(seoulFixture(), 'recipient').map((x) => x.vendor),
    ['은평구', '서대문구', '여유'],
  )
})

test('sortMatrixRows: 「여유」도 작업필요에서는 상태대로 섞인다 — 숨으면 안 된다', () => {
  assert.equal(sortMatrixRows(seoulFixture(), 'needsWork')[0].vendor, '여유')
})

test('sortMatrixRows: 수령인 자리의 「여분」도 맨 아래 (발주처가 상수인 채널)', () => {
  const rows = buildMatrix(
    input({
      orders: [order(1, '이마트', '여분'), order(2, '이마트', '여주점'), order(3, '이마트', '대구점')],
      items: [
        item({ id: 11, orderId: 1, productTypeId: 1, orderedQty: 1 }),
        item({ id: 12, orderId: 2, productTypeId: 1, orderedQty: 1 }),
        item({ id: 13, orderId: 3, productTypeId: 1, orderedQty: 1 }),
      ],
      skus: [sku(1, '10kg')],
      availability: { 1: 100 },
    }),
  ).rows
  assert.deepEqual(
    sortMatrixRows(rows, 'recipient').map((x) => x.recipient),
    ['대구점', '여주점', '여분'],
  )
})

// ------------------------------------------------------
// 열 그룹 — 머리글 2단 (품목 → 규격)
// ------------------------------------------------------
test('groupTitleOf: 백미는 적지 않는다', () => {
  assert.equal(groupTitleOf('천지향1세', '백미', 'URUCHI'), '천지향1세')
})

test('groupTitleOf: 잡곡 sentinel「기타」도 적지 않는다', () => {
  // 잡곡은 millingType이 '기타' sentinel — 도정 개념 자체가 없으므로 머리글에 남기지 않는다
  assert.equal(groupTitleOf('차조', '기타', null), '차조')
  assert.equal(groupTitleOf('녹두(친환경)', '기타', 'PURCHASED'), '녹두(친환경)')
})

test('groupTitleOf: 백미가 아니면 붙여 적는다', () => {
  assert.equal(groupTitleOf('서농22호', '현미', 'URUCHI'), '서농22호 · 현미')
})

test('groupTitleOf: 찰벼는 표시가 바뀐다 (찹쌀/찰현미)', () => {
  // 저장값은 '백미'지만 찰벼라 '찹쌀'로 보여야 하고, 백미가 아니므로 생략되지 않는다
  assert.equal(groupTitleOf('백옥찰', '백미', 'GLUTINOUS'), '백옥찰 · 찹쌀')
  assert.equal(groupTitleOf('백옥찰', '현미', 'GLUTINOUS'), '백옥찰 · 찰현미')
})

test('buildMatrix: 같은 품목의 규격들이 한 그룹으로 묶인다', () => {
  const m = buildMatrix(
    input({
      orders: [order(1, '농협')],
      items: [
        item({ id: 11, orderId: 1, productTypeId: 1, packageType: '10kg' }),
        item({ id: 12, orderId: 1, productTypeId: 2, packageType: '5kg' }),
      ],
      skus: [sku(1, '10kg'), sku(2, '5kg')],
    }),
  )
  assert.equal(m.groups.length, 1)
  assert.equal(m.groups[0].title, '가바백미')
  assert.equal(m.groups[0].packagingName, '자연주의')
  assert.equal(m.groups[0].columnKeys.length, 2)
})

test('buildMatrix: 포장지가 다르면 다른 그룹이다', () => {
  const m = buildMatrix(
    input({
      orders: [order(1, '농협')],
      items: [
        item({ id: 11, orderId: 1, productTypeId: 1 }),
        item({ id: 12, orderId: 1, productTypeId: 2 }),
      ],
      skus: [sku(1, '10kg'), sku(2, '10kg', { packagingName: '땅끝에서보냅니다' })],
    }),
  )
  assert.equal(m.groups.length, 2)
})

test('buildMatrix: 그룹도 등장 순서를 지킨다', () => {
  const m = buildMatrix(
    input({
      orders: [order(1, '농협')],
      items: [
        item({ id: 11, orderId: 1, productTypeId: 2 }),
        item({ id: 12, orderId: 1, productTypeId: 1 }),
      ],
      skus: [sku(1, '10kg', { varietyName: '가나다' }), sku(2, '10kg', { varietyName: '하나로' })],
    }),
  )
  // 가나다순이 아니라 나온 차례대로
  assert.deepEqual(
    m.groups.map((g) => g.title),
    ['하나로', '가나다'],
  )
})

test('buildMatrix: 매칭실패 그룹은 표시가 다르다', () => {
  const m = buildMatrix(
    input({
      orders: [order(1, '농협')],
      items: [item({ id: 11, orderId: 1, productTypeId: null, rawItemName: '유기농 차조' })],
      skus: [],
    }),
  )
  assert.equal(m.groups[0].title, '유기농 차조')
  assert.equal(m.groups[0].packagingName, '매칭실패')
  assert.equal(m.groups[0].unmatched, true)
})

test('buildMatrix: 열 순서가 그룹 순서와 맞물린다 (colspan 정합)', () => {
  const m = buildMatrix(
    input({
      orders: [order(1, '농협')],
      items: [
        item({ id: 11, orderId: 1, productTypeId: 1, packageType: '10kg' }),
        item({ id: 12, orderId: 1, productTypeId: 3, packageType: '10kg' }),
        item({ id: 13, orderId: 1, productTypeId: 2, packageType: '5kg' }),
      ],
      skus: [
        sku(1, '10kg'),
        sku(2, '5kg'),
        sku(3, '10kg', { varietyName: '다른품종' }),
      ],
    }),
  )
  // 그룹의 columnKeys를 순서대로 이으면 columns와 정확히 같아야 한다
  assert.deepEqual(
    m.groups.flatMap((g) => g.columnKeys),
    m.columns.map((c) => c.key),
  )
})

// ------------------------------------------------------
// 톤백 열 (C0-a) — 실데이터 #19 시아스: 같은 SKU 18, 라인 두 개가 1,000kg·200kg
// 가용 11자루의 kg 합은 7,067(203~1,014kg 제각각). 개수 × 1,000 = 11,000은 틀린 값.
// ------------------------------------------------------
const bulkInput = (o: Partial<BuildMatrixInput> = {}) =>
  input({
    orders: [order(1, '시아스')],
    items: [
      item({ id: 310, orderId: 1, productTypeId: 18, packageType: '톤백', unitWeightKg: 1000, orderedQty: 5 }),
      item({ id: 311, orderId: 1, productTypeId: 18, packageType: '톤백', unitWeightKg: 200, orderedQty: 3 }),
    ],
    skus: [sku(18, '톤백')],
    availability: { 18: 11 },
    availabilityKg: { 18: 7067 },
    ...o,
  })

test('columnKeyOf: 톤백은 자루중량까지 열 키다 — 중량이 다르면 다른 열', () => {
  const a = item({ id: 1, orderId: 1, productTypeId: 18, unitWeightKg: 1000 })
  const b = item({ id: 2, orderId: 1, productTypeId: 18, unitWeightKg: 200 })
  const c = item({ id: 3, orderId: 1, productTypeId: 18, unitWeightKg: null })
  assert.notEqual(columnKeyOf(a), columnKeyOf(b))
  assert.equal(columnKeyOf(a), 'pt:18|w:1000')
  assert.equal(columnKeyOf(c), 'pt:18') // 일반 규격 키는 그대로 — 기존 열 구성이 안 바뀐다
})

test('buildMatrix: 톤백 1,000kg·200kg이 두 열로 선다 (한 열로 합쳐지던 결함)', () => {
  const m = buildMatrix(bulkInput())
  assert.equal(m.columns.length, 2)
  assert.deepEqual(
    m.columns.map((c) => [c.unitWeightKg, c.orderedQty, c.bulk]),
    [
      [1000, 5, true],
      [200, 3, true],
    ],
  )
})

test('buildMatrix: 톤백 열 가용은 kg 합 — 개수 × 중량으로 환산하지 않는다', () => {
  const m = buildMatrix(bulkInput())
  assert.equal(m.columns[0].availableKg, 7067)
  assert.equal(m.columns[1].availableKg, 7067)
  assert.equal(m.columns[0].availableQty, 11) // 개수는 참고용으로 남는다
})

test('buildMatrix: 일반 규격 열은 bulk=false·availableKg=null', () => {
  const m = buildMatrix(
    input({
      orders: [order(1, '농협')],
      items: [item({ id: 1, orderId: 1, productTypeId: 1, orderedQty: 3 })],
      skus: [sku(1, '10kg')],
      availability: { 1: 10 },
    }),
  )
  assert.equal(m.columns[0].bulk, false)
  assert.equal(m.columns[0].availableKg, null)
})

test('cellStatusOf/톤백: 재고부족은 kg 기준 — 5,000kg 주문 vs 7,067kg 가용은 부족 아님', () => {
  const m = buildMatrix(bulkInput())
  assert.equal(m.rows[0].cells['pt:18|w:1000'].status, 'PENDING')
  assert.equal(m.rows[0].cells['pt:18|w:200'].status, 'PENDING')
})

test('cellStatusOf/톤백: 8,000kg 주문 vs 7,067kg 가용은 부족 — 개수(8 < 11)로 보면 놓친다', () => {
  const m = buildMatrix(
    bulkInput({
      items: [item({ id: 310, orderId: 1, productTypeId: 18, packageType: '톤백', unitWeightKg: 1000, orderedQty: 8 })],
    }),
  )
  assert.equal(m.rows[0].cells['pt:18|w:1000'].status, 'SHORTAGE')
})

test('isColumnShort: 톤백은 kg끼리, 일반은 개수끼리', () => {
  const m = buildMatrix(bulkInput())
  assert.equal(isColumnShort(m.columns[0]), false) // 5×1,000 = 5,000 < 7,067
  const short = buildMatrix(
    bulkInput({
      items: [item({ id: 310, orderId: 1, productTypeId: 18, packageType: '톤백', unitWeightKg: 1000, orderedQty: 8 })],
    }),
  )
  assert.equal(isColumnShort(short.columns[0]), true) // 8,000 > 7,067
  const plain = buildMatrix(
    input({
      orders: [order(1, '농협')],
      items: [item({ id: 1, orderId: 1, productTypeId: 1, orderedQty: 12 })],
      skus: [sku(1, '10kg')],
      availability: { 1: 10 },
    }),
  )
  assert.equal(isColumnShort(plain.columns[0]), true) // 12 > 10
})

test('isColumnShort: 남은 주문(발주 − 차감)으로 본다 — 다 차감한 열은 가용이 0이어도 부족이 아니다', () => {
  // 톤백 1자루 발주를 1,004 자루로 확정 → 가용 203kg만 남아도 남은 주문 0
  const done = buildMatrix(
    bulkInput({
      items: [item({ id: 310, orderId: 1, productTypeId: 18, packageType: '톤백', unitWeightKg: 1000, orderedQty: 1, allocatedQty: 1 })],
      availabilityKg: { 18: 203 },
    }),
  )
  assert.equal(isColumnShort(done.columns[0]), false)
  // 일반 규격도 같다 — 12 발주 중 10 차감, 가용 2면 남은 2 ≤ 2
  const plain = buildMatrix(
    input({
      orders: [order(1, '농협')],
      items: [item({ id: 1, orderId: 1, productTypeId: 1, orderedQty: 12, allocatedQty: 10 })],
      skus: [sku(1, '10kg')],
      availability: { 1: 2 },
    }),
  )
  assert.equal(isColumnShort(plain.columns[0]), false)
  // 부분 차감 뒤 실제로 모자라면 여전히 부족
  const still = buildMatrix(
    input({
      orders: [order(1, '농협')],
      items: [item({ id: 1, orderId: 1, productTypeId: 1, orderedQty: 12, allocatedQty: 10 })],
      skus: [sku(1, '10kg')],
      availability: { 1: 1 },
    }),
  )
  assert.equal(isColumnShort(still.columns[0]), true)
})

// ------------------------------------------------------
// 매칭 지정 반영 (D2e)
// ------------------------------------------------------

test('applyMatchPatches: 지정한 라인이 매칭실패 열에서 SKU 열로 옮겨간다', () => {
  const base = input({
    orders: [order(1, '박가네')],
    items: [item({ id: 10, orderId: 1, rawItemName: '혼합곡 (친환경)', packageType: '1kg', productTypeId: null })],
  })
  assert.equal(buildMatrix(base).columns[0].key.startsWith('raw:'), true)

  const after = applyMatchPatches(base, [
    { itemIds: [10], productTypeId: 7, sku: sku(7, '1kg', { varietyName: '혼합곡' }), availability: 30, availabilityKg: 30 },
  ])
  const m = buildMatrix(after)
  assert.equal(m.columns.length, 1)
  assert.equal(m.columns[0].key, 'pt:7')
  assert.equal(m.columns[0].availableQty, 30)
  assert.equal(m.groups[0].unmatched, false)
  // 원본은 그대로 — 불변성
  assert.equal(base.items[0].productTypeId, null)
})

test('applyMatchPatches: 이미 있는 SKU 열과 합쳐진다(중복 SKU 없음)', () => {
  const base = input({
    orders: [order(1, '박가네'), order(2, '김가네')],
    items: [
      item({ id: 10, orderId: 1, packageType: '1kg', productTypeId: 7 }),
      item({ id: 20, orderId: 2, rawItemName: '혼합곡 (친환경)', packageType: '1kg', productTypeId: null }),
    ],
    skus: [sku(7, '1kg')],
    availability: { 7: 5 },
    availabilityKg: { 7: 5 },
  })
  assert.equal(buildMatrix(base).columns.length, 2)

  const after = applyMatchPatches(base, [
    { itemIds: [20], productTypeId: 7, sku: sku(7, '1kg'), availability: 5, availabilityKg: 5 },
  ])
  assert.equal(after.skus.length, 1)
  const m = buildMatrix(after)
  assert.equal(m.columns.length, 1)
  assert.equal(m.columns[0].orderedQty, 2)
})

test('applyMatchPatches: 패치가 없으면 입력을 그대로 돌려준다', () => {
  const base = input({ orders: [order(1, '박가네')], items: [item({ id: 10, orderId: 1 })] })
  assert.equal(applyMatchPatches(base, []), base)
})

// ------------------------------------------------------
// 건 상세 — 라인 파생 (M1-1)
// ------------------------------------------------------

test('buildOrderLines: 그 건의 라인만 낸다', () => {
  const lines = buildOrderLines(
    input({
      items: [item({ id: 1, orderId: 10 }), item({ id: 2, orderId: 11 }), item({ id: 3, orderId: 10 })],
      skus: [sku(1, '10kg')],
      availability: { 1: 100 },
    }),
    10,
  )
  assert.deepEqual(
    lines.map((l) => l.itemId),
    [1, 3],
  )
})

test('buildOrderLines: 상태 심각도순으로 선다 (매칭실패 → 재고부족 → 부분 → 완료)', () => {
  const lines = buildOrderLines(
    input({
      items: [
        item({ id: 1, orderId: 1, orderedQty: 5, allocatedQty: 5 }), // 완료
        item({ id: 2, orderId: 1, orderedQty: 5, productTypeId: null }), // 매칭실패
        item({ id: 3, orderId: 1, orderedQty: 5, productTypeId: 2 }), // 재고부족(가용 1)
        item({ id: 4, orderId: 1, orderedQty: 5, allocatedQty: 2 }), // 부분
      ],
      skus: [sku(1, '10kg'), sku(2, '5kg')],
      availability: { 1: 100, 2: 1 },
    }),
    1,
  )
  assert.deepEqual(
    lines.map((l) => l.status),
    ['UNMATCHED', 'SHORTAGE', 'PARTIAL', 'COMPLETED'],
  )
})

test('buildOrderLines: 매칭실패는 가용을 모르므로 부족도 0이다', () => {
  const [line] = buildOrderLines(
    input({ items: [item({ id: 1, orderId: 1, orderedQty: 9, productTypeId: null, rawItemName: '녹두' })] }),
    1,
  )
  assert.equal(line.status, 'UNMATCHED')
  assert.equal(line.availableQty, null)
  assert.equal(line.shortage, 0)
  assert.equal(line.title, '녹두') // 매칭실패는 엑셀 원본 품목명
  assert.equal(line.packagingName, null)
})

test('buildOrderLines: 🔴 톤백 가용은 kg을 자루중량으로 나눈다 (개수는 의미가 없다)', () => {
  const [line] = buildOrderLines(
    input({
      items: [item({ id: 1, orderId: 1, orderedQty: 10, unitWeightKg: 1000, productTypeId: 7 })],
      skus: [sku(7, '톤백')],
      availability: { 7: 11 }, // 자루는 11개지만
      availabilityKg: { 7: 7067 }, // 실제 무게는 7,067kg (자루가 제각각)
    }),
    1,
  )
  assert.equal(line.bulk, true)
  assert.equal(line.unitWeightKg, 1000)
  assert.equal(line.availableQty, 7.067)
  assert.equal(line.shortage, 3) // 7자루까지만 나간다 — 내림
  assert.equal(line.status, 'SHORTAGE')
})

test('buildOrderLines: 🔴 단위 없는 규격은 중량이 null이다 (합계에서 빠진다)', () => {
  const [line] = buildOrderLines(
    input({
      items: [item({ id: 1, orderId: 1, packageType: '500' })],
      skus: [sku(1, '500')],
      availability: { 1: 10 },
    }),
    1,
  )
  assert.equal(line.unitWeightKg, null)
})

test('buildOrderLines: 🔴 매트릭스 셀과 같은 판정을 쓴다 (판정이 두 벌이 아니다)', () => {
  const src = input({
    orders: [order(1, '행복플러스', '은평구')],
    items: [
      item({ id: 1, orderId: 1, orderedQty: 91, productTypeId: 1 }),
      item({ id: 2, orderId: 1, orderedQty: 4, productTypeId: null }),
      item({ id: 3, orderId: 1, orderedQty: 6, allocatedQty: 6, productTypeId: 2 }),
    ],
    skus: [sku(1, '10kg'), sku(2, '5kg')],
    availability: { 1: 59, 2: 0 },
  })
  const matrix = buildMatrix(src)
  const row = matrix.rows[0]
  const lines = buildOrderLines(src, 1)

  // 라인 → 그 라인이 앉은 셀. 상태가 한 글자도 달라선 안 된다
  for (const line of lines) {
    const col = matrix.columns.find((c) => row.cells[c.key]?.itemIds.includes(line.itemId))
    assert.ok(col, `열을 찾지 못함: ${line.itemId}`)
    assert.equal(line.status, row.cells[col.key].status)
  }
})

test('sumOrderLines: 🔴 작업 라인수는 매칭실패를 포함하고, 일괄차감 라인수는 제외한다', () => {
  const lines = buildOrderLines(
    input({
      items: [
        item({ id: 1, orderId: 1, orderedQty: 5 }), // 대기
        item({ id: 2, orderId: 1, orderedQty: 5, productTypeId: null }), // 매칭실패
        item({ id: 3, orderId: 1, orderedQty: 5, allocatedQty: 5 }), // 완료
      ],
      skus: [sku(1, '10kg')],
      availability: { 1: 100 },
    }),
    1,
  )
  const t = sumOrderLines(lines)
  assert.equal(t.workLines, 2) // 대기 + 매칭실패
  assert.equal(t.batchLines, 1) // 버튼이 실제로 건드리는 건 대기 하나
  assert.equal(t.doneLines, 1)
})

test('sumOrderLines: 남은 kg은 주문이 아니라 남은 수량으로 센다', () => {
  const lines = buildOrderLines(
    input({
      items: [item({ id: 1, orderId: 1, orderedQty: 10, allocatedQty: 4, packageType: '10kg' })],
      skus: [sku(1, '10kg')],
      availability: { 1: 100 },
    }),
    1,
  )
  assert.equal(sumOrderLines(lines).remainingKg, 60) // 6개 남음 × 10kg
})

test('sumOrderLines: 🔴 중량 미산정 줄이 섞이면 표시가 필요하다고 알린다', () => {
  const lines = buildOrderLines(
    input({
      items: [
        item({ id: 1, orderId: 1, orderedQty: 2, packageType: '10kg' }),
        item({ id: 2, orderId: 1, orderedQty: 3, packageType: '500' }), // 단위 없음
      ],
      skus: [sku(1, '10kg')],
      availability: { 1: 100 },
    }),
    1,
  )
  const t = sumOrderLines(lines)
  assert.equal(t.unknownWeight, true)
  assert.equal(t.remainingKg, 20) // 읽힌 줄만 센 값이다
})

test('sumOrderLines: 완료 줄은 차감 중량으로 접는다', () => {
  const lines = buildOrderLines(
    input({
      items: [item({ id: 1, orderId: 1, orderedQty: 9, allocatedQty: 9, packageType: '5kg' })],
      skus: [sku(1, '5kg')],
      availability: { 1: 100 },
    }),
    1,
  )
  const t = sumOrderLines(lines)
  assert.equal(t.doneLines, 1)
  assert.equal(t.doneKg, 45)
  assert.equal(t.workLines, 0)
})
