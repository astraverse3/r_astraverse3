'use server'

// 발주서 매칭실패 라인 안내 · 재매칭 (계획서 `docs/plan/plan-발주서-수동지정-제거.md`)
//
// `purchase-order-matrix.ts`가 이미 649줄이라 **파일을 분리**한다(800줄 상한).
//
// 🔴 **여기서 매칭을 고치지 않는다.** 매칭실패를 푸는 경로는 마스터 화면(품종 관리 /
//    제품유형 관리) → 「재매칭」 하나뿐이다. 팝오버 안에서 SKU를 지정하던 기능
//    (D2e 결정 N·O·S·T)은 2026-09-16에 철회했다 — 입구가 둘이면 별칭이 중구난방이 되고,
//    실측상 매칭실패의 절반은 이름이 아니라 **SKU 카탈로그 빈칸**이라 지정으로 풀리지도 않았다.
//    그래서 이 파일은 「무엇이 왜 실패했나」를 읽어 주기만 한다.
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
  type MatchFailReason,
} from '@/lib/purchase-order-matcher'
import { loadMatcherMasters } from '@/lib/purchase-order-masters'
import { loadAvailability, loadSkuMeta } from '@/lib/purchase-order-db'
import type { MatchPatch } from '@/lib/purchase-order-matrix'

/** 잡곡 도정유형 sentinel — 사람에게 보여줄 값이 아니다(화면에서 감춘다). */
const MISC_MILLING_SENTINEL = '기타'

// ======================================================
// 매칭실패 안내 데이터
// ======================================================

export type UnmatchedCellOptions = {
  /** 이 열의 원본 조합 */
  rawItemName: string
  packageType: string
  rawPackaging: string | null
  /**
   * 이 실패가 걸려 있는 범위 — 클릭한 셀이 아니라 **열 전체**다.
   * 마스터를 고칠 동기가 되라고 보여 준다: 셀 하나가 아니라 N수령인이 같이 막혀 있다.
   */
  scope: {
    recipientCount: number
    lineCount: number
    orderedQty: number
  }
  /** 매처가 어디서 멈췄는지 — 화면이 사유별로 갈 곳을 다르게 안내한다(결정 Z) */
  fail: {
    reason: MatchFailReason
    /** 해석 시도한 품종토큰. 품종을 못 읽은 경우 「이 이름을 별칭으로」의 그 이름이다 */
    varietyToken: string
    /** 품종까지는 풀렸을 때의 이름. 못 풀었으면 null */
    varietyName: string | null
    /** 표시값(찰벼는 찹쌀/찰현미). 잡곡 sentinel이면 null */
    millingType: string | null
  }
  /**
   * 품종토큰에 도정 단어가 섞여 있는가(구 결정 T).
   * true면 품종 관리에 가도 별칭으로 등록할 수 없으므로 화면이 미리 일러 준다.
   */
  blockedByMilling: boolean
}

export type UnmatchedCellOptionsResult =
  | { success: true; data: UnmatchedCellOptions }
  | { success: false; error: string }

/**
 * 매칭실패 셀 안내 데이터 — 왕복 1회분의 매처 부분해석 + 열 범위.
 *
 * `itemIds`는 클릭한 셀의 것이지만, 세는 범위는 **같은 묶음 안 같은 원본 조합 전부**다.
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

    // 열 전체 — 같은 묶음 안에서 원본 조합이 같고 아직 매칭 안 된 라인
    const column = await prisma.purchaseOrderItem.findMany({
      where: {
        productTypeId: null,
        rawItemName: head.rawItemName,
        packageType: head.packageType,
        rawPackaging: head.rawPackaging,
        unitWeightKg: head.unitWeightKg,
        order: { uploadId: head.order.uploadId },
      },
      select: { orderId: true, orderedQty: true },
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

    const variety = m.varietyId === null ? null : masters.varieties.find((v) => v.id === m.varietyId)
    const milling =
      m.millingType === null || m.millingType === MISC_MILLING_SENTINEL
        ? null
        : getDisplayMillingType(m.millingType, variety?.type ?? null)

    const { varietyToken } = normalizeItemName(head.rawItemName)
    const token = varietyToken.trim()

    return {
      success: true,
      data: {
        rawItemName: head.rawItemName,
        packageType: head.packageType,
        rawPackaging: head.rawPackaging,
        scope: {
          recipientCount: new Set(column.map((it) => it.orderId)).size,
          lineCount: column.length,
          orderedQty: column.reduce((s, it) => s + it.orderedQty, 0),
        },
        fail: {
          reason: m.reason,
          varietyToken: token,
          varietyName: variety?.name ?? null,
          millingType: milling,
        },
        blockedByMilling: hasMillingToken(token),
      },
    }
  } catch (error) {
    console.error('[getUnmatchedCellOptions] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '실패 사유를 불러오지 못했습니다.') }
  }
}

// ======================================================
// 재매칭
// ======================================================

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
 * 재매칭 뒤 클라이언트가 갈아끼울 「바뀐 것」을 읽는다. 트랜잭션 밖(커밋된 진실).
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
