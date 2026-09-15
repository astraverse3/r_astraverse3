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
  /** 곡종 구분. 매칭엔 안 쓰이고 찰벼 표시(`getDisplayMillingType`)에만 쓰는 선택 필드 */
  type?: string | null
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

// ------------------------------------------------------
// 수동지정 보조 (D2e) — 매칭 자체와는 무관, 팝오버가 쓴다
// ------------------------------------------------------

/**
 * 수동지정 팝오버의 SKU 후보 정렬 (결정 O).
 * 주문 규격과 **같은 규격 먼저** → 기본 SKU 먼저 → 도정·규격·포장지 이름순.
 * 원본 배열을 건드리지 않는다.
 */
export function sortSkuCandidates(
  skus: readonly MatcherProductType[],
  packageType: string,
): MatcherProductType[] {
  const wanted = stripSpaces(packageType)
  const sameSpec = (p: MatcherProductType) => (stripSpaces(p.packageType) === wanted ? 0 : 1)
  return [...skus].sort(
    (a, b) =>
      sameSpec(a) - sameSpec(b) ||
      Number(b.isDefault) - Number(a.isDefault) ||
      a.millingType.localeCompare(b.millingType, 'ko') ||
      a.packageType.localeCompare(b.packageType, 'ko') ||
      a.packagingName.localeCompare(b.packagingName, 'ko'),
  )
}

/**
 * 품종토큰에 **도정 단어가 섞여 있는가** (결정 T).
 *
 * `백미 천지향5세`처럼 도정이 이름 **앞**에 오면 접미 분리가 안 돼 토큰에 도정이 남는다.
 * 이걸 별칭으로 학습하면 도정은 품종 category 기본값으로 굳고, 나중에 `현미 …`가 와서
 * 또 학습되면 **현미 주문이 백미 SKU로 조용히 붙는다.** 그래서 학습을 거부한다.
 *
 * 🔴 위탁가공 별도품종(`발아현미`·`흑미`)을 먼저 걷어낸다 — 안 그러면 `가바발아현미`가
 * '현미'를 품어 학습이 막힌다(실제로 쓰이는 별칭이다).
 */
export function hasMillingToken(token: string): boolean {
  let t = stripSpaces(token)
  for (const tail of NON_MILLING_TAILS) t = t.split(stripSpaces(tail)).join('')
  return MILLING_SUFFIXES.some((s) => t.includes(s))
}
