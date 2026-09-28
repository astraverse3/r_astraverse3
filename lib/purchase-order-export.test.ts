import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import {
  buildExportSheet,
  formatKstDateTime,
  formatTitleDate,
  headerLabelOf,
  safeSheetName,
  summarizeLots,
  toWorksheet,
  type ExportAllocation,
  type ExportSheetInput,
} from './purchase-order-export'
import type { CellStatus, MatrixItemInput, MatrixOrderInput, MatrixSkuInput } from './purchase-order-matrix'

const LABEL: Record<CellStatus, string> = {
  UNMATCHED: '매칭실패',
  SHORTAGE: '재고부족',
  PARTIAL: '부분',
  PENDING: '대기',
  COMPLETED: '완료',
}

let nextId = 1
function item(p: Partial<MatrixItemInput> & { orderId: number; rawItemName: string }): MatrixItemInput {
  return {
    id: nextId++,
    packageType: '10kg',
    rawPackaging: null,
    orderedQty: 1,
    unitWeightKg: null,
    productTypeId: 1,
    allocatedQty: 0,
    ...p,
  }
}

function alloc(p: Partial<ExportAllocation> & { itemId: number; count: number }): ExportAllocation {
  return { packageId: 100, farmerName: '박태일', lotNo: 'L1', purchaseVendor: null, ...p }
}

function sku(id: number, varietyName: string, packageType: string, packagingName = '자연주의'): MatrixSkuInput {
  return { id, varietyName, millingType: '백미', varietyType: null, packageType, packagingName }
}

const DEFAULT_SKUS = [sku(1, '새청무', '10kg'), sku(2, '가바백미', '10kg')]

function input(
  orders: MatrixOrderInput[],
  items: MatrixItemInput[],
  allocations: ExportAllocation[],
  availability: Record<number, number> = { 1: 999, 2: 999, 3: 999 },
  skus: MatrixSkuInput[] = DEFAULT_SKUS,
): ExportSheetInput {
  return {
    matrix: { orders, items, skus, availability, availabilityKg: {} },
    allocations,
    title: '26/08/18 (화)\n서울급식',
    footerLines: ['내보낸 시각 2026-09-28 10:00'],
    statusLabel: (s) => LABEL[s],
  }
}

// ------------------------------------------------------
// 열 · 머리글 = 매트릭스 화면 (2026-09-28 A안)
// ------------------------------------------------------

test('열 — 원본 품목명이 달라도 한 SKU면 한 열, 1행은 SKU 품종명', () => {
  const orders = [{ id: 1, vendor: 'v1', recipient: 'r1' }, { id: 2, vendor: 'v2', recipient: 'r2' }]
  const a = item({ orderId: 1, rawItemName: '유기농 IPS', productTypeId: 1, orderedQty: 2 })
  const b = item({ orderId: 2, rawItemName: '유기농 프로틴 라이스 IPS', productTypeId: 1, orderedQty: 3 })
  const sheet = buildExportSheet(input(orders, [a, b], []))
  assert.equal(sheet.rows[0].length, 3) // 이름 두 칸 + 열 하나
  assert.equal(sheet.rows[0][2], '새청무')
  assert.deepEqual(sheet.rows[5], ['소계', null, 5])
})

test('머리글 — 1행은 제목 같은 칸 병합, 포장지 줄은 포장지 같은 칸 병합', () => {
  // 택배 천지향 모양 — 10kg는 「천지향」, 5·1kg는 「땅끝에서보냅니다」
  const orders = [{ id: 1, vendor: 'v', recipient: 'r' }]
  const items = [1, 2, 3].map((id) => item({ orderId: 1, rawItemName: '유기농 천지향', productTypeId: id }))
  const skus = [
    sku(1, '천지향1세', '10kg', '천지향'),
    sku(2, '천지향1세', '5kg', '땅끝에서보냅니다'),
    sku(3, '천지향1세', '1kg', '땅끝에서보냅니다'),
  ]
  const sheet = buildExportSheet(input(orders, items, [], undefined, skus))
  assert.deepEqual(sheet.rows[1], ['포장지', null, '천지향', '땅끝에서보냅니다', '땅끝에서보냅니다'])
  assert.deepEqual(sheet.rows[2], ['규격', null, '10kg', '5kg', '1kg'])
  assert.deepEqual(
    sheet.merges.filter((m) => m.s.c >= 2),
    [
      { s: { r: 0, c: 2 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 3 }, e: { r: 1, c: 4 } },
    ],
  )
})

