// 발주서 차감 공용 DB 헬퍼 — 트랜잭션 클라이언트(`tx`)를 받는 4개.
//
// 원래 `app/actions/purchase-order.ts`의 비공개 함수였다(D2c C1에서 순수 이동, 동작 변경 없음).
// 'use server' 파일은 export한 모든 것이 서버 액션이 되므로 `tx`를 받는 헬퍼를 export할 수 없다.
// 매칭·차감 액션(purchase-order.ts)과 매트릭스 셀 액션(purchase-order-matrix.ts)이 함께 쓴다.
// (`purchase-order-masters.ts`와 같은 패턴 — DB 접근이 있어 서버에서만 import한다)

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { availableOf, MOVEMENT_COUNT_SELECT } from '@/lib/package-available'
import type { AvailabilityMap, MatrixSkuInput } from '@/lib/purchase-order-matrix'
import {
  computeOrderStatus,
  type AvailablePackage,
  type Allocation,
} from '@/lib/purchase-order-allocation'

/** 특정 SKU의 가용 패키지(FIFO 정렬 키 포함). available>0만. */
export async function loadAvailablePackages(
  tx: Prisma.TransactionClient,
  productTypeId: number,
): Promise<AvailablePackage[]> {
  const pkgs = await tx.millingOutputPackage.findMany({
    where: { productTypeId },
    select: {
      id: true,
      count: true,
      source: true,
      createdAt: true,
      incomingDate: true,
      ...MOVEMENT_COUNT_SELECT,
    },
  })
  return pkgs
    .map((p) => {
      // FIFO: MILLED=createdAt(도정일), PURCHASED=incomingDate(입고일)
      const sortKey =
        p.source === 'PURCHASED' && p.incomingDate ? p.incomingDate : p.createdAt
      return { packageId: p.id, available: availableOf(p), sortKey }
    })
    .filter((p) => p.available > 0)
}

/** 한 라인의 확정 차감합(type=SALE). */
export async function allocatedQtyOfItem(
  tx: Prisma.TransactionClient,
  itemId: number,
): Promise<number> {
  const agg = await tx.packageMovement.aggregate({
    where: { orderItemId: itemId, type: 'SALE' },
    _sum: { count: true },
  })
  return agg._sum.count ?? 0
}

/** 건 status 재계산 — 라인별 차감합 집계 → computeOrderStatus → 저장. */
export async function recalcOrderStatus(
  tx: Prisma.TransactionClient,
  orderId: number,
): Promise<void> {
  const items = await tx.purchaseOrderItem.findMany({
    where: { orderId },
    select: { id: true, orderedQty: true },
  })
  const withAlloc = await Promise.all(
    items.map(async (it) => ({
      orderedQty: it.orderedQty,
      allocatedQty: await allocatedQtyOfItem(tx, it.id),
    })),
  )
  await tx.purchaseOrder.update({
    where: { id: orderId },
    data: { status: computeOrderStatus(withAlloc) },
  })
}

