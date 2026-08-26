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
import type { LoadingTimeSlot, Prisma, PurchaseChannel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { recordAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth-guard'
import { sanitizeErrorMessage } from '@/lib/error-sanitize'
import { validateExcelUpload } from '@/lib/file-validation'
import { parsePurchaseOrder, type ParsedSheet } from '@/lib/purchase-order-parser'
import { matchPurchaseOrderItem } from '@/lib/purchase-order-matcher'
import { bundleDuplicateKey } from '@/lib/purchase-order-allocation'
import { PURCHASE_CHANNELS } from '@/lib/purchase-channel'
import { pickRecommendedVendor, RECOMMEND_WINDOW } from '@/lib/shipping-recommend'
import {
  loadMatcherMasters,
  toDateOrNull,
  type MatcherMasters,
} from '@/lib/purchase-order-masters'

// ======================================================
// 입력 검증 (시스템 경계)
// ======================================================

const CHANNELS = ['DELIVERY', 'EMART', 'MEAL_SEOUL', 'MEAL_HAENAM', 'CORPORATE'] as const

const TIME_SLOTS = ['UNKNOWN', 'AM', 'PM', 'EXACT'] as const

const NoteSchema = z.string().trim().max(500).nullable()

/** 「직접 입력」을 골랐으면 시각이 있어야 한다 — 등록·상차 수정 양쪽에 같은 규칙을 건다 */
const exactNeedsTime = (v: { loadingTimeSlot: string; loadingTime: string | null }) =>
  v.loadingTimeSlot !== 'EXACT' || v.loadingTime !== null
const EXACT_TIME_ERROR = {
  message: '상차 시각을 「직접 입력」으로 두려면 시각을 채워 주세요.',
  path: ['loadingTime'],
}

const UploadSelectionBase = z
  .object({
    sheetName: z.string().min(1),
    channel: z.enum(CHANNELS), // 추측값이 아니라 사용자가 확정한 채널(#31)
    orderDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '발주일은 yyyy-mm-dd 형식이어야 합니다.')
      .nullable(),
    note: NoteSchema,
    // 배송·상차(S3) — 전부 비워도 등록된다(결정 #37).
    // 필수로 만들면 배차 안 정해진 날 아무거나 채워두고 끝까지 안 고친다
    shippingVendorId: z.number().int().positive().nullable(),
    loadingDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '상차일은 yyyy-mm-dd 형식이어야 합니다.')
      .nullable(),
    loadingTimeSlot: z.enum(TIME_SLOTS),
    loadingTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, '상차 시각은 HH:mm 형식이어야 합니다.')
      .nullable(),
  })

const UploadSelectionSchema = UploadSelectionBase.refine(exactNeedsTime, EXACT_TIME_ERROR)

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

/** 등록 모달의 배송업체 드롭다운 항목 — 사용중인 업체만 내려간다 */
export type ShippingVendorOption = { id: number; name: string }

export type PreviewResult =
  | {
      success: true
      fileName: string
      sheets: SheetPreview[]
      vendors: ShippingVendorOption[]
      /** 채널별 추천 배송업체 id — 고정 패턴이 없는 채널은 키가 없다(결정 #38) */
      recommendedVendorByChannel: Partial<Record<PurchaseChannel, number>>
    }
  | { success: false; error: string }

/**
 * 채널별 추천 배송업체 — 채널마다 최근 3건의 최빈값(결정 #38).
 *
 * 계획서 §6은 「파일에 등장하는 채널만」이었으나 **5채널 전부** 조회한다.
 * 사용자가 화면에서 채널을 바꿀 수 있어(#31) 등장 채널만 조회하면 바꾼 채널의 추천이 비어버리고,
 * 채널당 `take: 3`이라 전부 조회해도 최대 15행으로 비용은 같다(`channel+createdAt` 인덱스).
 *
 * 비활성 업체가 추천되면 드롭다운에 없는 값이 선택된 것처럼 보이므로 걸러낸다.
 */
