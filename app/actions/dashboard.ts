'use server'

import { prisma } from '@/lib/prisma'

export async function getDashboardStats() {
    try {
        // 0. Calculate Latest Production Year from Stocks
        const latestStock = await prisma.stock.findFirst({
            orderBy: { productionYear: 'desc' },
            select: { productionYear: true }
        });
        const latestYear = latestStock?.productionYear || new Date().getFullYear();
        const currentYear = new Date().getFullYear();

        // Batch 1: Key Aggregates (Lightweight)
        const [totalAvailableStock, totalMillingBatches, totalOutputWeight, totalInputWeight] = await Promise.all([
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
            // 3. Total output production weight (KG) - Filtered by Current Year
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
            // 4. Total Input Weight for Yield (Current Year)
            prisma.millingBatch.aggregate({
                where: {
                    date: {
                        gte: new Date(`${currentYear}-01-01`),
                        lt: new Date(`${currentYear + 1}-01-01`)
                    }
                },
                _sum: { totalInputKg: true }
            })
        ]);

        // Batch 2: Complex Queries & Lists (Heavier)
        const [recentLogs, stockByVariety, latestStockUpdateLog, latestBatchUpdateLog] = await Promise.all([
            // 5. Recent 10 milling logs
            prisma.millingBatch.findMany({
                take: 10,
                orderBy: { date: 'desc' },
                include: {
                    outputs: true,
                    stocks: {
                        include: { variety: true } // Fetch variety object
                    }
                }
            }),
            // 6. Stock by Variety (ALL Statuses for Year)
            prisma.stock.groupBy({
                by: ['varietyId', 'status'],
                where: {
                    productionYear: latestYear
                },
                _sum: { weightKg: true }
            }),
            // 8. Latest Updates
            prisma.stock.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
            prisma.millingBatch.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
        ]);

        // Process Stock Data (Mapped by ID -> need Names)
        // Fetch all Varieties to map IDs to Names
        const varieties = await prisma.variety.findMany();
        const varietyNameMap = new Map(varieties.map(v => [v.id, v.name]));

        const rawStockData = stockByVariety as unknown as Array<{ varietyId: number, status: string, _sum: { weightKg: number | null } }>;
        const varietyMap = new Map<string, { current: number, total: number }>();

        rawStockData.forEach(item => {
            const name = varietyNameMap.get(item.varietyId) || 'Unknown';
            const weight = item._sum.weightKg || 0;
            const current = varietyMap.get(name) || { current: 0, total: 0 };

            current.total += weight;
            if (item.status === 'AVAILABLE') {
                current.current += weight;
            }
            varietyMap.set(name, current);
        });

        // Convert to sorted array
        const processedStockByVariety = Array.from(varietyMap.entries())
            .map(([variety, data]) => ({
                variety,
                currentWeight: data.current,
                totalWeight: data.total
            }))
            .sort((a, b) => b.totalWeight - a.totalWeight);

        // Stats Calculations
        const totalOutput = totalOutputWeight._sum?.totalWeight || 0;
        const totalStockWeight = processedStockByVariety.reduce((sum, item) => sum + item.totalWeight, 0);
        const availableStockWeight = totalAvailableStock._sum?.weightKg || 0;
        const consumedStockWeight = totalStockWeight - availableStockWeight;
        const millingProgressRate = totalStockWeight > 0 ? (consumedStockWeight / totalStockWeight) * 100 : 0;

        // Approx Yield (Overall)
        const totalInput = totalInputWeight._sum?.totalInputKg || 0;
        const yieldPercentage = totalInput > 0 ? (totalOutput / totalInput) * 100 : 0;

        // Latest Update
        const latestStockUpdate = latestStockUpdateLog?.updatedAt?.getTime() || 0;
        const latestBatchUpdate = latestBatchUpdateLog?.updatedAt?.getTime() || 0;
        const lastUpdated = new Date(Math.max(latestStockUpdate, latestBatchUpdate));
        const finalLastUpdated = lastUpdated.getTime() === 0 ? new Date() : lastUpdated;

        return {
            success: true,
            data: {
                targetYear: latestYear,
                productionYear: currentYear,
                availableStockKg: availableStockWeight,
                consumedStockKg: consumedStockWeight,
                totalStockKg: totalStockWeight,
                millingProgressRate: millingProgressRate,
                totalBatches: totalMillingBatches,
                totalOutputKg: totalOutput,
                yieldPercentage: yieldPercentage, // Using rough global yield for now
                recentLogs, // Note: UI will need to read variety.name from relations
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
