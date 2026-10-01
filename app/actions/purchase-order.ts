'use server'

// 발주서 판매처리 — 묶음 목록 · 삭제 (계획서 §8.3.1)
//
// 흐름: 엑셀 업로드 → 파싱(§8.2.2) → 중복감지(#16) → 적재(Upload+Order+Item) →
//       라인 자동매칭(§8.2.3, productTypeId) → 차감확정(FIFO #3, PackageMovement type=SALE) →
//       라인/건 status 파생(#12).
//
// **업로드(미리보기·적재·비고)는 `purchase-order-upload.ts`로 분리**했다(D1b, 800줄 상한).
// export(원본 양식 복원 + 생산자·로트 채움)는 별도 단계.
// 모든 write = OPERATION_MANAGE(2026-06-22 권한 단순화), 조회(list*/get*) = 공개.
//
// 🔴 **차감은 이 파일에 없다.** 셀 단위(사람이 로트를 고름) = `purchase-order-matrix.ts`의
// `confirmCell`/`cancelCell`, 행 일괄(FIFO 자동) = `purchase-order-batch.ts`.
// 여기 있던 `confirmOrder`·`confirmOrderItem`·`cancelOrderItemMovements`·`listPurchaseOrders`는
// D2c 이후 **호출처가 0건인 채로 남아 있다가** D3에서 삭제됐다(계획서 D3 §5) — 되살리지 말 것.
// 🔴 `getPurchaseOrderDetail`·`DetailLine`·`OrderDetail`도 **M1-1에서 같은 이유로 삭제**했다.
// 건 상세는 서버를 부르지 않는다 — `lib/purchase-order-matrix.ts`의 `buildOrderLines`가 이미
// 클라이언트에 있는 `BuildMatrixInput`에서 파생한다(라인마다 쿼리 2회를 돌던 경로였다).

import type { Prisma, PurchaseChannel } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { allocatedQtyOfItem, recalcOrderStatus } from '@/lib/purchase-order-db'
import { decideOrderCancel, decideQtyChange, MAX_ORDER_QTY } from '@/lib/purchase-order-edit'
import { revalidatePath } from 'next/cache'
import { recordAuditLog } from '@/lib/audit'
import { requirePermission, requireSession } from '@/lib/auth-guard'
import { sanitizeErrorMessage } from '@/lib/error-sanitize'
import {
  compareLoading,
  describeLoading,
  todayIsoKst,
  type LoadingDisplay,
  type LoadingInfo,
} from '@/lib/loading-schedule'
import { toKstDate } from '@/lib/kst-date'

// ======================================================
// 내부 헬퍼
// ======================================================

