'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'
import { getProductCode, generateLotNo } from '@/lib/lot-generation'

// Updated to match new schema relations
export type MillingBatchFormData = {
    id?: number
    date: Date
    remarks?: string
    millingType: string
    totalInputKg: number
    selectedStockIds: number[]
}

export type MillingOutputInput = {
    packageType: string
    weightPerUnit: number
    count: number
    totalWeight: number
}





export async function startMillingBatch(data: MillingBatchFormData) {
    try {
        const result = await prisma.$transaction(async (tx) => {
            // 0. Update Mode Check
            if (data.id) {
                // --- UPDATE Logic ---
                const batch = await tx.millingBatch.findUnique({
                    where: { id: data.id },
                    include: { stocks: true }
                })
                if (!batch) throw new Error('Batch not found')
                if (batch.isClosed) throw new Error('Batch is closed')

                // Update Batch Metadata
                await tx.millingBatch.update({
                    where: { id: data.id },
                    data: {
                        date: data.date,
                        remarks: data.remarks?.trim(),
                        millingType: data.millingType,
                        totalInputKg: data.totalInputKg // Updated Input Weight
                    }
                })

                // Stocks Handling
                const currentStockIds = batch.stocks.map(s => s.id)
                const newStockIds = data.selectedStockIds

                // 1. Removed Stocks -> Set to AVAILABLE
                const removedIds = currentStockIds.filter(id => !newStockIds.includes(id))
                if (removedIds.length > 0) {
                    await tx.stock.updateMany({
                        where: { id: { in: removedIds } },
                        data: { status: 'AVAILABLE', batchId: null }
                    })
                }

                // 2. New Stocks -> Check Availability & Set to CONSUMED
                const addedIds = newStockIds.filter(id => !currentStockIds.includes(id))
                if (addedIds.length > 0) {
                    const newStocks = await tx.stock.findMany({ where: { id: { in: addedIds } } })
                    const unavailable = newStocks.find(s => s.status !== 'AVAILABLE')
                    if (unavailable) throw new Error(`Stock ${unavailable.bagNo} is not available`)

                    await tx.stock.updateMany({
                        where: { id: { in: addedIds } },
                        data: { status: 'CONSUMED', batchId: data.id }
                    })
                }

                // 3. Ensure kept stocks are linked (redundant but safe) needed? 
                // Existing links persist. We just updated status of broken ones.

                // Refetch updated batch
                return await tx.millingBatch.findUnique({ where: { id: data.id } })
            } else {
                // --- CREATE Logic (Original) ---
                // 1. Validate stocks
                const stocks = await tx.stock.findMany({
                    where: { id: { in: data.selectedStockIds } },
                    include: { batch: true }
                })

                if (stocks.length !== data.selectedStockIds.length) {
                    throw new Error('Some stocks not found')
                }

                const alreadyUsed = stocks.find(s => s.status !== 'AVAILABLE')
                if (alreadyUsed) {
                    throw new Error(`Stock ${alreadyUsed.bagNo} is already processed`)
                }

                // Update user input total weight
                const actualTotalInputKg = data.totalInputKg;

                // 2. Create Batch
                const newBatch = await tx.millingBatch.create({
                    data: {
                        date: data.date,
                        remarks: data.remarks?.trim(),
                        millingType: data.millingType,
                        totalInputKg: actualTotalInputKg,
                        // Link stocks
                        stocks: {
                            connect: data.selectedStockIds.map(id => ({ id }))
                        }
                    }
                })

                // 3. Update Stocks status
                await tx.stock.updateMany({
                    where: { id: { in: data.selectedStockIds } },
                    data: {
                        status: 'CONSUMED',
                        batchId: newBatch.id
                    }
                })

                return newBatch
            }
        })

        revalidatePath('/milling')
        revalidatePath('/stocks')
        return { success: true, data: result }
    } catch (error) {
        console.error('Failed to start/update milling batch:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Failed to process batch' }
    }
}

export type GetMillingLogsParams = {
    keyword?: string
    startDate?: Date
    endDate?: Date
    status?: string // 'active' | 'completed'
    variety?: string // variety name search
    millingType?: string
    yieldRate?: string
}

