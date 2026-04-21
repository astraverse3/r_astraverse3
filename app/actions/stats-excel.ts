'use server'

import * as XLSX from 'xlsx'
import { requireSession } from '@/lib/auth-guard'
import { recordAuditLog } from '@/lib/audit'

export type StatsExcelRow = Record<string, string | number>

export async function exportStatsRows(
    rows: StatsExcelRow[],
    sheetName: string,
    fileNamePrefix: string,
    auditDescription?: string,
) {
    await requireSession()
    try {
        const headers = rows.length > 0 ? Object.keys(rows[0]) : []

        let worksheet
        if (rows.length === 0) {
            worksheet = XLSX.utils.aoa_to_sheet([[sheetName]])
        } else {
            worksheet = XLSX.utils.json_to_sheet(rows, { header: headers })
        }

        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

        const buf = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' })

        await recordAuditLog({
            action: 'EXPORT',
            entity: 'Statistics',
            description: auditDescription ?? `통계 엑셀 내보내기: ${sheetName} (${rows.length}건)`
        })

        return {
            success: true as const,
            data: buf,
            fileName: `${fileNamePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        }
    } catch (error) {
        console.error('Stats export failed:', error)
        return { success: false as const, error: '엑셀 다운로드에 실패했습니다.' }
    }
}
