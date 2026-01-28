'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'

// Updated definition to match new schema relations
export type StockFormData = {
    productionYear: number
    bagNo: number
    certId: number     // ID of the FarmerCertification
    varietyId: number  // ID of the Variety
    weightKg: number
    incomingDate: Date // New field for Lot Tracking
}

export async function createStock(data: StockFormData) {
    try {
        const stock = await prisma.stock.create({
            data: {
                productionYear: data.productionYear,
                bagNo: data.bagNo,
                weightKg: data.weightKg,
                incomingDate: data.incomingDate,
                certId: data.certId,
                varietyId: data.varietyId,
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

            // 3. Update stock
            const updatedStock = await tx.stock.update({
                where: { id },
                data: {
                    productionYear: data.productionYear,
                    bagNo: data.bagNo,
                    weightKg: data.weightKg,
                    incomingDate: data.incomingDate,
                    certId: data.certId,
                    varietyId: data.varietyId,
                },
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

export type GetStocksParams = {
    productionYear?: string
    varietyId?: string
    farmerId?: string
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
        if (params?.varietyId && params.varietyId !== 'ALL') {
            where.varietyId = parseInt(params.varietyId)
        }
        if (params?.farmerId && params.farmerId !== 'ALL') {
            where.certification = {
                farmerId: parseInt(params.farmerId)
            }
        }
        if (params?.status && params.status !== 'ALL') {
            where.status = params.status
        }
        // CertType filter might need to traverse relation if we keep it
        if (params?.certType && params.certType !== 'ALL') {
            where.certification = {
                ...where.certification, // keep farmerId if exists (merged if both present? Prisma handles deep merge or overwrite? usually explicit needed)
                // Actually need to be careful. certification object inside where.
                // If farmerId is set, it sets certification: { farmerId: ... }
                // If certType is set, it sets certification: { certType: ... }
                // If BOTH are set, we need certification: { farmerId: ..., certType: ... }
                certType: params.certType
            }
            // Fix deep merge logic manually:
            if (params?.farmerId && params.farmerId !== 'ALL') {
                where.certification.farmerId = parseInt(params.farmerId)
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
                certification: {
                    include: {
                        farmer: true
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
