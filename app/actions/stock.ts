'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// Updated definition to match new schema relations
import { generateLotNo } from '@/lib/lot-generation'
export type StockFormData = {
    productionYear: number
    bagNo: number
    farmerId: number     // ID of the Farmer (which links to Group for cert)
    varietyId: number  // ID of the Variety
    weightKg: number
    incomingDate: Date
}

export async function createStock(data: StockFormData) {
    try {
        // 1. Fetch related info for Lot Generation
        const farmer = await prisma.farmer.findUnique({
            where: { id: data.farmerId },
            include: { group: true }
        });
        const variety = await prisma.variety.findUnique({
            where: { id: data.varietyId }
        });

        if (!farmer || !variety) throw new Error('Invalid Farmer or Variety');

        // 2. Generate Pre-assigned Lot No (Default: White Rice)
        let lotNo: string | null = null;
        // Only generate Lot No if Group exists AND Cert is NOT '일반'
        if (farmer.group && farmer.group.certType !== '일반') {
            lotNo = generateLotNo({
                incomingDate: data.incomingDate,
                varietyType: variety.type,
                varietyName: variety.name,
                millingType: '백미', // Default assumption
                certNo: farmer.group.certNo,
                farmerGroupCode: farmer.group.code,
                farmerNo: farmer.farmerNo || ''
            });
        }

        // 3. Duplicate Check: (Year + Farmer + Variety + BagNo) must be unique
        const existingStock = await prisma.stock.findFirst({
            where: {
                productionYear: data.productionYear,
                farmerId: data.farmerId,
                varietyId: data.varietyId,
                bagNo: data.bagNo
            }
        });

        if (existingStock) {
            throw new Error(`이미 등록된 톤백번호입니다. (생산자: ${farmer.name}, 품종: ${variety.name}, 번호: ${data.bagNo})`);
        }


        const stock = await prisma.stock.create({
            data: {
                productionYear: data.productionYear,
                bagNo: data.bagNo,
                weightKg: data.weightKg,
                incomingDate: data.incomingDate,
                farmerId: data.farmerId,
                varietyId: data.varietyId,
                status: 'AVAILABLE',
                lotNo // Save generated Lot No (or null)
            },
        })
        revalidatePath('/stocks')
        return { success: true, data: stock }
    } catch (error) {
        console.error('Failed to create stock:', error)
        return { success: false, error: 'Failed to create stock' }
    }
}

export async function updateStock(id: number, data: StockFormData) {
    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Get current stock info
            const currentStock = await tx.stock.findUnique({
                where: { id },
                include: { batch: { select: { isClosed: true } } }
            });

            if (!currentStock) throw new Error('Stock not found');

            // SAFETY CHECK
            if (currentStock.batch?.isClosed) {
                throw new Error('마감된 도정 작업에 포함된 재고는 수정할 수 없습니다.');
            }

            // 2. Calculate weight difference
            const weightDiff = data.weightKg - currentStock.weightKg;

            // 3. Prepare Update Data
            // If critical fields changed, regenerate Lot No
            let newLotNo = undefined;
            if (
                data.incomingDate.getTime() !== currentStock.incomingDate.getTime() ||
                data.farmerId !== currentStock.farmerId ||
                data.varietyId !== currentStock.varietyId
            ) {
                const farmer = await tx.farmer.findUnique({ where: { id: data.farmerId }, include: { group: true } });
                const variety = await tx.variety.findUnique({ where: { id: data.varietyId } });

                if (farmer && variety) {
                    // Only generate if Group exists AND Cert is NOT '일반'
                    if (farmer.group && farmer.group.certType !== '일반') {
                        newLotNo = generateLotNo({
                            incomingDate: data.incomingDate,
                            varietyType: variety.type,
                            varietyName: variety.name,
                            millingType: '백미', // Default assumption
                            certNo: farmer.group.certNo,
                            farmerGroupCode: farmer.group.code,
                            farmerNo: farmer.farmerNo || ''
                        });
                    } else {
                        newLotNo = null; // Explicitly set to null if no group or General
                    }
                }

            }

            // 4. Duplicate Check for Update (Exclude self)
            // Check if (Year + Farmer + Variety + BagNo) is being changed to something that conflicts
            if (
                data.productionYear !== currentStock.productionYear ||
                data.farmerId !== currentStock.farmerId ||
                data.varietyId !== currentStock.varietyId ||
                data.bagNo !== currentStock.bagNo
            ) {
                const existing = await tx.stock.findFirst({
                    where: {
                        productionYear: data.productionYear,
                        farmerId: data.farmerId,
                        varietyId: data.varietyId,
                        bagNo: data.bagNo,
                        NOT: { id: id } // Exclude self
                    },
                    include: { farmer: true, variety: true }
                });

                if (existing) {
                    throw new Error(`이미 등록된 톤백번호입니다. (생산자: ${existing.farmer.name}, 품종: ${existing.variety.name}, 번호: ${data.bagNo})`);
                }
            }

            // 4. Update stock
            const updateData: any = {
                productionYear: data.productionYear,
                bagNo: data.bagNo,
                weightKg: data.weightKg,
                incomingDate: data.incomingDate,
                farmerId: data.farmerId,
                varietyId: data.varietyId,
            }

            if (newLotNo !== undefined) {
                updateData.lotNo = newLotNo
            }

            const updatedStock = await tx.stock.update({
                where: { id },
                data: updateData
            });

            // 4. Update batch total if needed
            if (currentStock.batchId && weightDiff !== 0) {
                await tx.millingBatch.update({
                    where: { id: currentStock.batchId },
                    data: {
                        totalInputKg: { increment: weightDiff }
                    }
                });
            }

            return updatedStock;
        });

        revalidatePath('/stocks')
        revalidatePath('/milling')
        return { success: true, data: result }
    } catch (error) {
        console.error('Failed to update stock:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Failed to update stock' }
    }
}

