// 발주서 재매칭 판정 — 'use server' 아님(테스트 가능)
//
// 계획서 docs/plan/plan-매트릭스-포장지규격-수정.md 변경 ①.
//
// 예전 재매칭은 매칭실패 줄(productTypeId=null)만 다시 봤다. 그래서 SKU 기본 포장지를 고쳐도
// 이미 (틀린 SKU에) 붙은 줄은 따라오지 않았다(2026-10-01 실사용 첫날). 이제 **차감이 없는 줄 전부**를
// 다시 본다. 9/16 수동지정 철회 뒤로 줄의 SKU를 정하는 건 매처 하나뿐이라, 다시 돌려도
// 사람이 정한 값을 덮어쓰지 않는다.

export type RematchLine = {
  id: number
  /** 지금 붙어 있는 SKU. 매칭실패면 null */
  productTypeId: number | null
  /** 이 줄에 판매 차감이 하나라도 있는가 — 있으면 건드리지 않는다 */
  deducted: boolean
  /** 지금 매처를 돌린 결과. 실패면 null */
  matchedTo: number | null
}

export type RematchPlan = {
  /** 쓸 것 — 목표 SKU → 줄 id들 */
  writes: Map<number, number[]>
  /** 매칭실패였다가 붙은 줄 */
  newlyMatched: number
  /** 다른 SKU로 옮겨 간 줄 */
  moved: number
  /**
   * 차감이 있어 못 옮긴 줄 — 매처 결과가 지금 SKU와 **다른** 것만 센다.
   * 정상 차감된 줄까지 세면 매번 시끄럽다. 이 수가 0이 아니면 「차감 취소부터」라는 신호다.
   */
  blockedByDeduction: number
  /**
   * 붙어 있었는데 지금 매처로는 실패하는 줄(예: SKU 비활성화). 매칭을 풀지 않고 그대로 둔다 —
   * 풀면 화면에서 열이 통째로 사라져 「뭐가 바뀌었나」를 알 수 없다. 사람이 보게 센다.
   */
  needsReview: number
  /** 여전히 매칭실패인 줄 */
  stillUnmatched: number
}

export function planRematch(lines: readonly RematchLine[]): RematchPlan {
  const writes = new Map<number, number[]>()
  let newlyMatched = 0
  let moved = 0
  let blockedByDeduction = 0
  let needsReview = 0
  let stillUnmatched = 0

  for (const l of lines) {
    if (l.deducted) {
      if (l.matchedTo !== null && l.matchedTo !== l.productTypeId) blockedByDeduction++
      continue
    }
    if (l.matchedTo === null) {
      if (l.productTypeId === null) stillUnmatched++
      else needsReview++
      continue
    }
    if (l.matchedTo === l.productTypeId) continue

    if (l.productTypeId === null) newlyMatched++
    else moved++
    const list = writes.get(l.matchedTo)
    if (list) list.push(l.id)
    else writes.set(l.matchedTo, [l.id])
  }

  return { writes, newlyMatched, moved, blockedByDeduction, needsReview, stillUnmatched }
}
