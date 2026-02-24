'use server'

import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { revalidatePath } from 'next/cache'

// ADMIN 권한 체크 헬퍼
async function requireAdmin() {
    const session = await getServerSession(authOptions)
    if (!session?.user) throw new Error('Unauthorized')
    // @ts-ignore
    if (session.user.role !== 'ADMIN') throw new Error('Forbidden: Admin only')
    return session
}

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

// 사용자 역할 변경
export async function updateUserRole(userId: string, role: string) {
    const session = await requireAdmin()

    // 본인 역할 변경 방지
    // @ts-ignore
    if (session.user.id === userId) {
        return { success: false, error: '본인의 역할은 변경할 수 없습니다.' }
    }

    if (!['ADMIN', 'USER'].includes(role)) {
        return { success: false, error: '유효하지 않은 역할입니다.' }
    }

    await prisma.user.update({
        where: { id: userId },
        data: { role },
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

    revalidatePath('/admin/users')
    return { success: true }
}

// 사용자 삭제
export async function deleteUser(userId: string) {
    const session = await requireAdmin()

    // 본인 삭제 방지
    // @ts-ignore
    if (session.user.id === userId) {
        return { success: false, error: '본인 계정은 삭제할 수 없습니다.' }
    }

    // Account, Session도 cascade로 삭제됨 (schema에 onDelete: Cascade 설정됨)
    await prisma.user.delete({
        where: { id: userId },
    })

    revalidatePath('/admin/users')
    return { success: true }
}

// 사용자 권한 변경
export async function updateUserPermissions(userId: string, permissions: string[]) {
    await requireAdmin()

    await prisma.user.update({
        where: { id: userId },
        data: { permissions },
    })

    revalidatePath('/admin/users')
    return { success: true }
}
