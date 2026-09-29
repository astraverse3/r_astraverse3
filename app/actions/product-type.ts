'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { recordAuditLog } from '@/lib/audit'
import { requirePermission, requireSession } from '@/lib/auth-guard'
import { sanitizeErrorMessage, guardErrorMessage } from '@/lib/error-sanitize'

// 관리 화면 경로 (revalidate 대상)
const ADMIN_PATH = '/admin/product-types'

// ------------------------------------------------------
// Packaging (포장지명 마스터)
// ------------------------------------------------------

export async function listPackagings() {
  try {
    await requireSession()
    const data = await prisma.packaging.findMany({
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    })
    return { success: true, data }
  } catch (error) {
    console.error('Failed to list packagings:', error)
    return { success: false, error: guardErrorMessage(error, '포장지 목록을 불러오지 못했어요.') }
  }
}

export async function createPackaging(name: string) {
  try {
    await requirePermission('OPERATION_MANAGE')
    const trimmed = name.trim()
    if (!trimmed) return { success: false, error: '포장지명을 입력해주세요.' }

    const existing = await prisma.packaging.findUnique({ where: { name: trimmed } })
    if (existing) return { success: false, error: '이미 존재하는 포장지입니다.' }

    const created = await prisma.packaging.create({ data: { name: trimmed } })

    await recordAuditLog({
      action: 'CREATE',
      entity: 'Packaging',
      entityId: created.id,
      description: `포장지 등록: ${trimmed}`,
    })

    revalidatePath(ADMIN_PATH)
    return { success: true, data: created }
  } catch (error) {
    console.error('Failed to create packaging:', error)
    return { success: false, error: guardErrorMessage(error, '포장지 등록에 실패했어요.') }
  }
}

export async function togglePackagingActive(id: number) {
  try {
    await requirePermission('OPERATION_MANAGE')
    const pkg = await prisma.packaging.findUnique({ where: { id } })
    if (!pkg) return { success: false, error: '포장지를 찾을 수 없어요.' }

    const updated = await prisma.packaging.update({
      where: { id },
      data: { active: !pkg.active },
    })

    await recordAuditLog({
      action: 'UPDATE',
      entity: 'Packaging',
      entityId: id,
      description: `포장지 ${updated.active ? '활성화' : '비활성화'}: ${pkg.name}`,
    })

    revalidatePath(ADMIN_PATH)
    return { success: true, data: updated }
  } catch (error) {
    console.error('Failed to toggle packaging:', error)
    return { success: false, error: guardErrorMessage(error, '포장지 상태 변경에 실패했어요.') }
  }
}

// ------------------------------------------------------
// ProductType (SKU 카탈로그)
// ------------------------------------------------------

export type ProductTypeFilter = {
  varietyId?: number
  millingType?: string
  packageType?: string
  activeOnly?: boolean
}

export async function listProductTypes(filter?: ProductTypeFilter) {
  try {
    await requireSession()
    const where: {
      varietyId?: number
      millingType?: string
      packageType?: string
      active?: boolean
    } = {}
    if (filter?.varietyId) where.varietyId = filter.varietyId
    if (filter?.millingType) where.millingType = filter.millingType
    if (filter?.packageType) where.packageType = filter.packageType
    if (filter?.activeOnly) where.active = true

    const data = await prisma.productType.findMany({
      where,
      include: { variety: true, packaging: true },
      orderBy: [
        { varietyId: 'asc' },
        { millingType: 'asc' },
        { packageType: 'asc' },
        { isDefault: 'desc' },
      ],
    })
    return { success: true, data }
  } catch (error) {
    console.error('Failed to list product types:', error)
    return { success: false, error: guardErrorMessage(error, '제품유형 목록을 불러오지 못했어요.') }
  }
}

export type UpsertProductTypeInput = {
  id?: number
  varietyId: number
  millingType: string
  packageType: string
  packagingId: number
  isDefault?: boolean
  active?: boolean
  unitsPerBox?: number | null // 박스 입수(#35). 미입력이면 null → 박스 환산 칸 빈칸
}

/**
 * SKU 추가/수정. isDefault=true면 동일 (품종+도정+규격)의 기존 기본을 해제(트랜잭션).
 */
