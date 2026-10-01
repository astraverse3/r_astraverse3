'use server'

// 발주서 매트릭스 — 머리글에서 포장지·규격 수정 (계획서 `docs/plan/plan-매트릭스-포장지규격-수정.md` ②)
//
// 발단(2026-10-01 실사용 첫날): 엑셀 포장지가 틀려 발주서를 통째로 지우고 다시 올렸다.
//
// 🔴 고치는 건 SKU가 아니라 **엑셀에서 읽은 원본 값**(`packageType`·`rawPackaging`)이다. 바꾼 뒤 SKU는
//    매처가 정한다 — 줄의 SKU를 정하는 경로는 여전히 매처 하나다(9/16 수동지정 철회와 같은 원칙,
//    `purchase-order-assign.ts` 머리 주석). 매처 결과가 고른 값과 어긋나면 **아무것도 안 바꾸고 거부**한다.
// 🔴 범위는 서버가 정한다 — 클라이언트는 「이 시트의 이 SKU들」만 말하고, 줄 목록은 여기서 다시 읽는다.
//    낡은 화면이 일부 줄만 보내 같은 엑셀 열이 둘로 갈리는 일을 막는다.
// 🔴 차감이 하나라도 있으면 막는다 — 차감된 줄의 SKU가 바뀌면 판매 기록과 주문이 어긋난다.
// 🔴 `revalidatePath`를 부르지 않는다 — 재매칭과 같이 패치로 갈아끼운다(`applyMatchPatches`).

import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth-guard'
import { recordAuditLog } from '@/lib/audit'
import { sanitizeErrorMessage } from '@/lib/error-sanitize'
import { getDisplayMillingType } from '@/lib/milling-type-display'
import { matchKey, matchPurchaseOrderItem, type MatcherProductType } from '@/lib/purchase-order-matcher'
import { loadMatcherMasters, type MatcherMasters } from '@/lib/purchase-order-masters'
import { loadMatchPatch } from '@/lib/purchase-order-db'
import type { MatchPatch } from '@/lib/purchase-order-matrix'
import {
  isEditableSpec,
  packageTypeOptions,
  packagingOptions,
  type ColumnEditField,
  type ColumnEditOption,
} from '@/lib/purchase-order-column-edit'

/** 잡곡 도정유형 sentinel — 사람에게 보여줄 값이 아니다 */
const MISC_MILLING_SENTINEL = '기타'

export type ColumnEditTarget = {
  uploadId: number
  field: ColumnEditField
  /** 포장지 = 묶음의 규격 열 SKU들 · 규격 = 그 열 SKU 하나 */
  productTypeIds: number[]
}

export type ColumnEditInfo = {
  field: ColumnEditField
  /** `서농22호 · 현미` — 백미·잡곡이면 품종만 */
  title: string
  current: string
  scope: { recipientCount: number; lineCount: number; orderedQty: number }
  /** 차감이 있는 줄 수 — 0이 아니면 수정할 수 없다 */
  deductedLines: number
  options: ColumnEditOption[]
}

type ScopeItem = {
  id: number
  orderId: number
  orderedQty: number
  rawItemName: string
  packageType: string
  rawPackaging: string | null
  deducted: boolean
}

type Scope = { masters: MatcherMasters; scopeSkus: MatcherProductType[]; items: ScopeItem[] }

type Loaded = Scope & { title: string; current: string; options: ColumnEditOption[] }

/** DB의 ProductType 행 → 매처 모양(`loadMatcherMasters`와 같은 필드) */
function toMatcherSku(p: {
  id: number
  varietyId: number
  millingType: string
  packageType: string
  packagingId: number
  isDefault: boolean
  active: boolean
  packaging: { name: string }
}): MatcherProductType {
  const { packaging, ...rest } = p
  return {
    id: rest.id,
    varietyId: rest.varietyId,
    millingType: rest.millingType,
    packageType: rest.packageType,
    packagingId: rest.packagingId,
    packagingName: packaging.name,
    isDefault: rest.isDefault,
    active: rest.active,
  }
}

