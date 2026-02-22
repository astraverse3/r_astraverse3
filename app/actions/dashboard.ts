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
            // 3. Total output production weight (KG) - Filtered by Current Year AND Closed
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
            }),
            // 4. Total Input Weight for Yield (Current Year AND Closed)
            prisma.millingBatch.aggregate({
                where: {
                    isClosed: true,
                    date: {
                        gte: new Date(`${currentYear}-01-01`),
                        lt: new Date(`${currentYear + 1}-01-01`)
                    }
                },
                _sum: { totalInputKg: true }
            })
        ]);

        // Batch 2: Complex Queries & Lists (Heavier)
        const [recentLogs, stockByVariety, latestStockUpdateLog, latestBatchUpdateLog, yearBatches] = await Promise.all([
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
            // 9. All closed '백미' milling batches for variety yield calculation
            prisma.millingBatch.findMany({
                where: {
                    isClosed: true,
                    millingType: '백미',
                    date: {
                        gte: new Date(`${currentYear}-01-01`),
                        lt: new Date(`${currentYear + 1}-01-01`)
                    }
                },
                select: {
                    totalInputKg: true,
                    stocks: { select: { weightKg: true, variety: { select: { name: true, type: true } } } },
                    outputs: { select: { totalWeight: true } }
                }
            })
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

        // Process Variety & Split Yields (Uruchi / Indica)
        const varietyYieldMap = new Map<string, { in: number, out: number }>();
        let uruchiIn = 0;
        let uruchiOut = 0;
        let indicaIn = 0;
        let indicaOut = 0;

        if (yearBatches) {
            yearBatches.forEach(b => {
                const batchOut = b.outputs.reduce((s: number, o: any) => s + o.totalWeight, 0);
                const batchStockInput = b.stocks.reduce((s: number, st: any) => s + st.weightKg, 0);
                if (batchStockInput === 0) return;

                b.stocks.forEach((st: any) => {
                    const vName = st.variety.name;
                    const vType = st.variety.type;

                    // Exclude glutinous rice (찰벼) from yield statistics
                    if (vType === 'GLUTINOUS') return;

                    const ratio = st.weightKg / batchStockInput;
                    const proratedOut = batchOut * ratio;
                    const proratedIn = b.totalInputKg * ratio;

                    const curr = varietyYieldMap.get(vName) || { in: 0, out: 0 };
                    curr.in += proratedIn;
                    curr.out += proratedOut;
                    varietyYieldMap.set(vName, curr);

                    // Separate global white rice yields
                    if (vType === 'URUCHI') {
                        uruchiIn += proratedIn;
                        uruchiOut += proratedOut;
                    } else if (vType === 'INDICA') {
                        indicaIn += proratedIn;
                        indicaOut += proratedOut;
                    }
                });
            });
        }

        const uruchiYield = uruchiIn > 0 ? (uruchiOut / uruchiIn) * 100 : 0;
        const indicaYield = indicaIn > 0 ? (indicaOut / indicaIn) * 100 : 0;

        // Convert to sorted array
        const processedStockByVariety = Array.from(varietyMap.entries())
            .map(([variety, data]) => {
                const yieldInfo = varietyYieldMap.get(variety);
                const yieldRate = yieldInfo && yieldInfo.in > 0 ? (yieldInfo.out / yieldInfo.in) * 100 : 0;

                return {
                    variety,
                    currentWeight: data.current,
                    totalWeight: data.total,
                    yieldRate
                };
            })
            .sort((a, b) => b.totalWeight - a.totalWeight);

        // Overall metrics
        const totalOutput = totalOutputWeight._sum?.totalWeight || 0;
        const totalStockWeight = processedStockByVariety.reduce((sum, item) => sum + item.totalWeight, 0);
        const availableStockWeight = totalAvailableStock._sum?.weightKg || 0;
        const consumedStockWeight = totalStockWeight - availableStockWeight;
        const millingProgressRate = totalStockWeight > 0 ? (consumedStockWeight / totalStockWeight) * 100 : 0;

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
                uruchiYield,
                indicaYield,
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