export async function getMillingLogs(params?: GetMillingLogsParams) {
    try {
        const where: any = {}

        if (params?.startDate && params?.endDate) {
            where.date = {
                gte: params.startDate,
                lte: params.endDate
            }
        }

        // Status filter
        if (params?.status) {
            if (params.status === 'active') {
                where.isClosed = false
            } else if (params.status === 'completed') {
                where.isClosed = true
            }
        }

        // Milling Type filter
        if (params?.millingType) {
            where.millingType = params.millingType
        }

        const andConditions: any[] = []

        // Variety filter (check stocks)
        if (params?.variety) {
            andConditions.push({
                stocks: {
                    some: {
                        variety: {
                            name: { contains: params.variety }
                        }
                    }
                }
            })
        }

        // Keyword filter
        if (params?.keyword) {
            // remarks OR stock.variety.name OR stock.farmer.name
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
                        variety: true, // Need variety name
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

        return { success: true, data: logs }
    } catch (error) {
        console.error('Failed to get milling logs:', error)
        return { success: false, error: 'Failed to get milling logs' }
    }
}

// Helper: Remove stock from batch
export async function removeStockFromMilling(batchId: number, stockId: number) {
    try {
        const result = await prisma.$transaction(async (tx) => {
            const batch = await tx.millingBatch.findUnique({ where: { id: batchId }, include: { stocks: true } });
            if (!batch) throw new Error('Batch not found');
            if (batch.isClosed) throw new Error('Batch is closed');

            // Set stock back to AVAILABLE and unlink
            await tx.stock.update({
                where: { id: stockId },
                data: {
                    status: 'AVAILABLE',
                    batchId: null
                }
            });
            return { success: true };
        });
        revalidatePath('/milling')
        return result;
    } catch (error) {
        console.error('Failed to remove stock:', error);
        return { success: false, error: 'Failed to remove stock' };
    }
}

export async function addPackagingLog(batchId: number, data: MillingOutputInput) {
    try {
        // Fetch Batch and related Stock info for LOT NUMBER GENERATION
        const batch = await prisma.millingBatch.findUnique({
            where: { id: batchId },
            include: {
                stocks: {
                    include: {
                        variety: true,
                        farmer: {
                            include: { group: true }
                        }
                    }
                }
            }
        });

        if (!batch) throw new Error('Batch not found')

        // --- LOT NUMBER GENERATION LOGIC ---
        // 1. Date: Stock incoming date.
        const primaryStock = batch.stocks[0];
        if (!primaryStock) throw new Error('No stock linked to this batch');

        const productCode = getProductCode(primaryStock.variety.type, primaryStock.variety.name, batch.millingType);

        // Use helper to generate Lot No consistent with Stock logic
        const lotNo = generateLotNo({
            incomingDate: primaryStock.incomingDate,
            varietyType: primaryStock.variety.type,
            varietyName: primaryStock.variety.name,
            millingType: batch.millingType, // Use ACTUAL milling type
            certNo: primaryStock.farmer.group?.certNo || '00',
            farmerGroupCode: primaryStock.farmer.group?.code || '00',
            farmerNo: primaryStock.farmer.farmerNo || '00'
        });
        // -----------------------------------

        const output = await prisma.millingOutputPackage.create({
            data: {
                batchId,
                packageType: data.packageType,
                weightPerUnit: data.weightPerUnit,
                count: data.count,
                totalWeight: data.totalWeight,
                productCode, // Save derived code
                lotNo,       // Save generated LOT
            }
        })

        revalidatePath('/milling')
        return { success: true, data: output }
    } catch (error) {
        console.error('Failed to add packaging log:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Failed to add packaging log' }
    }
}

// Update multiple packaging logs (Replace all for batch)
export async function updatePackagingLogs(batchId: number, outputs: MillingOutputInput[]) {
    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Fetch Batch and Stock info for LOT generation
            const batch = await tx.millingBatch.findUnique({
                where: { id: batchId },
                include: {
                    stocks: {
                        include: { variety: true, farmer: { include: { group: true } } }
                    }
                }
            });
            if (!batch || !batch.stocks.length) throw new Error('Batch or stocks not found');
            const primaryStock = batch.stocks[0];

            // 2. Delete existing outputs
            await tx.millingOutputPackage.deleteMany({
                where: { batchId }
            });

            // 3. Create new outputs
            for (const output of outputs) {
                const productCode = getProductCode(primaryStock.variety.type, primaryStock.variety.name, batch.millingType);

                // Generate Lot No
                const lotNo = generateLotNo({
                    incomingDate: primaryStock.incomingDate,
                    varietyType: primaryStock.variety.type,
                    varietyName: primaryStock.variety.name,
                    millingType: batch.millingType, // Use ACTUAL milling type
                    certNo: primaryStock.farmer.group?.certNo || '00',
                    farmerGroupCode: primaryStock.farmer.group?.code || '00',
                    farmerNo: primaryStock.farmer.farmerNo || '00'
                });

                await tx.millingOutputPackage.create({
                    data: {
                        batchId,
                        packageType: output.packageType,
                        weightPerUnit: output.weightPerUnit,
                        count: output.count,
                        totalWeight: output.totalWeight,
                        productCode,
                        lotNo
                    }
                });
            }
            return { success: true };
        }, { timeout: 30000 });

        revalidatePath('/milling')
        return result
    } catch (error) {
        console.error('Failed to update packaging logs:', error)
        const message = error instanceof Error ? error.message : 'Failed to update logs'
        return { success: false, error: message }
    }
}

