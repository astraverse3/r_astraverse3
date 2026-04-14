'use server'

import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { recordAuditLog } from '@/lib/audit'
import { requireAdmin, requireSession } from '@/lib/auth-guard'

export type GetAuditLogsParams = {
    userId?: string
    action?: string
    entity?: string
    startDate?: Date
    endDate?: Date
    page?: number
    pageSize?: number
}

export async function getAuditLogs(params?: GetAuditLogsParams) {
    await requireAdmin()
    try {
        const { userId, action, entity, startDate, endDate, page = 1, pageSize = 50 } = params || {}
        
        const where: any = {}
        if (userId) where.userId = userId
        if (action && action !== 'ALL') where.action = action
        if (entity && entity !== 'ALL') where.entity = entity
        
        if (startDate || endDate) {
            where.createdAt = {}
            if (startDate) where.createdAt.gte = startDate
            if (endDate) where.createdAt.lte = endDate
        }

        const [total, logs] = await Promise.all([
            prisma.auditLog.count({ where }),
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }) as Promise<any[]>
        ])

        return {
            success: true,
            data: logs,
            pagination: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        }
    } catch (error) {
        console.error('Failed to get audit logs:', error)
        return { success: false, error: '활동 로그를 불러오는데 실패했습니다.' }
    }
}

export async function exportAuditLogs(params?: Omit<GetAuditLogsParams, 'page' | 'pageSize'>) {
    await requireAdmin()
    try {
        // Fetch ALL matching logs for export
        const result = await getAuditLogs({ ...params, page: 1, pageSize: 5000 })
        if (!result.success || !result.data) throw new Error('Failed to fetch data')

        const ENTITY_NAMES: Record<string, string> = {
            'Stock': '재고관리',
            'MillingBatch': '도정관리',
            'MillingOutputPackage': '도정관리',
            'Farmer': '생산자 관리',
            'Variety': '품종 관리',
            'User': '사용자 관리',
            'Notice': '공지사항 관리',
            'ProducerGroup': '작목반 관리',
            'Release': '출고관리',
            'StockRelease': '출고관리',
            'System': '시스템/기타'
        }

        const formatDetailsForExcel = (details: any) => {
            if (!details) return ''
            try {
                // 단순 객체일 경우 key: value 형태로 변환
                if (typeof details === 'object') {
                    return Object.entries(details)
                        .map(([key, value]) => {
                            if (typeof value === 'object' && value !== null) {
                                return `${key}: ${JSON.stringify(value)}`
                            }
                            return `${key}: ${value}`
                        })
                        .join('\n')
                }
                return JSON.stringify(details)
            } catch (e) {
                return String(details)
            }
        }

        const rows = (result.data as any[]).map((log: any) => ({
            'ID': log.id,
            '일시': log.createdAt.toLocaleString('ko-KR'),
            '작업자': log.userName,
            '이메일': log.userEmail,
            '작업': log.action,
            '대상': ENTITY_NAMES[log.entity] || log.entity,
            '대상ID': log.entityId,
            '설명': log.description,
            '변경상세': formatDetailsForExcel(log.details),
            'IP': log.ip
        }))

        const worksheet = XLSX.utils.json_to_sheet(rows)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'AuditLogs')

        const buf = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' })
        
        // 내보내기 기록 자체도 로그에 남김
        await recordAuditLog({
            action: 'EXPORT',
            entity: 'System', // 시스템 권한 기반
            description: `활동 로그 엑셀 내보내기 (${rows.length}건)`
        })

        return { 
            success: true, 
            data: buf, 
            fileName: `audit_logs_${new Date().toISOString().slice(0, 10)}.xlsx` 
        }
    } catch (error) {
        console.error('Export logs failed:', error)
        return { success: false, error: '엑셀 내보내기에 실패했습니다.' }
    }
}

// 현재 경로(메뉴)에 맞는 데이터의 가장 마지막 업데이트 시각 조회
export async function getLatestUpdateForPath(pathname: string) {
    await requireSession()
    try {
        let entities: string[] | undefined = undefined;

        if (pathname.startsWith('/stocks')) {
            entities = ['Stock'];
        } else if (pathname.startsWith('/milling')) {
            entities = ['MillingBatch'];
        } else if (pathname.startsWith('/release')) {
            entities = ['Release'];
        } else if (pathname.startsWith('/admin/users')) {
            entities = ['User'];
        } else if (pathname.startsWith('/admin/farmers')) {
            entities = ['Farmer', 'ProducerGroup'];
        } else if (pathname.startsWith('/admin/varieties')) {
            entities = ['Variety'];
        } else if (pathname.startsWith('/admin/notices')) {
            entities = ['Notice'];
        } else if (pathname.startsWith('/admin/logs')) {
            entities = undefined; // 전체 변경 내역 중 최신
        } else if (pathname === '/') {
            entities = undefined; // 전체 대시보드 중 최신
        } else {
            entities = undefined; // 기타 경로는 전체 최신
        }

        const where: any = {};
        if (entities) {
            where.entity = { in: entities };
        }

        const latestLog = await prisma.auditLog.findFirst({
            where,
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true }
        });

        if (latestLog) {
            return { success: true, timestamp: latestLog.createdAt.toISOString() };
        }
        
        return { success: true, timestamp: null };
    } catch (error) {
        console.error('Failed to get latest update context:', error);
        return { success: false, error: '시간을 불러오는데 실패했습니다.' };
    }
}