/** allocations를 검증·차감(PackageMovement type=SALE 생성). 트랜잭션 내부 공용. */
export async function applyAllocations(
  tx: Prisma.TransactionClient,
  args: {
    itemId: number
    productTypeId: number
    orderedQty: number
    allocations: Allocation[]
    createdById?: string
    createdName?: string
    /**
     * 초과 검사 방식. 기본 'count' = 개수 초과 차단.
     * 'open' = **톤백 전용**(D2d 결정 F) — 「이미 완료된 라인엔 더 못 넣는다」만 본다.
     * 1자루 주문에 587kg+450kg 두 자루를 내는 게 정상 업무라 개수로 막으면 안 된다.
     * 🔴 호출부(`confirmCell`)가 라인의 `unitWeightKg !== null`로만 켠다. 일반 규격에 켜면 초과 차감이 열린다.
     */
    guard?: 'count' | 'open'
  },
): Promise<number> {
  const already = await allocatedQtyOfItem(tx, args.itemId)
  const addQty = args.allocations.reduce((s, a) => s + a.count, 0)
  if (addQty <= 0) return 0
  if (args.guard === 'open') {
    if (already >= args.orderedQty) throw new Error('이미 전부 차감된 라인입니다.')
  } else if (already + addQty > args.orderedQty) {
    throw new Error(`주문수량(${args.orderedQty})을 초과한 차감입니다.`)
  }

  for (const a of args.allocations) {
    const pkg = await tx.millingOutputPackage.findUnique({
      where: { id: a.packageId },
      select: { count: true, productTypeId: true },
    })
    if (!pkg) throw new Error('재고를 찾을 수 없습니다.')
    if (pkg.productTypeId !== args.productTypeId) {
      throw new Error('해당 제품유형의 재고가 아닙니다.')
    }
    // 🔴 DB 집계 — `lib/package-available.ts`로 합치지 않는다 (#73).
    //    행을 로드하지 않고 DB에서 합을 낸다. 공식(count - SUM)은 같으니 고칠 땐 함께 봐야 한다.
    const used = await tx.packageMovement.aggregate({
      where: { packageId: a.packageId },
      _sum: { count: true },
    })
    const available = pkg.count - (used._sum.count ?? 0)
    if (a.count > available) {
      throw new Error(`재고가 부족합니다(가용 ${available}개).`)
    }
    await tx.packageMovement.create({
      data: {
        packageId: a.packageId,
        count: a.count,
        type: 'SALE',
        orderItemId: args.itemId,
        occurredAt: new Date(),
        createdById: args.createdById,
        createdName: args.createdName,
      },
    })
  }
  return addQty
}

// ------------------------------------------------------
// 매트릭스 입력 조각 (D2a) — D2e 지정 액션도 같은 두 값을 다시 읽는다
// ------------------------------------------------------
/**
 * SKU별 가용재고 합. 왕복 **1회** — 등장한 SKU의 재고 행만 끌어와 메모리에서 합친다.
 * 행 수는 SKU 수에 비례할 뿐이라(현재 제품재고 전체가 636행) 부담이 없다.
 */
export async function loadAvailability(
  skuIds: number[],
): Promise<{ qty: AvailabilityMap; kg: AvailabilityMap }> {
  const pkgs = await prisma.millingOutputPackage.findMany({
    where: { productTypeId: { in: skuIds } },
    select: { productTypeId: true, count: true, weightPerUnit: true, ...MOVEMENT_COUNT_SELECT },
  })
  const qty: AvailabilityMap = {}
  const kg: AvailabilityMap = {}
  for (const id of skuIds) {
    qty[id] = 0
    kg[id] = 0
  }
  for (const p of pkgs) {
    if (p.productTypeId === null) continue
    const n = Math.max(0, availableOf(p))
    qty[p.productTypeId] = (qty[p.productTypeId] ?? 0) + n
    // 🔴 kg는 행마다 곱한다 — 톤백은 재고 행마다 `weightPerUnit`이 다르다(203~1,014kg).
    //    개수 합에 한 중량을 곱하면 C0-a가 잡은 그 결함(11,000 vs 7,067)이 된다.
    kg[p.productTypeId] = (kg[p.productTypeId] ?? 0) + n * p.weightPerUnit
  }
  return { qty, kg }
}

/** 열 머리글에 쓸 SKU 이름들. 왕복 1회. */
export async function loadSkuMeta(skuIds: number[]): Promise<MatrixSkuInput[]> {
  const rows = await prisma.productType.findMany({
    where: { id: { in: skuIds } },
    select: {
      id: true,
      millingType: true,
      packageType: true,
      variety: { select: { name: true, type: true } },
      packaging: { select: { name: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    varietyName: r.variety.name,
    millingType: r.millingType,
    varietyType: r.variety.type,
    packageType: r.packageType,
    packagingName: r.packaging.name,
  }))
}

