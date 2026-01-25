'use server'

import { prisma } from '@/lib/prisma'

export async function getDashboardStats() {
    try {
        const [totalAvailableStock, totalMillingBatches, totalOutputWeight, recentLogs] = await Promise.all([
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
            // 4. Recent 5 milling logs
            prisma.millingBatch.findMany({
                take: 5,
                orderBy: { date: 'desc' },
                include: {
                    outputs: true
                }
            })
        ]);

        return {
            success: true,
            data: {
                availableStockKg: totalAvailableStock._sum.weightKg || 0,
                totalBatches: totalMillingBatches,
                totalOutputKg: totalOutputWeight._sum.totalWeight || 0,
                recentLogs
            }
        }
    } catch (error) {
        console.error('Failed to fetch dashboard stats:', error)
        return { success: false, error: '통계 정보를 불러오는데 실패했습니다.' }
    }
}
