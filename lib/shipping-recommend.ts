// 채널별 추천 배송업체 판정 (결정 #38).
//
// 시안은 "최근 이력 자동 추론 금지"라고 했지만 그 경고는 **직전 1건을 그대로 쓰는 방식**을 겨눈 것이다
// (예외 한 번이 곧바로 기본값이 된다). 최근 N건의 최빈값이면 예외 1건은 다수에 묻히고,
// 업체를 실제로 바꾸면 두 건만 지나도 따라온다.
//
// 채널 기본값을 저장할 곳이 없다 — SystemConfig 키도, 관리화면의 채널 설정 UI도, 초기 시드도.

/** 추천 판정에 쓰는 최근 묶음 수. 3건이면 예외 1건이 묻히고 교체는 2건 만에 따라온다. */
export const RECOMMEND_WINDOW = 3

/**
 * 최근 이력에서 추천 배송업체 하나를 고른다.
 * **최빈값이 유일할 때만** 추천한다 — 전부 다르거나 동률이면 고정 패턴이 없다는 뜻이라 빈칸으로 두고 사람이 고른다.
 *
 * @param recentVendorIds 최근 → 과거 순의 배송업체 id (배송업체가 비어 있는 묶음은 미리 걸러서 넘긴다)
 */
export function pickRecommendedVendor(recentVendorIds: number[]): number | null {
  if (recentVendorIds.length === 0) return null

  const counts = new Map<number, number>()
  for (const id of recentVendorIds) {
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  let best: number | null = null
  let bestCount = 0
  let tied = false
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id
      bestCount = count
      tied = false
    } else if (count === bestCount) {
      tied = true
    }
  }

  return tied ? null : best
}