export async function upsertProductType(input: UpsertProductTypeInput) {
  try {
    await requirePermission('OPERATION_MANAGE')
    const millingType = input.millingType.trim() || '기타'
    const packageType = input.packageType.trim()
    if (!packageType) return { success: false, error: '규격을 입력해주세요.' }
    if (!input.varietyId || !input.packagingId) {
      return { success: false, error: '품종과 포장지를 선택해주세요.' }
    }
    const unitsPerBox = input.unitsPerBox ?? null
    if (unitsPerBox !== null && (!Number.isInteger(unitsPerBox) || unitsPerBox < 1)) {
      return { success: false, error: '박스 입수는 1 이상의 정수로 입력해주세요.' }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 4키 중복 검사 (다른 레코드와 충돌)
      const dup = await tx.productType.findUnique({
        where: {
          varietyId_millingType_packageType_packagingId: {
            varietyId: input.varietyId,
            millingType,
            packageType,
            packagingId: input.packagingId,
          },
        },
      })
      if (dup && dup.id !== input.id) {
        throw new Error('이미 동일한 제품유형(SKU)이 존재합니다.')
      }

      // 기본 지정 시 동일 (품종+도정+규격)의 기존 기본 해제
      if (input.isDefault) {
        await tx.productType.updateMany({
          where: {
            varietyId: input.varietyId,
            millingType,
            packageType,
            isDefault: true,
            ...(input.id ? { NOT: { id: input.id } } : {}),
          },
          data: { isDefault: false },
        })
      }

      const data = {
        varietyId: input.varietyId,
        millingType,
        packageType,
        packagingId: input.packagingId,
        isDefault: input.isDefault ?? false,
        active: input.active ?? true,
        unitsPerBox,
      }

      return input.id
        ? tx.productType.update({ where: { id: input.id }, data })
        : tx.productType.create({ data })
    })

    await recordAuditLog({
      action: input.id ? 'UPDATE' : 'CREATE',
      entity: 'ProductType',
      entityId: result.id,
      details: input,
      description: `제품유형 ${input.id ? '수정' : '등록'}: id=${result.id}`,
    })

    revalidatePath(ADMIN_PATH)
    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to upsert product type:', error)
    return { success: false, error: sanitizeErrorMessage(error, '제품유형 저장에 실패했어요.') }
  }
}

export type ProductTypeUsage = {
  /** 제품재고 수 — 있으면 삭제 불가(`deleteProductType` 가드) */
  packages: number
  /** 이 SKU에 매칭된 발주서 품목, 시트별. 삭제하면 전부 매칭실패로 돌아간다 */
  orderItems: { sheetName: string; count: number }[]
}

/**
 * SKU를 가리키는 두 참조자를 센다 — 삭제 확인창이 누르는 순간 부른다(페이지 로드 값은 낡을 수 있다).
 *
 * 🔴 발주서 품목은 옵셔널 관계(SetNull)라 **삭제를 막지 않고 조용히 풀린다.**
 * 2026-09-23 SKU 58 삭제로 #15 택배 2품목이 그렇게 매칭실패가 됐다. 차감한 품목은
 * 그 SKU의 제품재고가 있어 `packages` 가드가 먼저 막으므로, 풀리는 건 「매칭만 된 품목」뿐이다.
 */
export async function getProductTypeUsage(
  id: number,
): Promise<{ success: true; data: ProductTypeUsage } | { success: false; error: string }> {
  try {
    await requirePermission('OPERATION_MANAGE')
    const [packages, items] = await Promise.all([
      prisma.millingOutputPackage.count({ where: { productTypeId: id } }),
      prisma.purchaseOrderItem.findMany({
        where: { productTypeId: id },
        select: { order: { select: { upload: { select: { sheetName: true } } } } },
      }),
    ])
    const bySheet = new Map<string, number>()
    for (const it of items) {
      const name = it.order.upload?.sheetName ?? '시트 없음'
      bySheet.set(name, (bySheet.get(name) ?? 0) + 1)
    }
    return {
      success: true,
      data: {
        packages,
        orderItems: [...bySheet.entries()].map(([sheetName, count]) => ({ sheetName, count })),
      },
    }
  } catch (error) {
    console.error('Failed to get product type usage:', error)
    return { success: false, error: guardErrorMessage(error, '제품유형 사용처를 불러오지 못했어요.') }
  }
}