export async function deletePackagingLog(outputId: number) {
    try {
        await prisma.millingOutputPackage.delete({
            where: { id: outputId }
        })
        revalidatePath('/milling')
        return { success: true }
    } catch (error) {
        console.error('Failed to delete packaging log:', error)
        return { success: false, error: 'Failed to delete packaging log' }
    }
}

export async function closeMillingBatch(batchId: number) {
    return updateMillingBatchStatus(batchId, true);
}

export async function reopenMillingBatch(batchId: number) {
    return updateMillingBatchStatus(batchId, false);
}

export async function updateMillingBatchStatus(batchId: number, isClosed: boolean) {
    try {
        await prisma.millingBatch.update({
            where: { id: batchId },
            data: { isClosed }
        })
        revalidatePath('/milling')
        revalidatePath('/stocks')
        return { success: true }
    } catch (error) {
        console.error('Failed to update status:', error)
        return { success: false, error: 'Failed to update status' }
    }
}

export async function deleteMillingBatch(batchId: number) {
    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Check if safe to delete
            const batch = await tx.millingBatch.findUnique({
                where: { id: batchId },
                include: { stocks: true }
            })
            if (!batch) throw new Error('Batch not found');

            // 2. Revert Stock status to AVAILABLE
            await tx.stock.updateMany({
                where: { batchId },
                data: {
                    status: 'AVAILABLE',
                    batchId: null
                }
            });

            // 3. Delete outputs first (cascade might handle, but explicit is safer)
            await tx.millingOutputPackage.deleteMany({
                where: { batchId }
            });

            // 4. Delete batch
            await tx.millingBatch.delete({
                where: { id: batchId }
            });

            return { success: true };
        });

        revalidatePath('/milling')
        revalidatePath('/stocks')
        return result
    } catch (error) {
        console.error('Failed to delete batch:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Failed to delete batch' }
    }
}

