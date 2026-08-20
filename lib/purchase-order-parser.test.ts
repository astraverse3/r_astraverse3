import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import {
  parsePurchaseOrder,
  parseSpecCatalog,
  normalizeCell,
  normalizeLabel,
  normalizeSpec,
  parseTitleDate,
  stripEmptyParens,
  suggestChannel,
  suggestOrderDate,
  verifySubtotals,
  type ParsedSheet,
} from './purchase-order-parser'

const TEMPLATE = 'docs/resources/발주서-통일양식-템플릿.xlsx'
const LEGACY = 'docs/resources/2026.08.xlsx' // 구 양식 현장 실파일(농가명 행·포장지 라벨 없음)

function template() {
  return parsePurchaseOrder(readFileSync(TEMPLATE), '템플릿.xlsx')
}
function sheet(name: string): ParsedSheet {
  return template().sheets.find((s) => s.sheetName === name)!
}

// ------------------------------------------------------
// 문자열 정규화
// ------------------------------------------------------
test('normalizeCell: CRLF·다중공백을 단일 공백으로', () => {
  assert.equal(normalizeCell('유기농\r\n천지향5세'), '유기농 천지향5세')
  assert.equal(normalizeCell('  10kg  '), '10kg')
  assert.equal(normalizeCell(undefined), '')
  assert.equal(normalizeCell(null), '')
})

test('normalizeLabel: 괄호·공백 무관하게 라벨 인식 (#27)', () => {
  assert.equal(normalizeLabel('(발주처)'), '발주처')
  assert.equal(normalizeLabel('( 수령인 )'), '수령인')
  assert.equal(normalizeLabel('품목별 소계'), '품목별소계')
  assert.equal(normalizeLabel('포장지'), '포장지')
})

test('stripEmptyParens: 농가명 기입란 잔재인 빈 괄호 제거 (#27)', () => {
  assert.equal(
    stripEmptyParens('유기농\r\n백미\r\n천지향5세\r\n(         )'),
    '유기농 백미 천지향5세',
  )
  assert.equal(stripEmptyParens('유기농 가바백미'), '유기농 가바백미')
  // 내용 있는 괄호는 보존
  assert.equal(stripEmptyParens('노벨뉴트리션(지피코)'), '노벨뉴트리션(지피코)')
})

test('normalizeSpec: 공백·콤마 제거 + kg 환산 (#33)', () => {
  assert.deepEqual(normalizeSpec('1 kg'), { spec: '1kg', weightKg: 1 })
  assert.deepEqual(normalizeSpec('1,000kg'), { spec: '1000kg', weightKg: 1000 })
  assert.deepEqual(normalizeSpec('10kg'), { spec: '10kg', weightKg: 10 })
  assert.deepEqual(normalizeSpec('420g'), { spec: '420g', weightKg: 0.42 })
  assert.deepEqual(normalizeSpec('500 g'), { spec: '500g', weightKg: 0.5 })
  // 단위 없음 → weightKg=null (호출측이 경고)
  assert.deepEqual(normalizeSpec('1'), { spec: '1', weightKg: null })
  assert.deepEqual(normalizeSpec('톤백'), { spec: '톤백', weightKg: null })
})

// ------------------------------------------------------
// 채널·발주일 추측 (#31) — 확정이 아니라 화면 자동 채움 힌트
// ------------------------------------------------------
test('suggestChannel: 고정 prefix 4종 + 기업별 + 미판별', () => {
  assert.equal(suggestChannel('이마트_260819'), 'EMART')
  assert.equal(suggestChannel('택배_260818'), 'DELIVERY')
  assert.equal(suggestChannel('서울급식_060818'), 'MEAL_SEOUL')
  assert.equal(suggestChannel('해남급식_260821'), 'MEAL_HAENAM')
  assert.equal(suggestChannel('시아스_260811'), 'CORPORATE')
  assert.equal(suggestChannel('노벨_뉴트리션_260618'), 'CORPORATE')
  // 시트명 규칙은 필수가 아니다 → 못 뽑으면 null(화면에서 지정)
  assert.equal(suggestChannel('공장동08.21'), null)
  assert.equal(suggestChannel('작성안내'), null)
})

