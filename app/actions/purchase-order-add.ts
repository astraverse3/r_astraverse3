'use server'

// 발주서 — 작업 중인 시트에 품목·주문 추가 (계획서 `docs/plan/plan-발주서-건상세-수정추가.md` 2단계)
//
// 🔴 SKU를 정하는 경로는 매처 하나다. 사람이 고른 SKU에서 원본 값(품목명·규격·포장지)을 만들고
//    매처로 다시 돌려 같은 SKU가 나와야 저장한다(`lib/purchase-order-add.ts` `rawItemFor`).
//    목록(`listAddableSkus`)도 그 검증을 통과하는 SKU만 내려보낸다 — 고른 건 반드시 추가된다.
// 🔴 저장된 파생값을 같은 트랜잭션에서 맞춘다 — 건 `status`(recalcOrderStatus) · 묶음 `orderCount`(주문 추가 +1).
// 🔴 트랜잭션은 30초(기본 5초는 Neon에서 P2028로 터진다 — 2026-10-01).
// 🔴 `revalidatePath('/sales')`만 부른다. 매트릭스 화면은 클라이언트가 `router.refresh()`.

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth-guard'
import { recordAuditLog } from '@/lib/audit'
import { sanitizeErrorMessage } from '@/lib/error-sanitize'
import { getDisplayMillingType } from '@/lib/milling-type-display'
import { compareSpec } from '@/lib/package-spec'
import { loadMatcherMasters } from '@/lib/purchase-order-masters'
import { recalcOrderStatus } from '@/lib/purchase-order-db'
import { MAX_ORDER_QTY } from '@/lib/purchase-order-edit'
import { cleanName, rawItemFor, type RawItem } from '@/lib/purchase-order-add'

const TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 }
const MISC_MILLING_SENTINEL = '기타'
const NOT_ADDABLE = '이 제품은 추가할 수 없어요(품목명으로 매칭이 안 돼요). 품종 관리의 별칭을 확인해 주세요.'

export type AddableSku = {
  id: number
  /** `서농22호 · 현미` — 매트릭스 머리글 1행과 같은 표기(백미·잡곡은 품종명만) */
  name: string
  spec: string
  packaging: string
}

/** 추가할 수 있는 SKU 목록 — 활성 · 톤백/잔량 제외 · 매처 검증 통과만. 이름 → 규격(무거운 것부터) → 포장지 순 */
export async function listAddableSkus(): Promise<{ success: true; data: AddableSku[] } | { success: false; error: string }> {
  try {
    await requirePermission('OPERATION_MANAGE')
    const { varieties, productTypes } = await loadMatcherMasters()
    const data = productTypes
      .filter((p) => rawItemFor(p, varieties, productTypes) !== null)
      .map((p) => {
        const v = varieties.find((x) => x.id === p.varietyId)
        const milling =
          p.millingType === MISC_MILLING_SENTINEL ? null : getDisplayMillingType(p.millingType, v?.type ?? null)
        const name = milling && milling !== '백미' ? `${v?.name ?? ''} · ${milling}` : (v?.name ?? '')
        return { id: p.id, name, spec: p.packageType, packaging: p.packagingName }
      })
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name, 'ko') ||
          compareSpec(a.spec, b.spec) ||
          a.packaging.localeCompare(b.packaging, 'ko'),
      )
    return { success: true, data }
  } catch (error) {
    console.error('[listAddableSkus] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '제품 목록을 불러오지 못했습니다.') }
  }
}

/** 고른 SKU의 원본 값 — 매처 검증을 통과해야 한다. 실패는 사람에게 보일 문구로 던진다 */
async function resolveRaw(productTypeId: number): Promise<RawItem> {
  const { varieties, productTypes } = await loadMatcherMasters()
  const sku = productTypes.find((p) => p.id === productTypeId)
  const raw = sku ? rawItemFor(sku, varieties, productTypes) : null
  if (!raw) throw new Error(NOT_ADDABLE)
  return raw
}

const ItemSchema = z.object({
  productTypeId: z.number().int().positive(),
  qty: z.number().int().min(1).max(MAX_ORDER_QTY),
})

type AddResult = { success: true; message: string; orderId: number } | { success: false; error: string }

