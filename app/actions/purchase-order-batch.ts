'use server'

// 발주서 행 일괄차감 (계획서 `docs/plan/plan-발주서판매처리-D3.md`)
//
// 매트릭스에서 행(수령처)을 여러 개 골라 한 번에 차감한다. 액션은 둘 —
// `previewBatch`(검토 게이트에 뿌릴 dry-run, **쓰지 않는다**)와 `confirmBatch`(실제 차감).
// 무엇을 얼마나 뺄지는 두 액션 모두 **같은 순수함수** `planBatchAllocations`가 정한다(결정 C).
//
// 🔴 **왜 셀 차감(`confirmCell`)을 라인마다 부르지 않는가.**
// `applyAllocations`는 배분 1건당 쿼리 4회(기차감 집계·재고 조회·사용량 집계·INSERT)를 쓴다.
// Neon 왕복이 250~300ms라 배분 1건이 곧 1초다 — 실측 택배 묶음(67건 79라인)을 그렇게 돌리면
// **100초를 넘겨** 트랜잭션 timeout 30초에 걸린다. 2026-08-26 적재 사고와 같은 뿌리
// (루프 안 INSERT는 20회가 한계).
//
// 그래서 여기는 **배치 경로**다(결정 F) — 조회 4회로 전부 읽고, 배분은 메모리에서 끝내고,
// 쓰기는 `createMany` 1회 + 건 상태 `updateMany` 최대 3회. 라인 수와 무관하게 **왕복 ≤ 8회**.
//
// 🔴 **`applyAllocations`의 검증 3종을 여기선 순수함수가 보장한다.**
//   - SKU 일치 → 풀을 라인의 `productTypeId`로 만들므로 다른 SKU 재고가 섞일 수 없다
//   - 가용 초과 → `planBatchAllocations`가 풀을 깎아가며 배분해 구조적으로 넘지 못한다
//   - 주문 초과 → 배분 상한이 `orderedQty - allocatedQty`라 넘지 못한다
//   사람이 고른 배분을 받지 않고 **FIFO 자동 배분만** 하기 때문에 가능한 단순화다(결정 B).
//   셀 팝오버(사람이 로트를 고르는 경로)는 지금처럼 `applyAllocations`를 계속 쓴다.
//
// 🔴 `revalidatePath`를 부르지 않는다 — 부르면 Next가 매트릭스를 통째로 다시 그려(1.4초)
//    결정 C(15ms 로컬 재계산)가 무효가 된다. 확정은 바뀐 값만 돌려준다(결정 H).

import type { OrderStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth-guard'
import { recordAuditLog } from '@/lib/audit'
import { sanitizeErrorMessage } from '@/lib/error-sanitize'
import { availableOf, MOVEMENT_COUNT_SELECT } from '@/lib/package-available'
import { computeOrderStatus, type AvailablePackage } from '@/lib/purchase-order-allocation'
import { loadAvailability } from '@/lib/purchase-order-db'
import {
  fingerprintBatchPlan,
  planBatchAllocations,
  type BatchLine,
  type BatchPlan,
  type BatchShortage,
  type BatchSkipped,
} from '@/lib/purchase-order-batch'
import type { AvailabilityMap } from '@/lib/purchase-order-matrix'

// ------------------------------------------------------
// 반환 타입
// ------------------------------------------------------

/**
 * 검토 게이트가 그릴 값. **이름은 여기 없다** — 수령인·품목·규격은 매트릭스가 이미 갖고 있고,
 * 서버가 또 조립하면 표기 규칙이 두 곳이 된다(C0-c에서 한 번 샜다). 화면이 `itemId`로 붙인다.
 */
export type BatchPreview = {
  totals: BatchPlan['totals']
  /** 확정 버튼에 찍는 「N라인 차감 확정」 */
  confirmLines: number
  shortages: BatchShortage[]
  skipped: BatchSkipped[]
  /** 확정 때 되돌려 받는 대조값(결정 G) */
  fingerprint: string
}

export type BatchPreviewResult =
  | { success: true; data: BatchPreview }
  | { success: false; error: string }

/** 차감이 바꾼 값만 — 셀 차감의 `CellPatch`와 같은 역할이되 SKU가 여럿이다(결정 H) */
export type BatchPatch = {
  /** itemId → 새 allocatedQty */
  allocatedQty: Record<number, number>
  /** productTypeId → 가용 개수 */
  availability: AvailabilityMap
  /** productTypeId → 가용 kg */
  availabilityKg: AvailabilityMap
}

export type BatchConfirmResult =
  | { success: true; patch: BatchPatch; confirmed: number; lines: number }
  /** 게이트를 띄운 사이 재고가 바뀌었다 — 아무것도 쓰지 않았고, 새 계획을 함께 돌려준다(결정 G) */
  | { success: false; mismatch: true; error: string; preview: BatchPreview }
  | { success: false; mismatch?: false; error: string }

// ------------------------------------------------------
// 조회 — preview·confirm이 같은 입력을 만든다
// ------------------------------------------------------

type ItemRow = {
  id: number
  orderId: number
  productTypeId: number | null
  orderedQty: number
  unitWeightKg: number | null
}

/** 선택된 건들의 라인 전부. 제외 대상(매칭실패·톤백·완료)도 걸러내지 않고 다 가져온다 — 거르는 건 순수함수의 일이다. */
async function loadItems(client: Prisma.TransactionClient, orderIds: number[]): Promise<ItemRow[]> {
  return client.purchaseOrderItem.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true, orderId: true, productTypeId: true, orderedQty: true, unitWeightKg: true },
    orderBy: { id: 'asc' },
  })
}