test('parseTitleDate: 1행 제목에서 날짜 추출', () => {
  assert.equal(parseTitleDate('26/08/19(수) 옥천농협 배송').iso, '2026-08-19')
  assert.equal(parseTitleDate('26/08/18 (화) 서울급식').iso, '2026-08-18')
  // 연도 없는 제목은 월·일만
  assert.deepEqual(parseTitleDate('8/11(화) 오후상차'), {
    iso: null,
    month: 8,
    day: 11,
  })
  assert.deepEqual(parseTitleDate('제목 없음'), {
    iso: null,
    month: null,
    day: null,
  })
})

test('suggestOrderDate: 시트명 YYMMDD 우선 + 제목 불일치 경고 (#31)', () => {
  assert.deepEqual(suggestOrderDate('이마트_260819', '26/08/19(수)'), {
    date: '2026-08-19',
    warning: null,
  })
  // 실제 템플릿에 있던 오타 — 시트명은 2006년, 제목은 2026년
  const typo = suggestOrderDate('서울급식_060818', '26/08/18 (화) 서울급식')
  assert.equal(typo.date, '2006-08-18')
  assert.match(typo.warning!, /시트명 날짜.*제목 날짜/)
  // 존재하지 않는 날짜(2/31)는 시트명에서 못 뽑고 제목으로 넘어간다
  assert.equal(suggestOrderDate('택배_260231', '26/02/20 (금)').date, '2026-02-20')
})

test('suggestOrderDate: MM.DD 시트명은 제목에서 연도를 빌린다 (#31)', () => {
  assert.deepEqual(suggestOrderDate('공장동08.21', '26/08/21 (금) 해남군공공급식'), {
    date: '2026-08-21',
    warning: null,
  })
  // 연도를 어디서도 못 얻으면 null → 화면에서 지정
  assert.equal(suggestOrderDate('공장동08.21', '8/21(금)').date, null)
})

// ------------------------------------------------------
// 소계 검증 (#29) — 순수함수
// ------------------------------------------------------
test('verifySubtotals: 소계 셀과 데이터 합계 대조', () => {
  assert.deepEqual(
    verifySubtotals([
      { label: 'C열 백미 10kg', subtotal: 74, sum: 74 },
      { label: 'D열 찹쌀 1kg', subtotal: null, sum: 12 }, // 소계 없는 열은 통과
    ]),
    [],
  )
  const warn = verifySubtotals([
    { label: 'C열 백미 10kg', subtotal: 27, sum: 77 },
  ])
  assert.equal(warn.length, 1)
  assert.match(warn[0], /소계 불일치.*27.*77/)
})

// ------------------------------------------------------
// 실파일(새 통일양식 템플릿) — 5시트 전부 인식
// ------------------------------------------------------
test('실파일: 5시트 전부 인식 + 미인식 시트 없음', () => {
  const parsed = template()
  assert.deepEqual(
    parsed.sheets.map((s) => s.sheetName),
    ['이마트_260819', '택배_260818', '서울급식_060818', '해남급식_260821', '시아스_260811'],
  )
  assert.deepEqual(parsed.skipped, [])
})

test('실파일 이마트: 발주처 고정 + 하단 박스 환산표는 읽지 않음', () => {
  const emart = sheet('이마트_260819')
  assert.equal(emart.suggestedChannel, 'EMART')
  assert.equal(emart.suggestedOrderDate, '2026-08-19')
  assert.deepEqual(
    emart.orders.map((o) => o.recipient),
    ['여주지점', '대구지점', '시화지점'],
  )
  assert.ok(emart.orders.every((o) => o.vendor === '이마트'))
  // 데이터 아래 별도 표(박스 환산)를 발주로 오인하지 않는다 — 조용히 넘기지도 않는다
  assert.ok(emart.warnings.some((w) => /별도 표/.test(w)))

  assert.deepEqual(emart.orders[0].items, [
    { rawItemName: '유기농 가바백미', packageType: '1kg', rawPackaging: '자연주의', orderedQty: 112, unitWeightKg: null },
    { rawItemName: '유기농 천지향', packageType: '4kg', rawPackaging: '자연주의', orderedQty: 24, unitWeightKg: null },
    { rawItemName: '유기농 귀리쌀', packageType: '420g', rawPackaging: 'PET', orderedQty: 20, unitWeightKg: null },
  ])
})

