'use server'

// 발주서 판매처리 — 적재·매칭·차감 액션 (계획서 §8.3.1)
//
// 흐름: 엑셀 업로드 → 파싱(§8.2.2) → 중복감지(#16) → 적재(Upload+Order+Item) →
//       라인 자동매칭(§8.2.3, productTypeId) → 차감확정(FIFO #3, PackageMovement type=SALE) →
//       라인/건 status 파생(#12).
//
// export(원본 양식 복원 + 생산자·로트 채움)는 별도 단계.
// 모든 write = OPERATION_MANAGE(2026-06-22 권한 단순화), 조회(list*/get*) = 공개.

import type { Prisma, PurchaseChannel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { recordAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth-guard'
import { sanitizeErrorMessage } from '@/lib/error-sanitize'
import { validateExcelUpload } from '@/lib/file-validation'
import { parsePurchaseOrder } from '@/lib/purchase-order-parser'
import {
  matchPurchaseOrderItem,
  normalizeItemName,
  type MatcherVariety,
  type MatcherProductType,
} from '@/lib/purchase-order-matcher'
import {
  suggestAllocation,
  computeLineStatus,
  computeOrderStatus,
  orderDuplicateKey,
  detectDuplicateOrders,
  type AvailablePackage,
  type Allocation,
  type LineStatus,
} from '@/lib/purchase-order-allocation'

// ======================================================
// 내부 헬퍼
// ======================================================

/** 'yyyy-mm-dd'(시트명 유래) → Date. 없으면 null. */
function toDateOrNull(iso: string | null): Date | null {
  return iso ? new Date(`${iso}T00:00:00Z`) : null
}

/** 매칭에 쓸 마스터(품종·SKU) 로드 — 순수 매처에 주입. */
async function loadMatcherMasters(): Promise<{
  varieties: MatcherVariety[]
  productTypes: MatcherProductType[]
}> {
  const [vs, pts] = await Promise.all([
    prisma.variety.findMany({
      select: { id: true, name: true, category: true, aliases: true },
    }),
    prisma.productType.findMany({
      where: { active: true },
      include: { packaging: { select: { name: true } } },
    }),
  ])
  return {
    varieties: vs.map((v) => ({
      id: v.id,
      name: v.name,
      category: v.category,
      aliases: v.aliases,
    })),
    productTypes: pts.map((p) => ({
      id: p.id,
      varietyId: p.varietyId,
      millingType: p.millingType,
      packageType: p.packageType,
      packagingId: p.packagingId,
      packagingName: p.packaging.name,
      isDefault: p.isDefault,
      active: p.active,
    })),
  }
}

/** 특정 SKU의 가용 패키지(FIFO 정렬 키 포함). available>0만. */
async function loadAvailablePackages(
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
      movements: { select: { count: true } },
    },
  })
  return pkgs
    .map((p) => {
      const used = p.movements.reduce((s, m) => s + m.count, 0)
      // FIFO: MILLED=createdAt(도정일), PURCHASED=incomingDate(입고일)
      const sortKey =
        p.source === 'PURCHASED' && p.incomingDate ? p.incomingDate : p.createdAt
      return { packageId: p.id, available: p.count - used, sortKey }
    })
    .filter((p) => p.available > 0)
}