/** itemId → 기차감 합(type=SALE). 라인 수와 무관하게 **왕복 1회**. */
async function loadAllocated(
  client: Prisma.TransactionClient,
  itemIds: number[],
): Promise<Record<number, number>> {
  if (itemIds.length === 0) return {}
  const rows = await client.packageMovement.groupBy({
    by: ['orderItemId'],
    where: { orderItemId: { in: itemIds }, type: 'SALE' },
    _sum: { count: true },
  })
  const map: Record<number, number> = {}
  for (const r of rows) {
    if (r.orderItemId !== null) map[r.orderItemId] = r._sum.count ?? 0
  }
  return map
}

/**
 * SKU → 가용 패키지(FIFO 정렬 키 포함) + SKU → 1개당 kg. **왕복 1회**.
 *
 * 단중은 SKU 대표값(첫 행)으로 잡는다 — 일반 규격은 SKU가 곧 규격이라 행마다 같다.
 * 제각각인 건 톤백뿐인데 톤백은 일괄에서 빠진다(결정 D).
 */
async function loadPools(
  client: Prisma.TransactionClient,
  skuIds: number[],
): Promise<{ pools: Record<number, AvailablePackage[]>; weights: Record<number, number> }> {
  const pools: Record<number, AvailablePackage[]> = {}
  const weights: Record<number, number> = {}
  if (skuIds.length === 0) return { pools, weights }

  const pkgs = await client.millingOutputPackage.findMany({
    where: { productTypeId: { in: skuIds } },
    select: {
      id: true,
      productTypeId: true,
      count: true,
      weightPerUnit: true,
      source: true,
      createdAt: true,
      incomingDate: true,
      ...MOVEMENT_COUNT_SELECT,
    },
  })

  for (const p of pkgs) {
    if (p.productTypeId === null) continue
    if (!(p.productTypeId in weights)) weights[p.productTypeId] = p.weightPerUnit
    const available = availableOf(p)
    if (available <= 0) continue
    // FIFO 기준 — MILLED=도정일(createdAt) / PURCHASED=입고일(incomingDate). `loadAvailablePackages`와 같은 규칙.
    const sortKey = p.source === 'PURCHASED' && p.incomingDate ? p.incomingDate : p.createdAt
    ;(pools[p.productTypeId] ??= []).push({ packageId: p.id, available, sortKey })
  }
  return { pools, weights }
}

const toBatchLines = (items: ItemRow[], allocated: Record<number, number>): BatchLine[] =>
  items.map((it) => ({
    itemId: it.id,
    orderId: it.orderId,
    productTypeId: it.productTypeId,
    orderedQty: it.orderedQty,
    allocatedQty: allocated[it.id] ?? 0,
    unitWeightKg: it.unitWeightKg,
  }))

const skuIdsOf = (items: ItemRow[]) => [
  ...new Set(items.map((it) => it.productTypeId).filter((id): id is number => id !== null)),
]

const toPreview = (plan: BatchPlan): BatchPreview => ({
  totals: plan.totals,
  confirmLines: plan.lines.length,
  shortages: plan.shortages,
  skipped: plan.skipped,
  fingerprint: fingerprintBatchPlan(plan),
})

const validOrderIds = (orderIds: number[]) =>
  [...new Set(orderIds)].filter((id) => Number.isInteger(id) && id > 0)

// ------------------------------------------------------
// dry-run (D3b)
// ------------------------------------------------------

