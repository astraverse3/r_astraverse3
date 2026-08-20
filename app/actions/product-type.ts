'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { recordAuditLog } from '@/lib/audit'
import { requirePermission, requireSession } from '@/lib/auth-guard'
import { sanitizeErrorMessage } from '@/lib/error-sanitize'

// 관리 화면 경로 (revalidate 대상)
const ADMIN_PATH = '/admin/product-types'

// ------------------------------------------------------
// Packaging (포장지명 마스터)
// ------------------------------------------------------

export async function listPackagings() {
  await requireSession()
  try {
    const data = await prisma.packaging.findMany({
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    })
    return { success: true, data }
  } catch (error) {
    console.error('Failed to list packagings:', error)
    return { success: false, error: '포장지 목록을 불러오지 못했어요.' }
  }
}

export async function createPackaging(name: string) {
  await requirePermission('OPERATION_MANAGE')
  try {
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
    return { success: false, error: '포장지 등록에 실패했어요.' }
  }
}

export async function togglePackagingActive(id: number) {
  await requirePermission('OPERATION_MANAGE')
  try {
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
    return { success: false, error: '포장지 상태 변경에 실패했어요.' }
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
  await requireSession()
  try {
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
    return { success: false, error: '제품유형 목록을 불러오지 못했어요.' }
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
  await requirePermission('OPERATION_MANAGE')
  try {
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

export async function deleteProductType(id: number) {
  await requirePermission('OPERATION_MANAGE')
  try {
    const used = await prisma.millingOutputPackage.count({ where: { productTypeId: id } })
    if (used > 0) {
      return {
        success: false,
        error: `포장 ${used}건에서 사용 중이라 삭제할 수 없어요. 비활성화를 사용하세요.`,
      }
    }

    await prisma.productType.delete({ where: { id } })

    await recordAuditLog({
      action: 'DELETE',
      entity: 'ProductType',
      entityId: id,
      description: `제품유형 삭제: id=${id}`,
    })

    revalidatePath(ADMIN_PATH)
    return { success: true }
  } catch (error) {
    console.error('Failed to delete product type:', error)
    return { success: false, error: '제품유형 삭제에 실패했어요.' }
  }
}

export async function toggleProductTypeActive(id: number) {
  await requirePermission('OPERATION_MANAGE')
  try {
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
    return { success: false, error: '제품유형 상태 변경에 실패했어요.' }
  }
}

/**
 * 등록 화면용: 주어진 (품종+도정+규격)의 기본 SKU·후보 SKU + 선택 가능한 포장지 목록.
 */
export async function suggestProductType(
  varietyId: number,
  millingType: string,
  packageType: string,
) {
  await requireSession()
  try {
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
    return { success: false, error: '제품유형 추천 조회에 실패했어요.' }
  }
}
