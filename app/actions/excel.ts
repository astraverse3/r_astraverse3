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
        })

        // Sort naturally (match list view)
        farmers.sort((a, b) => {
            // 1. Crop Year (Descending - Latest first)
            const yearA = a.group?.cropYear || 0
            const yearB = b.group?.cropYear || 0
            if (yearA !== yearB) {
                return yearB - yearA
            }

            // 2. Group Code
            const codeA = a.group?.code || ''
            const codeB = b.group?.code || ''
            const groupCompare = codeA.localeCompare(codeB, undefined, { numeric: true })
            if (groupCompare !== 0) return groupCompare

            // 3. Farmer No
            const farmerNoA = a.farmerNo || ''
            const farmerNoB = b.farmerNo || ''
            return farmerNoA.localeCompare(farmerNoB, undefined, { numeric: true })
        })

        const rows: any[] = farmers.map(farmer => ({
            '생산년도': farmer.group?.cropYear || '',
            '작목반번호': farmer.group?.code || '',
            '작목반명': farmer.group?.name || '',
            '인증번호': farmer.group?.certNo || '',
            '농가번호': farmer.farmerNo || '',
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
export async function importFarmers(formData: FormData): Promise<import('@/lib/excel-utils').ExcelImportResult> {
    const result: import('@/lib/excel-utils').ExcelImportResult = {
        success: false, // Will be set to true if process completes without catastrophic failure
        counts: { total: 0, success: 0, skipped: 0, failed: 0 },
        errors: []
    }

    try {
        const file = formData.get('file') as File

        if (!file) {
            result.errors.push({ row: 0, reason: '파일이 없습니다.' })
            return result
        }

        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer)

        // Loop through all sheets
        let allRows: any[] = []
        for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName]
            const sheetData = XLSX.utils.sheet_to_json(worksheet) as any[]
            allRows = allRows.concat(sheetData)
        }

        result.counts.total = allRows.length
        const currentYear = new Date().getFullYear()

        // Transaction to ensure data integrity
        // Note: effectively we are doing many small transactions or one big one?
        // The previous code used one big transaction. 
        // If we want to allow partial success (skipping bad rows), likely we want to keep the big transaction 
        // BUT exclude the bad rows from it, which is what the previous logic did (continue loop).
        // So we can keep the single transaction structure for now, assuming "Skipped" rows don't break the transaction.

        await prisma.$transaction(async (tx) => {
            let rowIndex = 1 // Header is row 1, data starts at row 2 in Excel visual. 
            // json_to_sheet usually handles header. 
            // So jsonData[0] is physically row 2.

            for (const row of allRows) {
                rowIndex++ // Increment for each data row (jsonData index 0 is row 2)

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
                const missingFields = []
                if (!groupCode) missingFields.push('작목반번호')
                if (!groupName) missingFields.push('작목반명')
                if (!certNo) missingFields.push('인증번호')
                if (!farmerNo) missingFields.push('농가번호')
                if (!farmerName) missingFields.push('농가명')

                if (missingFields.length > 0) {
                    result.counts.skipped++
                    result.errors.push({
                        row: rowIndex,
                        reason: `필수값 누락: ${missingFields.join(', ')}`
                    })
                    continue
                }

                try {
                    // 1. Process Producer Group (Upsert)
                    // Derive Cert Type from CertNo (3rd digit)
                    const thirdChar = certNo!.length >= 3 ? certNo!.charAt(2) : ''
                    let certType = '일반'
                    if (thirdChar === '1') certType = '유기농'
                    else if (thirdChar === '3') certType = '무농약'

                    let group = await tx.producerGroup.findUnique({
                        where: {
                            code_cropYear: {
                                code: groupCode!,
                                cropYear: targetYear
                            }
                        }
                    })

                    if (!group) {
                        group = await tx.producerGroup.create({
                            data: {
                                code: groupCode!,
                                name: groupName!,
                                certNo: certNo!,
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
                                farmerNo: farmerNo!
                            }
                        }
                    })

                    if (!existingFarmer) {
                        await tx.farmer.create({
                            data: {
                                groupId: group.id,
                                farmerNo: farmerNo!,
                                name: farmerName!,
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
                    result.counts.success++

                } catch (innerError) {
                    console.error(`Row ${rowIndex} error:`, innerError)
                    result.counts.failed++
                    result.errors.push({
                        row: rowIndex,
                        reason: 'DB 저장 실패'
                    })
                }
            }
        }, {
            maxWait: 10000,
            timeout: 20000
        })

        revalidatePath('/admin/farmers')
        result.success = true // Operation completed (even if some rows failed, the act of processing finished)
        return result

    } catch (error) {
        console.error('Import failed:', error)
        result.success = false
        result.message = '엑셀 데이터 처리 중 치명적인 오류가 발생했습니다.'
        return result
    }
}
