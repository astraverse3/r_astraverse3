// 발주서 건 상세 — 품목·주문 추가 판정 ('use server' 아님 — 테스트 가능)
//
// 계획서 docs/plan/plan-발주서-건상세-수정추가.md 2단계.
//
// 🔴 SKU를 정하는 경로는 매처 하나다(9/16 수동지정 철회 · 오늘 머리글 수정과 같은 원칙). 사람이 SKU를 골라도
//    저장하는 건 **원본 값**(품목명·규격·포장지)이고, 그 원본 값을 매처에 넣었을 때 **고른 SKU가 나와야** 한다.
//    그래야 나중에 재매칭을 눌러도 추가한 줄이 엉뚱한 SKU로 옮겨 가지 않는다.

import { matchPurchaseOrderItem, type MatcherProductType, type MatcherVariety } from './purchase-order-matcher'

/** 잡곡 도정 sentinel — 품목명에 넣지 않는다 */
const MISC_MILLING_SENTINEL = '기타'
/** 추가 대상이 아닌 규격 — 톤백은 자루중량 축, 잔량은 판매 SKU가 아니다 */
const NOT_ADDABLE_SPECS = new Set(['톤백', '잔량'])

export type RawItem = { rawItemName: string; packageType: string; rawPackaging: string }

/**
 * 품목명 후보 — 앞에서부터 매처에 넣어 본다.
 * 🔴 「찹쌀」 같은 **표시용** 도정명은 쓰지 않는다 — 2026-10-01 실험에서 `백옥찰 찹쌀`은 매처가 못 읽었다.
 *    저장값(백미·현미·…)만 쓴다.
 */
export function rawNameCandidates(varietyName: string, millingType: string): string[] {
  if (millingType === MISC_MILLING_SENTINEL) return [varietyName]
  if (millingType === '백미') return [varietyName, `${varietyName} 백미`]
  return [`${varietyName} ${millingType}`, `${millingType} ${varietyName}`]
}

/**
 * 이 SKU로 추가할 원본 값. 매처가 이 SKU를 돌려주는 첫 품목명을 쓴다. 못 찾으면 null(추가할 수 없는 SKU).
 * 포장지는 SKU 포장지명을 그대로 적는다 — 빈칸(기본 포장지)에 기대면 기본이 바뀔 때 줄이 따라 움직인다.
 */
export function rawItemFor(
  sku: MatcherProductType,
  varieties: readonly MatcherVariety[],
  productTypes: readonly MatcherProductType[],
): RawItem | null {
  if (!sku.active || NOT_ADDABLE_SPECS.has(sku.packageType)) return null
  const variety = varieties.find((v) => v.id === sku.varietyId)
  if (!variety) return null
  for (const rawItemName of rawNameCandidates(variety.name, sku.millingType)) {
    const raw = { rawItemName, packageType: sku.packageType, rawPackaging: sku.packagingName }
    const m = matchPurchaseOrderItem(raw, [...varieties], [...productTypes])
    if (m.matched && m.productTypeId === sku.id) return raw
  }
  return null
}

/** 수령인·발주처 입력 정리 — 앞뒤 공백 제거, 연속 공백 하나로 */
export function cleanName(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}