test('머리글 — 매칭실패 열은 원본 품목명 · 포장지 줄 「매칭실패」', () => {
  const orders = [{ id: 1, vendor: 'v', recipient: 'r' }]
  const a = item({ orderId: 1, rawItemName: '유기농 율무', productTypeId: null })
  const sheet = buildExportSheet(input(orders, [a], []))
  assert.equal(sheet.rows[0][2], '유기농 율무')
  assert.equal(sheet.rows[1][2], '매칭실패')
})

test('열 폭 — 로트번호는 폭에 안 넣고(잘려도 됨), 한글은 두 자 몫', () => {
  const orders = [{ id: 1, vendor: 'v', recipient: 'r' }]
  const a = item({ orderId: 1, rawItemName: '천지향', productTypeId: 1, allocatedQty: 1 })
  const b = item({ orderId: 1, rawItemName: '천지향', productTypeId: 2, allocatedQty: 1 })
  const skus = [sku(1, '천지향1세', '10kg', '천지향'), sku(2, '천지향1세', '5kg', '땅끝에서보냅니다')]
  const lot = '251119-11-15103885-4113'
  const allocs = [alloc({ itemId: a.id, count: 1, lotNo: lot }), alloc({ itemId: b.id, count: 1, lotNo: lot })]
  const sheet = buildExportSheet(input(orders, [a, b], allocs, undefined, skus))
  assert.equal(sheet.rows[4][2], lot) // 값은 온전하다
  // 천지향(6)·박태일(6) → 최소 10 · 땅끝에서보냅니다(16) → 18
  assert.deepEqual(sheet.colWidths.slice(2), [10, 18])
})

// ------------------------------------------------------
// 생산자 · 로트
// ------------------------------------------------------

test('로트 요약 — 매입 잡곡은 로트가 null이어도 packageId로 따로 센다', () => {
  const lots = summarizeLots([
    alloc({ itemId: 1, count: 3, packageId: 1, lotNo: null, farmerName: null, purchaseVendor: '가나상사' }),
    alloc({ itemId: 1, count: 2, packageId: 2, lotNo: null, farmerName: null, purchaseVendor: '가나상사' }),
  ])
  assert.equal(lots.length, 2)
  assert.equal(lots[0].farmerLabel, '매입·가나상사')
  assert.equal(lots[0].lotLabel, '매입')
})

test('로트 요약 — 같은 로트는 합치고 많이 나간 순', () => {
  const lots = summarizeLots([
    alloc({ itemId: 1, count: 2, lotNo: 'L1', farmerName: '김' }),
    alloc({ itemId: 2, count: 5, lotNo: 'L2', farmerName: '박' }),
    alloc({ itemId: 3, count: 4, lotNo: 'L1', farmerName: '김' }),
  ])
  assert.deepEqual(lots.map((l) => [l.lotLabel, l.count]), [['L1', 6], ['L2', 5]])
})

test('머리글 — 하나면 그대로, 여럿이면 「대표 외 N」, 없으면 빈칸', () => {
  const lots = summarizeLots([
    alloc({ itemId: 1, count: 5, lotNo: 'L2', farmerName: '박' }),
    alloc({ itemId: 1, count: 2, lotNo: 'L1', farmerName: '박' }),
  ])
  assert.equal(headerLabelOf(lots, (e) => e.farmerLabel), '박') // 생산자는 한 명
  assert.equal(headerLabelOf(lots, (e) => e.lotLabel), 'L2 외 1')
  assert.equal(headerLabelOf([], (e) => e.lotLabel), '')
})

