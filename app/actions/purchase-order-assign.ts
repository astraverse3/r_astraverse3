'use server'

// 발주서 매칭실패 라인 수동지정 · 재매칭 (계획서 `docs/plan/plan-발주서판매처리-D2e.md`)
//
// `purchase-order-matrix.ts`가 이미 649줄이라 **파일을 분리**한다(800줄 상한).
//
// 🔴 **지정 단위는 셀이 아니라 「열」이다**(결정 N). 같은 묶음 안에서 원본 조합
//    (품목명·규격·포장지·자루중량)이 같은 라인 전부에 같은 SKU를 넣는다 —
//    원본이 같은데 수령인마다 다른 SKU일 이유가 없다.
//
// 🔴 **후보는 기존 활성 SKU뿐이다**(결정 O). 매처와 같은 원칙으로 find-or-create를 안 한다 —
//    카탈로그에 없는 SKU는 재고도 0이라 지정해 봐야 차감할 게 없다. 없으면 등록 화면으로 보낸다.
//
// 🔴 `revalidatePath`를 부르지 않는다(D2c 결정 C·C3 교훈). 액션 응답에 현재 페이지가
//    통째로 다시 그려져 매트릭스 1.4초 재조회가 매번 붙는다. 클라이언트가 `applyMatchPatches`로
//    바뀐 것만 갈아끼우고 `buildMatrix`를 재실행한다(15ms).

import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth-guard'
import { recordAuditLog } from '@/lib/audit'
import { sanitizeErrorMessage } from '@/lib/error-sanitize'
import { getDisplayMillingType } from '@/lib/milling-type-display'
import {
  hasMillingToken,
  matchPurchaseOrderItem,
  normalizeItemName,
  sortSkuCandidates,
  type MatchFailReason,
} from '@/lib/purchase-order-matcher'
import { loadMatcherMasters, learnVarietyAlias } from '@/lib/purchase-order-masters'
import { loadAvailability, loadSkuMeta } from '@/lib/purchase-order-db'
import type { MatchPatch } from '@/lib/purchase-order-matrix'

// ======================================================
// 수동지정 팝오버 데이터
// ======================================================

/** 고를 수 있는 SKU 한 줄. `millingType`은 표시값(찰벼는 찹쌀/찰현미)이다. */
export type SkuCandidate = {
  id: number
  varietyId: number
  millingType: string
  packageType: string
  packagingName: string
  isDefault: boolean
  /** 주문 규격과 같은가 — 화면이 이걸로 위쪽에 강조한다 */
  sameSpec: boolean
}

export type VarietyOption = {
  id: number
  name: string
  category: string
  /** 이 품종에 고를 수 있는 활성 SKU 수. 0이면 등록 화면으로 보낸다 */
  skuCount: number
}

export type UnmatchedCellOptions = {
  /** 이 열의 원본 조합 */
  rawItemName: string
  packageType: string
  rawPackaging: string | null
  /** 지정이 닿는 범위 — 클릭한 셀이 아니라 **열 전체**다(결정 N) */
  scope: {
    itemIds: number[]
    recipientCount: number
    lineCount: number
    orderedQty: number
  }
  /** 매처가 어디서 멈췄는지 — 화면이 사유 한 줄을 띄운다 */
  fail: {
    reason: MatchFailReason
    varietyToken: string
    varietyId: number | null
    millingType: string | null
  }
  /** 별칭 학습 가능 여부(결정 S·T). `canLearn=false`면 체크박스를 숨기고 사유를 적는다 */
  alias: { canLearn: boolean; token: string; blockedByMilling: boolean }
  varieties: VarietyOption[]
  /** 품종 id → 그 품종의 활성 SKU(정렬 완료). 전체를 한 번에 내린다(SKU 75개) */
  skusByVariety: Record<number, SkuCandidate[]>
}

export type UnmatchedCellOptionsResult =
  | { success: true; data: UnmatchedCellOptions }
  | { success: false; error: string }

