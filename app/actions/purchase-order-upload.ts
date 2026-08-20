'use server'

// 발주서 업로드 — 2단계(결정 #31). 미리보기(파싱만) → 시트 선택·확정 → 적재.
//
// 묶음 단위는 「시트 1장」이다(#30). 한 파일에 여러 채널 시트가 섞여 있어도 그대로 받고,
// 어떤 시트를 어떤 채널·발주일로 적재할지는 사람이 화면에서 확정한다.
//
// 파싱 결과를 클라이언트로 왕복시키지 않는다(조작 방지). 미리보기·적재가 각각 파일을 받아
// 서버에서 다시 파싱하고, 클라이언트가 보내는 것은 「선택한 시트 + 확정 채널·발주일·비고」뿐이다.
//
// write 권한 = OPERATION_MANAGE (2026-06-22 권한 단순화).

import { z } from 'zod'
import type { Prisma, PurchaseChannel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { recordAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth-guard'
import { sanitizeErrorMessage } from '@/lib/error-sanitize'
import { validateExcelUpload } from '@/lib/file-validation'
import { parsePurchaseOrder, type ParsedSheet } from '@/lib/purchase-order-parser'
import { matchPurchaseOrderItem } from '@/lib/purchase-order-matcher'
import { bundleDuplicateKey } from '@/lib/purchase-order-allocation'
import {
  loadMatcherMasters,
  toDateOrNull,
  type MatcherMasters,
} from '@/lib/purchase-order-masters'

// ======================================================
// 입력 검증 (시스템 경계)
// ======================================================

const CHANNELS = ['DELIVERY', 'EMART', 'MEAL_SEOUL', 'MEAL_HAENAM', 'CORPORATE'] as const

const NoteSchema = z.string().trim().max(500).nullable()

const UploadSelectionSchema = z.object({
  sheetName: z.string().min(1),
  channel: z.enum(CHANNELS), // 추측값이 아니라 사용자가 확정한 채널(#31)
  orderDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '발주일은 yyyy-mm-dd 형식이어야 합니다.')
    .nullable(),
  note: NoteSchema,
})

const UploadSelectionsSchema = z.array(UploadSelectionSchema).min(1)

export type UploadSelection = z.infer<typeof UploadSelectionSchema>

// ======================================================
// 1단계 — 미리보기 (파싱만, DB 적재 없음)
// ======================================================

export type SheetPreview = {
  sheetName: string
  recognized: boolean // 발주서 양식으로 인식됐는지(헤더 구조 기준 #31)
  reason: string | null // 미인식 사유
  suggestedChannel: PurchaseChannel | null // 시트명 추측. null이면 화면에서 골라야 한다
  suggestedOrderDate: string | null // 'yyyy-mm-dd'
  orderCount: number
  itemCount: number
  warnings: string[] // 음수·소계 불일치·단위 누락 등(#28·#29·#33)
  alreadyUploaded: boolean // 같은 (파일명+시트명+발주일) 묶음이 이미 있음
}

export type PreviewResult =
  | { success: true; fileName: string; sheets: SheetPreview[] }
  | { success: false; error: string }

export async function previewPurchaseOrder(formData: FormData): Promise<PreviewResult> {
  await requirePermission('OPERATION_MANAGE')
  try {
    const file = formData.get('file') as File | null
    if (!file) return { success: false, error: '파일이 없습니다.' }
    validateExcelUpload(file)

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = parsePurchaseOrder(buffer, file.name)
    const priorKeys = await loadPriorBundleKeys(file.name)

    const recognized: SheetPreview[] = parsed.sheets.map((s) => ({
      sheetName: s.sheetName,
      recognized: true,
      reason: null,
      suggestedChannel: s.suggestedChannel,
      suggestedOrderDate: s.suggestedOrderDate,
      orderCount: s.orders.length,
      itemCount: s.orders.reduce((n, o) => n + o.items.length, 0),
      warnings: s.warnings,
      alreadyUploaded: priorKeys.has(
        bundleDuplicateKey(file.name, s.sheetName, s.suggestedOrderDate),
      ),
    }))
    // 미인식 시트도 함께 보여준다 — 시트명 오타로 조용히 빠지는 걸 막기 위해(작성안내 5번)
    const skipped: SheetPreview[] = parsed.skipped.map((s) => ({
      sheetName: s.sheetName,
      recognized: false,
      reason: s.reason,
      suggestedChannel: null,
      suggestedOrderDate: null,
      orderCount: 0,
      itemCount: 0,
      warnings: [],
      alreadyUploaded: false,
    }))

    return { success: true, fileName: file.name, sheets: [...recognized, ...skipped] }
  } catch (error) {
    console.error('[previewPurchaseOrder] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '발주서를 읽지 못했습니다.') }
  }
}

// ======================================================
// 2단계 — 선택한 시트 적재
// ======================================================

export type UploadConflict = { sheetName: string; orderDate: string | null }
/** 적재된 묶음 1건 = 시트 1장 (#30). */
export type UploadedBundle = {
  uploadId: number
  sheetName: string
  channel: PurchaseChannel
  orderDate: string | null
  orderCount: number
  itemCount: number
  matched: number
}
export type UploadResult =
  | {
      success: true
      bundles: UploadedBundle[]
      summary: {
        bundleCount: number
        orderCount: number
        itemCount: number
        matched: number
        failed: number
      }
      warnings: string[] // 적재한 시트의 파서 경고(#28·#29·#33)
    }
  | { success: false; duplicate: true; conflicts: UploadConflict[]; message: string }
  | { success: false; error: string }

/** 같은 파일명으로 이미 적재된 묶음 키 집합(#16 개정 — 파일명+시트명+발주일). */
async function loadPriorBundleKeys(fileName: string): Promise<Set<string>> {
  const prior = await prisma.purchaseOrderUpload.findMany({
    where: { fileName },
    select: { sheetName: true, orderDate: true },
  })
  return new Set(prior.map((b) => bundleDuplicateKey(fileName, b.sheetName, b.orderDate)))
}

/** 시트 1장 적재 — 묶음 + 건 + 라인. 트랜잭션 안에서만 호출한다. */
async function insertSheetBundle(
  tx: Prisma.TransactionClient,
  args: {
    fileName: string
    sheet: ParsedSheet
    selection: UploadSelection
    uploadedById?: string
    uploadedName?: string
    masters: MatcherMasters
  },
): Promise<UploadedBundle> {
  const { fileName, sheet, selection, masters } = args
  const { channel, orderDate } = selection
  const upload = await tx.purchaseOrderUpload.create({
    data: {
      fileName,
      sheetName: sheet.sheetName,
      channel,
      orderDate: toDateOrNull(orderDate),
      note: selection.note && selection.note.length > 0 ? selection.note : null,
      orderCount: sheet.orders.length,
      uploadedById: args.uploadedById,
      uploadedName: args.uploadedName,
    },
  })

  let itemCount = 0
  let matched = 0
  for (const o of sheet.orders) {
    const order = await tx.purchaseOrder.create({
      data: {
        uploadId: upload.id,
        channel,
        orderDate: toDateOrNull(orderDate),
        vendor: o.vendor,
        recipient: o.recipient,
        status: 'PENDING',
      },
    })
    for (const item of o.items) {
      const m = matchPurchaseOrderItem(
        {
          rawItemName: item.rawItemName,
          packageType: item.packageType,
          rawPackaging: item.rawPackaging,
        },
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
          unitWeightKg: item.unitWeightKg, // 톤백류만 값이 있다(#34)
          productTypeId: m.matched ? m.productTypeId : null,
        },
      })
      itemCount++
      if (m.matched) matched++
    }
  }

  return {
    uploadId: upload.id,
    sheetName: sheet.sheetName,
    channel,
    orderDate,
    orderCount: sheet.orders.length,
    itemCount,
    matched,
  }
}