// ------------------------------------------------------
// 시트 조립
// ------------------------------------------------------

test('시트 — 머리글 7줄 + 데이터, 셀 값은 주문 수량, 소계는 열 합', () => {
  const orders = [
    { id: 1, vendor: '은평구', recipient: '행복플러스' },
    { id: 2, vendor: '서대문구', recipient: '행복플러스' },
  ]
  const a = item({ orderId: 1, rawItemName: '새청무', packageType: '10kg', orderedQty: 91, allocatedQty: 91 })
  const b = item({ orderId: 2, rawItemName: '새청무', packageType: '10kg', orderedQty: 75, allocatedQty: 75 })
  const sheet = buildExportSheet(
    input(orders, [a, b], [alloc({ itemId: a.id, count: 91 }), alloc({ itemId: b.id, count: 75 })]),
  )
  assert.deepEqual(sheet.rows[0], ['26/08/18 (화)\n서울급식', null, '새청무'])
  assert.deepEqual(sheet.rows[1], ['포장지', null, '자연주의'])
  assert.deepEqual(sheet.rows[2], ['규격', null, '10kg'])
  assert.deepEqual(sheet.rows[3], ['농가명', null, '박태일'])
  assert.deepEqual(sheet.rows[4], ['로트번호', null, 'L1'])
  assert.deepEqual(sheet.rows[5], ['소계', null, 166])
  assert.deepEqual(sheet.rows[6], ['(발주처)', '(수령인)', null])
  assert.deepEqual(sheet.rows[7], ['은평구', '행복플러스', 91])
  assert.deepEqual(sheet.rows[8], ['서대문구', '행복플러스', 75])
  assert.equal(sheet.incompleteCount, 0)
  assert.equal(sheet.memos.length, 0) // 다 나갔고 로트도 하나 — 메모 없음
})

test('시트 — 로트가 섞인 열은 머리글 「외 N」 + 그 열 칸마다 로트 메모', () => {
  const orders = [
    { id: 1, vendor: '은평구', recipient: '행복플러스' },
    { id: 2, vendor: '강서구', recipient: '행복플러스' },
  ]
  const a = item({ orderId: 1, rawItemName: '찹쌀', orderedQty: 31, allocatedQty: 31 })
  const b = item({ orderId: 2, rawItemName: '찹쌀', orderedQty: 6, allocatedQty: 6 })
  const sheet = buildExportSheet(
    input(orders, [a, b], [
      alloc({ itemId: a.id, count: 20, lotNo: 'L1', farmerName: '박태일', packageId: 1 }),
      alloc({ itemId: a.id, count: 11, lotNo: 'L2', farmerName: '김종원', packageId: 2 }),
      alloc({ itemId: b.id, count: 6, lotNo: 'L2', farmerName: '김종원', packageId: 2 }),
    ]),
  )
  assert.equal(sheet.rows[3][2], '박태일 외 1') // L1 20개 > L2 17개 → L1이 대표
  assert.equal(sheet.rows[4][2], 'L1 외 1')
  assert.equal(sheet.memos.length, 2)
  assert.equal(sheet.memos[0].text, '박태일 · L1 · 20개\n김종원 · L2 · 11개')
  assert.deepEqual([sheet.memos[1].row, sheet.memos[1].col], [8, 2])
  assert.equal(sheet.memos[1].text, '김종원 · L2 · 6개')
})

