'use server'

import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { revalidatePath } from 'next/cache'
import { recordAuditLog } from '@/lib/audit'
import { requireSession } from '@/lib/auth-guard'

// 공지사항 권한 체크 헬퍼
async function requireNoticeManage() {
    const session = await getServerSession(authOptions)
    if (!session?.user) throw new Error('Unauthorized')
    
    const { role, permissions } = session.user
    if (role !== 'ADMIN' && !permissions?.includes('NOTICE_MANAGE')) {
        throw new Error('Forbidden: Notice management permission required')
    }
    return session
}

// 1. 전체 공지 목록 조회 (관리자용)
export async function getNotices() {
    await requireNoticeManage()
    
    const notices = await prisma.notice.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            author: {
                select: { name: true }
            }
        }
    })
    
    return notices
}

// 2. 활성화된 공지만 조회 (메인 대시보드 전광판용, 업무 권한 필요 없음)
// 로그인(승인된 사용자)은 본다 — 예전엔 가드가 아예 없어 승인 대기 계정도 직접 부를 수 있었다(§83)
export async function getActiveNotices() {
    try {
        await requireSession()
    } catch {
        return { success: false, data: [] }
    }
    const notices = await prisma.notice.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        include: {
            author: {
                select: { name: true }
            }
        }
    })
    
    return { success: true, data: notices }
}

// 3. 공지 생성
export async function createNotice(data: { title: string; content: string; isActive: boolean }) {
    const session = await requireNoticeManage()
    
    const notice = await prisma.notice.create({
        data: {
            ...data,
            authorId: session.user.id
        }
    })

    await recordAuditLog({
        action: 'CREATE',
        entity: 'Notice',
        entityId: notice.id,
        details: data,
        description: `공지사항 등록: ${data.title}`
    })
    
    // 대시보드 및 관리자 페이지 캐시 날리기
    revalidatePath('/')
    revalidatePath('/admin/notices')
    
    return { success: true }
}

// 4. 공지 수정
export async function updateNotice(id: number, data: { title?: string; content?: string; isActive?: boolean }) {
    await requireNoticeManage()
    
    const notice = await prisma.notice.update({
        where: { id },
        data
    })

    await recordAuditLog({
        action: 'UPDATE',
        entity: 'Notice',
        entityId: id,
        details: data,
        description: `공지사항 수정: ${notice.title}`
    })
    
    revalidatePath('/')
    revalidatePath('/admin/notices')
    
    return { success: true }
}

// 5. 공지 삭제
export async function deleteNotice(id: number) {
    await requireNoticeManage()
    
    const deleted = await prisma.notice.delete({
        where: { id }
    })

    await recordAuditLog({
        action: 'DELETE',
        entity: 'Notice',
        entityId: id,
        description: `공지사항 삭제: ${deleted.title}`
    })
    
    revalidatePath('/')
    revalidatePath('/admin/notices')
    
    return { success: true }
}
