'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function createStockRelease(
    stockIds: number[],
    date: Date,
    destination: string,
    purpose: string | undefined
) {
    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Validate Stocks
            const stocks = await tx.stock.findMany({
                where: { id: { in: stockIds } },
                select: { id: true, status: true, bagNo: true }
            })

            // Check if all exist
            if (stocks.length !== stockIds.length) {
                throw new Error('일부 재고를 찾을 수 없습니다.')
            }

            // Check Status
            const invalidStock = stocks.find(s => s.status !== 'AVAILABLE')
            if (invalidStock) {
                throw new Error(`이미 사용되거나 출고된 재고가 포함되어 있습니다. (포대번호: ${invalidStock.bagNo})`)
            }

            // 2. Create Release Record
            const release = await tx.stockRelease.create({
                data: {
                    date,
                    destination: destination.trim(),
                    purpose: purpose?.trim(),
                    // Link stocks
                    stocks: {
                        connect: stockIds.map(id => ({ id }))
                    }
                }
            })

            // 3. Update Stocks Status
            await tx.stock.updateMany({
                where: { id: { in: stockIds } },
                data: {
                    status: 'RELEASED',
                    releaseId: release.id
                }
            })

            return release
        })

        revalidatePath('/stocks')
        return { success: true, data: result }
    } catch (error) {
        console.error('Failed to create stock release:', error)
        return { success: false, error: error instanceof Error ? error.message : '출고 처리 실패' }
    }
}

export async function cancelStockRelease(stockIds: number[]) {
    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Validate Stocks
            const stocks = await tx.stock.findMany({
                where: { id: { in: stockIds } },
                select: { id: true, status: true, bagNo: true }
            })

            // Check if all exist
            if (stocks.length !== stockIds.length) {
                throw new Error('일부 재고를 찾을 수 없습니다.')
            }

            // Check Status - must be RELEASED
            const invalidStock = stocks.find(s => s.status !== 'RELEASED')
            if (invalidStock) {
                throw new Error(`출고 상태가 아닌 재고가 포함되어 있습니다. (포대번호: ${invalidStock.bagNo})`)
            }

            // 2. Update Stocks Status (Revert to AVAILABLE)
            await tx.stock.updateMany({
                where: { id: { in: stockIds } },
                data: {
                    status: 'AVAILABLE',
                    releaseId: null
                }
            })

            return { count: stockIds.length }
        })

        revalidatePath('/stocks')
        return { success: true, data: result }
    } catch (error) {
        console.error('Failed to cancel stock release:', error)
        return { success: false, error: error instanceof Error ? error.message : '출고 취소 실패' }
    }
}
