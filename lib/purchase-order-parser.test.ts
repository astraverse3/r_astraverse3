import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import {
  parsePurchaseOrder,
  parseSpecCatalog,
  normalizeCell,
} from './purchase-order-parser'

// ------------------------------------------------------
// normalizeCell — CRLF/공백 정리 (§2.1)
// ------------------------------------------------------
test('normalizeCell: CRLF·다중공백을 단일 공백으로', () => {
  assert.equal(normalizeCell('유기농\r\n천지향5세'), '유기농 천지향5세')
  assert.equal(normalizeCell('자연\r\n주의'), '자연 주의')
  assert.equal(normalizeCell('  10kg  '), '10kg')
  assert.equal(normalizeCell(undefined), '')
  assert.equal(normalizeCell(null), '')
})

// ------------------------------------------------------
// 실파일 구조 — 시트 2개·channel 판별·빈 템플릿
// ------------------------------------------------------
test('실파일: 시트 2개 + channel 판별', () => {
  const buf = readFileSync('docs/resources/발주서.xlsx')
  const parsed = parsePurchaseOrder(buf, '발주서.xlsx')

  assert.equal(parsed.fileName, '발주서.xlsx')
  assert.equal(parsed.sheets.length, 2)

  const delivery = parsed.sheets.find((s) => s.channel === 'DELIVERY')
  const emart = parsed.sheets.find((s) => s.channel === 'EMART')
  assert.ok(delivery, '택배 시트 존재')
  assert.ok(emart, '이마트 시트 존재')
  assert.ok(emart!.sheetName.includes('이마트'))

  // 빈 템플릿이라 주문 데이터 없음
  assert.equal(delivery!.orders.length, 0)
  assert.equal(emart!.orders.length, 0)
})

test('실파일 규격 카탈로그: 택배 34열 / 이마트 7열', () => {
  const buf = readFileSync('docs/resources/발주서.xlsx')
  const cat = parseSpecCatalog(buf, '발주서.xlsx')

  const delivery = cat.sheets.find((s) => s.channel === 'DELIVERY')!
  const emart = cat.sheets.find((s) => s.channel === 'EMART')!
  assert.equal(delivery.specs.length, 34) // C~AJ
  assert.equal(emart.specs.length, 7) // C~I

  // 품목명 병합 펼침: 천지향5세 10kg 규격, 포장지 빈칸→null
  const cheonji = delivery.specs.find(
    (s) => s.rawItemName === '유기농 천지향5세' && s.packageType === '10kg',
  )
  assert.ok(cheonji, '천지향5세 10kg 규격 존재')
  assert.equal(cheonji!.rawPackaging, null)

  // 포장지 줄바꿈→공백 정규화 확인('자연\r\n주의' → '자연 주의')
  const withPkg = delivery.specs.find((s) => s.rawPackaging === '자연 주의')
  assert.ok(withPkg, '자연주의 포장지(공백 정규화) 규격 존재')

  // 도정 결합 품목(가바백미/가바현미) 존재
  assert.ok(delivery.specs.some((s) => s.rawItemName === '유기농 가바백미'))
  assert.ok(delivery.specs.some((s) => s.rawItemName === '유기농 가바현미'))
})

// ------------------------------------------------------
// 합성 워크북 — 병합 펼치기 + 수량 파싱 (빈 템플릿엔 데이터가 없어 별도 검증)
// ------------------------------------------------------
function buildSyntheticBuffer(): Buffer {
  const aoa = [
    ['날짜', '', '유기농\n가바백미', '', '유기농\n검정보리'], // r0 품목명(C0:D0 병합)
    ['농가명', '', '', '', ''], // r1
    ['포장지', '', '자연주의', '', 'PET'], // r2
    ['중량', '', '1kg', '4kg', '420g'], // r3
    ['택배 소계', '', 0, 0, 0], // r4
    ['(발주처)', '(수령인)', '', '', ''], // r5
    ['하나로', '홍길동', 2, 1, ''], // r6 데이터(가바백미 1kg×2, 4kg×1)
    ['', '', '', '', ''], // r7 빈 행
    ['이마트풍', '김철수', '', 0, 3], // r8 데이터(검정보리 420g×3)
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = [{ s: { r: 0, c: 2 }, e: { r: 0, c: 3 } }] // 가바백미 병합
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '발주서(택배)')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

test('합성: 병합 펼치기 + 수량 파싱 + 빈행/0 제외', () => {
  const buf = buildSyntheticBuffer()
  const parsed = parsePurchaseOrder(buf, 'synthetic.xlsx')

  assert.equal(parsed.sheets.length, 1)
  const sheet = parsed.sheets[0]
  assert.equal(sheet.channel, 'DELIVERY')
  assert.equal(sheet.orders.length, 2) // 하나로, 이마트풍 (빈 행 r7 제외)

  const o0 = sheet.orders[0]
  assert.equal(o0.vendor, '하나로')
  assert.equal(o0.recipient, '홍길동')
  assert.equal(o0.items.length, 2)

  // C열: 가바백미 1kg 자연주의 ×2
  assert.deepEqual(o0.items[0], {
    rawItemName: '유기농 가바백미',
    packageType: '1kg',
    rawPackaging: '자연주의',
    orderedQty: 2,
  })
  // D열: 병합으로 품목명 채워짐(가바백미), 포장지 빈칸→null, 4kg ×1
  assert.deepEqual(o0.items[1], {
    rawItemName: '유기농 가바백미',
    packageType: '4kg',
    rawPackaging: null,
    orderedQty: 1,
  })

  const o1 = sheet.orders[1]
  assert.equal(o1.vendor, '이마트풍')
  assert.equal(o1.items.length, 1) // 검정보리 420g ×3 (D열 0은 제외)
  assert.deepEqual(o1.items[0], {
    rawItemName: '유기농 검정보리',
    packageType: '420g',
    rawPackaging: 'PET',
    orderedQty: 3,
  })
})