test('실파일 택배: 중간 빈 행 뒤 발주도 끝까지 읽는다', () => {
  const delivery = sheet('택배_260818')
  assert.equal(delivery.suggestedChannel, 'DELIVERY')
  assert.equal(delivery.orders.length, 67)
  // 빈 행 2줄(72·73행) 뒤에 이어지는 마지막 발주 — 빈 행을 종료 신호로 쓰면 잘린다
  const last = delivery.orders[delivery.orders.length - 1]
  assert.equal(last.vendor, '해남로컬푸드')
  assert.equal(last.recipient, '해남로컬푸드') // 수령인 = 발주처
  assert.equal(last.items.length, 3)
  // 소계와 데이터 합계가 열 단위로 일치 → 경고 없음
  assert.deepEqual(delivery.warnings, [])
})

test('실파일 서울급식: 서식에 든 단위(1 kg) 정규화 + 시트명 오타 경고 (#33·#31)', () => {
  const seoul = sheet('서울급식_060818')
  // 중량 셀 원시값은 숫자 1, 서식이 `0\ "kg"` → cell.w로 읽어야 단위가 산다
  const specs = [...new Set(seoul.orders.flatMap((o) => o.items).map((i) => i.packageType))]
  assert.deepEqual(specs.sort(), ['10kg', '1kg', '500g', '5kg'])
  assert.ok(seoul.warnings.every((w) => !/단위\(kg·g\)가 없습니다/.test(w)))

  assert.equal(seoul.suggestedOrderDate, '2006-08-18')
  assert.ok(seoul.warnings.some((w) => /시트명 날짜/.test(w)))

  assert.ok(seoul.orders.every((o) => o.recipient === '행복플러스'))
  assert.deepEqual(
    seoul.orders.map((o) => o.vendor),
    ['은평구', '서대문구', '여유'],
  )
})

test('실파일 해남급식: 소계 행 + 수량 0인 수령처는 발주 없음', () => {
  const haenam = sheet('해남급식_260821')
  assert.equal(haenam.suggestedChannel, 'MEAL_HAENAM')
  // 땅끝농협·참솔은 전 규격 0 → 발주 라인이 없어 제외
  assert.deepEqual(
    haenam.orders.map((o) => o.recipient),
    ['싱싱유통', '급식센터'],
  )
  assert.deepEqual(haenam.orders[0].items[0], {
    rawItemName: '유기농 백미 천지향5세',
    packageType: '10kg',
    rawPackaging: null,
    orderedQty: 66,
    unitWeightKg: null,
  })
  assert.deepEqual(haenam.warnings, [])
})

test('실파일 시아스: 라벨 행 없는 구조 + 톤백 분리 (#32·#34)', () => {
  const sias = sheet('시아스_260811')
  assert.equal(sias.suggestedChannel, 'CORPORATE')
  assert.equal(sias.suggestedOrderDate, '2026-08-11')

  // 라벨 행이 없어 규격이 B열부터 시작하고, 수령인은 발주처를 복사한다
  assert.equal(sias.orders.length, 1)
  assert.equal(sias.orders[0].vendor, '시아스')
  assert.equal(sias.orders[0].recipient, '시아스')

  // 톤백: 규격은 '톤백'으로 치환, 발주 중량은 unitWeightKg로 분리
  assert.deepEqual(sias.orders[0].items, [
    { rawItemName: '유기농 가바백미', packageType: '톤백', rawPackaging: '톤백', orderedQty: 1, unitWeightKg: 1000 },
    { rawItemName: '유기농 가바백미', packageType: '톤백', rawPackaging: '톤백', orderedQty: 1, unitWeightKg: 200 },
    { rawItemName: '유기농 가바현미', packageType: '톤백', rawPackaging: '톤백', orderedQty: 1, unitWeightKg: 1000 },
    { rawItemName: '유기농 가바현미', packageType: '톤백', rawPackaging: '톤백', orderedQty: 1, unitWeightKg: 200 },
  ])
  assert.deepEqual(sias.warnings, [])
})

