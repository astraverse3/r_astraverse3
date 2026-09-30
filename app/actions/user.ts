'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { recordAuditLog } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth-guard'
import { guardErrorMessage } from '@/lib/error-sanitize'
import { USER_ROLE } from '@/lib/user-role'

// 전체 사용자 목록 조회
export async function getUsers() {
    await requireAdmin()

    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            permissions: true,
            department: true,
            position: true,
            phone: true,
            createdAt: true,
        }
    })

    return users
}

/**
 * 승인 대기 인원 — 헤더 알림(종, `lib/notifications.ts`)이 ADMIN에게만 부른다(§83 · 작업지시 ⑥).
 * 뱃지일 뿐이라 실패하면 0 — 화면 전체를 깨뜨리지 않는다.
 */
export async function countPendingUsers(): Promise<number> {
    try {
        await requireAdmin()
        return await prisma.user.count({ where: { role: USER_ROLE.PENDING } })
    } catch (error) {
        console.error('Failed to count pending users:', error)
        return 0
    }
}

/**
 * 가입 승인 — PENDING → USER, 권한은 빈 채로(기존처럼 행에서 부여). §83 T4
 * 🔴 `updateUserRole`(ADMIN↔USER 토글)을 넓히지 않고 한 방향 전용으로 둔다.
 *    `where role=PENDING`이라 이미 처리된 사람(다른 탭에서 승인·삭제)을 다시 바꾸지 않는다
 */
export async function approveUser(userId: string): Promise<{ success: true } | { success: false; error: string }> {
    try {
        await requireAdmin()
        const { count } = await prisma.user.updateMany({
            where: { id: userId, role: USER_ROLE.PENDING },
            data: { role: USER_ROLE.USER, permissions: [] },
        })
        if (count === 0) return { success: false, error: '이미 처리됐거나 없는 사용자예요. 새로고침해 주세요.' }

        const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
        await recordAuditLog({
            action: 'UPDATE',
            entity: 'User',
            entityId: userId,
            details: { role: USER_ROLE.USER, from: USER_ROLE.PENDING },
            description: `가입 승인: ${user?.name || user?.email || userId}`,
        })

        revalidatePath('/admin/users')
        revalidatePath('/', 'layout') // 뱃지가 레이아웃에 있다
        return { success: true }
    } catch (error) {
        console.error('Failed to approve user:', error)
        return { success: false, error: guardErrorMessage(error, '승인하지 못했어요.') }
    }
}

// 사용자 역할 변경
export async function updateUserRole(userId: string, role: string) {
    const session = await requireAdmin()

    // 본인 역할 변경 방지
    if (session.user.id === userId) {
        return { success: false, error: '본인의 역할은 변경할 수 없습니다.' }
    }

    if (!['ADMIN', 'USER'].includes(role)) {
        return { success: false, error: '유효하지 않은 역할입니다.' }
    }

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role },
        select: { name: true, email: true }
    })

    await recordAuditLog({
        action: 'UPDATE',
        entity: 'User',
        entityId: userId,
        details: { role },
        description: `사용자 권한(Role) 변경: ${updatedUser.name || updatedUser.email || userId} -> ${role}`
    })

    revalidatePath('/admin/users')
    return { success: true }
}

// 사용자 정보 수정
export async function updateUserInfo(
    userId: string,
    data: { name?: string | null; email?: string | null; department?: string | null; position?: string | null; phone?: string | null }
) {
    await requireAdmin()

    await prisma.user.update({
        where: { id: userId },
        data: {
            name: data.name ?? null,
            email: data.email ?? null,
            department: data.department ?? null,
            position: data.position ?? null,
            phone: data.phone ?? null,
        },
    })

    await recordAuditLog({
        action: 'UPDATE',
        entity: 'User',
        entityId: userId,
        details: data,
        description: `사용자 정보 수정: ${data.name || userId}`
    })

    revalidatePath('/admin/users')
    return { success: true }
}

// 사용자 삭제
export async function deleteUser(userId: string) {
    const session = await requireAdmin()

    // 본인 삭제 방지
    if (session.user.id === userId) {
        return { success: false, error: '본인 계정은 삭제할 수 없습니다.' }
    }

    const deletedUser = await prisma.user.delete({
        where: { id: userId },
        select: { name: true, email: true }
    })

    await recordAuditLog({
        action: 'DELETE',
        entity: 'User',
        entityId: userId,
        description: `사용자 계정 삭제: ${deletedUser.name || deletedUser.email}`
    })

    revalidatePath('/admin/users')
    revalidatePath('/', 'layout') // 승인 대기 거절(=삭제)이면 뱃지가 줄어야 한다(§83)
    return { success: true }
}

// 사용자 권한 변경
export async function updateUserPermissions(userId: string, permissions: string[]) {
    await requireAdmin()

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { permissions },
        select: { name: true, email: true }
    })

    await recordAuditLog({
        action: 'UPDATE',
        entity: 'User',
        entityId: userId,
        details: { permissions },
        description: `사용자 세부 권한(Permissions) 변경: ${updatedUser.name || updatedUser.email || userId}`
    })

    revalidatePath('/admin/users')
    return { success: true }
}
