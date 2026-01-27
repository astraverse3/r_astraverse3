'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'

export type StockFormData = {
    productionYear: number
    bagNo: number
    farmerName: string
    variety: string
    certType: string
    weightKg: number
}

export async function createStock(data: StockFormData) {
    try {
        const stock = await prisma.stock.create({
            data: {
                ...data,
                status: 'AVAILABLE',
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
            // 1. Get current stock info with batch status
            const currentStock = await tx.stock.findUnique({
                where: { id },
                select: {
                    weightKg: true,
                    batchId: true,
                    batch: {
                        select: { isClosed: true }
                    }
                }
            });

            if (!currentStock) throw new Error('Stock not found');

            // SAFETY CHECK: Cannot update stock if it belongs to a closed batch
            if (currentStock.batch?.isClosed) {
                throw new Error('마감된 도정 작업에 포함된 재고는 수정할 수 없습니다.');
            }

            // 2. Calculate weight difference
            const weightDiff = data.weightKg - currentStock.weightKg;

            // 3. Update stock
            const updatedStock = await tx.stock.update({
                where: { id },
                data: { ...data },
            });

            // 4. If stock is linked to a batch and weight changed, update batch total
            if (currentStock.batchId && weightDiff !== 0) {
                await tx.millingBatch.update({
                    where: { id: currentStock.batchId },
                    data: {
                        totalInputKg: {
                            increment: weightDiff
                        }
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

export type GetStocksParams = {
    productionYear?: string
    variety?: string
    farmerName?: string
    certType?: string
    status?: string // 'ALL' | 'AVAILABLE' | 'CONSUMED'
    sort?: string // 'newest' | 'oldest' | 'weight_desc' | 'weight_asc'
}

export async function getStocks(params?: GetStocksParams) {
    try {
        const where: any = {}

        // 1. Filter Construction
        if (params?.productionYear) {
            where.productionYear = parseInt(params.productionYear)
        }
        if (params?.variety) {
            where.variety = { contains: params.variety } // Remove mode: 'insensitive' if using SQLite/MySQL without case-insensitive config, or keep for Postgres. Prisma default for SQLite is case-sensitive, but contains is usually what we want. Let's start simple.
        }
        if (params?.farmerName) {
            where.farmerName = { contains: params.farmerName }
        }
        if (params?.certType && params.certType !== 'ALL') {
            where.certType = params.certType
        }
        if (params?.status && params.status !== 'ALL') {
            where.status = params.status
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
            orderBy
        })
        return { success: true, data: stocks }
    } catch (error) {
        console.error('Failed to get stocks:', error)
        return { success: false, error: 'Failed to get stocks' }
    }
}
