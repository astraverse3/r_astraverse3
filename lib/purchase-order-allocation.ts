// 발주서 차감 배분·상태 순수 로직 — 'use server' 아님(테스트 가능)
//
// 계획서 §8.3.1 / 결정 #3·#4·#12·#16:
//   - FIFO 자동배분(오래된 도정/입고분부터)
//   - 라인 충족 판정(orderedQty vs 차감합) → 건 status 파생
//   - 재업로드 중복 감지 키(발주일+발주처+수령인)
//
// DB·매칭은 하지 않는다. 액션(purchase-order.ts)이 조회 결과를 넣어 호출한다.

export type LineStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED'
export type OrderStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED'

// ------------------------------------------------------
// FIFO 자동배분 (#3) — 오래된 재고부터 필요 수량까지 그리디
// ------------------------------------------------------
export type AvailablePackage = {
  packageId: number
  available: number // 가용 개수 = count - SUM(movement.count)
  sortKey: Date | string // FIFO 기준(MILLED=createdAt / PURCHASED=incomingDate). 호출측이 선택
}

export type Allocation = { packageId: number; count: number }

export type AllocationResult = {
  allocations: Allocation[]
  allocatedQty: number // 실제 배분된 합
  shortage: number // 부족분(가용 부족 시 > 0, #4 부분처리)
}

/** 필요 수량(qty)을 FIFO 순서로 가용 재고에 그리디 배분. 부족분은 shortage로. */
export function suggestAllocation(
  qty: number,
  packages: AvailablePackage[],
): AllocationResult {
  const sorted = packages
    .filter((p) => p.available > 0)
    .sort(
      (a, b) =>
        new Date(a.sortKey).getTime() - new Date(b.sortKey).getTime() ||
        a.packageId - b.packageId, // tie-break: 오래된 id 우선(결정적)
    )

  const allocations: Allocation[] = []
  let remaining = qty
  for (const p of sorted) {
    if (remaining <= 0) break
    const take = Math.min(remaining, p.available)
    allocations.push({ packageId: p.packageId, count: take })
    remaining -= take
  }

  return {
    allocations,
    allocatedQty: qty - Math.max(0, remaining),
    shortage: Math.max(0, remaining),
  }
}

// ------------------------------------------------------
// 상태 파생 (#12) — 라인 단위 판정 → 건 집계 파생
// ------------------------------------------------------

/** 라인 충족 판정: 차감합(allocatedQty) vs 주문수량(orderedQty). */
export function computeLineStatus(
  orderedQty: number,
  allocatedQty: number,
): LineStatus {
  if (allocatedQty <= 0) return 'PENDING'
  if (allocatedQty >= orderedQty) return 'COMPLETED'
  return 'PARTIAL'
}

/** 건 status = 라인 집계 파생값(전부충족=COMPLETED / 일부라도 차감=PARTIAL / 0=PENDING). */
export function computeOrderStatus(
  items: { orderedQty: number; allocatedQty: number }[],
): OrderStatus {
  if (items.length === 0) return 'PENDING'
  const statuses = items.map((it) => computeLineStatus(it.orderedQty, it.allocatedQty))
  if (statuses.every((s) => s === 'COMPLETED')) return 'COMPLETED'
  if (statuses.some((s) => s !== 'PENDING')) return 'PARTIAL'
  return 'PENDING'
}

// ------------------------------------------------------
// 재업로드 중복 감지 (#16) — 발주일+발주처+수령인 조합 키
// ------------------------------------------------------

/** 한 발주 건(행)의 중복 비교 키. 발주일은 날짜(yyyy-mm-dd)까지만 비교. */
export function orderDuplicateKey(
  orderDate: Date | string | null | undefined,
  vendor: string,
  recipient: string,
): string {
  const d = orderDate ? new Date(orderDate).toISOString().slice(0, 10) : ''
  return `${d}|${vendor.trim()}|${recipient.trim()}`
}

export type OrderKeyInput = {
  orderDate?: Date | string | null
  vendor: string
  recipient: string
}

/** 신규 적재 대상 중 기존 키집합과 겹치는 건을 반환(강제 차단 아님, 경고용 #16). */
export function detectDuplicateOrders<T extends OrderKeyInput>(
  incoming: T[],
  existingKeys: Set<string>,
): T[] {
  return incoming.filter((o) =>
    existingKeys.has(orderDuplicateKey(o.orderDate, o.vendor, o.recipient)),
  )
}
