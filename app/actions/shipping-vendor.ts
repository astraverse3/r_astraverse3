'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { recordAuditLog } from '@/lib/audit'
import { requireAdmin, requireSession } from '@/lib/auth-guard'

// 관리 화면 경로 (revalidate 대상) — 배송업체는 설정 화면 안 섹션 (결정 #40)
const ADMIN_PATH = '/admin/settings'

export type ShippingVendorRow = {
  id: number
  name: string
  sortOrder: number
  active: boolean
}

/** 배송업체 목록 — 활성 먼저, 그 안에서 지정 순서 (결정 #39: 비활성은 숨기지 않고 뒤로) */
export async function listShippingVendors() {
  await requireSession()
  try {
    const data = await prisma.shippingVendor.findMany({
      orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, sortOrder: true, active: true },
    })
    return { success: true, data }
  } catch (error) {
    console.error('Failed to list shipping vendors:', error)
    return { success: false, error: '배송업체 목록을 불러오지 못했어요.' }
  }
}

/** 배송업체 등록 — sortOrder는 맨 뒤 +10 (시드가 10단위) */
export async function createShippingVendor(name: string) {
  await requireAdmin()
  try {
    const trimmed = name.trim()
    if (!trimmed) return { success: false, error: '업체명을 입력해주세요.' }

    const existing = await prisma.shippingVendor.findUnique({ where: { name: trimmed } })
    if (existing) return { success: false, error: '이미 등록된 업체입니다.' }

    const last = await prisma.shippingVendor.findFirst({ orderBy: { sortOrder: 'desc' } })
    const created = await prisma.shippingVendor.create({
      data: { name: trimmed, sortOrder: (last?.sortOrder ?? 0) + 10 },
    })

    await recordAuditLog({
      action: 'CREATE',
      entity: 'ShippingVendor',
      entityId: created.id,
      description: `배송업체 등록: ${trimmed}`,
    })

    revalidatePath(ADMIN_PATH)
    return { success: true, data: created }
  } catch (error) {
    console.error('Failed to create shipping vendor:', error)
    return { success: false, error: '배송업체 등록에 실패했어요.' }
  }
}

/** 업체명 변경 — 과거 묶음은 id로 참조하므로 이름만 바뀐다 */
export async function renameShippingVendor(id: number, name: string) {
  await requireAdmin()
  try {
    const trimmed = name.trim()
    if (!trimmed) return { success: false, error: '업체명을 입력해주세요.' }

    const vendor = await prisma.shippingVendor.findUnique({ where: { id } })
    if (!vendor) return { success: false, error: '배송업체를 찾을 수 없어요.' }
    if (vendor.name === trimmed) return { success: true, data: vendor }

    const duplicate = await prisma.shippingVendor.findUnique({ where: { name: trimmed } })
    if (duplicate) return { success: false, error: '이미 등록된 업체입니다.' }

    const updated = await prisma.shippingVendor.update({
      where: { id },
      data: { name: trimmed },
    })

    await recordAuditLog({
      action: 'UPDATE',
      entity: 'ShippingVendor',
      entityId: id,
      description: `배송업체명 변경: ${vendor.name} → ${trimmed}`,
    })

    revalidatePath(ADMIN_PATH)
    return { success: true, data: updated }
  } catch (error) {
    console.error('Failed to rename shipping vendor:', error)
    return { success: false, error: '업체명 변경에 실패했어요.' }
  }
}

/**
 * 표시 순서 이동 — 같은 사용 상태 안에서 인접 업체와 sortOrder를 맞바꾼다.
 * 숫자를 직접 입력받지 않으므로 사용자가 sortOrder를 신경 쓸 일이 없다.
 *
 * 화면은 낙관적으로 먼저 재배열하고 이 액션은 뒤에서 저장만 한다.
 * 목록 조회 1회로 대상·이웃을 함께 찾는다 — 클릭당 왕복을 줄이려고 `findUnique`를 두지 않았다.
 * 정렬은 목록 조회와 같아야 한다(동순위 tie-break가 다르면 화면에 보이는 이웃과 어긋난다).
 */
export async function moveShippingVendor(id: number, direction: 'up' | 'down') {
  await requireAdmin()
  try {
    const all = await prisma.shippingVendor.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, sortOrder: true, active: true },
    })
    const vendor = all.find((v) => v.id === id)
    if (!vendor) return { success: false, error: '배송업체를 찾을 수 없어요.' }

    const siblings = all.filter((v) => v.active === vendor.active)
    const index = siblings.findIndex((v) => v.id === vendor.id)
    const neighbor = siblings[direction === 'up' ? index - 1 : index + 1]
    // 끝단이면 조용히 무시 — 버튼이 비활성이라 정상 흐름에서는 오지 않는다
    if (!neighbor) return { success: true }

    // sortOrder가 같으면 맞바꿔도 순서가 안 바뀐다 → 이동 방향으로 1칸 벌린다
    const [mine, theirs] =
      vendor.sortOrder === neighbor.sortOrder
        ? direction === 'up'
          ? [neighbor.sortOrder - 1, neighbor.sortOrder]
          : [neighbor.sortOrder + 1, neighbor.sortOrder]
        : [neighbor.sortOrder, vendor.sortOrder]

    await prisma.$transaction([
      prisma.shippingVendor.update({ where: { id: vendor.id }, data: { sortOrder: mine } }),
      prisma.shippingVendor.update({ where: { id: neighbor.id }, data: { sortOrder: theirs } }),
    ])

    // 화면은 이미 바뀌어 있다. 다른 경로로 들어올 때 옛 순서가 보이지 않도록 캐시만 무효화한다
    revalidatePath(ADMIN_PATH)
    return { success: true }
  } catch (error) {
    console.error('Failed to move shipping vendor:', error)
    return { success: false, error: '순서 변경에 실패했어요.' }
  }
}

/** 사용 여부 토글 — 삭제는 제공하지 않는다 (결정 #39: 과거 묶음이 참조) */
export async function toggleShippingVendorActive(id: number) {
  await requireAdmin()
  try {
    const vendor = await prisma.shippingVendor.findUnique({ where: { id } })
    if (!vendor) return { success: false, error: '배송업체를 찾을 수 없어요.' }

    const updated = await prisma.shippingVendor.update({
      where: { id },
      data: { active: !vendor.active },
    })

    await recordAuditLog({
      action: 'UPDATE',
      entity: 'ShippingVendor',
      entityId: id,
      description: `배송업체 ${updated.active ? '사용' : '미사용'} 전환: ${vendor.name}`,
    })

    revalidatePath(ADMIN_PATH)
    return { success: true, data: updated }
  } catch (error) {
    console.error('Failed to toggle shipping vendor:', error)
    return { success: false, error: '사용 여부 변경에 실패했어요.' }
  }
}
