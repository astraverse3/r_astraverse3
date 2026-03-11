'use server'

import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { revalidatePath } from 'next/cache'

// 공지사항 권한 체크 헬퍼
async function requireNoticeManage() {
    const session = await getServerSession(authOptions)
    if (!session?.user) throw new Error('Unauthorized')
    
    // @ts-ignore
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
        orderBy: { createdAt: 'desc' }
    })
    
    return notices
}

// 2. 활성화된 공지만 조회 (메인 대시보드 전광판용, 권한 필요 없음)
export async function getActiveNotices() {
    const notices = await prisma.notice.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
    })
    
    return { success: true, data: notices }
}

// 3. 공지 생성
export async function createNotice(data: { title: string; content: string; isActive: boolean }) {
    await requireNoticeManage()
    
    await prisma.notice.create({
        data
    })
    
    // 대시보드 및 관리자 페이지 캐시 날리기
    revalidatePath('/')
    revalidatePath('/admin/notices')
    
    return { success: true }
}

// 4. 공지 수정
export async function updateNotice(id: number, data: { title?: string; content?: string; isActive?: boolean }) {
    await requireNoticeManage()
    
    await prisma.notice.update({
        where: { id },
        data
    })
    
    revalidatePath('/')
    revalidatePath('/admin/notices')
    
    return { success: true }
}

// 5. 공지 삭제
export async function deleteNotice(id: number) {
    await requireNoticeManage()
    
    await prisma.notice.delete({
        where: { id }
    })
    
    revalidatePath('/')
    revalidatePath('/admin/notices')
    
    return { success: true }
}
