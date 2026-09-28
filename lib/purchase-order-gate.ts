// 검토 게이트 선택 목록 (계획서 `docs/plan/plan-발주서-M1-6-게이트선택.md`)
//
// 폰 목록의 `작업필요 n건 검토`로 연 게이트에서 **뺄 건을 고르는** 목록을 만든다. 순수함수 —
// 화면은 그리기만 한다.
//
// 🔴 **여기는 차감량을 계산하지 않는다.** 한 건을 빼면 FIFO로 그 재고가 뒤 건에 가므로
//    「무엇이 얼마나 나가나」는 서버 `previewBatch`가 **남은 건 전체로 다시** 낸다.
//    여기 요약은 「이 건에 무엇이 걸려 있나」(주문 기준)일 뿐이다.
// 🔴 **일괄 대상 판정은 `sumOrderLines` 한 벌이다** — 제외 순서(매칭실패 → 톤백)가 `planBatch`와 같다.

import { orderLineSpec, sumOrderLines, type OrderLine } from './purchase-order-matrix'

/** 부모가 넘기는 건 하나 — 이름·그룹 축은 채널 선언으로 이미 풀어 온다 */
export type GateOrder = {
  orderId: number
  /** 묶는 축(`groupAxisOf`). 없으면 null — 한 그룹으로 모인다 */
  group: string | null
  /** 행에 적을 이름(`nameTiersOf` 앞 값) */
  name: string
  lines: readonly OrderLine[]
}

/**
 * 일괄로 할 게 없는 이유. `null`이면 고를 수 있는 건이다.
 * 🔴 사유가 있는 건은 **체크박스를 주지 않는다** — 눌러도 아무 일이 없는 체크박스는 거짓 어포던스다.
 */
export type GateSkip = 'bulk' | 'unmatched' | 'mixed' | 'none'

export type GateRow = {
  orderId: number
  name: string
  /** `천지향 · 백미 4kg 6개 외 2품목`(주문 기준). 일괄 대상이 없으면 null */
  summary: string | null
  /** 일괄 대상 품목 수 — 「전부 재고없음」 판정의 분모 */
  batchLines: number
  skip: GateSkip | null
}

export type GateGroup = {
  /** 그룹 키 — 축이 없으면 `''` */
  key: string
  label: string | null
  rows: GateRow[]
}

/** 일괄 대상 = 아직 남았고, 매칭됐고, 톤백이 아닌 줄(`sumOrderLines.batchLines`와 같은 기준) */
const isBatchLine = (l: OrderLine) => l.status !== 'COMPLETED' && l.status !== 'UNMATCHED' && !l.bulk

export function gateRowOf(order: GateOrder): GateRow {
  const totals = sumOrderLines(order.lines)
  const batch = order.lines.filter(isBatchLine)

  if (totals.batchLines === 0) {
    const unmatched = totals.workLines - totals.bulkLines
    const skip: GateSkip =
      totals.bulkLines > 0 && unmatched > 0
        ? 'mixed'
        : totals.bulkLines > 0
          ? 'bulk'
          : unmatched > 0
            ? 'unmatched'
            : 'none'
    return { orderId: order.orderId, name: order.name, summary: null, batchLines: 0, skip }
  }

  const head = batch[0]
  const summary =
    `${head.title} ${orderLineSpec(head)} ${head.remainingQty.toLocaleString()}개` +
    (batch.length > 1 ? ` 외 ${(batch.length - 1).toLocaleString()}품목` : '')
  return { orderId: order.orderId, name: order.name, summary, batchLines: batch.length, skip: null }
}

/**
 * 이번 미리보기에서 이 건이 어떻게 되나 — **서버 미리보기의 부족 목록으로만** 판정한다.
 *
 * 🔴 행마다 kg을 따로 셈하지 않는다(2026-09-28 사용자 확인에서 발견). 처음엔 주문 기준 남은 kg을
 *    적었는데, 16품목이 전부 가용 0이라 차감 예정이 0kg인 화면에서 행마다 `10kg`·`21kg`이 찍혀
 *    「이만큼 나간다」로 읽혔다. 행 kg을 FIFO 결과로 다시 셈하면 합계와 **두 벌**이 된다 —
 *    kg은 위 합계 한 곳, 행은 상태만 말한다.
 */
export type GateState = 'full' | 'partial' | 'none'

export function gateStateOf(batchLines: number, shortages: readonly { allocated: number }[]): GateState {
  if (shortages.length === 0) return 'full'
  // 일괄 대상 전부가 부족이고 하나도 못 받았으면 이 건은 이번에 아무 일도 없다
  if (shortages.length >= batchLines && shortages.every((s) => s.allocated === 0)) return 'none'
  return 'partial'
}

/**
 * 건들을 그룹으로 묶는다. **넘겨받은 순서를 흐트러뜨리지 않는다** — 먼저 나온 그룹이 먼저 서고,
 * 그룹 안 행도 들어온 차례 그대로다(부모가 목록의 정렬 순서로 넘긴다).
 */
export function buildGateGroups(orders: readonly GateOrder[]): GateGroup[] {
  const groups = new Map<string, GateGroup>()
  for (const o of orders) {
    const key = o.group ?? ''
    const g = groups.get(key) ?? { key, label: o.group, rows: [] }
    g.rows.push(gateRowOf(o))
    groups.set(key, g)
  }
  return [...groups.values()]
}

/** 체크박스를 줄 건(= 사유 없는 건)의 id */
export function pickableIds(groups: readonly GateGroup[]): number[] {
  return groups.flatMap((g) => g.rows.filter((r) => r.skip === null).map((r) => r.orderId))
}
