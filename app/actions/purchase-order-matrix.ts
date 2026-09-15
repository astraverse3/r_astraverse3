'use server'

// 발주서 매트릭스 조회 (계획서 `docs/plan/plan-발주서판매처리-D2매트릭스.md` D2a)
//
// `purchase-order.ts`가 이미 625줄이라 **파일을 분리**한다 —
// D1b에서 `purchase-order-upload.ts`를 뗀 것과 같은 이유(800줄 상한).
//
// 🔴 **라인 수와 무관하게 쿼리 수가 고정이다**(갭 G4 = N+1 제거).
// 택배 묶음은 1,700라인까지 간다 — 라인마다 `loadAvailablePackages`를 부르면 화면이 안 뜬다.
//   ① 묶음 + 건 + 라인 + 차감(movement)  ②③ 가용재고 · SKU 메타(병렬)
//
// ⚠️ **논리 단계는 3이지만 실제 쿼리는 9회다.** Prisma가 중첩 relation을 관계마다
// 별도 SELECT로 쪼갠다(Order·Item·Movement / Package·Movement / ProductType·Variety·Packaging).
// 계획서의 「왕복 1~3회」는 그 동작을 모르고 쓴 값이라 2026-09-09 실측으로 정정했다.
//
// 실측(묶음 #15, 67건 79라인 · Neon): 쿼리 9회 × ~200ms. **앱 처리는 15ms뿐이고 나머지가 전부
// 왕복 지연이다.** ②③을 병렬로 던져 중앙값 1,896ms → **1,432ms**(-464ms).
// 더 줄이려면 ①의 중첩 4회를 JOIN으로 합쳐야 한다(`relationJoins` preview) — 스키마를 건드리므로 보류.
//
// 피벗·정렬·상태 파생은 `lib/purchase-order-matrix.ts`(순수 함수)가 한다. 여기서는 조회만 —
// 🔴 **피벗은 클라이언트가 돌린다**(D2c 결정 C). 서버는 `BuildMatrixInput`을 넘기고, 셀 차감 뒤에는
// 바뀐 두 값(라인 allocatedQty · SKU 가용)만 돌려줘 클라이언트가 `buildMatrix`를 재실행한다(15ms).
// 전체 재조회(1.4초)는 확정이 실패했을 때만 한다.
//
// 셀 액션 3종(`getCellAllocation`·`confirmCell`·`cancelCell`)은 아래 「셀 차감」 절.
// 톤백 셀(D2d)은 `getBulkCellOptions`로 자루 목록을 받고, 확정·취소는 같은 `confirmCell`·`cancelCell`을 쓴다.

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth-guard'
import { recordAuditLog } from '@/lib/audit'
import { sanitizeErrorMessage } from '@/lib/error-sanitize'
import { availableOf, MOVEMENT_COUNT_SELECT } from '@/lib/package-available'
import { describeLoading, todayIsoKst, type LoadingDisplay } from '@/lib/loading-schedule'
import {
  sortFifo,
  suggestAllocation,
  type Allocation,
  type AvailablePackage,
} from '@/lib/purchase-order-allocation'
import { splitAllocationsByLine, type CellLine } from '@/lib/purchase-order-cell'
import { requiredKgOf } from '@/lib/purchase-order-bulk'
import {
  allocatedQtyOfItem,
  applyAllocations,
  loadAvailability,
  loadSkuMeta,
  recalcOrderStatus,
} from '@/lib/purchase-order-db'
import type {
  AvailabilityMap,
  BuildMatrixInput,
  MatrixItemInput,
  MatrixSkuInput,
} from '@/lib/purchase-order-matrix'

/** 매트릭스 상단 요약 — 어느 묶음을 보고 있는지 */
export type MatrixHeader = {
  uploadId: number
  fileName: string
  sheetName: string
  channel: string
  orderDate: string | null
  note: string | null
  orderCount: number
  loading: LoadingDisplay
}

export type UploadMatrixResult =
  | { success: true; header: MatrixHeader; input: BuildMatrixInput }
  | { success: false; error: string }