export async function deleteStock(id: number) {
    try {
        const stock = await prisma.stock.findUnique({
            where: { id },
            select: { status: true }
        });

        if (stock?.status === 'CONSUMED') {
            return { success: false, error: '도정 완료된 데이터는 삭제할 수 없습니다.' }
        }

        await prisma.stock.delete({
            where: { id },
        })
        revalidatePath('/stocks')
        revalidatePath('/milling')
        return { success: true }
    } catch (error) {
        console.error('Failed to delete stock:', error)
        return { success: false, error: 'Failed to delete stock' }
    }
}

export async function deleteStocks(ids: number[]) {
    try {
        const results = {
            success: [] as number[],
            failed: [] as { id: number; reason: string }[]
        }

        for (const id of ids) {
            const stock = await prisma.stock.findUnique({
                where: { id },
                select: { status: true, bagNo: true }
            })

            if (!stock) {
                results.failed.push({
                    id,
                    reason: `재고 ${id}: 찾을 수 없음`
                })
                continue
            }

            if (stock.status === 'CONSUMED') {
                results.failed.push({
                    id,
                    reason: `포대 ${stock.bagNo}: 도정 완료되어 삭제 불가`
                })
                continue
            }

            try {
                await prisma.stock.delete({ where: { id } })
                results.success.push(id)
            } catch (error) {
                results.failed.push({
                    id,
                    reason: `포대 ${stock.bagNo}: 삭제 실패`
                })
            }
        }

        revalidatePath('/stocks')
        revalidatePath('/milling')

        return {
            success: true,
            data: results
        }
    } catch (error) {
        console.error('Failed to delete stocks:', error)
        return { success: false, error: 'Failed to delete stocks' }
    }
}


// ... imports

export type GetStocksParams = {
    productionYear?: string
    varietyId?: string
    farmerId?: string
    farmerName?: string // Added
    status?: string // 'ALL' | 'AVAILABLE' | 'CONSUMED'
    sort?: string // 'newest' | 'oldest' | 'weight_desc' | 'weight_asc'
    // certType filter becomes complex. Need to filter by farmer.group.certType
    certType?: string
}

