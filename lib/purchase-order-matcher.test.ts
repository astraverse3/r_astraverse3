import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  matchPurchaseOrderItem,
  normalizeItemName,
  type MatchResult,
  type MatcherVariety,
  type MatcherProductType,
} from './purchase-order-matcher'

/** 매칭 성공을 단언하고 productTypeId를 반환(타입 좁히기). */
function matchedId(r: MatchResult): number {
  assert.equal(r.matched, true)
  if (!r.matched) throw new Error('unreachable')
  return r.productTypeId
}

// ------------------------------------------------------
// 픽스처 — DB 마스터 스냅샷(2026-06-23 dump 기반, §6.1.1 매칭에 필요한 품종/SKU만)
// 순수 단위테스트라 DB 무관·결정적. 시드 변경 시 함께 갱신.
// ------------------------------------------------------
const V = (
  id: number,
  name: string,
  category: string,
  aliases: string[] = [],
): MatcherVariety => ({ id, name, category, aliases })

const varieties: MatcherVariety[] = [
  V(16, '천지향5세', 'RICE'),
  V(12, '백옥찰', 'RICE', ['찹쌀']),
  V(15, '천지향1세', 'RICE', ['천지향']),
  V(17, '하이아미', 'RICE'),
  V(14, '서농22호', 'RICE', ['가바']),
  V(47, '발아현미', 'MISC_GRAIN', ['가바발아현미']),
  V(18, '흑미', 'MISC_GRAIN', ['가바흑미']),
  V(32, '검정보리', 'MISC_GRAIN'),
  V(38, '귀리', 'MISC_GRAIN'),
  V(46, '찰보리', 'MISC_GRAIN'),
  V(35, '기장', 'MISC_GRAIN'),
  V(36, '차조', 'MISC_GRAIN'),
  V(34, '수수', 'MISC_GRAIN'),
  V(43, '팥', 'MISC_GRAIN'),
  V(7, 'IPS', 'RICE'),
  V(6, 'CJ6', 'RICE'),
  V(20, '서농24호', 'RICE'), // 함정: 흑미 계통이나 별개 품종, alias 없음(가바흑미와 무관 §6.2)
]

const PT = (
  id: number,
  varietyId: number,
  millingType: string,
  packageType: string,
  packagingName: string,
  packagingId: number,
  isDefault = false,
  active = true,
): MatcherProductType => ({
  id,
  varietyId,
  millingType,
  packageType,
  packagingId,
  packagingName,
  isDefault,
  active,
})

const productTypes: MatcherProductType[] = [
  PT(22, 14, '백미', '1kg', '자연주의', 5, true),
  PT(23, 14, '백미', '1kg', '땅끝미가', 2, false),
  PT(19, 14, '백미', '4kg', '자연주의', 5, true),
  PT(21, 14, '백미', '3kg', '땅끝미가', 2, true),
  PT(27, 14, '현미', '1kg', '자연주의', 5, true),
  PT(58, 14, '현미', '800g', 'PET', 10, true),
  PT(38, 16, '백미', '10kg', '천지향', 6, true),
  PT(40, 16, '칠분도미', '10kg', '땅끝에서보냅니다', 3, true), // 함정: 칠분도미(오분도미 아님)
  PT(59, 32, '기타', '1kg', '땅끝에서보냅니다', 3, true),
  PT(63, 18, '기타', '1kg', '땅끝에서보냅니다', 3, true),
  PT(5, 12, '백미', '1kg', '땅끝에서보냅니다', 3, true),
]

const m = (rawItemName: string, packageType: string, rawPackaging: string | null) =>
  matchPurchaseOrderItem({ rawItemName, packageType, rawPackaging }, varieties, productTypes)

// ------------------------------------------------------
// ① 정규화 단위 — 접두 제거 + 도정 접미 분리 (#23·#24)
// ------------------------------------------------------
test('정규화: 인증/브랜드 접두 제거 + 도정유형 접미 분리', () => {
  assert.deepEqual(normalizeItemName('유기농 가바백미'), {
    varietyToken: '가바',
    millingType: '백미',
  })
  assert.deepEqual(normalizeItemName('유기농 가바현미'), {
    varietyToken: '가바',
    millingType: '현미',
  })
  assert.deepEqual(normalizeItemName('프로틴 라이스 IPS'), {
    varietyToken: 'IPS',
    millingType: null,
  })
  assert.deepEqual(normalizeItemName('자스민 라이스 CJ6'), {
    varietyToken: 'CJ6',
    millingType: null,
  })
  assert.deepEqual(normalizeItemName('유기농 천지향5세 오분도미'), {
    varietyToken: '천지향5세',
    millingType: '오분도미',
  })
})

test('정규화: 위탁가공 별도품종(흑미·발아현미)은 도정 접미로 분리 안 함 (#1·#24)', () => {
  assert.deepEqual(normalizeItemName('유기농 가바흑미'), {
    varietyToken: '가바흑미',
    millingType: null,
  })
  // 원본 '유기농\n가바\n발아현미' → 정규화 시 공백이 토큰 사이에 남음
  assert.deepEqual(normalizeItemName('유기농 가바 발아현미'), {
    varietyToken: '가바 발아현미',
    millingType: null,
  })
})

