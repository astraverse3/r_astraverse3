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

import type { PurchaseChannel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { recordAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth-guard'
import { sanitizeErrorMessage } from '@/lib/error-sanitize'
import {
  compareLoading,
  describeLoading,
  todayIsoKst,
  type LoadingDisplay,
  type LoadingInfo,
} from '@/lib/loading-schedule'

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
        loadingDate: u.loadingDate ? u.loadingDate.toISOString().slice(0, 10) : null,
        loadingTimeSlot: u.loadingTimeSlot,
        loadingTime: u.loadingTime,
        vendorName: u.shippingVendor?.name ?? null,
      }
      return {
        id: u.id,
        fileName: u.fileName,
        sheetName: u.sheetName,
        channel: u.channel,
        orderDate: u.orderDate ? u.orderDate.toISOString().slice(0, 10) : null,
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