/**
 * 매칭실패 셀 팝오버 데이터 — 왕복 1회분의 마스터 + 매처 부분해석 + 열 범위.
 *
 * `itemIds`는 클릭한 셀의 것이지만, 돌려주는 `scope.itemIds`는 **같은 묶음 안 같은 원본 조합 전부**다.
 */
export async function getUnmatchedCellOptions(
  itemIds: number[],
): Promise<UnmatchedCellOptionsResult> {
  await requirePermission('OPERATION_MANAGE')
  try {
    if (itemIds.length === 0) return { success: false, error: '셀에 라인이 없습니다.' }

    const clicked = await prisma.purchaseOrderItem.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true,
        rawItemName: true,
        packageType: true,
        rawPackaging: true,
        unitWeightKg: true,
        productTypeId: true,
        order: { select: { uploadId: true } },
      },
    })
    if (clicked.length !== itemIds.length) return { success: false, error: '라인을 찾을 수 없습니다.' }
    if (clicked.some((it) => it.productTypeId !== null)) {
      return { success: false, error: '이미 지정된 라인이 섞여 있습니다. 새로고침해 주세요.' }
    }
    const head = clicked[0]
    const sameCombo = (it: (typeof clicked)[number]) =>
      it.rawItemName === head.rawItemName &&
      it.packageType === head.packageType &&
      it.rawPackaging === head.rawPackaging &&
      it.unitWeightKg === head.unitWeightKg
    if (!clicked.every(sameCombo)) return { success: false, error: '한 셀의 라인이 아닙니다.' }

    // 열 전체 — 같은 묶음 안에서 원본 조합이 같고 아직 매칭 안 된 라인(결정 N)
    const column = await prisma.purchaseOrderItem.findMany({
      where: {
        productTypeId: null,
        rawItemName: head.rawItemName,
        packageType: head.packageType,
        rawPackaging: head.rawPackaging,
        unitWeightKg: head.unitWeightKg,
        order: { uploadId: head.order.uploadId },
      },
      select: { id: true, orderId: true, orderedQty: true },
    })

    const masters = await loadMatcherMasters()
    const m = matchPurchaseOrderItem(
      {
        rawItemName: head.rawItemName,
        packageType: head.packageType,
        rawPackaging: head.rawPackaging,
      },
      masters.varieties,
      masters.productTypes,
    )
    if (m.matched) {
      return {
        success: false,
        error: '지금은 자동으로 매칭됩니다. 헤더의 「재매칭」을 눌러 주세요.',
      }
    }

    const varietyById = new Map(masters.varieties.map((v) => [v.id, v]))
    const skusByVariety: Record<number, SkuCandidate[]> = {}
    for (const v of masters.varieties) {
      const own = masters.productTypes.filter((p) => p.varietyId === v.id)
      if (own.length === 0) continue
      skusByVariety[v.id] = sortSkuCandidates(own, head.packageType).map((p) => ({
        id: p.id,
        varietyId: p.varietyId,
        millingType: getDisplayMillingType(p.millingType, varietyById.get(p.varietyId)?.type ?? null),
        packageType: p.packageType,
        packagingName: p.packagingName,
        isDefault: p.isDefault,
        sameSpec: p.packageType.replace(/\s+/g, '') === head.packageType.replace(/\s+/g, ''),
      }))
    }

    const { varietyToken } = normalizeItemName(head.rawItemName)
    const token = varietyToken.trim()
    const blockedByMilling = hasMillingToken(token)

    return {
      success: true,
      data: {
        rawItemName: head.rawItemName,
        packageType: head.packageType,
        rawPackaging: head.rawPackaging,
        scope: {
          itemIds: column.map((it) => it.id),
          recipientCount: new Set(column.map((it) => it.orderId)).size,
          lineCount: column.length,
          orderedQty: column.reduce((s, it) => s + it.orderedQty, 0),
        },
        fail: {
          reason: m.reason,
          varietyToken: token,
          varietyId: m.varietyId,
          millingType: m.millingType,
        },
        alias: {
          // 품종을 이미 풀었으면 학습할 게 없다(실패는 SKU·포장지 쪽이다)
          canLearn: m.reason === 'variety_unresolved' && token.length > 0 && !blockedByMilling,
          token,
          blockedByMilling,
        },
        varieties: masters.varieties
          .map((v) => ({
            id: v.id,
            name: v.name,
            category: v.category,
            skuCount: skusByVariety[v.id]?.length ?? 0,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
        skusByVariety,
      },
    }
  } catch (error) {
    console.error('[getUnmatchedCellOptions] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '지정 후보를 불러오지 못했습니다.') }
  }
}

// ======================================================
// 지정 / 재매칭
// ======================================================

export type AssignResult =
  | {
      success: true
      patch: MatchPatch
      /** 학습한 별칭. 학습 안 했으면 null */
      learnedAlias: string | null
      /** 학습을 건너뛴 사유(사용자에게 보일 때만 채운다) */
      aliasSkipped: string | null
    }
  | { success: false; error: string }

/**
 * 매칭실패 열에 SKU를 지정한다(결정 N). 트랜잭션 하나 — 지정과 별칭 학습이 같이 커밋된다.
 *
 * 🔴 넘어온 라인이 **여전히 미매칭인지 트랜잭션 안에서 다시 확인**한다.
 *    다른 세션이 먼저 지정했으면 덮어쓰지 않고 거부한다(화면은 `router.refresh()`).
 */
export async function assignUnmatchedColumn(
  itemIds: number[],
  productTypeId: number,
  opts?: { learnAlias?: boolean },
): Promise<AssignResult> {
  await requirePermission('OPERATION_MANAGE')
  try {
    if (itemIds.length === 0) return { success: false, error: '지정할 라인이 없습니다.' }

    const outcome = await prisma.$transaction(async (tx) => {
      const items = await tx.purchaseOrderItem.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, rawItemName: true, productTypeId: true },
      })
      if (items.length !== itemIds.length) throw new Error('라인을 찾을 수 없습니다.')
      if (items.some((it) => it.productTypeId !== null)) {
        throw new Error('다른 사람이 먼저 지정했습니다. 새로고침해 주세요.')
      }

      const pt = await tx.productType.findUnique({
        where: { id: productTypeId },
        select: { id: true, varietyId: true, active: true },
      })
      if (!pt) throw new Error('제품유형을 찾을 수 없습니다.')
      if (!pt.active) throw new Error('사용하지 않는 제품유형입니다.')

      await tx.purchaseOrderItem.updateMany({
        where: { id: { in: itemIds } },
        data: { productTypeId },
      })

      let learnedAlias: string | null = null
      let aliasSkipped: string | null = null
      if (opts?.learnAlias) {
        const r = await learnVarietyAlias(tx, pt.varietyId, items[0].rawItemName)
        if (r.learned) learnedAlias = r.learned
        else if (r.reason === 'milling_token') aliasSkipped = '도정유형이 섞인 이름이라 학습하지 않았습니다.'
        else if (r.reason === 'taken') aliasSkipped = '다른 품종이 이미 쓰는 이름이라 학습하지 않았습니다.'
      }
      return { learnedAlias, aliasSkipped }
    })

    await recordAuditLog({
      action: 'UPDATE',
      entity: 'PurchaseOrderItem',
      description:
        `발주서 매칭 수동지정 productTypeId=${productTypeId} items=[${itemIds.join(',')}]` +
        (outcome.learnedAlias ? ` 별칭학습="${outcome.learnedAlias}"` : ''),
    })

    return {
      success: true,
      patch: await loadMatchPatch(itemIds, productTypeId),
      learnedAlias: outcome.learnedAlias,
      aliasSkipped: outcome.aliasSkipped,
    }
  } catch (error) {
    console.error('[assignUnmatchedColumn] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '품종 지정에 실패했습니다.') }
  }
}

