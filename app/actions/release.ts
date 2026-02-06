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

export async function getReleaseLogs(filters?: {
    startDate?: Date
    endDate?: Date
    keyword?: string
}) {
    try {
        const where: any = {}

        if (filters?.startDate || filters?.endDate) {
            where.date = {}
            if (filters.startDate) where.date.gte = filters.startDate
            if (filters.endDate) where.date.lte = filters.endDate
        }

        if (filters?.keyword) {
            where.OR = [
                { destination: { contains: filters.keyword, mode: 'insensitive' } },
                { purpose: { contains: filters.keyword, mode: 'insensitive' } }
            ]
        }

        const logs = await prisma.stockRelease.findMany({
            where,
            include: {
                stocks: {
                    include: {
                        farmer: {
                            include: {
                                group: true
                            }
                        },
                        variety: true
                    }
                }
            },
            orderBy: {
                date: 'desc'
            }
        })
        return { success: true, data: logs }
    } catch (error) {
        console.error('Failed to fetch release logs:', error)
        return { success: false, error: '출고 내역을 불러오는데 실패했습니다.' }
    }
}

export async function updateStockRelease(
    id: number,
    data: { date: Date; destination: string; purpose?: string }
) {
    try {
        const result = await prisma.stockRelease.update({
            where: { id },
            data: {
                date: data.date,
                destination: data.destination.trim(),
                purpose: data.purpose?.trim()
            }
        })
        revalidatePath('/releases')
        return { success: true, data: result }
    } catch (error) {
        console.error('Failed to update stock release:', error)
        return { success: false, error: '출고 내역 수정 실패' }
    }
}

export async function deleteStockReleases(ids: number[]) {
    try {
        await prisma.$transaction(async (tx) => {
            // 1. Revert all associated stocks
            await tx.stock.updateMany({
                where: { releaseId: { in: ids } },
                data: {
                    status: 'AVAILABLE',
                    releaseId: null
                }
            })

            // 2. Delete the release records
            await tx.stockRelease.deleteMany({
                where: { id: { in: ids } }
            })
        })
        revalidatePath('/releases')
        revalidatePath('/stocks')
        return { success: true }
    } catch (error) {
        console.error('Failed to delete stock releases:', error)
        return { success: false, error: '출고 내역 삭제 실패' }
    }
}

export async function removeStockFromRelease(stockId: number) {
    try {
        await prisma.$transaction(async (tx) => {
            // 1. Find the release associated with this stock
            const stock = await tx.stock.findUnique({
                where: { id: stockId },
                select: { releaseId: true }
            })

            if (!stock || !stock.releaseId) {
                throw new Error('출고 정보를 찾을 수 없습니다.')
            }

            const releaseId = stock.releaseId

            // 2. Revert the stock
            await tx.stock.update({
                where: { id: stockId },
                data: {
                    status: 'AVAILABLE',
                    releaseId: null
                }
            })

            // 3. Check if release has any stocks left
            const remainingStocks = await tx.stock.count({
                where: { releaseId }
            })

            // 4. If empty, delete the release record
            if (remainingStocks === 0) {
                await tx.stockRelease.delete({
                    where: { id: releaseId }
                })
            }
        })
        revalidatePath('/releases')
        revalidatePath('/stocks')
        return { success: true }
    } catch (error) {
        console.error('Failed to remove stock from release:', error)
        return { success: false, error: error instanceof Error ? error.message : '항목 삭제 실패' }
    }
}
