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
// 피벗·정렬·상태 파생은 `lib/purchase-order-matrix.ts`(순수 함수)가 한다. 여기서는 조회만.

import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth-guard'
import { sanitizeErrorMessage } from '@/lib/error-sanitize'
import { availableOf, MOVEMENT_COUNT_SELECT } from '@/lib/package-available'
import { describeLoading, todayIsoKst, type LoadingDisplay } from '@/lib/loading-schedule'
import {
  buildMatrix,
  type AvailabilityMap,
  type Matrix,
  type MatrixItemInput,
  type MatrixSkuInput,
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
  | { success: true; header: MatrixHeader; matrix: Matrix }
  | { success: false; error: string }

/**
 * 묶음 하나를 매트릭스로 펼친다.
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

    const matrix = buildMatrix({
      orders: upload.orders.map((o) => ({
        id: o.id,
        vendor: o.vendor,
        recipient: o.recipient,
      })),
      items,
      skus,
      availability,
      availabilityKg,
    })

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
      matrix,
    }
  } catch (error) {
    console.error('[getUploadMatrix] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '매트릭스를 불러오지 못했습니다.') }
  }
}

/**
 * SKU별 가용재고 합. 왕복 **1회** — 등장한 SKU의 재고 행만 끌어와 메모리에서 합친다.
 * 행 수는 SKU 수에 비례할 뿐이라(현재 제품재고 전체가 636행) 부담이 없다.
 */
async function loadAvailability(
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
async function loadSkuMeta(skuIds: number[]): Promise<MatrixSkuInput[]> {
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