/** 건 상세 「+ 품목 추가」 — 같은 건에 같은 SKU 줄이 이미 있으면 거부(수량을 고치게) */
export async function addOrderItem(orderId: number, productTypeId: number, qty: number): Promise<AddResult> {
  try {
    await requirePermission('OPERATION_MANAGE')
    if (!Number.isInteger(orderId) || !ItemSchema.safeParse({ productTypeId, qty }).success) {
      return { success: false, error: `수량은 1~${MAX_ORDER_QTY.toLocaleString()} 사이 정수로 넣어 주세요.` }
    }
    const raw = await resolveRaw(productTypeId)
    const order = await prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findUnique({
        where: { id: orderId },
        select: {
          uploadId: true,
          vendor: true,
          recipient: true,
          items: { where: { productTypeId, unitWeightKg: null }, select: { id: true } },
        },
      })
      if (!order) throw new Error('건을 찾을 수 없습니다. 새로고침해 주세요.')
      if (order.items.length > 0) throw new Error('이미 있는 품목이에요. 그 줄의 수량을 고치세요.')
      await tx.purchaseOrderItem.create({
        data: { orderId, ...raw, orderedQty: qty, unitWeightKg: null, productTypeId },
      })
      await recalcOrderStatus(tx, orderId)
      return order
    }, TX_OPTIONS)

    await recordAuditLog({
      action: 'CREATE',
      entity: 'PurchaseOrderItem',
      description: `발주서 품목 추가 ${order.vendor}/${order.recipient} ${raw.rawItemName} ${raw.packageType} ${raw.rawPackaging} ${qty}개`,
      details: { orderId, uploadId: order.uploadId, productTypeId, qty },
    })
    revalidatePath('/sales')
    return { success: true, message: `${raw.rawItemName} ${raw.packageType} ${qty}개를 추가했어요.`, orderId }
  } catch (error) {
    console.error('[addOrderItem] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '품목을 추가하지 못했습니다.') }
  }
}

const OrderSchema = z.object({
  uploadId: z.number().int().positive(),
  vendor: z.string().min(1).max(100),
  recipient: z.string().min(1).max(100),
})

export type NewOrderInput = {
  uploadId: number
  vendor: string
  /** 비면 발주처와 같게(파서와 같은 규칙 — 수령인 칸이 없는 채널) */
  recipient: string
  productTypeId: number
  qty: number
}

/** 「+ 주문 추가」 — 첫 품목까지 한 번에(빈 건이 생기지 않게). 같은 발주처+수령인 건이 있으면 거부 */
export async function addPurchaseOrder(input: NewOrderInput): Promise<AddResult> {
  try {
    await requirePermission('OPERATION_MANAGE')
    const vendor = cleanName(input.vendor)
    const recipient = cleanName(input.recipient) || vendor
    if (!OrderSchema.safeParse({ uploadId: input.uploadId, vendor, recipient }).success) {
      return { success: false, error: '이름을 넣어 주세요(100자까지).' }
    }
    if (!ItemSchema.safeParse({ productTypeId: input.productTypeId, qty: input.qty }).success) {
      return { success: false, error: `수량은 1~${MAX_ORDER_QTY.toLocaleString()} 사이 정수로 넣어 주세요.` }
    }
    const raw = await resolveRaw(input.productTypeId)
    const orderId = await createOrderTx({ ...input, vendor, recipient }, raw)

    await recordAuditLog({
      action: 'CREATE',
      entity: 'PurchaseOrder',
      entityId: orderId,
      description: `발주서 주문 추가 ${vendor}/${recipient} uploadId=${input.uploadId} — ${raw.rawItemName} ${raw.packageType} ${raw.rawPackaging} ${input.qty}개`,
      details: { uploadId: input.uploadId, productTypeId: input.productTypeId, qty: input.qty },
    })
    revalidatePath('/sales')
    return { success: true, message: `${recipient === vendor ? vendor : recipient} 주문을 추가했어요.`, orderId }
  } catch (error) {
    console.error('[addPurchaseOrder] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '주문을 추가하지 못했습니다.') }
  }
}

/** 트랜잭션 본문 — 묶음 확인 · 중복 확인 · 건+첫 품목 생성 · 건 수 +1 */
async function createOrderTx(input: NewOrderInput, raw: RawItem): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const upload = await tx.purchaseOrderUpload.findUnique({
      where: { id: input.uploadId },
      select: { channel: true, orderDate: true },
    })
    if (!upload) throw new Error('시트를 찾을 수 없습니다. 새로고침해 주세요.')
    const dup = await tx.purchaseOrder.findFirst({
      where: { uploadId: input.uploadId, vendor: input.vendor, recipient: input.recipient },
      select: { id: true },
    })
    if (dup) throw new Error('이미 있는 주문이에요. 그 건 상세에서 품목을 추가하세요.')
    const order = await tx.purchaseOrder.create({
      data: {
        uploadId: input.uploadId,
        channel: upload.channel,
        orderDate: upload.orderDate,
        vendor: input.vendor,
        recipient: input.recipient,
        items: {
          create: { ...raw, orderedQty: input.qty, unitWeightKg: null, productTypeId: input.productTypeId },
        },
      },
      select: { id: true },
    })
    await tx.purchaseOrderUpload.update({ where: { id: input.uploadId }, data: { orderCount: { increment: 1 } } })
    await recalcOrderStatus(tx, order.id)
    return order.id
  }, TX_OPTIONS)
}
