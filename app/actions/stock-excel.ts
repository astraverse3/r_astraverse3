'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import * as XLSX from 'xlsx'
import { ExcelImportResult } from '@/lib/excel-utils'

// --- EXPORT LOGIC ---
export async function exportStocksSample() {
    try {
        // Create a sample workbook
        const rows = [
            {
                '입고일자': '2024-10-15',
                '생산년도': 2024,
                '생산자명': '홍길동',
                '품종': '신동진',
                '톤백번호': 1,
                '중량(kg)': 800
            },
            {
                '입고일자': '2024-10-15',
                '생산년도': 2024,
                '생산자명': '김철수',
                '품종': '삼광',
                '톤백번호': 2,
                '중량(kg)': 805.5
            }
        ]

        const worksheet = XLSX.utils.json_to_sheet(rows)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'StockSample')

        const buf = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' })

        return { success: true, daa: buf, fileName: `stock_upload_sample.xlsx` }

    } catch (error) {
        console.error('Export sample failed:', error)
        return { success: false, error: '샘플 다운로드에 실패했습니다.' }
    }
}

// --- IMPORT LOGIC ---
export async function importStocks(formData: FormData): Promise<ExcelImportResult> {
    const result: ExcelImportResult = {
        success: false,
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
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

        result.counts.total = jsonData.length

        // Pre-fetch all Farmers and Varieties to minimize DB calls inside loop?
        // Or just do findFirst/findUnique inside loop? 
        // Given typically small batch size, finding inside loop is safer for correctness, though less efficient.
        // Let's cache them for performance if list is not huge. 
        // But simply finding by name is fine for now.

        // Transaction for data integrity
        await prisma.$transaction(async (tx) => {
            let rowIndex = 1

            for (const row of jsonData) {
                rowIndex++

                // Extract Fields
                const dateStr = row['입고일자'] ? String(row['입고일자']) : undefined // Need to handle Excel date format carefully
                const productionYear = row['생산년도'] ? parseInt(String(row['생산년도'])) : undefined
                const farmerName = row['생산자명'] ? String(row['생산자명']).trim() : undefined
                const varietyName = row['품종'] ? String(row['품종']).trim() : undefined
                const bagNo = row['톤백번호'] ? parseInt(String(row['톤백번호'])) : undefined
                const weightKg = row['중량(kg)'] ? parseFloat(String(row['중량(kg)'])) : (row['중량'] ? parseFloat(String(row['중량'])) : undefined)

                // 1. Specific Validation
                const missingFields = []
                if (!dateStr) missingFields.push('입고일자')
                if (!productionYear) missingFields.push('생산년도')
                if (!farmerName) missingFields.push('생산자명')
                if (!varietyName) missingFields.push('품종')
                if (bagNo === undefined) missingFields.push('톤백번호')
                if (weightKg === undefined) missingFields.push('중량')

                if (missingFields.length > 0) {
                    result.counts.skipped++
                    result.errors.push({
                        row: rowIndex,
                        reason: `필수값 누락: ${missingFields.join(', ')}`
                    })
                    continue
                }

                // 2. Data Conversion & Logic Validation
                // Handle Date (Excel might return number or string)
                let incomingDate: Date | undefined
                if (typeof row['입고일자'] === 'number') {
                    // Excel serial date
                    incomingDate = new Date(Math.round((row['입고일자'] - 25569) * 86400 * 1000))
                } else {
                    // Try parsing string
                    const d = new Date(dateStr!)
                    if (!isNaN(d.getTime())) incomingDate = d
                }

                if (!incomingDate) {
                    result.counts.skipped++
                    result.errors.push({ row: rowIndex, reason: '날짜 형식 오류 (YYYY-MM-DD 권장)' })
                    continue
                }

                try {
                    // 3. Lookups
                    const farmer = await tx.farmer.findFirst({
                        where: { name: farmerName }
                    })
                    if (!farmer) {
                        result.counts.failed++
                        result.errors.push({ row: rowIndex, reason: `등록되지 않은 생산자: ${farmerName}` })
                        continue
                    }

                    const variety = await tx.variety.findUnique({
                        where: { name: varietyName }
                    })
                    if (!variety) {
                        result.counts.failed++
                        result.errors.push({ row: rowIndex, reason: `등록되지 않은 품종: ${varietyName}` })
                        continue
                    }

                    // 4. Create Stock
                    await tx.stock.create({
                        data: {
                            productionYear: productionYear!,
                            bagNo: bagNo!,
                            weightKg: weightKg!,
                            incomingDate: incomingDate,
                            farmerId: farmer.id,
                            varietyId: variety!.id,
                            status: 'AVAILABLE'
                        }
                    })

                    result.counts.success++

                } catch (innerError) {
                    console.error(`Row ${rowIndex} error:`, innerError)
                    result.counts.failed++
                    result.errors.push({ row: rowIndex, reason: 'DB 저장 중 오류 발생' })
                }
            }
        }, {
            maxWait: 10000,
            timeout: 60000 // Increase timeout for potentially large uploads
        })

        revalidatePath('/stocks')
        result.success = true
        return result

    } catch (error) {
        console.error('Import failed:', error)
        result.success = false
        result.message = '엑셀 데이터 처리 중 치명적인 오류가 발생했습니다.'
        return result
    }
}
