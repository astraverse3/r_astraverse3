'use server'

import { prisma } from '@/lib/prisma'

export async function getDashboardStats() {
    try {
        const [totalAvailableStock, totalMillingBatches, totalOutputWeight, recentLogs, stockByVariety, milledByVariety] = await Promise.all([
            // 1. Total available stock weight (KG)
            prisma.stock.aggregate({
                where: { status: 'AVAILABLE' },
                _sum: { weightKg: true }
            }),
            // 2. Count of milling batches
            prisma.millingBatch.count(),
            // 3. Total output production weight (KG)
            prisma.millingOutputPackage.aggregate({
                _sum: { totalWeight: true }
            }),
            // 4. Recent 10 milling logs
            prisma.millingBatch.findMany({
                take: 10,
                orderBy: { date: 'desc' },
                include: {
                    outputs: true
                }
            }),
            // 5. Stock by Variety (AVAILABLE)
            prisma.stock.groupBy({
                by: ['variety'],
                where: { status: 'AVAILABLE' },
                _sum: { weightKg: true },
                orderBy: { _sum: { weightKg: 'desc' } }
            }),
            // 6. Milled Quantity by Variety (CONSUMED) - Total Input
            prisma.stock.groupBy({
                by: ['variety'],
                where: { status: 'CONSUMED' },
                _sum: { weightKg: true },
                orderBy: { _sum: { weightKg: 'desc' } }
            })
        ]);

        return {
            success: true,
            data: {
                availableStockKg: totalAvailableStock._sum.weightKg || 0,
                totalBatches: totalMillingBatches,
                totalOutputKg: totalOutputWeight._sum.totalWeight || 0,
                recentLogs,
                stockByVariety,
                milledByVariety
            }
        }
    } catch (error) {
        console.error('Failed to fetch dashboard stats:', error)
        return { success: false, error: '통계 정보를 불러오는데 실패했습니다.' }
    }
}
