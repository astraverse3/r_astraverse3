'use server'

import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { GetMillingLogsParams } from './milling'
import { requireSession } from '@/lib/auth-guard'
import { matchesYieldFilter } from '@/lib/milling-yield'

export async function exportMillingLogs(params?: GetMillingLogsParams) {
    await requireSession()
    try {
        const where: any = {}

        if (params?.startDate && params?.endDate) {
            where.date = {
                gte: params.startDate,
                lte: params.endDate
            }
        }

        // Status filter — 3단계 (도정중/포장중/마감됨) + legacy alias
        if (params?.status) {
            if (params.status === 'milling') {
                where.isClosed = false
                where.outputs = { none: {} }
            } else if (params.status === 'packaging') {
                where.isClosed = false
                where.outputs = { some: {} }
            } else if (params.status === 'closed' || params.status === 'completed') {
                where.isClosed = true
            } else if (params.status === 'open' || params.status === 'active') {
                where.isClosed = false
            }
        }

        // Milling Type filter: 콤마 구분 멀티값 지원
        if (params?.millingType) {
            const types = params.millingType.split(',').map(s => s.trim()).filter(Boolean)
            if (types.length === 1) {
                where.millingType = types[0]
            } else if (types.length > 1) {
                where.millingType = { in: types }
            }
        }

        const andConditions: any[] = []

        // Variety filter: 콤마 구분 멀티값 지원 (OR 조건)
        if (params?.variety) {
            const varieties = params.variety.split(',').map(s => s.trim()).filter(Boolean)
            if (varieties.length === 1) {
                andConditions.push({
                    stocks: { some: { variety: { name: { contains: varieties[0] } } } }
                })
            } else if (varieties.length > 1) {
                andConditions.push({
                    OR: varieties.map(v => ({
                        stocks: { some: { variety: { name: { contains: v } } } }
                    }))
                })
            }
        }

        // Farmer Name filter: 콤마 구분 다중 생산자 검색 (OR 조건)
        if (params?.farmerName) {
            const names = params.farmerName.split(',').map(s => s.trim()).filter(Boolean)
            if (names.length === 1) {
                andConditions.push({
                    stocks: { some: { farmer: { name: { contains: names[0] } } } }
                })
            } else if (names.length > 1) {
                andConditions.push({
                    OR: names.map(n => ({
                        stocks: { some: { farmer: { name: { contains: n } } } }
                    }))
                })
            }
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

        // Yield filter: 목록 조회와 동일한 공유 헬퍼로 post-query 필터. 미마감 배치는 제외.
        const filteredLogs = params?.yieldRate && params.yieldRate !== 'ALL'
            ? logs.filter(batch => matchesYieldFilter(batch, params.yieldRate))
            : logs

        const rows: any[] = []

        for (const batch of filteredLogs) {
            const dateStr = batch.date ? new Date(batch.date).toLocaleDateString('ko-KR') : ''
            const statusStr = batch.isClosed
                ? '마감됨'
                : batch.outputs.length > 0 ? '포장중' : '도정중'
            const productionSum = batch.outputs.reduce((sum, out) => sum + out.totalWeight, 0)
            const yieldRate = batch.totalInputKg > 0 ? (productionSum / batch.totalInputKg) * 100 : 0
            const formattedYield = yieldRate === 0 && !batch.isClosed ? '-' : `${(Math.round(yieldRate * 10) / 10).toFixed(1)}%`

            // Flatten data: one row per stock used in the batch
            if (batch.stocks.length === 0) {
                // Edge case: batch with no stocks linked yet
                rows.push({
                    '도정일자': dateStr,
                    '도정상태': statusStr,
                    '품종': '',
                    '도정분류': batch.millingType,
                    '생산자명': '',
                    '작목반': '',
                    '톤백번호': '',
                    '톤백무게(kg)': '',
                    '총 투입량(kg)': batch.totalInputKg,
                    '총 생산량(kg)': batch.isClosed ? productionSum : '-',
                    '수율': formattedYield,
                    '로트번호': '-',
                    '비고': batch.remarks || ''
                })
            } else {
                for (const stock of batch.stocks) {
                    const isConventional = stock.farmer.group?.certType === '일반'
                    const lotDisplay = isConventional ? '관행' : (stock.lotNo || '-')
                    rows.push({
                        '도정일자': dateStr,
                        '도정상태': statusStr,
                        '품종': stock.variety.name,
                        '도정분류': batch.millingType,
                        '생산자명': stock.farmer.name,
                        '작목반': stock.farmer.group?.name || '일반',
                        '톤백번호': stock.bagNo,
                        '톤백무게(kg)': stock.weightKg,
                        '총 투입량(kg)': batch.totalInputKg,
                        '총 생산량(kg)': batch.isClosed ? productionSum : '-',
                        '수율': formattedYield,
                        '로트번호': lotDisplay,
                        '비고': batch.remarks || ''
                    })
                }
            }
        }

        let worksheet
        if (rows.length === 0) {
            worksheet = XLSX.utils.aoa_to_sheet([['도정일자', '도정상태', '품종', '도정분류', '생산자명', '작목반', '톤백번호', '톤백무게(kg)', '총 투입량(kg)', '총 생산량(kg)', '수율', '로트번호', '비고']])
        } else {
            worksheet = XLSX.utils.json_to_sheet(rows)

            // Adjust column widths roughly
            const wscols = [
                { wch: 15 }, // 도정일자
                { wch: 10 }, // 도정상태
                { wch: 15 }, // 품종
                { wch: 10 }, // 도정분류
                { wch: 12 }, // 생산자명
                { wch: 12 }, // 작목반
                { wch: 10 }, // 톤백번호
                { wch: 12 }, // 톤백무게
                { wch: 12 }, // 총투입량
                { wch: 12 }, // 총생산량
                { wch: 10 }, // 수율
                { wch: 22 }, // 로트번호
                { wch: 30 }, // 비고
            ];
            worksheet['!cols'] = wscols;
        }

        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Milling Logs')

        const buf = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' })

        return { success: true, data: buf, fileName: `milling_logs_${new Date().toISOString().slice(0, 10)}.xlsx` }

    } catch (error) {
        console.error('Export milling logs failed:', error)
        return { success: false, error: '엑셀 다운로드에 실패했습니다.' }
    }
}