test('실파일 규격 카탈로그: 주문 없는 규격 열도 수집', () => {
  const cat = parseSpecCatalog(readFileSync(TEMPLATE), '템플릿.xlsx')
  assert.equal(cat.sheets.length, 5)

  const emart = cat.sheets.find((s) => s.sheetName === '이마트_260819')!
  assert.equal(emart.specs.length, 6) // C~H열 — 주문 0인 4kg·오분도미 포함
  assert.ok(
    emart.specs.some(
      (s) => s.rawItemName === '유기농 귀리쌀' && s.packageType === '420g' && s.rawPackaging === 'PET',
    ),
  )

  const sias = cat.sheets.find((s) => s.sheetName === '시아스_260811')!
  assert.equal(sias.specs.length, 4) // B~E열
  assert.ok(sias.specs.every((s) => s.packageType === '톤백'))
})

// ------------------------------------------------------
// 구 양식 실파일 — 발주서가 아니므로 전부 미인식 (#31)
// ------------------------------------------------------
test('구 양식 실파일: 포장지 라벨이 없어 전 시트 미인식', () => {
  const parsed = parsePurchaseOrder(readFileSync(LEGACY), '2026.08.xlsx')
  assert.equal(parsed.sheets.length, 0)
  assert.equal(parsed.skipped.length, 20)
  assert.ok(parsed.skipped.every((s) => /발주서 양식이 아닙니다/.test(s.reason)))
})

// ------------------------------------------------------
// 합성 워크북 — 병합 펼치기 · 음수 · 빈 괄호 · 구 템플릿 하위호환
// ------------------------------------------------------
type Aoa = (string | number)[][]

function buildBuffer(aoa: Aoa, merges: XLSX.Range[] = []): Buffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = merges
  XLSX.utils.book_append_sheet(wb, ws, '택배_260619')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

const ITEM_MERGE: XLSX.Range[] = [{ s: { r: 0, c: 2 }, e: { r: 0, c: 3 } }]

/** #27 통일 양식(소계 + 괄호 라벨) */
const STANDARD: Aoa = [
  ['26/06/19 (금)', '', '유기농\n가바백미', '', '유기농\n검정보리'],
  ['포장지', '', '자연주의', '', 'PET'],
  ['중량', '', '1kg', '4kg', '420g'],
  ['소계', '', 2, 1, 3],
  ['(발주처)', '(수령인)', '', '', ''],
  ['하나로', '홍길동', 2, 1, ''],
  ['', '', '', '', ''],
  ['대구2', '', '', 0, 3],
]

test('합성: 병합 펼치기 + 괄호 라벨 + 수령인 복사 + 0/빈행 제외 (#27)', () => {
  const parsed = parsePurchaseOrder(buildBuffer(STANDARD, ITEM_MERGE), 'synthetic.xlsx')
  assert.equal(parsed.sheets.length, 1)
  const s = parsed.sheets[0]
  assert.equal(s.suggestedChannel, 'DELIVERY')
  assert.equal(s.suggestedOrderDate, '2026-06-19')
  assert.equal(s.orders.length, 2) // 빈 행 제외

  assert.deepEqual(s.orders[0].items, [
    { rawItemName: '유기농 가바백미', packageType: '1kg', rawPackaging: '자연주의', orderedQty: 2, unitWeightKg: null },
    { rawItemName: '유기농 가바백미', packageType: '4kg', rawPackaging: null, orderedQty: 1, unitWeightKg: null },
  ])
  assert.equal(s.orders[1].recipient, '대구2') // 수령인 빈칸 → 발주처 복사
  assert.deepEqual(s.orders[1].items, [
    { rawItemName: '유기농 검정보리', packageType: '420g', rawPackaging: 'PET', orderedQty: 3, unitWeightKg: null },
  ])
  assert.deepEqual(s.warnings, []) // 소계 일치
})

