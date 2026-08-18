import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import {
  parsePurchaseOrder,
  parseSpecCatalog,
  parseSheetName,
  normalizeCell,
} from './purchase-order-parser'

const TEMPLATE = 'docs/resources/발주서-통일양식-템플릿.xlsx'

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
// 시트명 해석 — 채널_YYMMDD (#26)
// ------------------------------------------------------
test('parseSheetName: 고정 prefix 4종', () => {
  assert.deepEqual(parseSheetName('이마트_260619'), {
    channel: 'EMART',
    orderDate: '2026-06-19',
    label: '이마트',
  })
  assert.equal(parseSheetName('택배_260619')!.channel, 'DELIVERY')
  assert.equal(parseSheetName('서울급식_260616')!.channel, 'MEAL_SEOUL')
  assert.equal(parseSheetName('해남급식_260619')!.channel, 'MEAL_HAENAM')
})

test('parseSheetName: 그 외 시트명 = 기업별', () => {
  const noel = parseSheetName('노벨_260618')!
  assert.equal(noel.channel, 'CORPORATE')
  assert.equal(noel.label, '노벨')
  assert.equal(parseSheetName('광천김_260618')!.channel, 'CORPORATE')
  // 거래처명에 밑줄이 있어도 끝 6자리를 날짜로
  const underscore = parseSheetName('노벨_뉴트리션_260618')!
  assert.equal(underscore.label, '노벨_뉴트리션')
  assert.equal(underscore.orderDate, '2026-06-18')
})

test('parseSheetName: 미인식 시트 = null', () => {
  assert.equal(parseSheetName('작성안내'), null)
  assert.equal(parseSheetName('택배'), null) // 날짜 없음
  assert.equal(parseSheetName('_260619'), null) // prefix 없음
})

test('parseSheetName: 존재하지 않는 날짜는 orderDate=null (채널은 유지)', () => {
  const s = parseSheetName('택배_260231')! // 2/31
  assert.equal(s.channel, 'DELIVERY')
  assert.equal(s.orderDate, null)
})

// ------------------------------------------------------
// 실파일(통일양식 템플릿) — 채널 5종 · 미인식 시트 · 대표 발주일
// ------------------------------------------------------
test('실파일: 8개 채널 시트 파싱 + 작성안내는 skip', () => {
  const parsed = parsePurchaseOrder(readFileSync(TEMPLATE), '템플릿.xlsx')

  assert.equal(parsed.sheets.length, 8)
  assert.deepEqual(
    parsed.skipped.map((s) => s.sheetName),
    ['작성안내'],
  )
  assert.match(parsed.skipped[0].reason, /채널_YYMMDD/)
})

test('실파일: 채널 5종 판별 + 혼합 파일은 대표 채널 null', () => {
  const parsed = parsePurchaseOrder(readFileSync(TEMPLATE), '템플릿.xlsx')
  const byName = (n: string) => parsed.sheets.find((s) => s.sheetName === n)!

  assert.equal(byName('이마트_260619').channel, 'EMART')
  assert.equal(byName('택배_260619').channel, 'DELIVERY')
  assert.equal(byName('서울급식_260616').channel, 'MEAL_SEOUL')
  assert.equal(byName('해남급식_260619').channel, 'MEAL_HAENAM')
  assert.equal(byName('노벨_260618').channel, 'CORPORATE')
  assert.equal(byName('광천김_260618').channel, 'CORPORATE')

  // 템플릿은 채널별 예시가 한 파일에 모인 참고용 → 대표 채널 없음(업로드는 호출측이 거부)
  assert.equal(parsed.channel, null)
  assert.equal(parsed.channels.length, 5)
  // 대표 발주일 = 가장 이른 시트 날짜(미국수출_260515)
  assert.equal(parsed.orderDate, '2026-05-15')
})

test('실파일 이마트: 발주처 고정 + 수령인 물류센터 3건', () => {
  const parsed = parsePurchaseOrder(readFileSync(TEMPLATE), '템플릿.xlsx')
  const emart = parsed.sheets.find((s) => s.channel === 'EMART')!

  assert.equal(emart.orderDate, '2026-06-19')
  assert.deepEqual(
    emart.orders.map((o) => o.recipient),
    ['여주', '대구', '시화'],
  )
  assert.ok(emart.orders.every((o) => o.vendor === '이마트'))

  const yeoju = emart.orders[0]
  assert.deepEqual(yeoju.items, [
    { rawItemName: '유기농 가바백미', packageType: '4kg', rawPackaging: '자연주의', orderedQty: 4 },
    { rawItemName: '유기농 가바백미', packageType: '1kg', rawPackaging: '자연주의', orderedQty: 48 },
    { rawItemName: '유기농 천지향', packageType: '8kg', rawPackaging: '자연주의', orderedQty: 12 },
  ])
})

test('실파일 택배: 수령인 빈칸 → 발주처 복사 (#26)', () => {
  const parsed = parsePurchaseOrder(readFileSync(TEMPLATE), '템플릿.xlsx')
  const delivery = parsed.sheets.find((s) => s.channel === 'DELIVERY')!

  assert.equal(delivery.orders.length, 2)
  const goyang = delivery.orders[0]
  assert.equal(goyang.vendor, '고양1')
  assert.equal(goyang.recipient, '고양1') // 엑셀 B열은 빈칸
  assert.deepEqual(goyang.items, [
    { rawItemName: '유기농 가바백미', packageType: '1kg', rawPackaging: null, orderedQty: 48 },
  ])

  const daegu = delivery.orders[1]
  assert.equal(daegu.items.length, 2) // 가바백미 1kg ×16, 가바흑미 800g ×32
})