export async function getStocks(params?: GetStocksParams) {
    try {
        const where: any = {}

        // 1. Filter Construction
        if (params?.productionYear) {
            where.productionYear = parseInt(params.productionYear)
        }
        if (params?.varietyId && params.varietyId !== 'ALL') {
            where.varietyId = parseInt(params.varietyId)
        }

        // Filter by Farmer Name (Text Input)
        if (params?.farmerName) {
            where.farmer = {
                name: { contains: params.farmerName } // Partial search
            }
        }

        // Keep ID filter if specifically requested (though UI will use Name)
        if (params?.farmerId && params.farmerId !== 'ALL') {
            // If name filter exists, merge or reuse. Name filter is nested in 'farmer'.
            // If we already added 'farmer' object for name search:
            if (where.farmer) {
                where.farmer.id = parseInt(params.farmerId)
            } else {
                where.farmerId = parseInt(params.farmerId)
            }
        }

        if (params?.status && params.status !== 'ALL') {
            where.status = params.status
        }

        // Filter by CertType via Farmer -> Group match
        if (params?.certType && params.certType !== 'ALL') {
            // Ensure where.farmer exists
            if (!where.farmer) where.farmer = {}

            // Nested filtering: farmer -> group -> certType
            where.farmer.group = {
                certType: params.certType
            }
        }

        // 2. Sort Construction
        let orderBy: any = { createdAt: 'desc' } // Default
        if (params?.sort === 'oldest') {
            orderBy = { createdAt: 'asc' }
        } else if (params?.sort === 'weight_desc') {
            orderBy = { weightKg: 'desc' }
        } else if (params?.sort === 'weight_asc') {
            orderBy = { weightKg: 'asc' }
        }

        const stocks = await prisma.stock.findMany({
            where,
            orderBy,
            include: {
                variety: true,
                farmer: {
                    include: {
                        group: true // Include group for Cert No
                    }
                }
            }
        })
        return { success: true, data: stocks }
    } catch (error) {
        console.error('Failed to get stocks:', error)
        return { success: false, error: 'Failed to get stocks' }
    }
}

export type StockGroup = {
    key: string
    year: number
    variety: string
    certType: string
    totalWeight: number
    count: number
    farmerSetSize: number
    items: any[] // Initially empty
}

export async function getStockGroups(params?: GetStocksParams) {
    try {
        const where: any = {}

        // 1. Filter Construction (Reuse logic)
        if (params?.productionYear) where.productionYear = parseInt(params.productionYear)
        if (params?.varietyId && params.varietyId !== 'ALL') where.varietyId = parseInt(params.varietyId)
        if (params?.farmerName) where.farmer = { name: { contains: params.farmerName } }
        if (params?.farmerId && params.farmerId !== 'ALL') {
            if (where.farmer) where.farmer.id = parseInt(params.farmerId)
            else where.farmerId = parseInt(params.farmerId)
        }
        if (params?.status && params.status !== 'ALL') where.status = params.status
        if (params?.certType && params.certType !== 'ALL') {
            if (!where.farmer) where.farmer = {}
            where.farmer.group = { certType: params.certType }
        }

        // Fetch all matching stocks (Lightweight select for grouping)
        const stocks = await prisma.stock.findMany({
            where,
            select: {
                id: true,
                productionYear: true,
                weightKg: true,
                variety: { select: { name: true } },
                farmer: {
                    select: {
                        id: true,
                        group: { select: { certType: true } }
                    }
                }
            }
        })

        // Grouping Logic (Server-Side)
        const grouped: Record<string, StockGroup> = {}

        stocks.forEach((stock: any) => {
            const certType = stock.farmer?.group?.certType || '일반'
            const key = `${stock.productionYear}-${stock.variety?.name}-${certType}`

            if (!grouped[key]) {
                grouped[key] = {
                    key,
                    year: stock.productionYear,
                    variety: stock.variety?.name || 'Unknown',
                    certType,
                    totalWeight: 0,
                    count: 0,
                    farmerSetSize: 0, // Calculated later
                    items: [] // Empty
                }
                    // Temp storage for farmer IDs to count unique
                    ; (grouped[key] as any)._farmerIds = new Set()
            }

            grouped[key].totalWeight += stock.weightKg
            grouped[key].count += 1
            if (stock.farmer?.id) {
                (grouped[key] as any)._farmerIds.add(stock.farmer.id)
            }
        })

        // Finalize Groups
        const result = Object.values(grouped).map((g: any) => {
            g.farmerSetSize = g._farmerIds.size
            delete g._farmerIds
            return g as StockGroup
        })

        // Sort Groups (Same logic as client)
        result.sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year // Year Desc

            const aIsGeneral = a.certType === '일반'
            const bIsGeneral = b.certType === '일반'
            if (aIsGeneral && !bIsGeneral) return 1
            if (!aIsGeneral && bIsGeneral) return -1

            if (a.variety !== b.variety) return a.variety.localeCompare(b.variety, 'ko') // Variety Asc
            return a.certType.localeCompare(b.certType, 'ko') // Cert Asc
        })

        return { success: true, data: result }
    } catch (error) {
        console.error('Failed to get stock groups:', error)
        return { success: false, error: 'Failed to get stock groups' }
    }
}

