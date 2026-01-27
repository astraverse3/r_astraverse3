'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type MillingOutputInput = {
    packageType: string
    weightPerUnit: number
    count: number
    totalWeight: number
}

export type MillingBatchFormData = {
    date: Date
    title: string
    totalInputKg: number
    selectedStockIds: number[]
}

export async function startMillingBatch(data: MillingBatchFormData) {
    try {
        if (!data.selectedStockIds || data.selectedStockIds.length === 0) {
            return { success: false, error: 'No stocks selected' }
        }

        await prisma.$transaction(async (tx) => {
            // 1. Fetch selected stocks to verify availability and calculate total weight
            const stocks = await tx.stock.findMany({
                where: {
                    id: { in: data.selectedStockIds }
                }
            });

            if (stocks.length !== data.selectedStockIds.length) {
                throw new Error('Some stocks could not be found');
            }

            const alreadyConsumed = stocks.filter(s => s.status !== 'AVAILABLE');
            if (alreadyConsumed.length > 0) {
                throw new Error(`Stocks ${alreadyConsumed.map(s => s.farmerName).join(', ')} are already consumed`);
            }

            // Calculate ACTUAL total input weight from DB
            const actualTotalInputKg = stocks.reduce((sum, s) => sum + s.weightKg, 0);

            // 2. Create the MillingBatch
            const newBatch = await tx.millingBatch.create({
                data: {
                    date: data.date,
                    title: data.title,
                    totalInputKg: actualTotalInputKg, // Use server-calculated weight
                },
            });

            // 3. Update and link stocks
            await tx.stock.updateMany({
                where: {
                    id: { in: data.selectedStockIds }
                },
                data: {
                    status: 'CONSUMED',
                    batchId: newBatch.id
                }
            });

            return newBatch;
        });

    } catch (error) {
        console.error('Failed to start milling batch:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Failed to start milling batch' }
    }

    revalidatePath('/milling')
    revalidatePath('/stocks')
    redirect('/milling')
}

export async function deleteMillingBatch(batchId: number) {
    try {
        await prisma.$transaction(async (tx) => {
            // 1. Get batch info
            const batch = await tx.millingBatch.findUnique({
                where: { id: batchId },
                include: { outputs: true }
            });

            if (!batch) throw new Error('Batch not found');
            if (batch.isClosed) throw new Error('Cannot delete a closed batch. Please reopen it first.');

            // 2. Release Stocks (Set back to AVAILABLE and unlink)
            await tx.stock.updateMany({
                where: { batchId: batchId },
                data: {
                    status: 'AVAILABLE',
                    batchId: null
                }
            });

            // 3. Delete Outputs
            await tx.millingOutputPackage.deleteMany({
                where: { batchId: batchId }
            });

            // 4. Delete Batch
            await tx.millingBatch.delete({
                where: { id: batchId }
            });
        });

        revalidatePath('/milling')
        revalidatePath('/stocks')
        return { success: true }
    } catch (error) {
        console.error('Failed to delete milling batch:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Failed to delete milling batch' }
    }
}

export async function addPackagingLog(batchId: number, outputs: MillingOutputInput[]) {
    try {
        const batch = await prisma.millingBatch.findUnique({
            where: { id: batchId },
            select: { isClosed: true }
        });

        if (batch?.isClosed) {
            return { success: false, error: 'Closed batches cannot be modified' }
        }

        await prisma.millingOutputPackage.createMany({
            data: outputs.map(output => ({
                batchId,
                packageType: output.packageType,
                weightPerUnit: output.weightPerUnit,
                count: output.count,
                totalWeight: output.totalWeight,
            }))
        });

        revalidatePath('/milling')
        return { success: true }
    } catch (error) {
        console.error('Failed to add packaging log:', error)
        return { success: false, error: 'Failed to add packaging log' }
    }
}

export async function reopenMillingBatch(batchId: number) {
    try {
        await prisma.millingBatch.update({
            where: { id: batchId },
            data: { isClosed: false }
        });

        revalidatePath('/milling')
        return { success: true }
    } catch (error) {
        console.error('Failed to reopen milling batch:', error)
        return { success: false, error: 'Failed to reopen milling batch' }
    }
}

export async function updatePackagingLogs(batchId: number, outputs: MillingOutputInput[]) {
    try {
        const batch = await prisma.millingBatch.findUnique({
            where: { id: batchId },
            select: { isClosed: true }
        });

        if (batch?.isClosed) {
            return { success: false, error: 'Closed batches cannot be modified' }
        }

        await prisma.$transaction(async (tx) => {
            // 1. Delete existing outputs for this batch
            await tx.millingOutputPackage.deleteMany({
                where: { batchId }
            });

            // 2. Create new outputs
            await tx.millingOutputPackage.createMany({
                data: outputs.map(output => ({
                    batchId,
                    packageType: output.packageType,
                    weightPerUnit: output.weightPerUnit,
                    count: output.count,
                    totalWeight: output.totalWeight,
                }))
            });
        });

        revalidatePath('/milling')
        return { success: true }
    } catch (error) {
        console.error('Failed to update packaging logs:', error)
        return { success: false, error: 'Failed to update packaging logs' }
    }
}

export async function closeMillingBatch(batchId: number) {
    try {
        await prisma.millingBatch.update({
            where: { id: batchId },
            data: { isClosed: true }
        });

        revalidatePath('/milling')
        return { success: true }
    } catch (error) {
        console.error('Failed to close milling batch:', error)
        return { success: false, error: 'Failed to close milling batch' }
    }
}

export async function removeStockFromMilling(batchId: number, stockId: number) {
    try {
        await prisma.$transaction(async (tx) => {
            // 1. Verify batch state
            const batch = await tx.millingBatch.findUnique({
                where: { id: batchId },
                include: { outputs: true }
            });

            if (!batch) throw new Error('Batch not found');
            if (batch.isClosed) throw new Error('Cannot modify a closed batch');
            if (batch.outputs.length > 0) throw new Error('포장 기록이 있어 투입 내역을 수정할 수 없습니다. 포장 기록을 먼저 삭제해주세요.');

            // 2. Unlink Stock (Set back to AVAILABLE)
            await tx.stock.update({
                where: { id: stockId },
                data: {
                    status: 'AVAILABLE',
                    batchId: null
                }
            });

            // 3. Recalculate Total Input Weight
            // Fetch remaining stocks for this batch
            const remainingStocks = await tx.stock.findMany({
                where: { batchId: batchId }
            });

            const newTotalInputKg = remainingStocks.reduce((sum, s) => sum + s.weightKg, 0);

            // 4. Update Batch Total Input
            await tx.millingBatch.update({
                where: { id: batchId },
                data: { totalInputKg: newTotalInputKg }
            });
        });

        revalidatePath('/milling')
        revalidatePath('/stocks')
        return { success: true }
    } catch (error) {
        console.error('Failed to remove stock from milling:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Failed to remove stock' }
    }
}
