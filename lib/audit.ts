import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { headers } from 'next/headers'

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'IMPORT'

interface AuditParams {
    action: AuditAction
    entity: string
    entityId?: string | number
    details?: any
    description?: string
}

/**
 * 시스템 활동 로그를 기록하는 함수
 * 서버 액션 내에서 호출하도록 설계되었습니다.
 */
export async function recordAuditLog({
    action,
    entity,
    entityId,
    details,
    description
}: AuditParams) {
    try {
        const session = await getServerSession(authOptions)
        const headerList = await headers()
        
        // IP 및 User Agent 추출
        const ip = headerList.get('x-forwarded-for') || headerList.get('x-real-ip')
        const userAgent = headerList.get('user-agent')

        await prisma.auditLog.create({
            data: {
                userId: session?.user?.id as string | undefined,
                userName: session?.user?.name || 'Unknown',
                userEmail: session?.user?.email,
                action,
                entity,
                entityId: entityId?.toString(),
                details: details ? JSON.parse(JSON.stringify(details)) : null,
                description,
                ip: typeof ip === 'string' ? ip : null,
                userAgent: typeof userAgent === 'string' ? userAgent : null,
            }
        })
    } catch (error) {
        // 로그 기록 실패가 메인 비즈니스 로직에 영향을 주지 않도록 에러를 캐치만 하고 출력합니다.
        console.error('Failed to record audit log:', error)
    }
}