/** 한 라인의 확정 차감합(type=SALE). */
async function allocatedQtyOfItem(
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
async function recalcOrderStatus(
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
async function applyAllocations(
  tx: Prisma.TransactionClient,
  args: {
    itemId: number
    productTypeId: number
    orderedQty: number
    allocations: Allocation[]
    createdById?: string
    createdName?: string
  },
): Promise<number> {
  const already = await allocatedQtyOfItem(tx, args.itemId)
  const addQty = args.allocations.reduce((s, a) => s + a.count, 0)
  if (addQty <= 0) return 0
  if (already + addQty > args.orderedQty) {
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

// ======================================================
// 업로드 + 적재 + 자동매칭 (#15·#16·#23)
// ======================================================

export type UploadConflict = { vendor: string; recipient: string }
export type SkippedSheet = { sheetName: string; reason: string }
export type UploadResult =
  | {
      success: true
      uploadId: number
      summary: { orderCount: number; itemCount: number; matched: number; failed: number }
      skipped: SkippedSheet[] // 미인식 시트 경고(오타 방지 — 통일양식 작성안내 5번)
    }
  | { success: false; duplicate: true; conflicts: UploadConflict[]; message: string }
  | { success: false; error: string }

export async function uploadPurchaseOrder(
  formData: FormData,
  opts?: { force?: boolean },
): Promise<UploadResult> {
  const session = await requirePermission('OPERATION_MANAGE')
  try {
    const file = formData.get('file') as File | null
    if (!file) return { success: false, error: '파일이 없습니다.' }
    validateExcelUpload(file)

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = parsePurchaseOrder(buffer, file.name)
    const incomingOrders = parsed.sheets.flatMap((s) =>
      s.orders.map((o) => ({ ...o, channel: s.channel, orderDate: s.orderDate })),
    )
    if (incomingOrders.length === 0) {
      const hint = parsed.skipped.length > 0
        ? ` 인식하지 못한 시트: ${parsed.skipped.map((s) => s.sheetName).join(', ')}`
        : ''
      return { success: false, error: `발주 데이터가 없습니다(빈 발주서).${hint}` }
    }
    // 파일 1개 = 채널 1개(#26). 섞이면 묶음의 채널이 모호해지므로 거부한다.
    if (parsed.channel === null) {
      return {
        success: false,
        error: `한 파일에 채널이 섞여 있습니다(${parsed.channels.join(', ')}). 채널별로 파일을 나눠 올려주세요.`,
      }
    }

    // 중복 감지(#16): 같은 파일명으로 적재된 (발주처+수령인) 겹침 → 경고(강제진행 가능)
    if (!opts?.force) {
      const prior = await prisma.purchaseOrder.findMany({
        where: { upload: { fileName: file.name } },
        select: { orderDate: true, vendor: true, recipient: true },
      })
      const existingKeys = new Set(
        prior.map((o) => orderDuplicateKey(o.orderDate, o.vendor, o.recipient)),
      )
      const dups = detectDuplicateOrders(
        incomingOrders.map((o) => ({
          orderDate: o.orderDate,
          vendor: o.vendor,
          recipient: o.recipient,
        })),
        existingKeys,
      )
      if (dups.length > 0) {
        return {
          success: false,
          duplicate: true,
          conflicts: dups.map((d) => ({ vendor: d.vendor, recipient: d.recipient })),
          message: `같은 파일(${file.name})에서 이미 적재된 발주 ${dups.length}건이 있습니다. 그대로 진행하면 중복 적재됩니다.`,
        }
      }
    }

    const masters = await loadMatcherMasters()

    const result = await prisma.$transaction(async (tx) => {
      const upload = await tx.purchaseOrderUpload.create({
        data: {
          fileName: file.name,
          orderDate: toDateOrNull(parsed.orderDate),
          uploadedById: session.user?.id,
          uploadedName: session.user?.name ?? undefined,
        },
      })

      let itemCount = 0
      let matched = 0
      for (const o of incomingOrders) {
        const order = await tx.purchaseOrder.create({
          data: {
            uploadId: upload.id,
            channel: o.channel,
            orderDate: toDateOrNull(o.orderDate),
            vendor: o.vendor,
            recipient: o.recipient,
            status: 'PENDING',
          },
        })
        for (const item of o.items) {
          const m = matchPurchaseOrderItem(
            { rawItemName: item.rawItemName, packageType: item.packageType, rawPackaging: item.rawPackaging },
            masters.varieties,
            masters.productTypes,
          )
          await tx.purchaseOrderItem.create({
            data: {
              orderId: order.id,
              rawItemName: item.rawItemName,
              packageType: item.packageType,
              rawPackaging: item.rawPackaging,
              orderedQty: item.orderedQty,
              productTypeId: m.matched ? m.productTypeId : null,
            },
          })
          itemCount++
          if (m.matched) matched++
        }
      }

      await tx.purchaseOrderUpload.update({
        where: { id: upload.id },
        data: { orderCount: incomingOrders.length },
      })
      return { uploadId: upload.id, itemCount, matched }
    })

    await recordAuditLog({
      action: 'IMPORT',
      entity: 'PurchaseOrderUpload',
      entityId: result.uploadId,
      description: `발주서 업로드: ${file.name} (${incomingOrders.length}건 / ${result.itemCount}라인, 매칭 ${result.matched})`,
    })
    revalidatePath('/sales')

    return {
      success: true,
      uploadId: result.uploadId,
      summary: {
        orderCount: incomingOrders.length,
        itemCount: result.itemCount,
        matched: result.matched,
        failed: result.itemCount - result.matched,
      },
      skipped: parsed.skipped,
    }
  } catch (error) {
    console.error('[uploadPurchaseOrder] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '발주서 업로드에 실패했습니다.') }
  }
}

// ======================================================
// 조회 (공개)
// ======================================================

export type UploadSummaryRow = {
  id: number
  fileName: string
  orderDate: string | null
  orderCount: number
  uploadedName: string | null
  createdAt: string
  statusCount: { pending: number; partial: number; completed: number }
  unmatched: number // 매칭실패 라인 수
}

export async function listPurchaseUploads(): Promise<
  { success: true; data: UploadSummaryRow[] } | { success: false; error: string }
> {
  try {
    const uploads = await prisma.purchaseOrderUpload.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        orders: { select: { status: true, items: { select: { productTypeId: true } } } },
      },
    })
    const data: UploadSummaryRow[] = uploads.map((u) => {
      const statusCount = { pending: 0, partial: 0, completed: 0 }
      let unmatched = 0
      for (const o of u.orders) {
        if (o.status === 'COMPLETED') statusCount.completed++
        else if (o.status === 'PARTIAL') statusCount.partial++
        else statusCount.pending++
        unmatched += o.items.filter((i) => i.productTypeId === null).length
      }
      return {
        id: u.id,
        fileName: u.fileName,
        orderDate: u.orderDate ? u.orderDate.toISOString().slice(0, 10) : null,
        orderCount: u.orderCount,
        uploadedName: u.uploadedName,
        createdAt: u.createdAt.toISOString().slice(0, 10),
        statusCount,
        unmatched,
      }
    })
    return { success: true, data }
  } catch (error) {
    console.error('[listPurchaseUploads] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '업로드 목록을 불러오지 못했습니다.') }
  }
}

export type OrderRow = {
  id: number
  channel: PurchaseChannel
  vendor: string
  recipient: string
  status: 'PENDING' | 'PARTIAL' | 'COMPLETED'
  itemCount: number
  unmatched: number
}

export async function listPurchaseOrders(
  uploadId: number,
): Promise<{ success: true; data: OrderRow[] } | { success: false; error: string }> {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      where: { uploadId },
      orderBy: { id: 'asc' },
      include: { items: { select: { productTypeId: true } } },
    })
    const data: OrderRow[] = orders.map((o) => ({
      id: o.id,
      channel: o.channel,
      vendor: o.vendor,
      recipient: o.recipient,
      status: o.status,
      itemCount: o.items.length,
      unmatched: o.items.filter((i) => i.productTypeId === null).length,
    }))
    return { success: true, data }
  } catch (error) {
    console.error('[listPurchaseOrders] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '발주 목록을 불러오지 못했습니다.') }
  }
}

export type DetailLine = {
  itemId: number
  rawItemName: string
  packageType: string
  rawPackaging: string | null
  orderedQty: number
  matched: boolean
  productTypeId: number | null
  variety: string | null
  millingType: string | null
  packaging: string | null
  allocatedQty: number // 이미 확정 차감된 수량
  lineStatus: LineStatus
  availableQty: number // 이 SKU 가용 재고 합
  suggestion: Allocation[] // 남은 수량에 대한 FIFO 추천 배분
  shortage: number // 추천으로도 부족한 수량
}

export type OrderDetail = {
  id: number
  channel: PurchaseChannel
  vendor: string
  recipient: string
  status: 'PENDING' | 'PARTIAL' | 'COMPLETED'
  lines: DetailLine[]
}

export async function getPurchaseOrderDetail(
  orderId: number,
): Promise<{ success: true; data: OrderDetail } | { success: false; error: string }> {
  try {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          orderBy: { id: 'asc' },
          include: {
            productType: {
              include: { variety: { select: { name: true } }, packaging: { select: { name: true } } },
            },
          },
        },
      },
    })
    if (!order) return { success: false, error: '발주 건을 찾을 수 없습니다.' }

    const lines: DetailLine[] = await Promise.all(
      order.items.map(async (it) => {
        const allocatedQty = await allocatedQtyOfItem(prisma, it.id)
        let availableQty = 0
        let suggestion: Allocation[] = []
        let shortage = 0
        if (it.productTypeId) {
          const avail = await loadAvailablePackages(prisma, it.productTypeId)
          availableQty = avail.reduce((s, p) => s + p.available, 0)
          const need = it.orderedQty - allocatedQty
          if (need > 0) {
            const res = suggestAllocation(need, avail)
            suggestion = res.allocations
            shortage = res.shortage
          }
        }
        return {
          itemId: it.id,
          rawItemName: it.rawItemName,
          packageType: it.packageType,
          rawPackaging: it.rawPackaging,
          orderedQty: it.orderedQty,
          matched: it.productTypeId !== null,
          productTypeId: it.productTypeId,
          variety: it.productType?.variety.name ?? null,
          millingType: it.productType?.millingType ?? null,
          packaging: it.productType?.packaging.name ?? null,
          allocatedQty,
          lineStatus: computeLineStatus(it.orderedQty, allocatedQty),
          availableQty,
          suggestion,
          shortage,
        }
      }),
    )

    return {
      success: true,
      data: {
        id: order.id,
        channel: order.channel,
        vendor: order.vendor,
        recipient: order.recipient,
        status: order.status,
        lines,
      },
    }
  } catch (error) {
    console.error('[getPurchaseOrderDetail] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '발주 상세를 불러오지 못했습니다.') }
  }
}

