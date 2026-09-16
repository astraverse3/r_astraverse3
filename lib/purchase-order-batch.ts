// 발주서 행 일괄차감 — 배분 계획 순수 로직 (D3 결정 C·D·E)
//
// 매트릭스에서 행(수령처)을 여러 개 골라 한 번에 차감할 때, **무엇을 얼마나 뺄지**를
// 여기서 전부 계산한다. DB는 만지지 않는다 — 액션이 조회 결과를 넣어 호출하고,
// 검토 게이트(dry-run)와 실제 확정이 **같은 함수를 같은 입력으로** 부른다.
//
// 🔴 **가용 풀을 깎아가며 순차 배분한다.** 라인마다 `suggestAllocation`을 독립으로 부르면
//    같은 SKU를 쓰는 라인들이 **같은 재고를 각자 세어** 차감예정이 부풀려진다. 실측 택배 묶음
//    (67건 79라인)은 SKU가 겹친다 — 게이트에 적힌 kg이 확정 결과와 달라지는 결함이 된다.
//
// 🔴 **순서는 `itemId` 오름차순 고정.** 재고가 모자랄 때 「누가 먼저 가져가는가」가 순서로 갈리므로,
//    dry-run과 확정이 같은 순서를 써야 게이트에서 본 숫자가 그대로 나온다.
//
// 제외 3종(결정 D) — 매칭실패는 차감 불가, 톤백은 사람이 자루를 골라야 하고(개수 추천이 성립 안 함),
// 이미 전량 차감된 라인은 할 일이 없다. **재고부족은 제외가 아니다**(결정 E) — 가능한 만큼 빼고
// 부분으로 남긴다. 막는 사유는 매칭실패 하나뿐이다.

import {
  sortFifo,
  suggestAllocation,
  type Allocation,
  type AvailablePackage,
} from '@/lib/purchase-order-allocation'

/** 일괄 대상 라인. 매트릭스가 이미 들고 있는 값 그대로다(`MatrixItemInput`의 부분집합) */
export type BatchLine = {
  itemId: number
  orderId: number
  /** null = 매칭실패 */
  productTypeId: number | null
  orderedQty: number
  /** 기차감 합(type=SALE) */
  allocatedQty: number
  /** 톤백이면 자루 중량(#34). 일반 규격은 null */
  unitWeightKg: number | null
}

/** 제외 사유 — 사람에게 보여줄 문구는 화면이 만든다 */
export type BatchSkip = 'UNMATCHED' | 'BULK' | 'DONE'

export type BatchSkipped = {
  itemId: number
  orderId: number
  reason: BatchSkip
}

/** 실제로 쓸 라인. `allocations`가 빈 라인은 여기 들어오지 않는다 */
export type BatchPlanLine = {
  itemId: number
  orderId: number
  productTypeId: number
  /** 이번에 채워야 할 개수 = orderedQty - allocatedQty */
  need: number
  allocations: Allocation[]
  /** 못 채운 개수. > 0 이면 부분 차감으로 남는다 */
  shortage: number
}

/** 재고가 모자란 라인 — 한 개도 못 채운 라인(`allocated = 0`)도 포함한다 */
export type BatchShortage = {
  itemId: number
  orderId: number
  productTypeId: number
  need: number
  allocated: number
  shortage: number
}

export type BatchPlan = {
  /** 쓸 것만. `itemId` 오름차순 */
  lines: BatchPlanLine[]
  skipped: BatchSkipped[]
  shortages: BatchShortage[]
  totals: {
    /** 주문 전량을 채우는 라인 수 */
    full: number
    /**
     * 일부만 채우는 라인 수. **한 개도 못 채우는 라인은 여기 넣지 않는다**(`none`) —
     * 실측(묶음 #15)에서 부족 18라인 중 18개가 가용 0이었다. 그걸 「부분 차감」이라 부르면
     * 사람은 조금이라도 나가는 줄 알지만 실제로는 아무 일도 일어나지 않는다.
     */
    partial: number
    /** 가용이 0이라 이번에 아무것도 차감되지 않는 라인 수 */
    none: number
    /** 매칭실패로 빠진 라인 수 — 유일한 차단 사유(결정 E) */
    unmatched: number
    /** 톤백이라 빠진 라인 수 */
    bulk: number
    /** 이미 전량 차감돼 빠진 라인 수 */
    done: number
    /** 차감 예정 포장 개수 */
    units: number
    /** 차감 예정 중량 */
    kg: number
    /** 손대는 재고 행(로트) 수 */
    lots: number
  }
}