// ------------------------------------------------------
// ② 품종 해석 — 실파일 18종 전수 (§6.1.1 기대표 대조)
// ------------------------------------------------------
const expectedVariety: Record<string, string> = {
  '유기농 천지향5세': '천지향5세',
  '유기농 찹쌀': '백옥찰',
  '유기농 천지향': '천지향1세',
  '유기농 하이아미': '하이아미',
  '유기농 가바백미': '서농22호',
  '유기농 가바 발아현미': '발아현미',
  '유기농 가바현미': '서농22호',
  '유기농 가바흑미': '흑미',
  '유기농 검정보리': '검정보리',
  '유기농 귀리': '귀리',
  '유기농 찰보리': '찰보리',
  '유기농 기장': '기장',
  '유기농 차조': '차조',
  '유기농 수수': '수수',
  '유기농 팥': '팥',
  '프로틴 라이스 IPS': 'IPS',
  '자스민 라이스 CJ6': 'CJ6',
  '유기농 천지향5세 오분도미': '천지향5세',
}

// 실사용 품목명 18종 전수 대조. 품목 목록은 기대표 자체(파일 파싱과 분리 — 파서 양식이
// 바뀌어도 매처 회귀를 계속 잡는다). 통일양식 신규 품목 매칭은 실업로드로 검증(단계6 D1).
test('품종 해석: 실사용 품목명 18종 전수 매칭 (정규화+별칭)', () => {
  const nameById = new Map(varieties.map((v) => [v.id, v.name]))
  const items = Object.keys(expectedVariety)
  assert.equal(items.length, 18, `distinct 품목 18종 기대, 실제 ${items.length}`)

  for (const rawItemName of items) {
    const r = m(rawItemName, '1kg', null)
    assert.notEqual(r.varietyId, null, `품종 해석 실패: "${rawItemName}"`)
    const got = nameById.get(r.varietyId!)
    assert.equal(
      got,
      expectedVariety[rawItemName],
      `"${rawItemName}" → ${got} (기대 ${expectedVariety[rawItemName]})`,
    )
  }
})

// ------------------------------------------------------
// ④ SKU 해석 — 포장지 일치/빈칸 기본/실패 사유
// ------------------------------------------------------
test('SKU: 포장지 지정 일치 (공백/줄바꿈 흡수)', () => {
  assert.equal(matchedId(m('유기농 가바백미', '1kg', '자연주의')), 22)
})

test('SKU: 포장지 빈칸 → 기본 SKU 적용 (#21)', () => {
  assert.equal(matchedId(m('유기농 가바백미', '1kg', null)), 22)
  assert.equal(matchedId(m('유기농 천지향5세', '10kg', null)), 38)
  assert.equal(matchedId(m('유기농 찹쌀', '1kg', null)), 5)
  assert.equal(matchedId(m('유기농 검정보리', '1kg', null)), 59)
  assert.equal(matchedId(m('유기농 가바흑미', '1kg', null)), 63)
})

test('SKU: 도정 미분리 시 category 디폴트 (RICE→백미 / MISC→기타)', () => {
  // 가바현미 800g 빈칸 → 서농22호 현미 800g PET 기본(#58)
  assert.equal(matchedId(m('유기농 가바현미', '800g', null)), 58)
  // 가바백미 4kg 자연주의 → #19
  assert.equal(matchedId(m('유기농 가바백미', '4kg', '자연주의')), 19)
})

test('SKU 실패: 카탈로그에 없는 규격은 sku_unresolved (재고 차감 대상 아님)', () => {
  // 흑미 800g SKU 없음(1kg만 존재)
  const r1 = m('유기농 가바흑미', '800g', null)
  assert.equal(r1.matched, false)
  assert.equal(!r1.matched && r1.reason, 'sku_unresolved')
  assert.equal(!r1.matched && r1.varietyId, 18) // 품종은 해석됨

  // 천지향5세 오분도미 10kg → 칠분도미만 있고 오분도미 없음
  const r2 = m('유기농 천지향5세 오분도미', '10kg', null)
  assert.equal(r2.matched, false)
  assert.equal(!r2.matched && r2.reason, 'sku_unresolved')
  assert.equal(!r2.matched && r2.millingType, '오분도미')
})

test('SKU 실패: 지정 포장지에 해당 SKU 없으면 packaging_unresolved', () => {
  const r = m('유기농 가바백미', '1kg', 'PET') // 1kg는 자연주의/땅끝미가만
  assert.equal(r.matched, false)
  assert.equal(!r.matched && r.reason, 'packaging_unresolved')
})

test('품종 실패: 미지의 품목은 variety_unresolved + 학습용 토큰 보존', () => {
  const r = m('유기농 도깨비쌀', '1kg', null)
  assert.equal(r.matched, false)
  assert.equal(!r.matched && r.reason, 'variety_unresolved')
  assert.equal(!r.matched && r.varietyToken, '도깨비쌀')
})
