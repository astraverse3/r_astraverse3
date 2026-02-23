'use server'

import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { GetMillingLogsParams } from './milling'

export async function exportMillingLogs(params?: GetMillingLogsParams) {
    try {
        const where: any = {}

        if (params?.startDate && params?.endDate) {
            where.date = {
                gte: params.startDate,
                lte: params.endDate
            }
        }

        if (params?.status) {
            if (params.status === 'active') {
                where.isClosed = false
            } else if (params.status === 'completed') {
                where.isClosed = true
            }
        }

        if (params?.millingType) {
            where.millingType = params.millingType
        }

        const andConditions: any[] = []

        if (params?.variety) {
            andConditions.push({
                stocks: {
                    some: {
                        variety: {
                            name: { contains: params.variety }
                        }
                    }
                }
            })
        }

        if (params?.farmerName) {
            andConditions.push({
                stocks: {
                    some: {
                        farmer: {
                            name: { contains: params.farmerName }
                        }
                    }
                }
            })
        }

        if (params?.keyword) {
            andConditions.push({
                OR: [
                    { remarks: { contains: params.keyword } },
                    {
                        stocks: {
                            some: {
                                OR: [
                                    { variety: { name: { contains: params.keyword } } },
                                    { farmer: { name: { contains: params.keyword } } }
                                ]
                            }
                        }
                    }
                ]
            })
        }

        if (andConditions.length > 0) {
            where.AND = andConditions
        }

        const logs = await prisma.millingBatch.findMany({
            where,
            include: {
                stocks: {
                    include: {
                        variety: true,
                        farmer: {
                            include: { group: true }
                        }
                    }
                },
                outputs: true
            },
            orderBy: [
                { date: 'desc' },
                { id: 'desc' }
            ]
        })

        const rows: any[] = []

        for (const batch of logs) {
            const dateStr = batch.date ? new Date(batch.date).toLocaleDateString('ko-KR') : ''
            const statusStr = batch.isClosed ? '완료' : '진행중'
            const productionSum = batch.outputs.reduce((sum, out) => sum + out.totalWeight, 0)
            const yieldRate = batch.totalInputKg > 0 ? (productionSum / batch.totalInputKg) * 100 : 0
            const formattedYield = yieldRate === 0 && !batch.isClosed ? '-' : `${(Math.round(yieldRate * 10) / 10).toFixed(1)}%`

            // Flatten data: one row per stock used in the batch
            if (batch.stocks.length === 0) {
                // Edge case: batch with no stocks linked yet
                rows.push({
                    '도정일자': dateStr,
                    '진행상태': statusStr,
                    '품종': '',
                    '도정분류': batch.millingType,
                    '생산자명': '',
                    '작목반': '',
                    '톤백번호': '',
                    '톤백무게(kg)': '',
                    '총 투입량(kg)': batch.totalInputKg,
                    '총 생산량(kg)': batch.isClosed ? productionSum : '-',
                    '수율': formattedYield,
                    '비고': batch.remarks || ''
                })
            } else {
                for (const stock of batch.stocks) {
                    rows.push({
                        '도정일자': dateStr,
                        '진행상태': statusStr,
                        '품종': stock.variety.name,
                        '도정분류': batch.millingType,
                        '생산자명': stock.farmer.name,
                        '작목반': stock.farmer.group?.name || '일반',
                        '톤백번호': stock.bagNo,
                        '톤백무게(kg)': stock.weightKg,
                        '총 투입량(kg)': batch.totalInputKg,
                        '총 생산량(kg)': batch.isClosed ? productionSum : '-',
                        '수율': formattedYield,
                        '비고': batch.remarks || ''
                    })
                }
            }
        }

        let worksheet
        if (rows.length === 0) {
            worksheet = XLSX.utils.aoa_to_sheet([['도정일자', '진행상태', '품종', '도정분류', '생산자명', '작목반', '톤백번호', '톤백무게(kg)', '총 투입량(kg)', '총 생산량(kg)', '수율', '비고']])
        } else {
            worksheet = XLSX.utils.json_to_sheet(rows)

            // Adjust column widths roughly
            const wscols = [
                { wch: 15 }, // 도정일자
                { wch: 10 }, // 진행상태
                { wch: 15 }, // 품종
                { wch: 10 }, // 도정분류
                { wch: 12 }, // 생산자명
                { wch: 12 }, // 작목반
                { wch: 10 }, // 톤백번호
                { wch: 12 }, // 톤백무게
                { wch: 12 }, // 총투입량
                { wch: 12 }, // 총생산량
                { wch: 10 }, // 수율
                { wch: 30 }, // 비고
            ];
            worksheet['!cols'] = wscols;
        }

        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Milling Logs')

        const buf = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' })

        return { success: true, daa: buf, fileName: `milling_logs_${new Date().toISOString().slice(0, 10)}.xlsx` }

    } catch (error) {
        console.error('Export milling logs failed:', error)
        return { success: false, error: '엑셀 다운로드에 실패했습니다.' }
    }
}