/**
 * 고른 라인들의 FIFO 배분 계획.
 *
 * @param lines   대상 라인 전부(제외 대상 포함 — 걸러내는 것도 이 함수의 일이다)
 * @param pools   SKU → 가용 패키지. 입력은 **변경하지 않는다**(내부에서 복사해 깎는다)
 * @param weights SKU → 포장 1개당 kg. 없으면 0으로 친다(kg 합계에만 쓰인다)
 */
export function planBatchAllocations(
  lines: BatchLine[],
  pools: Record<number, AvailablePackage[]>,
  weights: Record<number, number> = {},
): BatchPlan {
  // SKU별로 한 번만 정렬·복사한다. 원본을 깎으면 호출부가 그 뒤에 쓰는 값이 조용히 바뀐다.
  const poolCache = new Map<number, AvailablePackage[]>()
  const poolOf = (sku: number) => {
    let pool = poolCache.get(sku)
    if (!pool) {
      pool = sortFifo((pools[sku] ?? []).map((p) => ({ ...p })))
      poolCache.set(sku, pool)
    }
    return pool
  }

  const planLines: BatchPlanLine[] = []
  const skipped: BatchSkipped[] = []
  const shortages: BatchShortage[] = []
  const lots = new Set<number>()
  let full = 0
  let partial = 0
  let none = 0
  let unmatched = 0
  let bulk = 0
  let done = 0
  let units = 0
  let kg = 0

  for (const line of [...lines].sort((a, b) => a.itemId - b.itemId)) {
    const at = { itemId: line.itemId, orderId: line.orderId }

    if (line.productTypeId === null) {
      skipped.push({ ...at, reason: 'UNMATCHED' })
      unmatched += 1
      continue
    }
    if (line.unitWeightKg !== null) {
      skipped.push({ ...at, reason: 'BULK' })
      bulk += 1
      continue
    }
    const need = line.orderedQty - line.allocatedQty
    if (need <= 0) {
      skipped.push({ ...at, reason: 'DONE' })
      done += 1
      continue
    }

    const sku = line.productTypeId
    const pool = poolOf(sku)
    const { allocations, allocatedQty, shortage } = suggestAllocation(need, pool)

    // 🔴 배분한 만큼 풀에서 깎는다 — 다음 라인이 같은 재고를 또 세지 않게.
    for (const a of allocations) {
      const p = pool.find((x) => x.packageId === a.packageId)
      if (p) p.available -= a.count
    }

    if (shortage > 0) {
      // 한 개도 못 채우면 「부분」이 아니다 — 이번 차감에서 아무 일도 일어나지 않는다
      if (allocatedQty > 0) partial += 1
      else none += 1
      shortages.push({ ...at, productTypeId: sku, need, allocated: allocatedQty, shortage })
    } else {
      full += 1
    }

    if (allocations.length > 0) {
      planLines.push({ ...at, productTypeId: sku, need, allocations, shortage })
      for (const a of allocations) {
        units += a.count
        lots.add(a.packageId)
      }
      kg += allocatedQty * (weights[sku] ?? 0)
    }
  }

  return {
    lines: planLines,
    skipped,
    shortages,
    totals: {
      full,
      partial,
      none,
      unmatched,
      bulk,
      done,
      units,
      kg: Math.round(kg * 100) / 100,
      lots: lots.size,
    },
  }
}

/**
 * 계획의 지문 — 검토 게이트에서 본 것과 확정 직전 재계산이 같은지 대조한다(결정 G).
 *
 * 수량뿐 아니라 **어느 로트에서 나가는지까지** 넣는다. 총량이 같아도 로트가 바뀌면
 * 사람이 게이트에서 본 「로트 N개」와 다른 일이 벌어지는 것이라, 그때도 멈춰야 한다.
 */
export function fingerprintBatchPlan(plan: BatchPlan): string {
  return plan.lines
    .map(
      (l) =>
        `${l.itemId}:${l.allocations
          .map((a) => `${a.packageId}x${a.count}`)
          .sort()
          .join(',')}`,
    )
    .join('|')
}
