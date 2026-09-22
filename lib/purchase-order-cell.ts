// 발주서 매트릭스 셀 차감 — 순수 로직 (D2c 결정 A · D2d 결정 G)
//
// 한 셀(수령인 × 규격)에는 라인(PurchaseOrderItem)이 여럿 있을 수 있다.
// 사용자는 셀 하나에 대한 배분(packageId·count 목록)만 고르고, 그것을 라인별로
// 나누는 계산은 여기서 한다. DB 쓰기는 `lib/purchase-order-db.ts`의 `applyAllocations`가
// 라인마다 받는다(가용 검증·초과 차단은 거기 있다).
//
// 규칙
//   - 라인은 **id 오름차순**으로, 남은 수량(orderedQty - allocatedQty)이 있는 것만 채운다
//   - 배분 1건이 라인 경계에 걸치면 **쪼갠다**(같은 packageId가 두 라인에 나뉜다)
//   - 배분 합이 셀의 남은 수량을 넘거나, 나눈 뒤 합이 안 맞으면 **던진다**
//     (계산 오류를 조용히 넘기지 않는다)
//   - `overflow: 'last'`(톤백 전용, D2d 결정 G) — 남은 수량을 넘는 몫은 **마지막으로 채운 라인**에 붙인다.
//     1자루 주문에 587kg+450kg 두 자루를 내는 게 정상 업무라서다. 남은 수량이 0이면 여전히 던진다

import type { Allocation } from '@/lib/purchase-order-allocation'

export type CellLine = {
  itemId: number
  orderedQty: number
  allocatedQty: number // 기차감 합(type=SALE)
}

export type LineAllocations = {
  itemId: number
  allocations: Allocation[]
}

export type SplitOptions = {
  /** 'last' — 남은 수량을 넘는 몫을 마지막 라인에 붙인다(톤백). 기본은 초과 시 던진다 */
  overflow?: 'last'
}

/** 셀의 남은 수량 합(라인별 orderedQty - allocatedQty, 음수는 0). */
export function cellRemainingQty(lines: CellLine[]): number {
  return lines.reduce((s, l) => s + Math.max(0, l.orderedQty - l.allocatedQty), 0)
}

/**
 * 셀 단위 배분을 라인별로 나눈다.
 * 반환은 **무언가 받은 라인만**, id 오름차순. 배분이 비면 빈 배열.
 */
export function splitAllocationsByLine(
  lines: CellLine[],
  allocations: Allocation[],
  options: SplitOptions = {},
): LineAllocations[] {
  for (const a of allocations) {
    if (!Number.isInteger(a.count) || a.count < 0) {
      throw new Error(`배분 개수가 올바르지 않습니다(packageId ${a.packageId}: ${a.count}).`)
    }
  }
  const total = allocations.reduce((s, a) => s + a.count, 0)
  const remaining = cellRemainingQty(lines)
  const overflowLast = options.overflow === 'last'
  if (total > remaining && !overflowLast) {
    throw new Error(`셀의 남은 수량(${remaining})을 초과한 차감입니다(${total}).`)
  }
  if (total > 0 && remaining === 0) {
    throw new Error('이미 전부 차감된 셀입니다.')
  }

  const slots = [...lines]
    .sort((a, b) => a.itemId - b.itemId)
    .map((l) => ({ itemId: l.itemId, left: Math.max(0, l.orderedQty - l.allocatedQty) }))
    .filter((s) => s.left > 0)

  const out: LineAllocations[] = []
  let cursor = 0
  for (const a of allocations) {
    let need = a.count
    while (need > 0) {
      const slot = slots[cursor]
      if (!slot) {
        // 남은 라인이 없다 — 톤백이면 마지막 라인에 통째로 붙인다
        if (!overflowLast) throw new Error('배분을 받을 품목이 남지 않았습니다.')
        pushTo(out, slots[slots.length - 1].itemId, { packageId: a.packageId, count: need })
        need = 0
        break
      }
      const take = Math.min(need, slot.left)
      pushTo(out, slot.itemId, { packageId: a.packageId, count: take })
      slot.left -= take
      need -= take
      if (slot.left === 0) cursor += 1
    }
  }

  const placed = out.reduce((s, l) => s + l.allocations.reduce((t, a) => t + a.count, 0), 0)
  if (placed !== total) {
    throw new Error(`배분 합이 맞지 않습니다(입력 ${total}, 배치 ${placed}).`)
  }
  return out
}

function pushTo(out: LineAllocations[], itemId: number, alloc: Allocation): void {
  const last = out[out.length - 1]
  if (last && last.itemId === itemId) {
    // 같은 packageId가 이어지면(overflow) 한 건으로 합친다 — applyAllocations 왕복을 아낀다
    const prev = last.allocations[last.allocations.length - 1]
    if (prev && prev.packageId === alloc.packageId) prev.count += alloc.count
    else last.allocations.push(alloc)
  } else out.push({ itemId, allocations: [alloc] })
}
