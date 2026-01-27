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
                    outputs: true,
                    stocks: true
                }
            }),
            // 6. Stock by Variety (ALL Statuses for Year) - Modified to calculate Total vs Available
            prisma.stock.groupBy({
                by: ['variety', 'status'],
                where: {
                    productionYear: latestYear
                },
                _sum: { weightKg: true }
            }),
            // 7. Consumed (Legacy/Redundant - keeping slot to preserve indices for now, or just return empty)
            Promise.resolve([]),
            // 8. Latest Update Time (Stock or MillingBatch or MillingOutputPackage)
            prisma.stock.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
            prisma.millingBatch.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
            // 9. Closed Batch Input (For Yield)
            prisma.millingBatch.aggregate({
                where: {
                    isClosed: true,
                    date: {
                        gte: new Date(`${currentYear}-01-01`),
                        lt: new Date(`${currentYear + 1}-01-01`)
                    }
                },
                _sum: { totalInputKg: true }
            }),
            // 10. Closed Batch Output (For Yield)
            prisma.millingOutputPackage.aggregate({
                where: {
                    batch: {
                        isClosed: true,
                        date: {
                            gte: new Date(`${currentYear}-01-01`),
                            lt: new Date(`${currentYear + 1}-01-01`)
                        }
                    }
                },
                _sum: { totalWeight: true }
            })
        ]);

        const totalOutput = totalOutputWeight._sum?.totalWeight || 0;
        // Yield calculation based on CLOSED batches only
        const closedInput = results[2] as { _sum: { totalInputKg: number | null } }; // Index 9 in full array, but rest syntax makes it index 2 in 'results'
        const closedOutput = results[3] as { _sum: { totalWeight: number | null } }; // Index 10 -> index 3

        const closedInputSum = closedInput._sum?.totalInputKg || 0;
        const closedOutputSum = closedOutput._sum?.totalWeight || 0;

        const yieldPercentage = closedInputSum > 0 ? (closedOutputSum / closedInputSum) * 100 : 0;

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

        // Process Stock Data
        const rawStockData = stockByVariety as unknown as Array<{ variety: string, status: string, _sum: { weightKg: number | null } }>;

        // Group by variety to calculate Current vs Total
        const varietyMap = new Map<string, { current: number, total: number }>();

        rawStockData.forEach(item => {
            const weight = item._sum.weightKg || 0;
            const current = varietyMap.get(item.variety) || { current: 0, total: 0 };

            // Total includes everything for the year
            current.total += weight;

            // Current only includes AVAILABLE
            if (item.status === 'AVAILABLE') {
                current.current += weight;
            }

            varietyMap.set(item.variety, current);
        });

        // Convert Map to sorted array
        const processedStockByVariety = Array.from(varietyMap.entries())
            .map(([variety, data]) => ({
                variety,
                currentWeight: data.current,
                totalWeight: data.total
            }))
            .sort((a, b) => b.totalWeight - a.totalWeight); // Sort by total weight

        // Calculate Total Stock for the year (Available + Consumed)
        const totalStockWeight = processedStockByVariety.reduce((sum, item) => sum + item.totalWeight, 0);
        const availableStockWeight = totalAvailableStock._sum?.weightKg || 0;
        const consumedStockWeight = totalStockWeight - availableStockWeight;
        const millingProgressRate = totalStockWeight > 0 ? (consumedStockWeight / totalStockWeight) * 100 : 0;

        return {
            success: true,
            data: {
                targetYear: latestYear, // For Stock Display
                productionYear: currentYear, // For Production Display
                availableStockKg: availableStockWeight,
                consumedStockKg: consumedStockWeight, // New Field
                totalStockKg: totalStockWeight, // New Field
                millingProgressRate: millingProgressRate, // New Field
                totalBatches: totalMillingBatches,
                totalOutputKg: totalOutput,
                yieldPercentage: yieldPercentage,
                recentLogs,
                stockByVariety: processedStockByVariety,
                milledByVariety: [],
                lastUpdated: finalLastUpdated
            }
        }
    } catch (error) {
        console.error('Failed to fetch dashboard stats:', error)
        return { success: false, error: '통계 정보를 불러오는데 실패했습니다.' }
    }
}