export type RematchResult =
  | {
      success: true
      patches: MatchPatch[]
      /** 새로 붙은 라인 수 */
      matchedLines: number
      /** 아직 남은 매칭실패 라인 수 */
      stillUnmatched: number
    }
  | { success: false; error: string }

/**
 * 묶음 전체 재매칭(결정 R) — 업로드 뒤에 등록된 SKU·별칭을 다시 적용한다.
 *
 * 업로드 시점의 매칭 결과가 그대로 굳어 있어서, 마스터를 보완해도 화면은 실패인 채로 남는다.
 * 실측(2026-09-15)에서 27라인 중 2종이 이 상태였다.
 *
 * 🔴 라인 루프 안에서 쿼리하지 않는다 — 매칭은 메모리에서 끝내고, 쓰기는 **SKU별 `updateMany`**로 묶는다.
 */
export async function rematchUpload(uploadId: number): Promise<RematchResult> {
  await requirePermission('OPERATION_MANAGE')
  try {
    const items = await prisma.purchaseOrderItem.findMany({
      where: { productTypeId: null, order: { uploadId } },
      select: { id: true, rawItemName: true, packageType: true, rawPackaging: true },
    })
    if (items.length === 0) {
      return { success: true, patches: [], matchedLines: 0, stillUnmatched: 0 }
    }

    const masters = await loadMatcherMasters()
    const bySku = new Map<number, number[]>()
    for (const it of items) {
      const m = matchPurchaseOrderItem(
        { rawItemName: it.rawItemName, packageType: it.packageType, rawPackaging: it.rawPackaging },
        masters.varieties,
        masters.productTypes,
      )
      if (!m.matched) continue
      const list = bySku.get(m.productTypeId)
      if (list) list.push(it.id)
      else bySku.set(m.productTypeId, [it.id])
    }

    const matchedLines = [...bySku.values()].reduce((s, ids) => s + ids.length, 0)
    if (matchedLines === 0) {
      return { success: true, patches: [], matchedLines: 0, stillUnmatched: items.length }
    }

    await prisma.$transaction(
      [...bySku.entries()].map(([productTypeId, ids]) =>
        prisma.purchaseOrderItem.updateMany({
          where: { id: { in: ids }, productTypeId: null },
          data: { productTypeId },
        }),
      ),
    )

    await recordAuditLog({
      action: 'UPDATE',
      entity: 'PurchaseOrderItem',
      description: `발주서 재매칭 uploadId=${uploadId} ${matchedLines}라인 (SKU ${bySku.size}종)`,
    })

    const patches = await Promise.all(
      [...bySku.entries()].map(([productTypeId, ids]) => loadMatchPatch(ids, productTypeId)),
    )
    return {
      success: true,
      patches,
      matchedLines,
      stillUnmatched: items.length - matchedLines,
    }
  } catch (error) {
    console.error('[rematchUpload] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '재매칭에 실패했습니다.') }
  }
}

/**
 * 지정 뒤 클라이언트가 갈아끼울 「바뀐 것」을 읽는다. 트랜잭션 밖(커밋된 진실).
 * 차감 경로의 `loadCellPatch`와 같은 역할이고, 같은 두 헬퍼를 쓴다.
 */
async function loadMatchPatch(itemIds: number[], productTypeId: number): Promise<MatchPatch> {
  const [avail, skus] = await Promise.all([
    loadAvailability([productTypeId]),
    loadSkuMeta([productTypeId]),
  ])
  const sku = skus[0]
  if (!sku) throw new Error('제품유형을 찾을 수 없습니다.')
  return {
    itemIds,
    productTypeId,
    sku,
    availability: avail.qty[productTypeId] ?? 0,
    availabilityKg: avail.kg[productTypeId] ?? 0,
  }
}