export async function getStocksByGroup(
    groupKey: { year: number, variety: string, certType: string },
    params?: GetStocksParams
) {
    try {
        const where: any = {}

        // 1. Base Filters (Must match getStockGroups to ensure consistency)
        if (params?.productionYear) where.productionYear = parseInt(params.productionYear)
        // Group specific overrides
        where.productionYear = groupKey.year

        if (params?.varietyId && params.varietyId !== 'ALL') where.varietyId = parseInt(params.varietyId)
        // Group specific overrides (Find variety by name is tricky if names aren't unique, but assuming they are for display)
        where.variety = { name: groupKey.variety }

        if (params?.farmerName) {
            // If variety filter was used, we need to merge
            where.farmer = { name: { contains: params.farmerName } }
        }

        // Group specific overrides for CertType
        if (!where.farmer) where.farmer = {}
        if (groupKey.certType === '일반') {
            // Handle '일반' logic: Either no group or group.certType == '일반'
            // This is tricky in Prisma "OR" with relations. 
            // Ideally we find farmers who match this cert type.
            // Simpler: Just filter by the params logic + checking the resulting rows? 
            // No, must filter in DB.
            // If '일반', it means (farmer.group IS MORE OR farmer.group.certType == '일반')
            // Let's use the explicit filter if possible.
            // Actually, the previous grouping logic treated `stock.farmer?.group?.certType || '일반'`.
            // So if group is null -> '일반'. If group.certType is '일반' -> '일반'.
            where.OR = [
                { farmer: { group: null } },
                { farmer: { group: { certType: '일반' } } }
            ]
            // IMPORTANT: merge with existing farmer name filter if present
            if (params?.farmerName) {
                // complex OR with AND... 
                // Let's rely on the fact that the group Key is derived.
                // Ideally we just pass the exact filters that generated the group.
            }
        } else {
            where.farmer = {
                ...where.farmer, // keep name filter
                group: { certType: groupKey.certType }
            }
        }

        // What if we just Re-Use getStocks but append the Group constraints?
        // It's cleaner.

        const baseWhere: any = {}
        // Copy-paste filter logic from getStocks is risky. 
        // Let's refine the Group Specific Where.

        // RE-IMPLEMENTING JUST THE GROUP FILTERS + Global Status Filter
        // We DO NOT filter by BagNo or Weight here, just the Grouping Keys and Global Filters.

        // productionYear
        baseWhere.productionYear = groupKey.year

        // variety
        baseWhere.variety = { name: groupKey.variety }

        // certType
        if (groupKey.certType === '일반') {
            baseWhere.OR = [
                { farmer: { group: isNaN } }, // Prisma doesn't support IS NULL like this exactly for relations sometimes?
                // Actually:
                { farmer: { groupId: null } },
                { farmer: { group: { certType: '일반' } } }
            ]
        } else {
            baseWhere.farmer = { group: { certType: groupKey.certType } }
        }

        // Merge Global Filters (Status, Farmer Name search)
        if (params?.status && params.status !== 'ALL') {
            baseWhere.status = params.status
        }
        if (params?.farmerName) {
            // Merge into farmer filter
            if (baseWhere.farmer) {
                baseWhere.farmer.name = { contains: params.farmerName }
            } else {
                // If we have OR logic for Cert, we can't easily add AND farmer.name.
                // Prisma requires AND: [ { OR: ... }, { farmer: { name: ... } } ]
                // It's getting complex. 

                // ALTERNATIVE STRATEGY:
                // Fetch ALL stocks for this group definition (Year, Variety, Cert), 
                // AND apply the Status filter.
                // Then filter by Farmer Name in memory if needed? No, DB is better.

                // Let's use the AND structure for safety.
                const certFilter = groupKey.certType === '일반'
                    ? { OR: [{ farmer: { groupId: null } }, { farmer: { group: { certType: '일반' } } }] }
                    : { farmer: { group: { certType: groupKey.certType } } }

                const finalWhere = {
                    AND: [
                        { productionYear: groupKey.year },
                        { variety: { name: groupKey.variety } },
                        certFilter,
                        params?.status && params.status !== 'ALL' ? { status: params.status } : {},
                        params?.farmerName ? { farmer: { name: { contains: params.farmerName } } } : {}
                    ]
                }

                // 2. Sort Construction (Copy from getStocks)
                let orderBy: any = { createdAt: 'desc' }
                if (params?.sort === 'oldest') orderBy = { createdAt: 'asc' }
                else if (params?.sort === 'weight_desc') orderBy = { weightKg: 'desc' }
                else if (params?.sort === 'weight_asc') orderBy = { weightKg: 'asc' }

                // Same include as getStocks
                const stocks = await prisma.stock.findMany({
                    where: finalWhere,
                    orderBy,
                    include: {
                        variety: true,
                        farmer: { include: { group: true } }
                    }
                })
                return { success: true, data: stocks }
            }
        }

        // Simple case (No Farmer Name filter complication)
        // ... (Repeating validation logic inside if is messy)

        // Let's just use the AND approach always.
        const certFilter = groupKey.certType === '일반'
            ? { OR: [{ farmer: { groupId: null } }, { farmer: { group: { certType: '일반' } } }] }
            : { farmer: { group: { certType: groupKey.certType } } }

        const finalWhere = {
            AND: [
                { productionYear: groupKey.year },
                { variety: { name: groupKey.variety } },
                certFilter,
                params?.status && params.status !== 'ALL' ? { status: params.status } : {},
                params?.farmerName ? { farmer: { name: { contains: params.farmerName } } } : {}
            ]
        }

        let orderBy: any = { createdAt: 'desc' }
        if (params?.sort === 'oldest') orderBy = { createdAt: 'asc' }
        else if (params?.sort === 'weight_desc') orderBy = { weightKg: 'desc' }
        else if (params?.sort === 'weight_asc') orderBy = { weightKg: 'asc' }

        const stocks = await prisma.stock.findMany({
            where: finalWhere,
            orderBy,
            include: {
                variety: true,
                farmer: { include: { group: true } }
            }
        })

        // Fallback Client-side sort for 'Farmer Name' & 'Bag No' 
        // (Since we can't easily orderBy related field + local field in one prisma call consistently? 
        // Actually we can: orderBy: [{ farmer: { name: 'asc' } }, { bagNo: 'asc' }]
        // But the current implementation does it in JS. Let's replicate or improve.
        // Current JS: Farmer Name (Asc) -> Bag No (Asc)
        // Let's do it in JS to match client exact behavior, or Prisma? 
        // Prisma is better.
        // But `orderBy` variable above overrides it.
        // The `orderBy` above is for the *Global Sort* dropdown (Newest, Weight, etc).
        // The Group Inner Sort (Farmer Name -> Bag No) is FIXED in the UI currently regardless of Global Sort?
        // Checking existing code: `group.items.sort(...)` lines 164-169.
        // Yes, the UI enforces Farmer -> BagNo sort WITHIN the group, ignoring the Global Sort?
        // WAIT. `getStocks` handles Global Sort. `GroupedStockRows` handles Inner Sort.
        // If Global Sort is "Newest", the API returns sorted list.
        // BUT the JS grouping logic `Object.values(grouped)` -> `items.push`.
        // THEN `group.items.sort` OVERWRITES the order!
        // So the Global Sort parameter effectively DOES NOTHING for the order of items INSIDE a group currently.
        // It presumably only affects WHICH items are fetched if there was pagination, or maybe the group order?
        // No, group order is also fixed.
        // So currently Global Sort might be broken or irrelevant in the Group View?
        // Let's preserve the existing JS sort logic: Farmer Name Asc -> Bag No Asc.

        stocks.sort((a, b) => {
            const farmerA = a.farmer?.name || ''
            const farmerB = b.farmer?.name || ''
            if (farmerA !== farmerB) return farmerA.localeCompare(farmerB, 'ko')
            return a.bagNo - b.bagNo
        })

        return { success: true, data: stocks }

    } catch (error) {
        console.error('Failed to get stocks by group:', error)
        return { success: false, error: 'Failed to get stocks by group' }
    }
}