// ======================================================
// 매칭 (재매칭 / 수동지정 #18·#22)
// ======================================================

export async function autoMatchOrderItem(
  itemId: number,
): Promise<{ success: true; matched: boolean } | { success: false; error: string }> {
  await requirePermission('OPERATION_MANAGE')
  try {
    const item = await prisma.purchaseOrderItem.findUnique({ where: { id: itemId } })
    if (!item) return { success: false, error: '라인을 찾을 수 없습니다.' }
    const masters = await loadMatcherMasters()
    const m = matchPurchaseOrderItem(
      { rawItemName: item.rawItemName, packageType: item.packageType, rawPackaging: item.rawPackaging },
      masters.varieties,
      masters.productTypes,
    )
    await prisma.purchaseOrderItem.update({
      where: { id: itemId },
      data: { productTypeId: m.matched ? m.productTypeId : null },
    })
    revalidatePath('/sales')
    return { success: true, matched: m.matched }
  } catch (error) {
    console.error('[autoMatchOrderItem] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '재매칭에 실패했습니다.') }
  }
}

export async function setOrderItemProductType(
  itemId: number,
  productTypeId: number,
  opts?: { learnAlias?: boolean },
): Promise<{ success: true } | { success: false; error: string }> {
  await requirePermission('OPERATION_MANAGE')
  try {
    await prisma.$transaction(async (tx) => {
      const item = await tx.purchaseOrderItem.findUnique({ where: { id: itemId } })
      if (!item) throw new Error('라인을 찾을 수 없습니다.')
      const pt = await tx.productType.findUnique({
        where: { id: productTypeId },
        select: { varietyId: true },
      })
      if (!pt) throw new Error('제품유형을 찾을 수 없습니다.')

      await tx.purchaseOrderItem.update({
        where: { id: itemId },
        data: { productTypeId },
      })

      // 별칭 학습(#22): 정규화한 품종토큰을 해당 품종 aliases에 append
      if (opts?.learnAlias) {
        const { varietyToken } = normalizeItemName(item.rawItemName)
        const key = varietyToken.trim()
        const variety = await tx.variety.findUnique({
          where: { id: pt.varietyId },
          select: { name: true, aliases: true },
        })
        if (variety && key && key !== variety.name && !variety.aliases.includes(key)) {
          await tx.variety.update({
            where: { id: pt.varietyId },
            data: { aliases: { push: key } },
          })
        }
      }
    })
    revalidatePath('/sales')
    return { success: true }
  } catch (error) {
    console.error('[setOrderItemProductType] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '품종 지정에 실패했습니다.') }
  }
}

// ======================================================
// 차감 확정 / 취소 (#3·#12·#17)
// ======================================================

export async function confirmOrderItem(
  itemId: number,
  allocations: Allocation[],
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requirePermission('OPERATION_MANAGE')
  try {
    await prisma.$transaction(async (tx) => {
      const item = await tx.purchaseOrderItem.findUnique({ where: { id: itemId } })
      if (!item) throw new Error('라인을 찾을 수 없습니다.')
      if (!item.productTypeId) throw new Error('매칭되지 않은 라인입니다. 먼저 품종을 지정하세요.')
      await applyAllocations(tx, {
        itemId,
        productTypeId: item.productTypeId,
        orderedQty: item.orderedQty,
        allocations,
        createdById: session.user?.id,
        createdName: session.user?.name ?? undefined,
      })
      await recalcOrderStatus(tx, item.orderId)
    })

    await recordAuditLog({
      action: 'CREATE',
      entity: 'PackageMovement',
      description: `발주서 라인 차감확정 itemId=${itemId} (${allocations.reduce((s, a) => s + a.count, 0)}개)`,
    })
    revalidatePath('/sales')
    revalidatePath('/packages')
    return { success: true }
  } catch (error) {
    console.error('[confirmOrderItem] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '차감 확정에 실패했습니다.') }
  }
}

export async function confirmOrder(
  orderId: number,
): Promise<{ success: true; confirmed: number } | { success: false; error: string }> {
  const session = await requirePermission('OPERATION_MANAGE')
  try {
    const confirmed = await prisma.$transaction(async (tx) => {
      const items = await tx.purchaseOrderItem.findMany({ where: { orderId } })
      let total = 0
      for (const item of items) {
        if (!item.productTypeId) continue // 매칭실패 라인은 건너뜀
        const already = await allocatedQtyOfItem(tx, item.id)
        const need = item.orderedQty - already
        if (need <= 0) continue
        const avail = await loadAvailablePackages(tx, item.productTypeId)
        const { allocations } = suggestAllocation(need, avail)
        if (allocations.length === 0) continue
        total += await applyAllocations(tx, {
          itemId: item.id,
          productTypeId: item.productTypeId,
          orderedQty: item.orderedQty,
          allocations,
          createdById: session.user?.id,
          createdName: session.user?.name ?? undefined,
        })
      }
      await recalcOrderStatus(tx, orderId)
      return total
    })

    await recordAuditLog({
      action: 'CREATE',
      entity: 'PurchaseOrder',
      entityId: orderId,
      description: `발주 건 일괄 차감확정 orderId=${orderId} (${confirmed}개)`,
    })
    revalidatePath('/sales')
    revalidatePath('/packages')
    return { success: true, confirmed }
  } catch (error) {
    console.error('[confirmOrder] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '일괄 차감에 실패했습니다.') }
  }
}

export async function cancelOrderItemMovements(
  itemId: number,
): Promise<{ success: true; removed: number } | { success: false; error: string }> {
  await requirePermission('OPERATION_MANAGE')
  try {
    const item = await prisma.purchaseOrderItem.findUnique({ where: { id: itemId } })
    if (!item) return { success: false, error: '라인을 찾을 수 없습니다.' }

    const removed = await prisma.$transaction(async (tx) => {
      const del = await tx.packageMovement.deleteMany({
        where: { orderItemId: itemId, type: 'SALE' },
      })
      await recalcOrderStatus(tx, item.orderId)
      return del.count
    })

    await recordAuditLog({
      action: 'DELETE',
      entity: 'PackageMovement',
      description: `발주서 라인 차감취소 itemId=${itemId} (${removed}건 하드삭제, 재고복원)`,
    })
    revalidatePath('/sales')
    revalidatePath('/packages')
    return { success: true, removed }
  } catch (error) {
    console.error('[cancelOrderItemMovements] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '차감 취소에 실패했습니다.') }
  }
}

// ======================================================
// 삭제 (#15) — 차감된 movement가 있으면 차단
// ======================================================

export async function deletePurchaseUpload(
  uploadId: number,
): Promise<{ success: true } | { success: false; error: string }> {
  await requirePermission('OPERATION_MANAGE')
  try {
    const movementCount = await prisma.packageMovement.count({
      where: { orderItem: { order: { uploadId } } },
    })
    if (movementCount > 0) {
      return { success: false, error: '차감된 건이 있어 삭제할 수 없습니다. 먼저 차감을 취소하세요.' }
    }
    await prisma.$transaction([
      prisma.purchaseOrder.deleteMany({ where: { uploadId } }), // item은 Cascade
      prisma.purchaseOrderUpload.delete({ where: { id: uploadId } }),
    ])
    await recordAuditLog({
      action: 'DELETE',
      entity: 'PurchaseOrderUpload',
      entityId: uploadId,
      description: `발주서 업로드 삭제 uploadId=${uploadId}`,
    })
    revalidatePath('/sales')
    return { success: true }
  } catch (error) {
    console.error('[deletePurchaseUpload] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '업로드 삭제에 실패했습니다.') }
  }
}

export async function deletePurchaseOrder(
  orderId: number,
): Promise<{ success: true } | { success: false; error: string }> {
  await requirePermission('OPERATION_MANAGE')
  try {
    const movementCount = await prisma.packageMovement.count({
      where: { orderItem: { orderId } },
    })
    if (movementCount > 0) {
      return { success: false, error: '차감된 라인이 있어 삭제할 수 없습니다. 먼저 차감을 취소하세요.' }
    }
    await prisma.purchaseOrder.delete({ where: { id: orderId } }) // item Cascade
    await recordAuditLog({
      action: 'DELETE',
      entity: 'PurchaseOrder',
      entityId: orderId,
      description: `발주 건 삭제 orderId=${orderId}`,
    })
    revalidatePath('/sales')
    return { success: true }
  } catch (error) {
    console.error('[deletePurchaseOrder] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '발주 건 삭제에 실패했습니다.') }
  }
}