/** 업로드 일시 표시 문자열 'MM.DD HH:mm' (KST 고정 — 서버 타임존에 좌우되지 않게). */
function formatUploadedAt(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(kst.getUTCMonth() + 1)}.${p(kst.getUTCDate())} ${p(kst.getUTCHours())}:${p(kst.getUTCMinutes())}`
}

// ======================================================
// 조회 (공개)
// ======================================================

export type UploadSummaryRow = {
  id: number
  fileName: string
  sheetName: string // 묶음 = 시트 1장(#30)
  channel: PurchaseChannel // 묶음 단위 채널(G5 해소)
  orderDate: string | null
  note: string | null // 묶음 비고
  orderCount: number
  uploadedName: string | null
  createdAt: string // 표시용 'MM.DD HH:mm' (KST). 서버에서 포맷해 hydration 불일치를 피한다
  statusCount: { pending: number; partial: number; completed: number }
  unmatched: number // 매칭실패 라인 수
  deletable: boolean // 차감된 라인이 하나도 없어야 삭제 가능(#15)
  // 배송·상차(S4) — 목록에서 그 자리에 채울 수 있어야 해서 원본 값도 함께 내려보낸다
  loading: LoadingInfo
  loadingDisplay: LoadingDisplay // '오늘 14:00' 같은 표시 라벨. 오늘 판정이 KST라 서버에서 만든다
  shippingVendorId: number | null
}

export async function listPurchaseUploads(): Promise<
  { success: true; data: UploadSummaryRow[] } | { success: false; error: string }
> {
  try {
    await requireSession()
    const todayIso = todayIsoKst()
    const uploads = await prisma.purchaseOrderUpload.findMany({
      // 정렬은 아래에서 상차 임박순으로 다시 잡는다. 여기서는 동순위를 이을 업로드 최신순만 정해둔다
      orderBy: { createdAt: 'desc' },
      include: {
        shippingVendor: { select: { name: true } },
        orders: {
          select: {
            status: true,
            items: {
              select: { productTypeId: true, _count: { select: { movements: true } } },
            },
          },
        },
      },
    })
    const data: UploadSummaryRow[] = uploads.map((u) => {
      const statusCount = { pending: 0, partial: 0, completed: 0 }
      let unmatched = 0
      let movements = 0
      for (const o of u.orders) {
        if (o.status === 'COMPLETED') statusCount.completed++
        else if (o.status === 'PARTIAL') statusCount.partial++
        else statusCount.pending++
        unmatched += o.items.filter((i) => i.productTypeId === null).length
        movements += o.items.reduce((n, i) => n + i._count.movements, 0)
      }
      const loading: LoadingInfo = {
        loadingDate: u.loadingDate ? toKstDate(u.loadingDate) : null,
        loadingTimeSlot: u.loadingTimeSlot,
        loadingTime: u.loadingTime,
        vendorName: u.shippingVendor?.name ?? null,
      }
      return {
        id: u.id,
        fileName: u.fileName,
        sheetName: u.sheetName,
        channel: u.channel,
        orderDate: u.orderDate ? toKstDate(u.orderDate) : null,
        loading,
        loadingDisplay: describeLoading(loading, todayIso),
        shippingVendorId: u.shippingVendorId,
        note: u.note,
        orderCount: u.orderCount,
        uploadedName: u.uploadedName,
        createdAt: formatUploadedAt(u.createdAt),
        statusCount,
        unmatched,
        deletable: movements === 0,
      }
    })
    // 상차 임박순 — 먼저 나갈 것이 먼저 포장돼야 한다(계획서 §4-S4).
    // findMany가 이미 업로드 최신순이므로, 동순위는 그 순서가 그대로 남는다(Array.sort는 안정 정렬)
    data.sort((a, b) => compareLoading(a.loading, b.loading, todayIso))
    return { success: true, data }
  } catch (error) {
    console.error('[listPurchaseUploads] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '업로드 목록을 불러오지 못했습니다.') }
  }
}

// ======================================================
// 삭제 (#15) — 차감된 movement가 있으면 차단
// ======================================================

export async function deletePurchaseUpload(
  uploadId: number,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePermission('OPERATION_MANAGE')
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

// ======================================================
// 건 상세에서 고치기 (계획서 `plan-발주서-건상세-수정추가.md` 1단계)
// 판정은 `lib/purchase-order-edit.ts`. 쓰기는 전부 트랜잭션 안에서 다시 읽은 값으로 한다.
// 🔴 저장된 파생값 둘을 같이 맞춘다 — 건 `status`(recalcOrderStatus) · 묶음 `orderCount`(건 취소 시 −1).
//    예전 `deletePurchaseOrder`는 `orderCount`를 안 줄였다(화면 호출 0곳이라 드러나지 않았다).
// 🔴 `revalidatePath('/sales')`만 부른다(시트 목록의 건수·진행). 매트릭스 화면은 클라이언트가 `router.refresh()`.
// ======================================================

/** `orderRemoved` = 건이 통째로 사라졌다 — 화면이 건 상세를 닫는다 */
/**
 * 인터랙티브 트랜잭션 시간 — 다른 발주서 쓰기(셀 차감·일괄·업로드)와 같은 값.
 * 🔴 기본값(5초·연결 대기 2초)으로 두면 Neon 왕복 250~300ms × (건 상태 재계산이 품목마다 1회)라
 *    DB가 느린 순간에만 「수량을 고치지 못했습니다」로 터진다(2026-10-01 사용자 재현 — 다시 하면 됐다).
 */
const TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 }

type EditResult = { success: true; message: string; orderRemoved: boolean } | { success: false; error: string }

const QtyInputSchema = z.object({
  itemId: z.number().int().positive(),
  qty: z.number().int().min(0).max(MAX_ORDER_QTY),
})

/** 건 하나를 지우고 묶음 건 수를 줄인다. 차감 확인은 호출부가 먼저 한다(품목은 Cascade) */
async function removeOrder(tx: Prisma.TransactionClient, orderId: number, uploadId: number | null) {
  await tx.purchaseOrder.delete({ where: { id: orderId } })
  if (uploadId !== null) {
    await tx.purchaseOrderUpload.update({ where: { id: uploadId }, data: { orderCount: { decrement: 1 } } })
  }
}

type QtyItem = {
  orderedQty: number
  orderId: number
  rawItemName: string
  packageType: string
  order: { uploadId: number | null; vendor: string; recipient: string; _count: { items: number } }
}
type QtyApplied = { kind: 'noop' | 'update' | 'deleteItem' | 'deleteOrder'; item: QtyItem }

/** 트랜잭션 본문 — 다시 읽고, 판정하고, 쓴다. 거부는 사람에게 보일 문구로 던진다(롤백) */
async function applyQtyChange(tx: Prisma.TransactionClient, itemId: number, qty: number): Promise<QtyApplied> {
  const item = await tx.purchaseOrderItem.findUnique({
    where: { id: itemId },
    select: {
      orderedQty: true,
      orderId: true,
      rawItemName: true,
      packageType: true,
      order: { select: { uploadId: true, vendor: true, recipient: true, _count: { select: { items: true } } } },
    },
  })
  if (!item) throw new Error('품목을 찾을 수 없습니다. 새로고침해 주세요.')
  const d = decideQtyChange({
    orderedQty: item.orderedQty,
    allocatedQty: await allocatedQtyOfItem(tx, itemId),
    newQty: qty,
    otherItemCount: item.order._count.items - 1,
  })
  if (d.kind === 'reject') throw new Error(d.reason)
  if (d.kind === 'update') {
    await tx.purchaseOrderItem.update({ where: { id: itemId }, data: { orderedQty: qty } })
    await recalcOrderStatus(tx, item.orderId)
  } else if (d.kind === 'deleteItem') {
    // 차감이 그 사이 생겼으면 지우지 않는다 — 판매 기록의 orderItemId가 끊긴다(SetNull)
    const r = await tx.purchaseOrderItem.deleteMany({ where: { id: itemId, movements: { none: {} } } })
    if (r.count !== 1) throw new Error('그 사이 차감되었습니다. 새로고침 후 다시 해 주세요.')
    await recalcOrderStatus(tx, item.orderId)
  } else if (d.kind === 'deleteOrder') {
    await removeOrder(tx, item.orderId, item.order.uploadId)
  }
  return { kind: d.kind, item }
}

/** 감사로그 문구 · 토스트 문구 */
function describeQtyChange({ kind, item }: QtyApplied, qty: number): { audit: string; message: string } {
  const what = `${item.order.vendor}/${item.order.recipient} ${item.rawItemName.replace(/\s+/g, ' ')} ${item.packageType}`
  if (kind === 'update') {
    return {
      audit: `발주서 수량 수정 ${what}: ${item.orderedQty} → ${qty}`,
      message: `수량을 ${item.orderedQty} → ${qty}개로 고쳤어요.`,
    }
  }
  if (kind === 'deleteItem') {
    return { audit: `발주서 품목 취소 ${what} (${item.orderedQty}개)`, message: '품목을 취소했어요.' }
  }
  return {
    audit: `발주서 건 취소(마지막 품목) ${what} (${item.orderedQty}개)`,
    message: '마지막 품목이라 건을 취소했어요.',
  }
}

/** 주문 수량 수정. 0 = 품목 취소, 마지막 품목을 0으로 = 건 취소 */
export async function updateOrderItemQty(itemId: number, qty: number): Promise<EditResult> {
  try {
    await requirePermission('OPERATION_MANAGE')
    if (!QtyInputSchema.safeParse({ itemId, qty }).success) {
      return { success: false, error: `수량은 0~${MAX_ORDER_QTY.toLocaleString()} 사이 정수로 넣어 주세요.` }
    }
    const applied = await prisma.$transaction((tx) => applyQtyChange(tx, itemId, qty), TX_OPTIONS)
    if (applied.kind === 'noop') return { success: true, message: '바뀐 게 없어요.', orderRemoved: false }

    const { item, kind } = applied
    const text = describeQtyChange(applied, qty)
    await recordAuditLog({
      action: kind === 'update' ? 'UPDATE' : 'DELETE',
      entity: kind === 'deleteOrder' ? 'PurchaseOrder' : 'PurchaseOrderItem',
      entityId: kind === 'deleteOrder' ? item.orderId : itemId,
      description: text.audit,
      details: { itemId, orderId: item.orderId, uploadId: item.order.uploadId, before: item.orderedQty, after: qty },
    })
    revalidatePath('/sales')
    return { success: true, message: text.message, orderRemoved: kind === 'deleteOrder' }
  } catch (error) {
    console.error('[updateOrderItemQty] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '수량을 고치지 못했습니다.') }
  }
}

/** 건 취소 — 차감이 하나라도 있으면 막는다. 묶음 건 수도 줄인다 */
export async function deletePurchaseOrder(orderId: number): Promise<EditResult> {
  try {
    await requirePermission('OPERATION_MANAGE')
    const order = await prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findUnique({
        where: { id: orderId },
        select: { uploadId: true, vendor: true, recipient: true, _count: { select: { items: true } } },
      })
      if (!order) throw new Error('건을 찾을 수 없습니다. 새로고침해 주세요.')
      const agg = await tx.packageMovement.aggregate({
        where: { orderItem: { orderId }, type: 'SALE' },
        _sum: { count: true },
      })
      const d = decideOrderCancel(agg._sum.count ?? 0)
      if (!d.ok) throw new Error(d.reason)
      await removeOrder(tx, orderId, order.uploadId)
      return order
    }, TX_OPTIONS)
    await recordAuditLog({
      action: 'DELETE',
      entity: 'PurchaseOrder',
      entityId: orderId,
      description: `발주 건 취소 ${order.vendor}/${order.recipient} (${order._count.items}품목) uploadId=${order.uploadId}`,
      details: { orderId, uploadId: order.uploadId },
    })
    revalidatePath('/sales')
    return { success: true, message: `${order.recipient} 건을 취소했어요.`, orderRemoved: true }
  } catch (error) {
    console.error('[deletePurchaseOrder] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '발주 건 취소에 실패했습니다.') }
  }
}
