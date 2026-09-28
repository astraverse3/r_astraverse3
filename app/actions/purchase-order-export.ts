'use server'

// 발주서 시트 엑셀 내보내기 (계획서 `docs/plan/plan-발주서-D5-엑셀내보내기.md`)
//
// 시트 목록 ⋮ 「엑셀 다운로드」가 부른다. 모양은 `lib/purchase-order-export.ts`(순수 함수)가 세우고,
// 여기서는 조회 → 워크북 → base64만 한다(`exportPackages` 패턴).
//
// 권한은 **로그인만**(도메인 계획서 §8 — 생산자·로트가 채워지는 내부 증빙이라 공개 노출은 금지,
// 쓰기가 아니라 `OPERATION_MANAGE`까지는 요구하지 않는다).
// 🔴 가드는 `try` 안에 둔다 — 밖에 두면 거부가 결과로 안 담기고 reject돼 「실패했습니다」만 뜬다.
//
// 쿼리 수는 품목 수와 무관하다 — ① 시트+건+품목+차감(로트·생산자 포함) ②③ 가용재고·SKU 메타(병렬).
// SKU 메타는 열 순서를 매트릭스 화면과 같게 묶는 데 쓴다(화면은 품종·도정·포장지로 묶는다).

import { z } from 'zod'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth-guard'
import { recordAuditLog } from '@/lib/audit'
import { sanitizeErrorMessage } from '@/lib/error-sanitize'
import { channelLabel } from '@/lib/purchase-channel'
import { loadAvailability, loadSkuMeta } from '@/lib/purchase-order-db'
import type { AvailabilityMap, MatrixItemInput, MatrixSkuInput } from '@/lib/purchase-order-matrix'
import {
  buildExportSheet,
  formatKstDateTime,
  formatTitleDate,
  safeSheetName,
  toWorksheet,
  type ExportAllocation,
} from '@/lib/purchase-order-export'
import { STATUS_META } from '@/app/(dashboard)/sales/purchase/[uploadId]/status-meta'

const UploadIdSchema = z.number().int().positive()

const MOVEMENT_SELECT = {
  where: { type: 'SALE' as const },
  select: {
    count: true,
    packageId: true,
    package: {
      select: {
        lotNo: true,
        purchaseVendor: true,
        stock: { select: { lotNo: true, farmer: { select: { name: true } } } },
      },
    },
  },
  orderBy: { id: 'asc' as const },
}

function loadSheet(uploadId: number) {
  return prisma.purchaseOrderUpload.findUnique({
    where: { id: uploadId },
    select: {
      id: true,
      sheetName: true,
      channel: true,
      orderDate: true,
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
              movements: MOVEMENT_SELECT,
            },
            // 🔴 id 순 = 원본 열 순서. 빼면 UPDATE된 품목이 뒤로 밀린다(`getUploadMatrix` 주석 참조)
            orderBy: { id: 'asc' },
          },
        },
        orderBy: { id: 'asc' },
      },
    },
  })
}

type LoadedSheet = NonNullable<Awaited<ReturnType<typeof loadSheet>>>

function toExportRows(sheet: LoadedSheet): { items: MatrixItemInput[]; allocations: ExportAllocation[] } {
  const rawItems = sheet.orders.flatMap((o) => o.items)
  const items = rawItems.map(({ movements, ...it }) => ({
    ...it,
    allocatedQty: movements.reduce((s, m) => s + m.count, 0),
  }))
  const allocations = rawItems.flatMap((it) =>
    it.movements.map((m) => ({
      itemId: it.id,
      packageId: m.packageId,
      count: m.count,
      farmerName: m.package.stock?.farmer.name ?? null,
      lotNo: m.package.lotNo ?? m.package.stock?.lotNo ?? null,
      purchaseVendor: m.package.purchaseVendor,
    })),
  )
  return { items, allocations }
}

export async function exportPurchaseSheet(
  uploadId: number,
): Promise<{ success: true; data: string; fileName: string } | { success: false; error: string }> {
  try {
    const session = await requireSession()
    const id = UploadIdSchema.parse(uploadId)

    const sheet = await loadSheet(id)
    if (!sheet) return { success: false, error: '시트를 찾을 수 없습니다.' }

    const { items, allocations } = toExportRows(sheet)
    const skuIds = [...new Set(items.map((i) => i.productTypeId).filter((v): v is number => v !== null))]
    const [{ qty, kg }, skus] = await Promise.all([
      skuIds.length > 0
        ? loadAvailability(skuIds)
        : Promise.resolve({ qty: {} as AvailabilityMap, kg: {} as AvailabilityMap }),
      skuIds.length > 0 ? loadSkuMeta(skuIds) : Promise.resolve<MatrixSkuInput[]>([]),
    ])

    const channel = channelLabel(sheet.channel)
    const built = buildExportSheet({
      matrix: {
        orders: sheet.orders.map((o) => ({ id: o.id, vendor: o.vendor, recipient: o.recipient })),
        items,
        skus,
        availability: qty,
        availabilityKg: kg,
      },
      allocations,
      title: sheet.orderDate ? `${formatTitleDate(sheet.orderDate)}\n${channel}` : channel,
      footerLines: [
        `내보낸 시각 ${formatKstDateTime(new Date())} · 내보낸 사람 ${session.user?.name ?? '-'}`,
        '원본에서 주문이 0인 행·열과 제목 칸의 메모는 저장되지 않아 빠져 있습니다.',
        '재고부족 표시는 내보낸 시각의 가용재고 기준입니다.',
      ],
      statusLabel: (s) => STATUS_META[s].label,
    })

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, toWorksheet(built), safeSheetName(sheet.sheetName))
    const data = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' })

    await recordAuditLog({
      action: 'EXPORT',
      entity: 'PurchaseOrderUpload',
      entityId: sheet.id,
      details: { sheetName: sheet.sheetName, orders: sheet.orders.length, incomplete: built.incompleteCount },
      description: `발주서 시트 엑셀 다운로드: ${sheet.sheetName}`,
    })

    return { success: true, data, fileName: `${sheet.sheetName}_차감결과.xlsx` }
  } catch (error) {
    console.error('[exportPurchaseSheet] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '엑셀 다운로드에 실패했습니다.') }
  }
}