async function loadShippingRecommendations(
  activeVendorIds: Set<number>,
): Promise<Partial<Record<PurchaseChannel, number>>> {
  const perChannel = await Promise.all(
    PURCHASE_CHANNELS.map(async (channel) => {
      const recent = await prisma.purchaseOrderUpload.findMany({
        where: { channel, shippingVendorId: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: RECOMMEND_WINDOW,
        select: { shippingVendorId: true },
      })
      const picked = pickRecommendedVendor(recent.map((r) => r.shippingVendorId as number))
      return [channel, picked !== null && activeVendorIds.has(picked) ? picked : null] as const
    }),
  )
  return Object.fromEntries(
    perChannel.filter((entry): entry is readonly [PurchaseChannel, number] => entry[1] !== null),
  )
}

export async function previewPurchaseOrder(formData: FormData): Promise<PreviewResult> {
  await requirePermission('OPERATION_MANAGE')
  try {
    const file = formData.get('file') as File | null
    if (!file) return { success: false, error: '파일이 없습니다.' }
    validateExcelUpload(file)

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = parsePurchaseOrder(buffer, file.name)
    const [priorKeys, vendors] = await Promise.all([
      loadPriorBundleKeys(file.name),
      prisma.shippingVendor.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true },
      }),
    ])
    const recommendedVendorByChannel = await loadShippingRecommendations(
      new Set(vendors.map((v) => v.id)),
    )

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

    return {
      success: true,
      fileName: file.name,
      sheets: [...recognized, ...skipped],
      vendors,
      recommendedVendorByChannel,
    }
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
      // 배송·상차(S3) — 상차 시각 문자열은 「직접 입력」일 때만 의미가 있다
      shippingVendorId: selection.shippingVendorId,
      loadingDate: toDateOrNull(selection.loadingDate),
      loadingTimeSlot: selection.loadingTimeSlot as LoadingTimeSlot,
      loadingTime: selection.loadingTimeSlot === 'EXACT' ? selection.loadingTime : null,
      orderCount: sheet.orders.length,
      uploadedById: args.uploadedById,
      uploadedName: args.uploadedName,
    },
  })

  // 건·라인을 하나씩 INSERT하면 왕복이 (건 수 + 라인 수)회가 된다.
  // DB가 Neon 클라우드라 왕복 1회가 250~300ms이고, Prisma 인터랙티브 트랜잭션 기본 타임아웃은 5초다
  // — 실측으로 67건짜리 시트가 INSERT 22회(5,033ms)에서 죽었다.
  // 묶음 1 + 건 전체 1 + 라인 전체 1, **왕복 3회**로 줄인다.
  const createdOrders = await tx.purchaseOrder.createManyAndReturn({
    data: sheet.orders.map((o) => ({
      uploadId: upload.id,
      channel,
      orderDate: toDateOrNull(orderDate),
      vendor: o.vendor,
      recipient: o.recipient,
      status: 'PENDING' as const,
    })),
    select: { id: true },
  })
  // PostgreSQL의 `INSERT ... RETURNING`은 VALUES 순서대로 돌려준다 — 그 순서로 건과 라인을 잇는다.
  // 전제가 깨지면 라인이 엉뚱한 건에 붙으므로 개수만이라도 확인하고 트랜잭션을 되돌린다
  if (createdOrders.length !== sheet.orders.length) {
    throw new Error('발주 건 생성 결과가 입력과 맞지 않습니다.')
  }

  const itemData: Prisma.PurchaseOrderItemCreateManyInput[] = []
  let matched = 0
  sheet.orders.forEach((o, index) => {
    const orderId = createdOrders[index].id
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
      if (m.matched) matched++
      itemData.push({
        orderId,
        rawItemName: item.rawItemName,
        packageType: item.packageType,
        rawPackaging: item.rawPackaging,
        orderedQty: item.orderedQty,
        unitWeightKg: item.unitWeightKg, // 톤백류만 값이 있다(#34)
        productTypeId: m.matched ? m.productTypeId : null,
      })
    }
  })
  if (itemData.length > 0) {
    await tx.purchaseOrderItem.createMany({ data: itemData })
  }
  const itemCount = itemData.length

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

    // 배송업체는 클라이언트가 보내는 id라 실재·사용중인지 확인한다(시스템 경계).
    // FK가 있어 없는 id면 DB가 막아주지만, 그때는 사용자에게 보일 사유가 남지 않는다
    const vendorIds = [...new Set(picked.map((s) => s.shippingVendorId).filter((id) => id !== null))]
    if (vendorIds.length > 0) {
      const found = await prisma.shippingVendor.count({
        where: { id: { in: vendorIds }, active: true },
      })
      if (found !== vendorIds.length) {
        return { success: false, error: '선택한 배송업체를 찾을 수 없습니다. 목록을 새로 불러와 주세요.' }
      }
    }

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
    },
    // 시트를 여러 장 고르면 왕복이 시트 수만큼 늘어난다. 기본 5초는 클라우드 DB에서 너무 빠듯하다
    { timeout: 30_000, maxWait: 10_000 },
    )

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

// ======================================================
// 묶음 배송·상차 수정 (S4 — 목록에서 그 자리에)
// ======================================================

const LoadingPatchSchema = UploadSelectionBase.pick({
  shippingVendorId: true,
  loadingDate: true,
  loadingTimeSlot: true,
  loadingTime: true,
}).refine(exactNeedsTime, EXACT_TIME_ERROR)

export type LoadingPatch = z.infer<typeof LoadingPatchSchema>

/**
 * 「배차 미정」을 목록에서 바로 채우기 위한 액션(계획서 §4-S4).
 * 등록 모달을 다시 열지 않아도 되게 `updateUploadNote`와 같은 결로 둔다.
 */
export async function updateUploadLoading(
  uploadId: number,
  patch: LoadingPatch,
): Promise<{ success: true } | { success: false; error: string }> {
  await requirePermission('OPERATION_MANAGE')
  try {
    const parsed = LoadingPatchSchema.safeParse(patch)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? '상차 정보가 올바르지 않습니다.' }
    }
    const value = parsed.data

    if (value.shippingVendorId !== null) {
      const vendor = await prisma.shippingVendor.count({
        where: { id: value.shippingVendorId, active: true },
      })
      if (vendor === 0) {
        return { success: false, error: '선택한 배송업체를 찾을 수 없습니다.' }
      }
    }

    await prisma.purchaseOrderUpload.update({
      where: { id: uploadId },
      data: {
        shippingVendorId: value.shippingVendorId,
        loadingDate: toDateOrNull(value.loadingDate),
        loadingTimeSlot: value.loadingTimeSlot as LoadingTimeSlot,
        loadingTime: value.loadingTimeSlot === 'EXACT' ? value.loadingTime : null,
      },
    })
    revalidatePath('/sales')
    return { success: true }
  } catch (error) {
    console.error('[updateUploadLoading] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '상차 정보를 저장하지 못했습니다.') }
  }
}