test('실파일 급식·기업별: 규격 다열 / 단일 셀', () => {
  const parsed = parsePurchaseOrder(readFileSync(TEMPLATE), '템플릿.xlsx')

  // 서울급식 — 발주처=구청, 수령인=행복플러스
  const seoul = parsed.sheets.find((s) => s.channel === 'MEAL_SEOUL')!
  assert.deepEqual(
    seoul.orders.map((o) => o.vendor),
    ['은평구', '서대문구', '여유'],
  )
  assert.ok(seoul.orders.every((o) => o.recipient === '행복플러스'))
  assert.equal(seoul.orders[0].items.length, 17) // 은평구: 주문 있는 규격만

  // 해남급식 — 발주처 고정, 수령인=배송업체
  const haenam = parsed.sheets.find((s) => s.channel === 'MEAL_HAENAM')!
  assert.ok(haenam.orders.every((o) => o.vendor === '해남급식'))
  assert.deepEqual(
    haenam.orders.map((o) => o.recipient),
    ['싱싱유통', '급식센터'],
  )

  // 기업별 — 1행 1규격, 수령인 빈칸→발주처
  const noel = parsed.sheets.find((s) => s.sheetName === '노벨_260618')!
  assert.equal(noel.orders.length, 1)
  assert.equal(noel.orders[0].vendor, '노벨뉴트리션(지피코)')
  assert.equal(noel.orders[0].recipient, '노벨뉴트리션(지피코)')
  assert.deepEqual(noel.orders[0].items, [
    { rawItemName: '유기농 하이아미', packageType: '20kg', rawPackaging: null, orderedQty: 25 },
  ])
})

test('실파일 규격 카탈로그: 주문 없는 규격 열도 수집', () => {
  const cat = parseSpecCatalog(readFileSync(TEMPLATE), '템플릿.xlsx')

  const emart = cat.sheets.find((s) => s.channel === 'EMART')!
  assert.equal(emart.specs.length, 5) // C~G열
  assert.ok(
    emart.specs.some(
      (s) => s.rawItemName === '유기농 귀리쌀' && s.packageType === '420g' && s.rawPackaging === 'PET',
    ),
  )

  const seoul = cat.sheets.find((s) => s.channel === 'MEAL_SEOUL')!
  assert.equal(seoul.specs.length, 19) // C~U열
  assert.ok(seoul.specs.every((s) => s.rawPackaging === null)) // 급식은 포장지 빈칸
})

// ------------------------------------------------------
// 합성 워크북 — 병합 펼치기 · 수량 파싱 · 단일 채널 파일
// ------------------------------------------------------
function buildSyntheticBuffer(sheetNames: string[]): Buffer {
  const wb = XLSX.utils.book_new()
  for (const name of sheetNames) {
    const aoa = [
      ['26/06/19 (금)', '', '유기농\n가바백미', '', '유기농\n검정보리'], // r0 품종+도정(C0:D0 병합)
      ['포장지', '', '자연주의', '', 'PET'], // r1
      ['중량', '', '1kg', '4kg', '420g'], // r2
      ['발주처', '수령인', '', '', ''], // r3 라벨행
      ['하나로', '홍길동', 2, 1, ''], // r4 데이터
      ['', '', '', '', ''], // r5 빈 행
      ['대구2', '', '', 0, 3], // r6 수령인 빈칸 + 0 제외
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!merges'] = [{ s: { r: 0, c: 2 }, e: { r: 0, c: 3 } }] // 가바백미 병합
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

test('합성: 병합 펼치기 + 수량 파싱 + 빈행/0 제외', () => {
  const parsed = parsePurchaseOrder(buildSyntheticBuffer(['택배_260619']), 'synthetic.xlsx')

  assert.equal(parsed.sheets.length, 1)
  const sheet = parsed.sheets[0]
  assert.equal(sheet.channel, 'DELIVERY')
  assert.equal(sheet.orders.length, 2) // 하나로, 대구2 (빈 행 제외)

  const o0 = sheet.orders[0]
  assert.equal(o0.vendor, '하나로')
  assert.equal(o0.recipient, '홍길동')
  // C열: 가바백미 1kg 자연주의 ×2 / D열: 병합으로 품목명 채워짐, 포장지 빈칸→null
  assert.deepEqual(o0.items, [
    { rawItemName: '유기농 가바백미', packageType: '1kg', rawPackaging: '자연주의', orderedQty: 2 },
    { rawItemName: '유기농 가바백미', packageType: '4kg', rawPackaging: null, orderedQty: 1 },
  ])

  const o1 = sheet.orders[1]
  assert.equal(o1.recipient, '대구2') // 빈칸→발주처 복사
  assert.deepEqual(o1.items, [
    { rawItemName: '유기농 검정보리', packageType: '420g', rawPackaging: 'PET', orderedQty: 3 },
  ])
})

test('합성: 같은 채널 시트 여러 장 = 단일 채널 파일', () => {
  const parsed = parsePurchaseOrder(
    buildSyntheticBuffer(['택배_260619', '택배_260620']),
    'synthetic.xlsx',
  )
  assert.equal(parsed.channel, 'DELIVERY')
  assert.deepEqual(parsed.channels, ['DELIVERY'])
  assert.equal(parsed.orderDate, '2026-06-19') // 가장 이른 날짜
  assert.equal(parsed.sheets.length, 2)
})

test('합성: 채널이 섞이면 대표 채널 null (호출측이 거부)', () => {
  const parsed = parsePurchaseOrder(
    buildSyntheticBuffer(['택배_260619', '이마트_260619']),
    'synthetic.xlsx',
  )
  assert.equal(parsed.channel, null)
  assert.deepEqual(parsed.channels.sort(), ['DELIVERY', 'EMART'])
})