test('시트 — 미완료 칸은 메모 + 하단 「미완료 N칸」', () => {
  const orders = [{ id: 1, vendor: '해남급식', recipient: '싱싱유통' }]
  const a = item({ orderId: 1, rawItemName: '찹쌀', orderedQty: 112, allocatedQty: 80 })
  const b = item({ orderId: 1, rawItemName: '혼합곡', orderedQty: 3, productTypeId: null })
  const sheet = buildExportSheet(input(orders, [a, b], [alloc({ itemId: a.id, count: 80 })]))
  assert.equal(sheet.incompleteCount, 2)
  assert.deepEqual(sheet.memos.map((m) => m.text), ['부분 — 차감 80 / 주문 112', '매칭실패 — 차감 0 / 주문 3'])
  assert.ok(sheet.rows.some((r) => r[0] === '미완료 2칸 — 칸 메모에 차감/주문 수량이 있습니다.'))
  assert.deepEqual(sheet.rows[sheet.rows.length - 1], ['내보낸 시각 2026-09-28 10:00'])
})

test('시트 — 재고부족은 매트릭스 판정(가용)을 따른다', () => {
  const orders = [{ id: 1, vendor: '이마트', recipient: '여주지점' }]
  const a = item({ orderId: 1, rawItemName: '가바백미', orderedQty: 10, productTypeId: 2 })
  const sheet = buildExportSheet(input(orders, [a], [], { 2: 3 }))
  assert.equal(sheet.memos[0].text, '재고부족 — 차감 0 / 주문 10')
})

test('시트 — 수령인이 전부 발주처와 같으면(시아스형) 이름 칸 하나 · 톤백은 자루중량', () => {
  const orders = [{ id: 1, vendor: '시아스', recipient: '시아스' }]
  const a = item({
    orderId: 1, rawItemName: '가바백미', packageType: '톤백', rawPackaging: '톤백',
    unitWeightKg: 1000, allocatedQty: 1,
  })
  const b = item({
    orderId: 1, rawItemName: '가바백미', packageType: '톤백', rawPackaging: '톤백',
    unitWeightKg: 200, allocatedQty: 1,
  })
  const sheet = buildExportSheet(input(orders, [a, b], [], undefined, [sku(1, '서농22호', '톤백', '톤백')]))
  assert.deepEqual(sheet.rows[2], ['규격', '1,000kg', '200kg'])
  assert.deepEqual(sheet.rows[6], ['시아스', 1, 1]) // 라벨 줄 없음
  // 같은 SKU 두 열(자루중량만 다름)은 1행 제목·포장지 줄 모두 병합
  assert.deepEqual(sheet.merges, [
    { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } },
  ])
})

test('워크시트 — 메모가 xlsx에 실리고 다시 읽힌다', () => {
  const orders = [{ id: 1, vendor: '해남급식', recipient: '싱싱유통' }]
  const a = item({ orderId: 1, rawItemName: '찹쌀', orderedQty: 5, allocatedQty: 2 })
  const ws = toWorksheet(buildExportSheet(input(orders, [a], [alloc({ itemId: a.id, count: 2 })])))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName('서울급식_260818'))
  const back = XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
  const cell = back.Sheets['서울급식_260818']['C8']
  assert.equal(cell.v, 5)
  assert.equal(cell.c?.[0].t, '부분 — 차감 2 / 주문 5')
})

// ------------------------------------------------------
// 표기
// ------------------------------------------------------

test('날짜 — KST 자정 저장값이 하루 밀리지 않는다(백로그 §39)', () => {
  // 2026-08-18 00:00 KST = 2026-08-17T15:00Z
  assert.equal(formatTitleDate(new Date('2026-08-17T15:00:00Z')), '26/08/18 (화)')
  assert.equal(formatKstDateTime(new Date('2026-09-28T05:03:00Z')), '2026-09-28 14:03')
})

test('시트명 — 금지 문자 치환 · 31자', () => {
  assert.equal(safeSheetName('택배/이마트:260818'), '택배_이마트_260818')
  assert.equal(safeSheetName('가'.repeat(40)).length, 31)
})