/** 범위 읽기 + 검증. 실패는 사람에게 보일 문구로 던진다. */
async function readScope(t: ColumnEditTarget): Promise<Scope> {
  const ids = [...new Set(t.productTypeIds)]
  if (ids.length === 0) throw new Error('수정할 열이 없습니다.')
  if (t.field === 'packageType' && ids.length !== 1) throw new Error('규격은 한 열씩 바꿉니다.')

  const [masters, skuRows, itemRows] = await Promise.all([
    loadMatcherMasters(),
    // 지금 붙은 SKU는 비활성일 수도 있다 — 마스터(활성만)가 아니라 DB에서 직접 읽는다
    prisma.productType.findMany({ where: { id: { in: ids } }, include: { packaging: { select: { name: true } } } }),
    prisma.purchaseOrderItem.findMany({
      where: { order: { uploadId: t.uploadId }, productTypeId: { in: ids } },
      select: {
        id: true,
        orderId: true,
        orderedQty: true,
        unitWeightKg: true,
        rawItemName: true,
        packageType: true,
        rawPackaging: true,
        _count: { select: { movements: true } },
      },
      orderBy: { id: 'asc' },
    }),
  ])
  if (skuRows.length !== ids.length) throw new Error('제품유형을 찾을 수 없습니다. 새로고침해 주세요.')

  const scopeSkus = skuRows.map(toMatcherSku)
  const [head] = scopeSkus
  const same = (s: MatcherProductType) =>
    s.varietyId === head.varietyId && s.millingType === head.millingType && s.packagingId === head.packagingId
  if (!scopeSkus.every(same)) throw new Error('한 묶음의 열이 아닙니다.')
  if (scopeSkus.some((s) => !isEditableSpec(s.packageType))) throw new Error('톤백·잔량 열은 여기서 바꿀 수 없습니다.')
  if (itemRows.length === 0) throw new Error('이 열에 품목이 없습니다. 새로고침해 주세요.')
  if (itemRows.some((it) => it.unitWeightKg !== null)) throw new Error('톤백 품목은 여기서 바꿀 수 없습니다.')

  const items = itemRows.map((it) => ({
    id: it.id,
    orderId: it.orderId,
    orderedQty: it.orderedQty,
    rawItemName: it.rawItemName,
    packageType: it.packageType,
    rawPackaging: it.rawPackaging,
    deducted: it._count.movements > 0,
  }))
  return { masters, scopeSkus, items }
}

/** 범위 + 팝업에 보일 이름·지금 값·선택지 — 조회와 수정이 같은 판정을 쓴다 */
async function loadTarget(t: ColumnEditTarget): Promise<Loaded> {
  const scope = await readScope(t)
  const [head] = scope.scopeSkus
  const variety = scope.masters.varieties.find((v) => v.id === head.varietyId)
  const milling =
    head.millingType === MISC_MILLING_SENTINEL ? null : getDisplayMillingType(head.millingType, variety?.type ?? null)
  const name = variety?.name ?? ''
  return {
    ...scope,
    title: milling && milling !== '백미' ? `${name} · ${milling}` : name,
    current: t.field === 'packaging' ? head.packagingName : head.packageType,
    options:
      t.field === 'packaging'
        ? packagingOptions(scope.scopeSkus, scope.masters.productTypes)
        : packageTypeOptions(head, scope.masters.productTypes),
  }
}