export async function deleteMillingBatches(ids: number[]) {
    try {
        const results = {
            success: [] as number[],
            failed: [] as { id: number; reason: string }[]
        }

        for (const id of ids) {
            const batch = await prisma.millingBatch.findUnique({
                where: { id },
                select: {
                    id: true,
                    date: true,
                    _count: {
                        select: { outputs: true }
                    }
                }
            })

            if (!batch) {
                results.failed.push({
                    id,
                    reason: `작업 ${id}: 찾을 수 없음`
                })
                continue
            }

            // Check if any packaging has been done
            if (batch._count.outputs > 0) {
                const dateStr = new Date(batch.date).toLocaleDateString('ko-KR')
                results.failed.push({
                    id,
                    reason: `${dateStr} 작업: 포장 진행되어 삭제 불가`
                })
                continue
            }

            try {
                await prisma.$transaction(async (tx) => {
                    // Revert stock status
                    await tx.stock.updateMany({
                        where: { batchId: id },
                        data: {
                            status: 'AVAILABLE',
                            batchId: null
                        }
                    })

                    // Delete outputs
                    await tx.millingOutputPackage.deleteMany({
                        where: { batchId: id }
                    })

                    // Delete batch
                    await tx.millingBatch.delete({
                        where: { id }
                    })
                })
                results.success.push(id)
            } catch (error) {
                const dateStr = new Date(batch.date).toLocaleDateString('ko-KR')
                results.failed.push({
                    id,
                    reason: `${dateStr} 작업: 삭제 실패`
                })
            }
        }

        revalidatePath('/milling')
        revalidatePath('/stocks')

        return {
            success: true,
            data: results
        }
    } catch (error) {
        console.error('Failed to delete milling batches:', error)
        return { success: false, error: 'Failed to delete milling batches' }
    }
}


export async function updateMillingBatchStocks(batchId: number, stockIds: number[]) {
    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Validate Batch
            const batch = await tx.millingBatch.findUnique({
                where: { id: batchId },
                include: { stocks: true }
            })
            if (!batch) throw new Error('Batch not found')
            if (batch.isClosed) throw new Error('Batch is closed')

            // 2. Determine Removed Stocks -> Set to AVAILABLE
            const currentStockIds = batch.stocks.map(s => s.id)
            const remainingStockIds = currentStockIds.filter(id => stockIds.includes(id))
            const removedStockIds = currentStockIds.filter(id => !stockIds.includes(id))

            if (removedStockIds.length > 0) {
                await tx.stock.updateMany({
                    where: { id: { in: removedStockIds } },
                    data: {
                        status: 'AVAILABLE',
                        batchId: null
                    }
                })
            }

            // 3. Determine New Stocks -> Set to CONSUMED & Link
            // Note: existing stocks that are kept don't need update, but safe to re-link or just ensure they are fine.
            // But we need to update status of NEW stocks.
            const newStockIds = stockIds.filter(id => !currentStockIds.includes(id))

            if (newStockIds.length > 0) {
                // Verify new stocks are available
                const newStocks = await tx.stock.findMany({
                    where: { id: { in: newStockIds } }
                })
                const unavailable = newStocks.find(s => s.status !== 'AVAILABLE')
                if (unavailable) {
                    throw new Error(`Stock ${unavailable.bagNo} is not available`)
                }

                await tx.stock.updateMany({
                    where: { id: { in: newStockIds } },
                    data: {
                        status: 'CONSUMED',
                        batchId: batchId
                    }
                })
            }

            // 4. Recalculate Total Input Weight
            // We need weights of ALL final stocks.
            const allFinalStocks = await tx.stock.findMany({
                where: { id: { in: stockIds } }
            })
            const newTotalInputKg = allFinalStocks.reduce((sum, s) => sum + s.weightKg, 0)

            // 5. Update Batch
            const updatedBatch = await tx.millingBatch.update({
                where: { id: batchId },
                data: {
                    totalInputKg: newTotalInputKg
                }
            })

            return updatedBatch
        })

        revalidatePath('/milling')
        revalidatePath('/stocks')
        return { success: true, data: result }
    } catch (error) {
        console.error('Failed to update milling batch stocks:', error)
        return { success: false, error: 'Failed to update batch stocks' }
    }
}

export async function updateMillingBatchMetadata(batchId: number, data: { date: Date, remarks: string }) {
    try {
        await prisma.millingBatch.update({
            where: { id: batchId },
            data: {
                date: data.date,
                remarks: data.remarks.trim() || null,
            }
        })
        revalidatePath('/milling')
        return { success: true }
    } catch (error) {
        console.error('Failed to update milling batch metadata:', error)
        return { success: false, error: 'Failed to update' }
    }
}
