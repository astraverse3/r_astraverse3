'use server'

import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

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
    try {
        // Fetch ALL matching logs for export
        const result = await getAuditLogs({ ...params, page: 1, pageSize: 5000 })
        if (!result.success || !result.data) throw new Error('Failed to fetch data')

        const rows = (result.data as any[]).map((log: any) => ({
            'ID': log.id,
            '일시': log.createdAt.toLocaleString('ko-KR'),
            '작업자': log.userName,
            '이메일': log.userEmail,
            '작업': log.action,
            '대상': log.entity,
            '대상ID': log.entityId,
            '설명': log.description,
            '변경상세': log.details ? JSON.stringify(log.details) : '',
            'IP': log.ip
        }))

        const worksheet = XLSX.utils.json_to_sheet(rows)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'AuditLogs')

        const buf = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' })
        
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