test('합성: 음수 조정 행은 제외하고 경고 + 소계 불일치 노출 (#28·#29)', () => {
  const aoa: Aoa = [
    ['26/06/19 (금)', '', '유기농\n백미\n천지향5세\n(      )'],
    ['포장지', '', ''],
    ['중량', '', '10kg'],
    ['품목별 소계', '', 27],
    ['(발주처)', '(수령인)', ''],
    ['해남급식', '싱싱유통', 62],
    ['해남급식', '급식센터', 15],
    ['해남고등학교', '보관요청', -50],
  ]
  const s = parsePurchaseOrder(buildBuffer(aoa), 'synthetic.xlsx').sheets[0]

  // 음수 라인은 담지 않는다 → 보관요청 행은 라인이 0개라 발주 자체가 빠진다
  assert.deepEqual(
    s.orders.map((o) => o.recipient),
    ['싱싱유통', '급식센터'],
  )
  assert.ok(s.warnings.some((w) => /음수/.test(w) && /보관요청/.test(w)))
  // 소계 27은 음수를 반영한 값 → 합계 77과 어긋나므로 경고로 드러난다
  assert.ok(s.warnings.some((w) => /소계 불일치/.test(w) && /77/.test(w)))

  // 품목명 빈 괄호 제거(#27)
  assert.equal(s.orders[0].items[0].rawItemName, '유기농 백미 천지향5세')
})

test('합성: 소계 행 없는 구 템플릿도 그대로 통과 (하위호환)', () => {
  const aoa: Aoa = [
    ['26/06/19 (금)', '', '유기농\n가바백미'],
    ['포장지', '', '자연주의'],
    ['중량', '', '1kg'],
    ['발주처', '수령인', ''], // 괄호 없는 구 라벨
    ['고양1', '', 48],
  ]
  const s = parsePurchaseOrder(buildBuffer(aoa), 'synthetic.xlsx').sheets[0]
  assert.equal(s.orders.length, 1)
  assert.equal(s.orders[0].vendor, '고양1')
  assert.equal(s.orders[0].recipient, '고양1')
  assert.equal(s.orders[0].items[0].orderedQty, 48)
  assert.deepEqual(s.warnings, []) // 소계가 없으면 검증도 없다
})

test('합성: 규격에 단위가 없으면 경고 (#33)', () => {
  const aoa: Aoa = [
    ['26/06/19 (금)', '', '유기농\n가바백미'],
    ['포장지', '', '자연주의'],
    ['중량', '', '1'], // 단위 누락
    ['(발주처)', '(수령인)', ''],
    ['고양1', '', 4],
  ]
  const s = parsePurchaseOrder(buildBuffer(aoa), 'synthetic.xlsx').sheets[0]
  assert.equal(s.orders[0].items[0].packageType, '1')
  assert.ok(s.warnings.some((w) => /단위\(kg·g\)가 없습니다/.test(w)))
})

test('합성: 발주서 양식이 아니면 미인식 시트로 분류', () => {
  const aoa: Aoa = [
    ['26/06/19 (금)', '', '유기농\n가바백미'],
    ['농가명', '', ''], // 구 양식 잔재 — 포장지 라벨 없음
    ['중량', '', '1kg'],
    ['고양1', '', 48],
  ]
  const parsed = parsePurchaseOrder(buildBuffer(aoa), 'synthetic.xlsx')
  assert.equal(parsed.sheets.length, 0)
  assert.match(parsed.skipped[0].reason, /발주서 양식이 아닙니다/)
})