export async function getColumnEditOptions(
  t: ColumnEditTarget,
): Promise<{ success: true; data: ColumnEditInfo } | { success: false; error: string }> {
  try {
    await requirePermission('OPERATION_MANAGE')
    const l = await loadTarget(t)
    return {
      success: true,
      data: {
        field: t.field,
        title: l.title,
        current: l.current,
        scope: {
          recipientCount: new Set(l.items.map((it) => it.orderId)).size,
          lineCount: l.items.length,
          orderedQty: l.items.reduce((s, it) => s + it.orderedQty, 0),
        },
        deductedLines: l.items.filter((it) => it.deducted).length,
        options: l.options,
      },
    }
  } catch (error) {
    console.error('[getColumnEditOptions] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '수정 정보를 불러오지 못했습니다.') }
  }
}

/**
 * 새 원본 값으로 매처를 돌려 줄마다 SKU를 정한다. 고른 값과 어긋나는 줄이 하나라도 있으면 던진다(아무것도 안 바뀐다).
 *
 * 🔴 규격을 바꿀 땐 포장지를 **지금 SKU의 포장지로 못박는다**. 원본 포장지가 빈칸(기본 포장지)이면 새 규격의
 *    기본 SKU가 다른 포장지일 수 있어서, 비워 두면 규격만 바꿨는데 포장지까지 바뀐다.
 */
function planEdit(l: Loaded, t: ColumnEditTarget & { value: string }) {
  const [head] = l.scopeSkus
  const raw: NonNullable<MatchPatch['raw']> =
    t.field === 'packaging' ? { rawPackaging: t.value } : { packageType: t.value, rawPackaging: head.packagingName }

  const bySku = new Map<number, number[]>()
  for (const it of l.items) {
    const packageType = raw.packageType ?? it.packageType
    const m = matchPurchaseOrderItem(
      { rawItemName: it.rawItemName, packageType, rawPackaging: raw.rawPackaging ?? null },
      l.masters.varieties,
      l.masters.productTypes,
    )
    const sku = m.matched ? l.masters.productTypes.find((p) => p.id === m.productTypeId) : undefined
    const ok =
      sku &&
      sku.varietyId === head.varietyId &&
      sku.millingType === head.millingType &&
      sku.packagingName === raw.rawPackaging &&
      matchKey(sku.packageType) === matchKey(packageType)
    if (!ok) {
      const name = it.rawItemName.replace(/\s+/g, ' ')
      throw new Error(`「${name}」이 바꾼 값으로 매칭되지 않아 아무것도 바꾸지 않았습니다.`)
    }
    const list = bySku.get(sku.id)
    if (list) list.push(it.id)
    else bySku.set(sku.id, [it.id])
  }
  return { bySku, raw }
}

export async function editColumnRaw(
  t: ColumnEditTarget & { value: string },
): Promise<{ success: true; patches: MatchPatch[]; lineCount: number } | { success: false; error: string }> {
  try {
    await requirePermission('OPERATION_MANAGE')
    const l = await loadTarget(t)
    const option = l.options.find((o) => o.value === t.value)
    if (!option || option.disabled) throw new Error('고를 수 없는 값입니다. 새로고침해 주세요.')
    if (l.items.some((it) => it.deducted)) {
      throw new Error('차감된 품목이 있어 바꿀 수 없습니다. 그 칸의 차감을 먼저 취소하세요.')
    }

    const { bySku, raw } = planEdit(l, t)
    await prisma.$transaction(async (tx) => {
      for (const [productTypeId, ids] of bySku) {
        // 조회와 쓰기 사이에 차감이 생겼거나 다른 사람이 먼저 바꿨으면 통째로 되돌린다
        const r = await tx.purchaseOrderItem.updateMany({
          where: { id: { in: ids }, movements: { none: {} }, productTypeId: { in: t.productTypeIds } },
          data: { ...raw, productTypeId },
        })
        if (r.count !== ids.length) {
          throw new Error('그 사이 차감되었거나 바뀐 품목이 있습니다. 새로고침 후 다시 해 주세요.')
        }
      }
    })

    const label = t.field === 'packaging' ? '포장지' : '규격'
    await recordAuditLog({
      action: 'UPDATE',
      entity: 'PurchaseOrderItem',
      description: `발주서 ${label} 수정 uploadId=${t.uploadId} ${l.title}: ${l.current} → ${t.value} (${l.items.length}줄)`,
      details: {
        uploadId: t.uploadId,
        field: t.field,
        before: l.current,
        after: t.value,
        itemIds: l.items.map((it) => it.id),
        fromProductTypeIds: t.productTypeIds,
        toProductTypeIds: [...bySku.keys()],
      },
    })

    const patches = await Promise.all(
      [...bySku.entries()].map(([productTypeId, ids]) => loadMatchPatch(ids, productTypeId, raw)),
    )
    return { success: true, patches, lineCount: l.items.length }
  } catch (error) {
    console.error('[editColumnRaw] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '수정에 실패했습니다.') }
  }
}