/**
 * 묶음 하나의 매트릭스 입력을 모은다. 피벗(`buildMatrix`)은 클라이언트가 돌린다(결정 C).
 *
 * 권한은 **`OPERATION_MANAGE`**다. 같은 파일의 다른 조회(`list*`/`get*`)는 공개지만
 * 이 화면은 셀을 눌러 바로 차감하는 작업 화면이라 읽기 단계에서 막는다.
 */
export async function getUploadMatrix(uploadId: number): Promise<UploadMatrixResult> {
  await requirePermission('OPERATION_MANAGE')
  try {
    // ① 묶음 + 건 + 라인 + 차감 — 중첩 include로 한 번에
    const upload = await prisma.purchaseOrderUpload.findUnique({
      where: { id: uploadId },
      select: {
        id: true,
        fileName: true,
        sheetName: true,
        channel: true,
        orderDate: true,
        note: true,
        orderCount: true,
        loadingDate: true,
        loadingTimeSlot: true,
        loadingTime: true,
        shippingVendor: { select: { name: true } },
        orders: {
          select: {
            id: true,
            vendor: true,
            recipient: true,
            items: {
              select: {
                id: true,
                orderId: true,
                rawItemName: true,
                packageType: true,
                rawPackaging: true,
                orderedQty: true,
                unitWeightKg: true,
                productTypeId: true,
                // 이 라인이 실제로 차감한 양. type=SALE만 센다(발주서 경로).
                movements: { where: { type: 'SALE' }, select: { count: true } },
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    })

    if (!upload) return { success: false, error: '묶음을 찾을 수 없습니다.' }

    const items: MatrixItemInput[] = upload.orders.flatMap((o) =>
      o.items.map((it) => ({
        id: it.id,
        orderId: it.orderId,
        rawItemName: it.rawItemName,
        packageType: it.packageType,
        rawPackaging: it.rawPackaging,
        orderedQty: it.orderedQty,
        unitWeightKg: it.unitWeightKg,
        productTypeId: it.productTypeId,
        allocatedQty: it.movements.reduce((s, m) => s + m.count, 0),
      })),
    )

    const skuIds = [...new Set(items.map((i) => i.productTypeId).filter((v): v is number => v !== null))]

    // ②③ 가용재고와 SKU 메타 — 🔴 **서로 독립이라 병렬로 던진다.**
    //    Neon 왕복이 건당 ~200ms라 순차로 하면 그대로 더해진다(실측: 병렬화 전 1.9초).
    //    가용 공식은 `lib/package-available.ts`의 `availableOf` 하나만 쓴다 —
    //    여기서 손으로 빼면 화면과 차감 판정이 갈린다(백로그 §20).
    const [{ qty: availability, kg: availabilityKg }, skus] = await Promise.all([
      skuIds.length > 0
        ? loadAvailability(skuIds)
        : Promise.resolve<{ qty: AvailabilityMap; kg: AvailabilityMap }>({ qty: {}, kg: {} }),
      skuIds.length > 0 ? loadSkuMeta(skuIds) : Promise.resolve<MatrixSkuInput[]>([]),
    ])

    const input: BuildMatrixInput = {
      orders: upload.orders.map((o) => ({
        id: o.id,
        vendor: o.vendor,
        recipient: o.recipient,
      })),
      items,
      skus,
      availability,
      availabilityKg,
    }

    return {
      success: true,
      header: {
        uploadId: upload.id,
        fileName: upload.fileName,
        sheetName: upload.sheetName,
        channel: upload.channel,
        // ⚠️ `toISOString().slice(0,10)`은 UTC로 잘라 하루 밀릴 수 있다(백로그 §39).
        //    기존 조회(`listUploads`)와 **같은 방식**을 쓴다 — 여기만 고치면 같은 묶음이
        //    목록과 매트릭스에서 다른 날짜로 보인다. §39에서 한꺼번에 바꾼다.
        orderDate: upload.orderDate ? upload.orderDate.toISOString().slice(0, 10) : null,
        note: upload.note,
        orderCount: upload.orderCount,
        loading: describeLoading(
          {
            loadingDate: upload.loadingDate ? upload.loadingDate.toISOString().slice(0, 10) : null,
            loadingTimeSlot: upload.loadingTimeSlot,
            loadingTime: upload.loadingTime,
            vendorName: upload.shippingVendor?.name ?? null,
          },
          todayIsoKst(),
        ),
      },
      input,
    }
  } catch (error) {
    console.error('[getUploadMatrix] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '매트릭스를 불러오지 못했습니다.') }
  }
}

// ======================================================
// 셀 차감 (D2c) — 셀 = 수령인 × 규격, 라인이 여럿일 수 있다
// ======================================================
//
// 🔴 **셀 하나 = 트랜잭션 하나**(결정 A). 라인마다 `confirmOrderItem`을 부르면 뒤엣것이
//    실패했을 때 앞엣것만 차감된 채 남는다. 배분을 라인에 나누는 계산은 순수 함수
//    `splitAllocationsByLine`이, DB 쓰기는 `applyAllocations`(가용 재검증·초과 차단)가 한다.
// 🔴 반환은 **바뀐 두 값만** — 라인별 `allocatedQty`와 그 SKU의 가용(개·kg). 클라이언트가
//    `BuildMatrixInput`의 그 자리만 갈아끼우고 `buildMatrix`를 다시 돌린다(결정 C).
//    셀 상태·행 진행률·같은 SKU를 쓰는 다른 행의 재고부족까지 거기서 파생된다 —
//    여기서 상태를 계산해 돌려주면 판정 규칙이 두 곳이 된다.

/** 사람이 고를 수 있는 재고 후보 — `packageId`만으론 못 고른다(로트·날짜·생산자를 함께). */
export type CellCandidate = {
  packageId: number
  lotNo: string | null
  /** MILLED=농가, PURCHASED=매입처 */
  producer: string
  /** 'yyyy-mm-dd'(KST). MILLED=도정일(createdAt), PURCHASED=입고일(incomingDate) — FIFO 기준과 같다 */
  date: string
  source: 'MILLED' | 'PURCHASED'
  available: number
  /** FIFO 추천 개수. 추천에 안 든 후보는 0 */
  suggested: number
}

/** 이미 차감된 내역 — 로트별 합(라인 구분은 사람에게 의미 없다) */
export type CellAllocated = {
  packageId: number
  lotNo: string | null
  date: string
  count: number
}

export type CellAllocation = {
  productTypeId: number
  lines: CellLine[]
  orderedQty: number
  allocatedQty: number
  remainingQty: number
  /** 가용 > 0인 후보, FIFO 순 */
  candidates: CellCandidate[]
  allocated: CellAllocated[]
  /** 추천으로도 못 채우는 개수 */
  shortage: number
}

export type CellAllocationResult =
  | { success: true; data: CellAllocation }
  | { success: false; error: string }

/** 차감·취소가 돌려주는 「바뀐 두 값」 */
export type CellPatch = {
  productTypeId: number
  /** itemId → 새 allocatedQty */
  allocatedQty: Record<number, number>
  availability: number
  availabilityKg: number
}

export type CellMutationResult =
  | { success: true; patch: CellPatch }
  | { success: false; error: string }

/** 셀의 라인들을 읽고 한 SKU·한 건인지 확인한다. 아니면 던진다(호출부 catch). */
async function loadCellItems(tx: Prisma.TransactionClient, itemIds: number[]) {
  if (itemIds.length === 0) throw new Error('셀에 라인이 없습니다.')
  const items = await tx.purchaseOrderItem.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, orderId: true, orderedQty: true, unitWeightKg: true, productTypeId: true },
    orderBy: { id: 'asc' },
  })
  if (items.length !== itemIds.length) throw new Error('라인을 찾을 수 없습니다.')
  const productTypeId = items[0].productTypeId
  if (productTypeId === null) throw new Error('매칭되지 않은 라인입니다. 먼저 품종을 지정하세요.')
  if (items.some((it) => it.productTypeId !== productTypeId || it.orderId !== items[0].orderId)) {
    throw new Error('한 셀의 라인이 아닙니다.')
  }
  return { items, productTypeId, orderId: items[0].orderId }
}

/** FIFO 기준일 — MILLED=도정일(createdAt), PURCHASED=입고일(incomingDate). `loadAvailablePackages`와 같은 규칙. */
function fifoDateOf(p: { source: string; createdAt: Date; incomingDate: Date | null }): Date {
  return p.source === 'PURCHASED' && p.incomingDate ? p.incomingDate : p.createdAt
}

/**
 * 셀 팝오버 데이터 — 라인별 주문·기차감, 재고 후보(FIFO 순), 추천 배분, 부족분.
 * 톤백(`unitWeightKg` 있음)은 여기서 막는다 — 자루가 제각각이라 개수 추천이 성립하지 않는다(D2d).
 */
export async function getCellAllocation(itemIds: number[]): Promise<CellAllocationResult> {
  await requirePermission('OPERATION_MANAGE')
  try {
    const { items, productTypeId } = await loadCellItems(prisma, itemIds)
    if (items.some((it) => it.unitWeightKg !== null)) {
      return { success: false, error: '톤백은 로트를 직접 지정해야 합니다.' }
    }

    const [movements, pkgs] = await Promise.all([
      prisma.packageMovement.findMany({
        where: { orderItemId: { in: itemIds }, type: 'SALE' },
        select: {
          orderItemId: true,
          packageId: true,
          count: true,
          package: { select: { lotNo: true, source: true, createdAt: true, incomingDate: true } },
        },
      }),
      prisma.millingOutputPackage.findMany({
        where: { productTypeId },
        select: {
          id: true,
          count: true,
          source: true,
          lotNo: true,
          createdAt: true,
          incomingDate: true,
          purchaseVendor: true,
          stock: { select: { farmer: { select: { name: true } } } },
          ...MOVEMENT_COUNT_SELECT,
        },
      }),
    ])

    const lines: CellLine[] = items.map((it) => ({
      itemId: it.id,
      orderedQty: it.orderedQty,
      allocatedQty: movements
        .filter((m) => m.orderItemId === it.id)
        .reduce((s, m) => s + m.count, 0),
    }))
    const orderedQty = lines.reduce((s, l) => s + l.orderedQty, 0)
    const allocatedQty = lines.reduce((s, l) => s + l.allocatedQty, 0)
    const remainingQty = Math.max(0, orderedQty - allocatedQty)

    // 후보 — FIFO 순. 추천도 같은 배열에서 내므로 순서가 어긋날 수 없다.
    type Cand = AvailablePackage & Omit<CellCandidate, 'suggested' | 'available'>
    const avail: Cand[] = pkgs.map((p) => {
      const d = fifoDateOf(p)
      return {
        packageId: p.id,
        available: Math.max(0, availableOf(p)),
        sortKey: d,
        lotNo: p.lotNo,
        producer: p.source === 'PURCHASED' ? (p.purchaseVendor ?? '—') : (p.stock?.farmer.name ?? '—'),
        date: todayIsoKst(d),
        source: p.source,
      }
    })
    const sorted = sortFifo(avail)
    const { allocations, shortage } = suggestAllocation(remainingQty, sorted)
    const suggestedOf = new Map(allocations.map((a) => [a.packageId, a.count]))
    const candidates: CellCandidate[] = sorted.map((c) => ({
      packageId: c.packageId,
      lotNo: c.lotNo,
      producer: c.producer,
      date: c.date,
      source: c.source,
      available: c.available,
      suggested: suggestedOf.get(c.packageId) ?? 0,
    }))

    // 기차감 — 로트별 합
    const allocatedByPkg = new Map<number, CellAllocated>()
    for (const m of movements) {
      const cur = allocatedByPkg.get(m.packageId)
      if (cur) cur.count += m.count
      else {
        allocatedByPkg.set(m.packageId, {
          packageId: m.packageId,
          lotNo: m.package.lotNo,
          date: todayIsoKst(fifoDateOf(m.package)),
          count: m.count,
        })
      }
    }

    return {
      success: true,
      data: {
        productTypeId,
        lines,
        orderedQty,
        allocatedQty,
        remainingQty,
        candidates,
        allocated: [...allocatedByPkg.values()],
        shortage,
      },
    }
  } catch (error) {
    console.error('[getCellAllocation] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '셀 정보를 불러오지 못했습니다.') }
  }
}

/** 차감·취소 뒤 「바뀐 두 값」을 다시 읽는다. 트랜잭션 밖(커밋된 진실). */
async function loadCellPatch(itemIds: number[], productTypeId: number): Promise<CellPatch> {
  const [allocs, { qty, kg }] = await Promise.all([
    Promise.all(itemIds.map(async (id) => [id, await allocatedQtyOfItem(prisma, id)] as const)),
    loadAvailability([productTypeId]),
  ])
  return {
    productTypeId,
    allocatedQty: Object.fromEntries(allocs),
    availability: qty[productTypeId] ?? 0,
    availabilityKg: kg[productTypeId] ?? 0,
  }
}

/**
 * 셀 차감 확정 — 한 트랜잭션. 배분은 라인에 나눠(`splitAllocationsByLine`) 라인마다
 * `applyAllocations`로 쓴다(가용은 거기서 다시 검증한다 — 화면 숫자가 낡았어도 초과 차감은 안 된다).
 */
export async function confirmCell(
  itemIds: number[],
  allocations: Allocation[],
): Promise<CellMutationResult> {
  const session = await requirePermission('OPERATION_MANAGE')
  try {
    const total = allocations.reduce((s, a) => s + a.count, 0)
    if (total <= 0) return { success: false, error: '차감할 개수가 없습니다.' }

    const { productTypeId, orderId } = await prisma.$transaction(
      async (tx) => {
        const { items, productTypeId, orderId } = await loadCellItems(tx, itemIds)
        const lines: CellLine[] = await Promise.all(
          items.map(async (it) => ({
            itemId: it.id,
            orderedQty: it.orderedQty,
            allocatedQty: await allocatedQtyOfItem(tx, it.id),
          })),
        )
        // 🔴 톤백 판정은 서버가 라인으로 한다 — 클라이언트 플래그를 믿지 않는다(D2d 결정 J).
        //    톤백은 자루 수가 주문 자루 수와 달라도 정상이라(587+450 두 자루) 초과 차단을 풀고
        //    넘치는 자루는 마지막 라인에 붙인다(결정 F·G). 일반 규격은 기본값 그대로.
        const bulk = items.some((it) => it.unitWeightKg !== null)
        const byLine = splitAllocationsByLine(lines, allocations, bulk ? { overflow: 'last' } : {})
        for (const l of byLine) {
          const item = items.find((it) => it.id === l.itemId)!
          await applyAllocations(tx, {
            itemId: l.itemId,
            productTypeId,
            orderedQty: item.orderedQty,
            allocations: l.allocations,
            createdById: session.user?.id,
            createdName: session.user?.name ?? undefined,
            guard: bulk ? 'open' : 'count',
          })
        }
        await recalcOrderStatus(tx, orderId)
        return { productTypeId, orderId }
      },
      // 🔴 Neon 왕복 250~300ms × (배분 1건당 2회 + INSERT). 기본 5초는 적재 사고 때 이미 터졌다.
      { timeout: 30000 },
    )

    await recordAuditLog({
      action: 'CREATE',
      entity: 'PackageMovement',
      description: `발주서 셀 차감확정 orderId=${orderId} items=[${itemIds.join(',')}] (${total}개)`,
    })
    // 🔴 revalidatePath를 부르지 않는다. Next 액션 핸들러는 revalidate가 한 번이라도 불리면 현재 페이지를
    //    응답에 통째로 다시 그린다(action-handler skipPageRendering=false) — 매트릭스 1.4초 재조회가 매번 붙어
    //    결정 C(15ms 로컬 재계산)가 무효가 된다(브라우저 실측 2026-09-14). /sales·/packages는 세션 기반 동적 렌더라
    //    무효화할 캐시가 없고, 라우터 캐시도 동적 세그먼트는 staleTime 0이라 다음 방문에 새로 읽는다.
    return { success: true, patch: await loadCellPatch(itemIds, productTypeId) }
  } catch (error) {
    console.error('[confirmCell] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '차감 확정에 실패했습니다.') }
  }
}

/** 셀 차감 취소 — 라인들의 SALE movement 하드삭제 + 건 status 재계산 + 감사로그. 반환은 `confirmCell`과 같다. */
export async function cancelCell(itemIds: number[]): Promise<CellMutationResult> {
  await requirePermission('OPERATION_MANAGE')
  try {
    const { productTypeId, orderId, removed } = await prisma.$transaction(async (tx) => {
      const { productTypeId, orderId } = await loadCellItems(tx, itemIds)
      const del = await tx.packageMovement.deleteMany({
        where: { orderItemId: { in: itemIds }, type: 'SALE' },
      })
      await recalcOrderStatus(tx, orderId)
      return { productTypeId, orderId, removed: del.count }
    })

    await recordAuditLog({
      action: 'DELETE',
      entity: 'PackageMovement',
      description: `발주서 셀 차감취소 orderId=${orderId} items=[${itemIds.join(',')}] (${removed}건 하드삭제, 재고복원)`,
    })
    // 🔴 revalidatePath를 부르지 않는다. Next 액션 핸들러는 revalidate가 한 번이라도 불리면 현재 페이지를
    //    응답에 통째로 다시 그린다(action-handler skipPageRendering=false) — 매트릭스 1.4초 재조회가 매번 붙어
    //    결정 C(15ms 로컬 재계산)가 무효가 된다(브라우저 실측 2026-09-14). /sales·/packages는 세션 기반 동적 렌더라
    //    무효화할 캐시가 없고, 라우터 캐시도 동적 세그먼트는 staleTime 0이라 다음 방문에 새로 읽는다.
    return { success: true, patch: await loadCellPatch(itemIds, productTypeId) }
  } catch (error) {
    console.error('[cancelCell] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '차감 취소에 실패했습니다.') }
  }
}

// ======================================================
// 톤백 셀 (D2d) — 자루 목록은 FIFO 순. 추천(kg FIFO)은 클라이언트 순수 함수가, 차이는 보여주기만(§40)
// ======================================================

/** 고를 수 있는 자루 행. `count>1`이면 같은 중량 자루 N개 묶음(실측 43행) */
export type BulkCandidate = {
  packageId: number
  weightPerUnit: number
  /** 가용 자루 수 */
  available: number
  lotNo: string | null
  producer: string
  /** 'yyyy-mm-dd'(KST). MILLED=도정일 / PURCHASED=입고일 */
  date: string
  source: 'MILLED' | 'PURCHASED'
  /** 이 재포장으로 생긴 행이면 그 id — 쪼개기 직후 새 자루를 찾는 데 쓴다 */
  repackId: number | null
}

export type BulkAllocated = {
  packageId: number
  lotNo: string | null
  weightPerUnit: number
  count: number
  kg: number
}

export type BulkCellOptions = {
  productTypeId: number
  lines: (CellLine & { unitWeightKg: number })[]
  /** 요구 kg 합 = Σ orderedQty × unitWeightKg */
  requiredKg: number
  /** 이미 나간 kg = Σ movement.count × weightPerUnit */
  allocatedKg: number
  /** 남은 자루 수(개수 기준 — 완료 판정은 개수, 결정 F) */
  remainingQty: number
  /** FIFO 순(오래된 자루부터). 추천은 이 순서를 그대로 쓴다 */
  candidates: BulkCandidate[]
  allocated: BulkAllocated[]
}

export type BulkCellOptionsResult =
  | { success: true; data: BulkCellOptions }
  | { success: false; error: string }

/**
 * 톤백 셀 팝오버 데이터. 톤백이 아닌 라인이 섞여 있으면 막는다(그쪽은 `getCellAllocation`).
 * 후보는 **FIFO 순**(도정/입고일 → id). 클라이언트 suggestBulkAllocation이 이 순서로 kg을 채운다(사용자 결정 2026-09-14).
 */
export async function getBulkCellOptions(itemIds: number[]): Promise<BulkCellOptionsResult> {
  await requirePermission('OPERATION_MANAGE')
  try {
    const { items, productTypeId } = await loadCellItems(prisma, itemIds)
    if (items.some((it) => it.unitWeightKg === null)) {
      return { success: false, error: '톤백 라인이 아닙니다.' }
    }

    const [movements, pkgs] = await Promise.all([
      prisma.packageMovement.findMany({
        where: { orderItemId: { in: itemIds }, type: 'SALE' },
        select: {
          orderItemId: true,
          packageId: true,
          count: true,
          package: { select: { lotNo: true, weightPerUnit: true } },
        },
      }),
      prisma.millingOutputPackage.findMany({
        where: { productTypeId },
        select: {
          id: true,
          count: true,
          weightPerUnit: true,
          source: true,
          lotNo: true,
          createdAt: true,
          incomingDate: true,
          purchaseVendor: true,
          repackId: true,
          stock: { select: { farmer: { select: { name: true } } } },
          ...MOVEMENT_COUNT_SELECT,
        },
      }),
    ])

    const lines = items.map((it) => ({
      itemId: it.id,
      orderedQty: it.orderedQty,
      unitWeightKg: it.unitWeightKg!,
      allocatedQty: movements.filter((m) => m.orderItemId === it.id).reduce((s, m) => s + m.count, 0),
    }))
    const requiredKg = lines.reduce((s, l) => s + requiredKgOf(l), 0)
    const allocatedKg =
      Math.round(movements.reduce((s, m) => s + m.count * m.package.weightPerUnit, 0) * 10) / 10
    const remainingQty = lines.reduce((s, l) => s + Math.max(0, l.orderedQty - l.allocatedQty), 0)

    const avail = pkgs
      .map((p) => ({
        packageId: p.id,
        weightPerUnit: p.weightPerUnit,
        available: Math.max(0, availableOf(p)),
        lotNo: p.lotNo,
        producer: p.source === 'PURCHASED' ? (p.purchaseVendor ?? '—') : (p.stock?.farmer.name ?? '—'),
        date: todayIsoKst(fifoDateOf(p)),
        source: p.source,
        repackId: p.repackId,
        sortKey: fifoDateOf(p),
      }))
      .filter((c) => c.available > 0)
    const candidates: BulkCandidate[] = sortFifo(avail).map((c) => ({
      packageId: c.packageId,
      weightPerUnit: c.weightPerUnit,
      available: c.available,
      lotNo: c.lotNo,
      producer: c.producer,
      date: c.date,
      source: c.source,
      repackId: c.repackId,
    }))

    const allocatedByPkg = new Map<number, BulkAllocated>()
    for (const m of movements) {
      const cur = allocatedByPkg.get(m.packageId)
      if (cur) {
        cur.count += m.count
        cur.kg = Math.round(cur.count * cur.weightPerUnit * 10) / 10
      } else {
        allocatedByPkg.set(m.packageId, {
          packageId: m.packageId,
          lotNo: m.package.lotNo,
          weightPerUnit: m.package.weightPerUnit,
          count: m.count,
          kg: Math.round(m.count * m.package.weightPerUnit * 10) / 10,
        })
      }
    }

    return {
      success: true,
      data: {
        productTypeId,
        lines,
        requiredKg,
        allocatedKg,
        remainingQty,
        candidates,
        allocated: [...allocatedByPkg.values()],
      },
    }
  } catch (error) {
    console.error('[getBulkCellOptions] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '톤백 재고를 불러오지 못했습니다.') }
  }
}
