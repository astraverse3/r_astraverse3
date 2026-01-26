'use server'

import { prisma } from '@/lib/prisma'

export async function getDashboardStats() {
    try {
        // 0. Calculate Latest Production Year from Stocks (or default to current year)
        const latestStock = await prisma.stock.findFirst({
            orderBy: { productionYear: 'desc' },
            select: { productionYear: true }
        });
        const latestYear = latestStock?.productionYear || new Date().getFullYear();
        const currentYear = new Date().getFullYear();

        const [totalAvailableStock, totalMillingBatches, totalOutputWeight, totalInputWeight, recentLogs, stockByVariety, milledByVariety, ...results] = await Promise.all([
            // 1. Total available stock weight (KG) - Filtered by Latest Year
            prisma.stock.aggregate({
                where: {
                    status: 'AVAILABLE',
                    productionYear: latestYear
                },
                _sum: { weightKg: true }
            }),
            // 2. Count of milling batches
            prisma.millingBatch.count(),
            // 3. Total output production weight (KG) - Filtered by Current Year (Batch Date)
            prisma.millingOutputPackage.aggregate({
                where: {
                    batch: {
                        date: {
                            gte: new Date(`${currentYear}-01-01`),
                            lt: new Date(`${currentYear + 1}-01-01`)
                        }
                    }
                },
                _sum: { totalWeight: true }
            }),
            // 4. Total Input Weight for Yield Calculation (Current Year)
            prisma.millingBatch.aggregate({
                where: {
                    date: {
                        gte: new Date(`${currentYear}-01-01`),
                        lt: new Date(`${currentYear + 1}-01-01`)
                    }
                },
                _sum: { totalInputKg: true }
            }),
            // 5. Recent 10 milling logs
            prisma.millingBatch.findMany({
                take: 10,
                orderBy: { date: 'desc' },
                include: {
                    outputs: true
                }
            }),
            // 6. Stock by Variety (AVAILABLE) - Filtered by Latest Year
            prisma.stock.groupBy({
                by: ['variety'],
                where: {
                    status: 'AVAILABLE',
                    productionYear: latestYear
                },
                _sum: { weightKg: true },
                orderBy: { _sum: { weightKg: 'desc' } }
            }),
            // 7. Milled Quantity by Variety (CONSUMED)
            prisma.stock.groupBy({
                by: ['variety'],
                where: { status: 'CONSUMED' },
                _sum: { weightKg: true },
                orderBy: { _sum: { weightKg: 'desc' } }
            }),
            // 8. Latest Update Time (Stock or MillingBatch or MillingOutputPackage)
            prisma.stock.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
            prisma.millingBatch.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } })
        ]);

        const totalOutput = totalOutputWeight._sum?.totalWeight || 0;
        const totalInput = totalInputWeight._sum?.totalInputKg || 0;
        const yieldPercentage = totalInput > 0 ? (totalOutput / totalInput) * 100 : 0;

        // Calculate latest update time
        // results[0] -> Stock update
        // results[1] -> Batch update
        const latestStockUpdate = (results[0] as { updatedAt: Date } | null)?.updatedAt?.getTime() || 0;
        const latestBatchUpdate = (results[1] as { updatedAt: Date } | null)?.updatedAt?.getTime() || 0;
        const lastUpdated = new Date(Math.max(latestStockUpdate, latestBatchUpdate));
        // If no data exists, fallback to current time is optional, but user asked for "latest change".
        // If 0, it means no data. Let's keep it as is or default to now if 0?
        // Let's default to now() only if BOTH are 0, to avoid showing 1970.
        const finalLastUpdated = lastUpdated.getTime() === 0 ? new Date() : lastUpdated;

        return {
            success: true,
            data: {
                targetYear: latestYear, // For Stock Display
                productionYear: currentYear, // For Production Display
                availableStockKg: totalAvailableStock._sum?.weightKg || 0,
                totalBatches: totalMillingBatches,
                totalOutputKg: totalOutput,
                yieldPercentage: yieldPercentage, // New Field
                recentLogs,
                stockByVariety,
                milledByVariety,
                lastUpdated: finalLastUpdated // For Clock
            }
        }
    } catch (error) {
        console.error('Failed to fetch dashboard stats:', error)
        return { success: false, error: '통계 정보를 불러오는데 실패했습니다.' }
    }
}
