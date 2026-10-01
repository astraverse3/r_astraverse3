// 발주서 건 상세 — 주문 수량 수정·품목 취소·건 취소 판정 ('use server' 아님 — 테스트 가능)
//
// 계획서 docs/plan/plan-발주서-건상세-수정추가.md 1단계.
// 액션(`app/actions/purchase-order.ts`)이 트랜잭션 안에서 읽은 값으로 이 판정을 부르고, 결과대로 쓴다.
//
// 🔴 차감된 것보다 적게 줄일 수 없다 — 판매 기록(PackageMovement)이 주문보다 많아진다.
// 🔴 품목을 다 지우면 빈 건이 남는다 → 마지막 품목 취소는 **건 취소**로 바꾼다.

export const MAX_ORDER_QTY = 99_999

export type QtyChangeInput = {
  orderedQty: number
  /** 이 줄에 확정된 판매 차감 합 */
  allocatedQty: number
  newQty: number
  /** 같은 건의 다른 품목 수 */
  otherItemCount: number
}

export type QtyChangeDecision =
  | { kind: 'reject'; reason: string }
  | { kind: 'noop' }
  | { kind: 'update' }
  | { kind: 'deleteItem' }
  /** 마지막 품목을 0으로 — 건째 취소한다 */
  | { kind: 'deleteOrder' }

export function decideQtyChange(i: QtyChangeInput): QtyChangeDecision {
  if (!Number.isInteger(i.newQty) || i.newQty < 0 || i.newQty > MAX_ORDER_QTY) {
    return { kind: 'reject', reason: `수량은 0~${MAX_ORDER_QTY.toLocaleString()} 사이 정수로 넣어 주세요.` }
  }
  if (i.newQty === i.orderedQty) return { kind: 'noop' }
  if (i.newQty < i.allocatedQty) {
    return {
      kind: 'reject',
      reason:
        i.newQty === 0
          ? `이미 ${i.allocatedQty}개 차감돼 취소할 수 없어요. 그 칸의 차감을 먼저 취소하세요.`
          : `이미 ${i.allocatedQty}개 차감돼 그보다 적게 줄일 수 없어요. 그 칸의 차감을 먼저 취소하세요.`,
    }
  }
  if (i.newQty === 0) return i.otherItemCount === 0 ? { kind: 'deleteOrder' } : { kind: 'deleteItem' }
  return { kind: 'update' }
}

/** 건 취소 — 차감이 하나라도 있으면 막는다 */
export function decideOrderCancel(allocatedTotal: number): { ok: true } | { ok: false; reason: string } {
  return allocatedTotal > 0
    ? { ok: false, reason: `이 건에 차감된 품목이 있어 취소할 수 없어요(${allocatedTotal}개). 차감을 먼저 취소하세요.` }
    : { ok: true }
}
