'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { recordAuditLog } from '@/lib/audit'
import { requireSession } from '@/lib/auth-guard'
import { sanitizeErrorMessage } from '@/lib/error-sanitize'

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
    await requireSession()
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

        await recordAuditLog({
            action: 'CREATE',
            entity: 'Stock',
            entityId: stock.id,
            details: data,
            description: `원곡 입고: ${farmer.name} - ${variety.name} (${data.weightKg}kg)`
        })

        revalidatePath('/stocks')
        return { success: true, data: stock }
    } catch (error) {
        console.error('Failed to create stock:', error)
        return { success: false, error: 'Failed to create stock' }
    }
}

export async function updateStock(id: number, data: StockFormData) {
    await requireSession()
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

            await recordAuditLog({
                action: 'UPDATE',
                entity: 'Stock',
                entityId: id,
                details: { prev: currentStock, new: updatedStock },
                description: `재고 정보 수정: ${id}번 데이터`
            })

            return updatedStock;
        });

        revalidatePath('/stocks')
        revalidatePath('/milling')
        return { success: true, data: result }
    } catch (error) {
        console.error('Failed to update stock:', error)
        return { success: false, error: sanitizeErrorMessage(error, '재고 수정에 실패했습니다.') }
    }
}

export async function deleteStock(id: number) {
    await requireSession()
    try {
        const stock = await prisma.stock.findUnique({
            where: { id },
            select: { status: true }
        });

        if (stock?.status === 'CONSUMED') {
            return { success: false, error: '도정 완료된 데이터는 삭제할 수 없습니다.' }
        }

        const deleted = await prisma.stock.delete({
            where: { id },
            include: { farmer: true, variety: true }
        })

        await recordAuditLog({
            action: 'DELETE',
            entity: 'Stock',
            entityId: id,
            description: `재고 삭제: ${deleted.farmer.name} - ${deleted.variety.name} (${deleted.weightKg}kg)`
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
    await requireSession()
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
                const deletedStock = await prisma.stock.delete({ 
                    where: { id },
                    include: { farmer: true, variety: true }
                })
                await recordAuditLog({
                    action: 'DELETE',
                    entity: 'Stock',
                    entityId: id,
                    description: `재고 다중 삭제: ${deletedStock.farmer.name} - ${deletedStock.variety.name} (${deletedStock.weightKg}kg)`
                })
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
    await requireSession()
    try {
        const where: any = {}
        const andConditions: any[] = []

        // 1. Filter Construction

        // productionYear: 콤마 구분 멀티값 지원
        if (params?.productionYear) {
            const years = params.productionYear.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
            if (years.length === 1) {
                where.productionYear = years[0]
            } else if (years.length > 1) {
                where.productionYear = { in: years }
            }
        }

        // varietyId: 콤마 구분 멀티값 지원
        if (params?.varietyId) {
            const ids = params.varietyId.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
            if (ids.length === 1) {
                where.varietyId = ids[0]
            } else if (ids.length > 1) {
                where.varietyId = { in: ids }
            }
        }

        if (params?.status && params.status !== 'ALL') {
            where.status = params.status
        }

        // farmerId: 단일 ID 필터 (UI에서 사용 시)
        if (params?.farmerId && params.farmerId !== 'ALL') {
            where.farmerId = parseInt(params.farmerId)
        }

        // farmerName: 콤마 구분 다중 생산자 검색 (OR 조건)
        if (params?.farmerName) {
            const names = params.farmerName.split(',').map(s => s.trim()).filter(Boolean)
            if (names.length === 1) {
                andConditions.push({ farmer: { name: { contains: names[0] } } })
            } else if (names.length > 1) {
                andConditions.push({ OR: names.map(n => ({ farmer: { name: { contains: n } } })) })
            }
        }

        // certType: 콤마 구분 멀티값 지원 (OR 조건)
        if (params?.certType) {
            const certList = params.certType.split(',').map(s => s.trim()).filter(Boolean)
            if (certList.length === 1) {
                andConditions.push({ farmer: { group: { certType: certList[0] } } })
            } else if (certList.length > 1) {
                andConditions.push({ OR: certList.map(c => ({ farmer: { group: { certType: c } } })) })
            }
        }

        if (andConditions.length > 0) {
            where.AND = andConditions
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
    await requireSession()
    try {
        const where: any = {}
        const andConditions: any[] = []

        // 1. Filter Construction (멀티값 지원)
        if (params?.productionYear) {
            const years = params.productionYear.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
            if (years.length === 1) {
                where.productionYear = years[0]
            } else if (years.length > 1) {
                where.productionYear = { in: years }
            }
        }
        if (params?.varietyId) {
            const ids = params.varietyId.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
            if (ids.length === 1) {
                where.varietyId = ids[0]
            } else if (ids.length > 1) {
                where.varietyId = { in: ids }
            }
        }
        if (params?.status && params.status !== 'ALL') where.status = params.status
        if (params?.farmerId && params.farmerId !== 'ALL') {
            where.farmerId = parseInt(params.farmerId)
        }
        if (params?.farmerName) {
            const names = params.farmerName.split(',').map(s => s.trim()).filter(Boolean)
            if (names.length === 1) {
                andConditions.push({ farmer: { name: { contains: names[0] } } })
            } else if (names.length > 1) {
                andConditions.push({ OR: names.map(n => ({ farmer: { name: { contains: n } } })) })
            }
        }
        if (params?.certType) {
            const certList = params.certType.split(',').map(s => s.trim()).filter(Boolean)
            if (certList.length === 1) {
                andConditions.push({ farmer: { group: { certType: certList[0] } } })
            } else if (certList.length > 1) {
                andConditions.push({ OR: certList.map(c => ({ farmer: { group: { certType: c } } })) })
            }
        }
        if (andConditions.length > 0) {
            where.AND = andConditions
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
    await requireSession()
    try {
        const andConditions: any[] = []

        // 그룹 키 기반 고정 필터 (년도, 품종, 인증)
        andConditions.push({ productionYear: groupKey.year })
        andConditions.push({ variety: { name: groupKey.variety } })

        if (groupKey.certType === '일반') {
            // '일반' = 그룹 없거나(groupId null) certType이 '일반'인 경우
            andConditions.push({
                OR: [
                    { farmer: { groupId: null } },
                    { farmer: { group: { certType: '일반' } } }
                ]
            })
        } else {
            andConditions.push({ farmer: { group: { certType: groupKey.certType } } })
        }

        // 전역 필터: 상태
        if (params?.status && params.status !== 'ALL') {
            andConditions.push({ status: params.status })
        }

        // 전역 필터: 생산자명 콤마 검색
        if (params?.farmerName) {
            const names = params.farmerName.split(',').map(s => s.trim()).filter(Boolean)
            if (names.length === 1) {
                andConditions.push({ farmer: { name: { contains: names[0] } } })
            } else if (names.length > 1) {
                andConditions.push({ OR: names.map(n => ({ farmer: { name: { contains: n } } })) })
            }
        }

        const stocks = await prisma.stock.findMany({
            where: { AND: andConditions },
            orderBy: [{ farmer: { name: 'asc' } }, { bagNo: 'asc' }],
            include: {
                variety: true,
                farmer: { include: { group: true } }
            }
        })

        return { success: true, data: stocks }

    } catch (error) {
        console.error('Failed to get stocks by group:', error)
        return { success: false, error: 'Failed to get stocks by group' }
    }
}
