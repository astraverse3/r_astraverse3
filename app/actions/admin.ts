'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'

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

export async function getFarmersWithCerts() {
    try {
        const farmers = await prisma.farmer.findMany({
            include: {
                certifications: true
            },
            orderBy: { name: 'asc' }
        })
        return { success: true, data: farmers }
    } catch (error) {
        console.error('Failed to get farmers:', error)
        return { success: false, error: 'Failed to get farmers' }
    }
}

export async function createVariety(data: VarietyFormData) {
    try {
        // Check duplicate
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
        revalidatePath('/stocks') // Maybe used in stock add dialog?
        revalidatePath('/milling') // Maybe used in milling?
        return { success: true, data: variety }
    } catch (error) {
        console.error('Failed to create variety:', error)
        return { success: false, error: 'Failed to create variety' }
    }
}

export async function updateVariety(id: number, data: VarietyFormData) {
    try {
        // Check duplicate if name changed
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

// --- FARMER ACTIONS ---

export type FarmerFormData = {
    name: string
    phone?: string
}

export async function createFarmer(data: FarmerFormData) {
    try {
        const farmer = await prisma.farmer.create({
            data: {
                name: data.name,
                phone: data.phone
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
                phone: data.phone
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
        // Check if used in Stock (via Certification)
        const used = await prisma.stock.findFirst({
            where: {
                certification: {
                    farmerId: id
                }
            }
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

// --- CERTIFICATION ACTIONS ---

export type CertificationFormData = {
    farmerId: number
    certType: string
    certNo: string
    personalNo?: string
}

export async function createCertification(data: CertificationFormData) {
    try {
        const cert = await prisma.farmerCertification.create({
            data: {
                farmerId: data.farmerId,
                certType: data.certType,
                certNo: data.certNo,
                personalNo: data.personalNo
            }
        })
        revalidatePath('/admin/farmers')
        return { success: true, data: cert }
    } catch (error) {
        console.error('Failed to create certification:', error)
        return { success: false, error: 'Failed to create certification' }
    }
}

export async function updateCertification(id: number, data: CertificationFormData) {
    try {
        const cert = await prisma.farmerCertification.update({
            where: { id },
            data: {
                // farmerId usually doesn't change
                certType: data.certType,
                certNo: data.certNo,
                personalNo: data.personalNo
            }
        })
        revalidatePath('/admin/farmers')
        return { success: true, data: cert }
    } catch (error) {
        console.error('Failed to update certification:', error)
        return { success: false, error: 'Failed to update certification' }
    }
}

export async function deleteCertification(id: number) {
    try {
        // Check usage in Stock
        const used = await prisma.stock.findFirst({
            where: { certId: id }
        })
        if (used) {
            return { success: false, error: '재고가 등록된 인증 정보는 삭제할 수 없습니다.' }
        }

        await prisma.farmerCertification.delete({
            where: { id }
        })
        revalidatePath('/admin/farmers')
        return { success: true }
    } catch (error) {
        console.error('Failed to delete certification:', error)
        return { success: false, error: 'Failed to delete certification' }
    }
}
