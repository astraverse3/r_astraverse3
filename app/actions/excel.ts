'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import * as XLSX from 'xlsx'

// --- EXPORT LOGIC ---
export async function exportFarmers() {
    try {
        const farmers = await prisma.farmer.findMany({
            include: {
                group: true
            },
            orderBy: [
                { group: { code: 'asc' } },
                { farmerNo: 'asc' }
            ]
        })

        const rows: any[] = farmers.map(farmer => ({
            '생산년도': farmer.group.cropYear,
            '작목반번호': farmer.group.code,
            '작목반명': farmer.group.name,
            '인증번호': farmer.group.certNo,
            '농가번호': farmer.farmerNo,
            '농가명': farmer.name,
            '취급품목': farmer.items || ''
        }))

        const worksheet = XLSX.utils.json_to_sheet(rows)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'ProducerGroups')

        const buf = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' })

        return { success: true, daa: buf, fileName: `producer_groups_${new Date().toISOString().slice(0, 10)}.xlsx` }

    } catch (error) {
        console.error('Export failed:', error)
        return { success: false, error: '엑셀 내보내기에 실패했습니다.' }
    }
}

// --- IMPORT LOGIC ---
export async function importFarmers(formData: FormData) {
    try {
        const file = formData.get('file') as File

        if (!file) return { success: false, error: '파일이 없습니다.' }

        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer)
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

        let successCount = 0
        let errorCount = 0
        const currentYear = new Date().getFullYear()

        // Transaction to ensure data integrity
        await prisma.$transaction(async (tx) => {
            for (const row of jsonData) {
                const groupCode = row['작목반번호'] ? String(row['작목반번호']) : undefined
                const groupName = row['작목반명'] ? String(row['작목반명']) : undefined
                const certNo = row['인증번호'] ? String(row['인증번호']) : undefined

                const farmerNo = row['생산자번호'] ? String(row['생산자번호']) : (row['농가번호'] ? String(row['농가번호']) : undefined)
                const farmerName = row['생산자명'] ? String(row['생산자명']) : (row['농가명'] ? String(row['농가명']) : undefined)
                const items = row['취급품목'] ? String(row['취급품목']) : undefined

                // Parse Year from Excel, default to current year if missing
                let targetYear = row['생산년도'] ? parseInt(String(row['생산년도'])) : currentYear
                if (isNaN(targetYear)) targetYear = currentYear

                // Validate Essential Fields
                if (!groupCode || !groupName || !certNo || !farmerNo || !farmerName) {
                    errorCount++
                    continue
                }

                // 1. Process Producer Group (Upsert)
                // Derive Cert Type from CertNo (3rd digit)
                const thirdChar = certNo.length >= 3 ? certNo.charAt(2) : ''
                let certType = '일반'
                if (thirdChar === '1') certType = '유기농'
                else if (thirdChar === '3') certType = '무농약'

                let group = await tx.producerGroup.findUnique({
                    where: {
                        code_cropYear: {
                            code: groupCode,
                            cropYear: targetYear
                        }
                    }
                })

                if (!group) {
                    group = await tx.producerGroup.create({
                        data: {
                            code: groupCode,
                            name: groupName,
                            certNo: certNo,
                            certType: certType,
                            cropYear: targetYear
                        }
                    })
                } else {
                    // Update Group Info if changed (e.g. CertNo update)
                    if (group.name !== groupName || group.certNo !== certNo) {
                        group = await tx.producerGroup.update({
                            where: { id: group.id },
                            data: { name: groupName, certNo, certType }
                        })
                    }
                }

                // 2. Process Farmer (Upsert)
                // Use Composite Unique [groupId, farmerNo]
                const existingFarmer = await tx.farmer.findUnique({
                    where: {
                        groupId_farmerNo: {
                            groupId: group.id,
                            farmerNo: farmerNo
                        }
                    }
                })

                if (!existingFarmer) {
                    await tx.farmer.create({
                        data: {
                            groupId: group.id,
                            farmerNo: farmerNo,
                            name: farmerName,
                            items: items
                        }
                    })
                } else {
                    // Update Farmer Info
                    await tx.farmer.update({
                        where: { id: existingFarmer.id },
                        data: {
                            name: farmerName,
                            items: items
                        }
                    })
                }
                successCount++
            }
        }, {
            maxWait: 10000,
            timeout: 20000
        })

        revalidatePath('/admin/farmers')
        return { success: true, message: `총 ${successCount}건 처리 완료 (생산년도 자동 반영)` }

    } catch (error) {
        console.error('Import failed:', error)
        return { success: false, error: '엑셀 데이터 처리 중 오류가 발생했습니다. 데이터 형식을 확인해주세요.' }
    }
}
