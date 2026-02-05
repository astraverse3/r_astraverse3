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


export type GetStocksParams = {
    productionYear?: string
    varietyId?: string
    farmerId?: string
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

        // Filter by Farmer directly
        if (params?.farmerId && params.farmerId !== 'ALL') {
            where.farmerId = parseInt(params.farmerId)
        }

        if (params?.status && params.status !== 'ALL') {
            where.status = params.status
        }

        // Filter by CertType via Farmer -> Group match
        if (params?.certType && params.certType !== 'ALL') {
            where.farmer = {
                group: {
                    certType: params.certType
                }
            }
            // Preserve farmerId filter if exists
            if (params?.farmerId && params.farmerId !== 'ALL') {
                where.farmer.id = parseInt(params.farmerId)
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