/** 검토 게이트용. 쓰지 않는다 — 왕복 3회(라인 → 기차감·가용 병렬). */
export async function previewBatch(orderIds: number[]): Promise<BatchPreviewResult> {
  await requirePermission('OPERATION_MANAGE')
  try {
    const ids = validOrderIds(orderIds)
    if (ids.length === 0) return { success: false, error: '선택된 수령처가 없습니다.' }

    const items = await loadItems(prisma, ids)
    if (items.length === 0) return { success: false, error: '선택한 건에 품목이 없습니다.' }

    const [allocated, { pools, weights }] = await Promise.all([
      loadAllocated(prisma, items.map((it) => it.id)),
      loadPools(prisma, skuIdsOf(items)),
    ])

    const plan = planBatchAllocations(toBatchLines(items, allocated), pools, weights)
    return { success: true, data: toPreview(plan) }
  } catch (error) {
    console.error('[previewBatch] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '차감 예정을 계산하지 못했습니다.') }
  }
}

// ------------------------------------------------------
// 확정 (D3b)
// ------------------------------------------------------

/**
 * 고른 건들을 한 트랜잭션에 차감한다.
 *
 * @param fingerprint 검토 게이트가 받은 `BatchPreview.fingerprint`. 트랜잭션 안에서 다시 계산한
 *        결과와 다르면(다른 사람이 먼저 같은 재고를 가져갔다 등) **아무것도 쓰지 않고** 중단한다(결정 G).
 */
export async function confirmBatch(
  orderIds: number[],
  fingerprint: string,
): Promise<BatchConfirmResult> {
  const session = await requirePermission('OPERATION_MANAGE')
  try {
    const ids = validOrderIds(orderIds)
    if (ids.length === 0) return { success: false, error: '선택된 수령처가 없습니다.' }

    const outcome = await prisma.$transaction(
      async (tx) => {
        const [orders, items] = await Promise.all([
          tx.purchaseOrder.findMany({
            where: { id: { in: ids } },
            select: { id: true, status: true, uploadId: true },
          }),
          loadItems(tx, ids),
        ])
        if (items.length === 0) throw new Error('선택한 건에 품목이 없습니다.')

        const allocated = await loadAllocated(tx, items.map((it) => it.id))
        const { pools, weights } = await loadPools(tx, skuIdsOf(items))
        const plan = planBatchAllocations(toBatchLines(items, allocated), pools, weights)

        // 🔴 게이트에서 본 것과 다르면 여기서 끝낸다 — 부분 커밋 없음(결정 G, 사용자 확정 2026-09-16)
        if (fingerprintBatchPlan(plan) !== fingerprint) {
          return { mismatch: true as const, preview: toPreview(plan) }
        }
        if (plan.lines.length === 0) throw new Error('차감할 품목이 없습니다.')

        // ① 차감 — 라인 루프가 아니라 한 번에 넣는다
        const occurredAt = new Date()
        const data = plan.lines.flatMap((l) =>
          l.allocations.map((a) => ({
            packageId: a.packageId,
            count: a.count,
            type: 'SALE' as const,
            orderItemId: l.itemId,
            occurredAt,
            createdById: session.user?.id,
            createdName: session.user?.name ?? undefined,
          })),
        )
        const created = await tx.packageMovement.createMany({ data })

        // ② 건 상태 — 메모리에서 파생하고 상태별로 묶어 updateMany(최대 3회).
        //    `recalcOrderStatus`를 건마다 부르면 건 수만큼 왕복이 늘어난다.
        const addedByItem = new Map<number, number>()
        for (const l of plan.lines) {
          addedByItem.set(l.itemId, l.allocations.reduce((s, a) => s + a.count, 0))
        }
        const newAllocatedQty: Record<number, number> = {}
        const byOrder = new Map<number, { orderedQty: number; allocatedQty: number }[]>()
        for (const it of items) {
          const after = (allocated[it.id] ?? 0) + (addedByItem.get(it.id) ?? 0)
          newAllocatedQty[it.id] = after
          const list = byOrder.get(it.orderId) ?? []
          list.push({ orderedQty: it.orderedQty, allocatedQty: after })
          byOrder.set(it.orderId, list)
        }
        const buckets = new Map<OrderStatus, number[]>()
        for (const o of orders) {
          const next = computeOrderStatus(byOrder.get(o.id) ?? [])
          if (next === o.status) continue
          const list = buckets.get(next) ?? []
          list.push(o.id)
          buckets.set(next, list)
        }
        for (const [status, orderIdList] of buckets) {
          await tx.purchaseOrder.updateMany({
            where: { id: { in: orderIdList } },
            data: { status },
          })
        }

        return {
          mismatch: false as const,
          confirmed: created.count,
          lines: plan.lines.length,
          units: plan.totals.units,
          newAllocatedQty,
          skuIds: skuIdsOf(items),
          uploadId: orders[0]?.uploadId ?? null,
          orderCount: orders.length,
        }
      },
      // 🔴 왕복이 8회 남짓이라 5초로도 되지만, Neon이 느린 순간을 대비해 셀 차감과 같은 값으로 둔다.
      { timeout: 30000 },
    )

    if (outcome.mismatch) {
      return {
        success: false,
        mismatch: true,
        error: '재고가 바뀌어 차감을 중단했습니다. 새로 계산한 내용을 확인해 주세요.',
        preview: outcome.preview,
      }
    }

    await recordAuditLog({
      action: 'CREATE',
      entity: 'PackageMovement',
      entityId: outcome.uploadId ?? undefined,
      description:
        `발주서 행 일괄차감 uploadId=${outcome.uploadId ?? '-'} ` +
        `건 ${outcome.orderCount}개 · ${outcome.lines}라인 · ${outcome.units}개`,
    })

    const { qty, kg } = await loadAvailability(outcome.skuIds)
    return {
      success: true,
      patch: { allocatedQty: outcome.newAllocatedQty, availability: qty, availabilityKg: kg },
      confirmed: outcome.units,
      lines: outcome.lines,
    }
  } catch (error) {
    console.error('[confirmBatch] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '일괄 차감에 실패했습니다.') }
  }
}
