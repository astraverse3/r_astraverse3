'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// --- VARIETY ACTIONS (Unchanged) ---
export type VarietyFormData = {
    name: string
    type: string
}

export async function getVarieties() {
    try {
        const varieties = await prisma.variety.findMany({
            orderBy: { name: 'asc' }
        })
        return { success: true, data: varieties }
    } catch (error) {
        console.error('Failed to get varieties:', error)
        return { success: false, error: 'Failed to get varieties' }
    }
}

export async function createVariety(data: VarietyFormData) {
    try {
        const existing = await prisma.variety.findUnique({
            where: { name: data.name }
        })
        if (existing) {
            return { success: false, error: '이미 존재하는 품종입니다.' }
        }

        const variety = await prisma.variety.create({
            data: { name: data.name, type: data.type }
        })
        revalidatePath('/admin/varieties')
        revalidatePath('/stocks')
        revalidatePath('/milling')
        return { success: true, data: variety }
    } catch (error) {
        console.error('Failed to create variety:', error)
        return { success: false, error: 'Failed to create variety' }
    }
}

export async function updateVariety(id: number, data: VarietyFormData) {
    try {
        const existing = await prisma.variety.findUnique({
            where: { name: data.name }
        })
        if (existing && existing.id !== id) {
            return { success: false, error: '이미 존재하는 품종입니다.' }
        }

        const variety = await prisma.variety.update({
            where: { id },
            data: { name: data.name, type: data.type }
        })
        revalidatePath('/admin/varieties')
        revalidatePath('/stocks')
        return { success: true, data: variety }
    } catch (error) {
        console.error('Failed to update variety:', error)
        return { success: false, error: 'Failed to update variety' }
    }
}

export async function deleteVariety(id: number) {
    try {
        await prisma.variety.delete({
            where: { id }
        })
        revalidatePath('/admin/varieties')
        revalidatePath('/stocks')
        return { success: true }
    } catch (error) {
        console.error('Failed to delete variety:', error)
        return { success: false, error: 'Failed to delete variety' }
    }
}

// --- PRODUCER GROUP & FARMER ACTIONS ---

// Fetch Farmers with nested Group info
export type GetFarmersParams = {
    groupName?: string
    farmerName?: string
    certType?: string
    cropYear?: number
}

export async function getFarmersWithGroups(params?: GetFarmersParams) {
    try {
        const where: any = {}

        if (params?.groupName) {
            where.group = {
                ...where.group,
                name: { contains: params.groupName }
            }
        }

        if (params?.farmerName) {
            where.name = { contains: params.farmerName }
        }

        if (params?.certType && params.certType !== 'ALL') {
            where.group = {
                ...where.group,
                certType: params.certType
            }
        }

        if (params?.cropYear) {
            where.group = {
                ...where.group, // Merge with existing group filter if any
                cropYear: params.cropYear
            }
        }

        const farmers = await prisma.farmer.findMany({
            where,
            include: {
                group: true // Include group for displaying Group Name/Cert No
            },
        })

        // Sort naturally (handles "10" > "2" correctly)
        // Order: cropYear (desc) -> group code (asc) -> farmerNo (asc)
        farmers.sort((a, b) => {
            // 1. Crop Year (Descending - Latest first)
            if (a.group.cropYear !== b.group.cropYear) {
                return b.group.cropYear - a.group.cropYear
            }

            // 2. Group Code
            const groupCompare = a.group.code.localeCompare(b.group.code, undefined, { numeric: true })
            if (groupCompare !== 0) return groupCompare

            // 3. Farmer No
            return a.farmerNo.localeCompare(b.farmerNo, undefined, { numeric: true })
        })

        return { success: true, data: farmers }
    } catch (error) {
        console.error('Failed to get farmers:', error)
        return { success: false, error: 'Failed to get farmers' }
    }
}

export async function getProducerGroups() {
    try {
        const groups = await prisma.producerGroup.findMany({
            orderBy: { code: 'asc' }
        })
        return { success: true, data: groups }
    } catch (error) {
        console.error('Failed to get groups:', error)
        return { success: false, error: 'Failed to get groups' }
    }
}

// FARMER CRUD
export type FarmerFormData = {
    name: string
    farmerNo: string
    items?: string
    phone?: string
    groupId: number
}

export async function createFarmer(data: FarmerFormData) {
    try {
        // Check duplicate within group
        const existing = await prisma.farmer.findUnique({
            where: {
                groupId_farmerNo: {
                    groupId: data.groupId,
                    farmerNo: data.farmerNo
                }
            }
        });

        if (existing) {
            return { success: false, error: `해당 작목반에 이미 농가번호 ${data.farmerNo}가 존재합니다.` }
        }

        const farmer = await prisma.farmer.create({
            data: {
                name: data.name,
                farmerNo: data.farmerNo,
                items: data.items,
                phone: data.phone,
                groupId: data.groupId
            }
        })
        revalidatePath('/admin/farmers')
        revalidatePath('/stocks')
        return { success: true, data: farmer }
    } catch (error) {
        console.error('Failed to create farmer:', error)
        return { success: false, error: 'Failed to create farmer' }
    }
}

export async function updateFarmer(id: number, data: FarmerFormData) {
    try {
        const farmer = await prisma.farmer.update({
            where: { id },
            data: {
                name: data.name,
                farmerNo: data.farmerNo,
                items: data.items,
                phone: data.phone,
                groupId: data.groupId
            }
        })
        revalidatePath('/admin/farmers')
        revalidatePath('/stocks')
        return { success: true, data: farmer }
    } catch (error) {
        console.error('Failed to update farmer:', error)
        return { success: false, error: 'Failed to update farmer' }
    }
}

export async function deleteFarmer(id: number) {
    try {
        const used = await prisma.stock.findFirst({
            where: { farmerId: id }
        })
        if (used) {
            return { success: false, error: '재고가 등록된 농가는 삭제할 수 없습니다.' }
        }

        await prisma.farmer.delete({
            where: { id }
        })
        revalidatePath('/admin/farmers')
        revalidatePath('/stocks')
        return { success: true }
    } catch (error) {
        console.error('Failed to delete farmer:', error)
        return { success: false, error: 'Failed to delete farmer' }
    }
}

// PRODUCER GROUP CRUD (Optional, mostly handled via Excel but good to have)
export type ProducerGroupFormData = {
    code: string
    name: string
    certNo: string
    cropYear?: number
}

export async function createProducerGroup(data: ProducerGroupFormData) {
    try {
        // Derive certType
        const thirdChar = data.certNo.length >= 3 ? data.certNo.charAt(2) : ''
        let certType = '일반'
        if (thirdChar === '1') certType = '유기농'
        else if (thirdChar === '3') certType = '무농약'

        const group = await prisma.producerGroup.create({
            data: {
                code: data.code,
                name: data.name,
                certNo: data.certNo,
                certType,
                cropYear: data.cropYear || 2025
            }
        })
        return { success: true, data: group }
    } catch (error) {
        console.error('Failed to create group:', error)
        return { success: false, error: 'Failed to create group' }
    }
}
