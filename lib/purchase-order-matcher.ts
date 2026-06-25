// 발주서 라인 → ProductType(SKU) 매칭 파이프라인 — 순수 모듈
//
// 계획서 §8.2.3 / 결정 #1·#5·#22·#23·#24:
//   ① 정규화   : 인증/브랜드 접두 제거 + 도정유형 접미 분리 → (품종토큰, millingType?)
//   ② 품종 해석 : Variety.name 정확일치 → 실패 시 Variety.aliases 조회
//   ③ 도정 확정 : 접미 분리값, 없으면 품종 category 디폴트(RICE→백미 / MISC_GRAIN→기타)
//   ④ SKU 해석 : (varietyId + millingType + packageType + 포장지) 4키로 ProductType 조회
//
// find-or-create 안 함(§8.2.3 검토포인트): 카탈로그에 없는 SKU는 재고도 0 →
// 매칭실패(수동, #18)로 회송. SKU 생성은 도정산/매입 등록 경로의 책임.
//
// ⚠️ 위탁가공 별도품종(흑미·발아현미)은 도정 접미로 취급 안 함(#1·#24) — 품종토큰 유지.
// ⚠️ 도정 미분리 시 곡종표현 '찹쌀'(=백옥찰 백미)·'천지향' 등은 RICE 디폴트(백미)로 자동 커버.

// ------------------------------------------------------
// 입출력 타입 (마스터는 DB 조회 결과를 호출측에서 주입 — 순수함수 유지)
// ------------------------------------------------------
export type MatcherVariety = {
  id: number
  name: string
  category: string // 'RICE' | 'MISC_GRAIN'
  aliases: string[]
}

export type MatcherProductType = {
  id: number
  varietyId: number
  millingType: string
  packageType: string
  packagingId: number
  packagingName: string
  isDefault: boolean
  active: boolean
}

export type MatchInput = {
  rawItemName: string // 정규화 전/후 무관(매처가 공백 무시 비교)
  packageType: string
  rawPackaging: string | null // 빈칸이면 null → 기본 포장지(#21)
}

export type MatchFailReason =
  | 'variety_unresolved' // 품종/별칭으로 해석 실패
  | 'packaging_unresolved' // 지정 포장지에 해당하는 SKU 없음
  | 'sku_unresolved' // 조합(품종+도정+규격+포장지) SKU 없음

export type MatchResult =
  | {
      matched: true
      productTypeId: number
      varietyId: number
      millingType: string
      packagingId: number
    }
  | {
      matched: false
      reason: MatchFailReason
      varietyId: number | null // 부분 해석 결과(수동지정 UI 보조)
      millingType: string | null
      varietyToken: string // 해석 시도한 품종토큰(#22 alias 학습 입력)
    }

// ------------------------------------------------------
// 정규화 상수
// ------------------------------------------------------
// 인증/브랜드 접두 — 긴 것 먼저(부분일치 방지)
const BRAND_PREFIXES = ['프로틴 라이스', '자스민 라이스', '유기농']
// 도정유형 접미 — 긴 것 먼저
const MILLING_SUFFIXES = ['오분도미', '칠분도미', '백미', '현미']
// 위탁가공 별도품종 — 도정 접미로 분리하면 안 됨(#1·#24)
const NON_MILLING_TAILS = ['발아현미', '흑미']
const MISC_MILLING_SENTINEL = '기타'

/** 공백 전부 제거(품종명·포장지명 비교용 — 발주서 줄바꿈이 공백으로 남는 문제 흡수). */
function stripSpaces(s: string): string {
  return s.replace(/\s+/g, '')
}

/** CRLF·다중공백 정리(정규화 안 된 rawItemName 대비). */
function tidy(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
}