export async function deleteProductType(id: number) {
  try {
    await requirePermission('OPERATION_MANAGE')
    const used = await prisma.millingOutputPackage.count({ where: { productTypeId: id } })
    if (used > 0) {
      return {
        success: false,
        error: `포장 ${used}건에서 사용 중이라 삭제할 수 없어요. 비활성화를 사용하세요.`,
      }
    }

    // SetNull로 풀릴 발주서 품목 수 — 삭제 전에 세야 남는다(로그로 「왜 풀렸지」를 찾게)
    const unmatched = await prisma.purchaseOrderItem.count({ where: { productTypeId: id } })

    await prisma.productType.delete({ where: { id } })

    await recordAuditLog({
      action: 'DELETE',
      entity: 'ProductType',
      entityId: id,
      description:
        `제품유형 삭제: id=${id}` + (unmatched > 0 ? ` (발주서 ${unmatched}품목 매칭 해제)` : ''),
    })

    revalidatePath(ADMIN_PATH)
    return { success: true }
  } catch (error) {
    console.error('Failed to delete product type:', error)
    return { success: false, error: guardErrorMessage(error, '제품유형 삭제에 실패했어요.') }
  }
}

export async function toggleProductTypeActive(id: number) {
  try {
    await requirePermission('OPERATION_MANAGE')
    const pt = await prisma.productType.findUnique({ where: { id } })
    if (!pt) return { success: false, error: '제품유형을 찾을 수 없어요.' }

    const updated = await prisma.productType.update({
      where: { id },
      data: { active: !pt.active },
    })

    await recordAuditLog({
      action: 'UPDATE',
      entity: 'ProductType',
      entityId: id,
      description: `제품유형 ${updated.active ? '활성화' : '비활성화'}: id=${id}`,
    })

    revalidatePath(ADMIN_PATH)
    return { success: true, data: updated }
  } catch (error) {
    console.error('Failed to toggle product type:', error)
    return { success: false, error: guardErrorMessage(error, '제품유형 상태 변경에 실패했어요.') }
  }
}

/**
 * 등록 화면용: 주어진 (품종+도정+규격)의 기본 SKU·후보 SKU + 선택 가능한 포장지 목록.
 */
/**
 * 품종별 활성 SKU 규격 — 포장·재포장 「만들 규격」 버튼이 고정 목록에 더할 것(백로그 §48).
 * 고정 목록에 이미 있는지는 화면(`mergeSpecButtons`)이 거른다 — 여기는 있는 그대로 준다.
 * @returns `{ [varietyId]: packageType[] }` — SKU가 없는 품종은 키가 없다
 */
export async function listSkuSpecs(
  varietyIds: number[],
  millingType: string,
): Promise<{ success: true; data: Record<number, string[]> } | { success: false; error: string }> {
  try {
    await requireSession()
    // 시스템 경계 — 화면이 넘긴 값은 믿지 않는다
    const ids = [...new Set(varietyIds)].filter((id) => Number.isInteger(id) && id > 0)
    const mt = millingType?.trim() || '기타'
    if (ids.length === 0) return { success: true, data: {} }

    const rows = await prisma.productType.findMany({
      where: { varietyId: { in: ids }, millingType: mt, active: true },
      select: { varietyId: true, packageType: true },
      distinct: ['varietyId', 'packageType'],
    })
    const data: Record<number, string[]> = {}
    for (const r of rows) (data[r.varietyId] ??= []).push(r.packageType)
    return { success: true, data }
  } catch (error) {
    console.error('Failed to list SKU specs:', error)
    return { success: false, error: guardErrorMessage(error, 'SKU 규격 조회에 실패했어요.') }
  }
}

export async function suggestProductType(
  varietyId: number,
  millingType: string,
  packageType: string,
) {
  try {
    await requireSession()
    const mt = millingType?.trim() || '기타'
    const pt = packageType?.trim()

    const [defaultType, candidates, packagings] = await Promise.all([
      pt
        ? prisma.productType.findFirst({
            where: { varietyId, millingType: mt, packageType: pt, isDefault: true, active: true },
            include: { packaging: true },
          })
        : Promise.resolve(null),
      pt
        ? prisma.productType.findMany({
            where: { varietyId, millingType: mt, packageType: pt, active: true },
            include: { packaging: true },
            orderBy: { isDefault: 'desc' },
          })
        : Promise.resolve([]),
      prisma.packaging.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    ])

    return { success: true, data: { default: defaultType, candidates, packagings } }
  } catch (error) {
    console.error('Failed to suggest product type:', error)
    return { success: false, error: guardErrorMessage(error, '제품유형 추천 조회에 실패했어요.') }
  }
}
