'use server'

import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export async function exportReleaseLogs(filters?: {
    startDate?: Date
    endDate?: Date
    keyword?: string
}) {
    try {
        const where: any = {}

        if (filters?.startDate || filters?.endDate) {
            where.date = {}
            if (filters.startDate) where.date.gte = filters.startDate
            if (filters.endDate) where.date.lte = filters.endDate
        }

        if (filters?.keyword) {
            where.OR = [
                { destination: { contains: filters.keyword, mode: 'insensitive' } },
                { purpose: { contains: filters.keyword, mode: 'insensitive' } }
            ]
        }

        const logs = await prisma.stockRelease.findMany({
            where,
            include: {
                stocks: {
                    include: {
                        farmer: {
                            include: {
                                group: true
                            }
                        },
                        variety: true
                    }
                }
            },
            orderBy: {
                date: 'desc'
            }
        })

        const rows: any[] = []

        for (const log of logs) {
            const dateStr = log.date ? new Date(log.date).toLocaleDateString('ko-KR') : ''

            if (log.stocks.length === 0) {
                // Edge case where release has no stocks mapped
                rows.push({
                    '출고일자': dateStr,
                    '출고처': log.destination,
                    '용도': log.purpose || '',
                    '생산자명': '',
                    '작목반': '',
                    '품종': '',
                    '톤백번호': '',
                    '톤백무게(kg)': '',
                })
            } else {
                for (const stock of log.stocks) {
                    rows.push({
                        '출고일자': dateStr,
                        '출고처': log.destination,
                        '용도': log.purpose || '',
                        '생산자명': stock.farmer.name,
                        '작목반': stock.farmer.group?.name || '일반',
                        '품종': stock.variety.name,
                        '톤백번호': stock.bagNo,
                        '톤백무게(kg)': stock.weightKg,
                    })
                }
            }
        }

        let worksheet
        if (rows.length === 0) {
            worksheet = XLSX.utils.aoa_to_sheet([['출고일자', '출고처', '용도', '생산자명', '작목반', '품종', '톤백번호', '톤백무게(kg)']])
        } else {
            worksheet = XLSX.utils.json_to_sheet(rows)

            const wscols = [
                { wch: 15 }, // 출고일자
                { wch: 20 }, // 출고처
                { wch: 20 }, // 용도
                { wch: 15 }, // 생산자명
                { wch: 15 }, // 작목반
                { wch: 15 }, // 품종
                { wch: 10 }, // 톤백번호
                { wch: 12 }, // 톤백무게
            ];
            worksheet['!cols'] = wscols;
        }

        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Release Logs')

        const buf = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' })

        return { success: true, daa: buf, fileName: `release_logs_${new Date().toISOString().slice(0, 10)}.xlsx` }

    } catch (error) {
        console.error('Export release logs failed:', error)
        return { success: false, error: '엑셀 다운로드에 실패했습니다.' }
    }
}