// ------------------------------------------------------
// ① 정규화 — 접두 제거 + 도정 접미 분리
// ------------------------------------------------------
function stripBrandPrefix(name: string): string {
  for (const p of BRAND_PREFIXES) {
    if (name === p) return ''
    if (name.startsWith(p + ' ')) return name.slice(p.length).trim()
  }
  return name
}

function splitMillingSuffix(token: string): {
  varietyToken: string
  millingType: string | null
} {
  // 위탁가공 별도품종은 접미 분리 제외(품종토큰 그대로 유지)
  for (const tail of NON_MILLING_TAILS) {
    if (token.endsWith(tail)) return { varietyToken: token, millingType: null }
  }
  for (const suf of MILLING_SUFFIXES) {
    if (token.endsWith(suf) && stripSpaces(token).length > suf.length) {
      return { varietyToken: token.slice(0, -suf.length).trim(), millingType: suf }
    }
  }
  return { varietyToken: token, millingType: null }
}

export function normalizeItemName(rawItemName: string): {
  varietyToken: string
  millingType: string | null
} {
  const stripped = stripBrandPrefix(tidy(rawItemName))
  return splitMillingSuffix(stripped)
}

// ------------------------------------------------------
// ② 품종 해석 — name 정확일치 → aliases (공백 무시 비교)
// ------------------------------------------------------
function resolveVariety(
  varietyToken: string,
  varieties: MatcherVariety[],
): MatcherVariety | null {
  const key = stripSpaces(varietyToken)
  if (!key) return null
  const byName = varieties.find((v) => stripSpaces(v.name) === key)
  if (byName) return byName
  return (
    varieties.find((v) => v.aliases.some((a) => stripSpaces(a) === key)) ?? null
  )
}

// ------------------------------------------------------
// 매칭 엔트리 — 라인 1개 → MatchResult
// ------------------------------------------------------
export function matchPurchaseOrderItem(
  input: MatchInput,
  varieties: MatcherVariety[],
  productTypes: MatcherProductType[],
): MatchResult {
  const { varietyToken, millingType } = normalizeItemName(input.rawItemName)

  // ② 품종
  const variety = resolveVariety(varietyToken, varieties)
  if (!variety) {
    return {
      matched: false,
      reason: 'variety_unresolved',
      varietyId: null,
      millingType,
      varietyToken,
    }
  }

  // ③ 도정 확정 — 미분리면 category 디폴트
  const finalMilling =
    millingType ?? (variety.category === 'RICE' ? '백미' : MISC_MILLING_SENTINEL)

  // ④ SKU — (품종+도정+규격) 후보 압축 후 포장지로 결정
  const pkgType = stripSpaces(input.packageType)
  const candidates = productTypes.filter(
    (p) =>
      p.active &&
      p.varietyId === variety.id &&
      p.millingType === finalMilling &&
      stripSpaces(p.packageType) === pkgType,
  )

  if (input.rawPackaging) {
    const wanted = stripSpaces(input.rawPackaging)
    const sku = candidates.find((p) => stripSpaces(p.packagingName) === wanted)
    if (!sku) {
      return {
        matched: false,
        reason: 'packaging_unresolved',
        varietyId: variety.id,
        millingType: finalMilling,
        varietyToken,
      }
    }
    return ok(sku, variety.id, finalMilling)
  }

  // 포장지 빈칸(#21): 기본 SKU, 없으면 후보 유일할 때만 채택
  const sku =
    candidates.find((p) => p.isDefault) ??
    (candidates.length === 1 ? candidates[0] : undefined)
  if (!sku) {
    return {
      matched: false,
      reason: 'sku_unresolved',
      varietyId: variety.id,
      millingType: finalMilling,
      varietyToken,
    }
  }
  return ok(sku, variety.id, finalMilling)
}

function ok(
  sku: MatcherProductType,
  varietyId: number,
  millingType: string,
): MatchResult {
  return {
    matched: true,
    productTypeId: sku.id,
    varietyId,
    millingType,
    packagingId: sku.packagingId,
  }
}
