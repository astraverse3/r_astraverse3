'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'

export type VarietyFormData = {
    name: string
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
        // Check duplicate
        const existing = await prisma.variety.findUnique({
            where: { name: data.name }
        })
        if (existing) {
            return { success: false, error: '이미 존재하는 품종입니다.' }
        }

        const variety = await prisma.variety.create({
            data: { name: data.name }
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
            data: { name: data.name }
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