/** 선택 목록이 실제 파싱 결과와 맞는지 확인. 어긋나면 사용자에게 보일 사유를 돌려준다. */
function validateSelections(
  selections: UploadSelection[],
  bySheet: Map<string, ParsedSheet>,
): string | null {
  const dupNames = selections
    .map((s) => s.sheetName)
    .filter((name, i, arr) => arr.indexOf(name) !== i)
  if (dupNames.length > 0) {
    return `같은 시트를 두 번 선택했습니다(${[...new Set(dupNames)].join(', ')}).`
  }
  const missing = selections.filter((s) => !bySheet.has(s.sheetName))
  if (missing.length > 0) {
    return `파일에서 찾을 수 없는 시트입니다(${missing.map((s) => s.sheetName).join(', ')}). 파일이 바뀌었는지 확인해 주세요.`
  }
  const empty = selections.filter((s) => (bySheet.get(s.sheetName)?.orders.length ?? 0) === 0)
  if (empty.length > 0) {
    return `발주 데이터가 없는 시트입니다(${empty.map((s) => s.sheetName).join(', ')}).`
  }
  return null
}

export async function uploadPurchaseOrder(
  formData: FormData,
  selections: UploadSelection[],
): Promise<UploadResult> {
  const session = await requirePermission('OPERATION_MANAGE')
  try {
    const file = formData.get('file') as File | null
    if (!file) return { success: false, error: '파일이 없습니다.' }
    validateExcelUpload(file)

    const parsedSelections = UploadSelectionsSchema.safeParse(selections)
    if (!parsedSelections.success) {
      return { success: false, error: '적재할 시트 선택 값이 올바르지 않습니다.' }
    }
    const picked = parsedSelections.data

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = parsePurchaseOrder(buffer, file.name)
    const bySheet = new Map(parsed.sheets.map((s) => [s.sheetName, s]))

    const invalid = validateSelections(picked, bySheet)
    if (invalid) return { success: false, error: invalid }

    // 중복 감지(#16 개정): 묶음 키가 DB unique와 같아 강제진행이 성립하지 않는다.
    const priorKeys = await loadPriorBundleKeys(file.name)
    const dups = picked.filter((s) =>
      priorKeys.has(bundleDuplicateKey(file.name, s.sheetName, s.orderDate)),
    )
    if (dups.length > 0) {
      return {
        success: false,
        duplicate: true,
        conflicts: dups.map((s) => ({ sheetName: s.sheetName, orderDate: s.orderDate })),
        message: `이미 적재된 시트입니다(${dups.map((s) => s.sheetName).join(', ')}). 다시 올리려면 묶음 목록에서 기존 묶음을 삭제해 주세요.`,
      }
    }

    const masters = await loadMatcherMasters()

    const bundles = await prisma.$transaction(async (tx) => {
      const created: UploadedBundle[] = []
      for (const selection of picked) {
        created.push(
          await insertSheetBundle(tx, {
            fileName: file.name,
            sheet: bySheet.get(selection.sheetName) as ParsedSheet,
            selection,
            uploadedById: session.user?.id,
            uploadedName: session.user?.name ?? undefined,
            masters,
          }),
        )
      }
      return created
    })

    for (const b of bundles) {
      await recordAuditLog({
        action: 'IMPORT',
        entity: 'PurchaseOrderUpload',
        entityId: b.uploadId,
        description: `발주서 업로드: ${file.name} [${b.sheetName}] (${b.orderCount}건 / ${b.itemCount}라인, 매칭 ${b.matched})`,
      })
    }
    revalidatePath('/sales')

    return {
      success: true,
      bundles,
      summary: bundles.reduce(
        (acc, b) => ({
          bundleCount: acc.bundleCount + 1,
          orderCount: acc.orderCount + b.orderCount,
          itemCount: acc.itemCount + b.itemCount,
          matched: acc.matched + b.matched,
          failed: acc.failed + (b.itemCount - b.matched),
        }),
        { bundleCount: 0, orderCount: 0, itemCount: 0, matched: 0, failed: 0 },
      ),
      warnings: picked.flatMap((s) =>
        (bySheet.get(s.sheetName)?.warnings ?? []).map((w) => `[${s.sheetName}] ${w}`),
      ),
    }
  } catch (error) {
    console.error('[uploadPurchaseOrder] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '발주서 업로드에 실패했습니다.') }
  }
}

// ======================================================
// 묶음 비고 수정
// ======================================================

export async function updateUploadNote(
  uploadId: number,
  note: string | null,
): Promise<{ success: true } | { success: false; error: string }> {
  await requirePermission('OPERATION_MANAGE')
  try {
    const parsed = NoteSchema.safeParse(note)
    if (!parsed.success) return { success: false, error: '비고는 500자까지 입력할 수 있습니다.' }
    const value = parsed.data && parsed.data.length > 0 ? parsed.data : null

    await prisma.purchaseOrderUpload.update({ where: { id: uploadId }, data: { note: value } })
    revalidatePath('/sales')
    return { success: true }
  } catch (error) {
    console.error('[updateUploadNote] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '비고를 저장하지 못했습니다.') }
  }
}
