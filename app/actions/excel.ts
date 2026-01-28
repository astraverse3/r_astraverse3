'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import * as XLSX from 'xlsx'

// --- EXPORT LOGIC ---
export async function exportFarmers() {
    try {
        // Fetch all farmers with certifications
        const farmers = await prisma.farmer.findMany({
            include: {
                certifications: true
            },
            orderBy: { name: 'asc' }
        })

        // Flatten data for Excel
        const rows: any[] = []

        farmers.forEach(farmer => {
            if (farmer.certifications.length === 0) {
                // Farmer without cert
                rows.push({
                    '생산자명': farmer.name,
                    '연락처': farmer.phone || '',
                    '인증번호': '',
                    '생산자식별번호': ''
                })
            } else {
                // Farmer with certs
                farmer.certifications.forEach(cert => {
                    rows.push({
                        '생산자명': farmer.name,
                        '연락처': farmer.phone || '',
                        '인증번호': cert.certNo,
                        '생산자식별번호': cert.personalNo || ''
                    })
                })
            }
        })

        // Generate Excel Buffer
        const worksheet = XLSX.utils.json_to_sheet(rows)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Farmers')

        // Write to buffer
        const buf = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' })

        return { success: true, daa: buf, fileName: `farmers_export_${new Date().toISOString().slice(0, 10)}.xlsx` }

    } catch (error) {
        console.error('Export failed:', error)
        return { success: false, error: '엑셀 내보내기에 실패했습니다.' }
    }
}

// --- IMPORT LOGIC ---
export async function importFarmers(formData: FormData) {
    try {
        const file = formData.get('file') as File
        if (!file) {
            return { success: false, error: '파일이 없습니다.' }
        }

        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer)
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

        // Validation & Processing
        let successCount = 0
        let errorCount = 0

        for (const row of jsonData) {
            const name = row['생산자명']
            const phone = row['연락처'] ? String(row['연락처']) : undefined
            const certNo = row['인증번호'] ? String(row['인증번호']) : undefined
            const personalNo = row['생산자식별번호'] ? String(row['생산자식별번호']) : undefined

            if (!name) {
                errorCount++
                continue
            }

            // 1. Upsert Farmer (Name + Phone unique-ish check)
            // Since name is not unique in DB but treated as main ID here, we try to find by Name first.
            let farmer = await prisma.farmer.findFirst({
                where: { name: name } // Phone check strictly? Let's just match Name for simplicity or Name+Phone
            })

            if (!farmer) {
                farmer = await prisma.farmer.create({
                    data: { name, phone }
                })
            } else if (phone && farmer.phone !== phone) {
                // Update phone if different
                await prisma.farmer.update({
                    where: { id: farmer.id },
                    data: { phone }
                })
            }

            // 2. Process Certification
            if (certNo) {
                // Derive Cert Type
                // Rule: 3rd digit. Index 2 (0,1,2).
                // Example: 151xxxxx -> '1' -> 유기농
                // Example: 153xxxxx -> '3' -> 무농약
                const thirdChar = certNo.length >= 3 ? certNo.charAt(2) : ''
                let certType = '일반'
                if (thirdChar === '1') certType = '유기농'
                else if (thirdChar === '3') certType = '무농약'

                // Upsert Cert
                const existingCert = await prisma.farmerCertification.findFirst({
                    where: {
                        farmerId: farmer.id,
                        certNo: certNo
                    }
                })

                if (!existingCert) {
                    await prisma.farmerCertification.create({
                        data: {
                            farmerId: farmer.id,
                            certType,
                            certNo,
                            personalNo
                        }
                    })
                } else {
                    // Update details
                    await prisma.farmerCertification.update({
                        where: { id: existingCert.id },
                        data: {
                            certType,
                            personalNo
                        }
                    })
                }
            }
            successCount++
        }

        revalidatePath('/admin/farmers')
        return {
            success: true,
            message: `${successCount}건 처리 완료 (실패/누락 ${errorCount}건)`
        }

    } catch (error) {
        console.error('Import failed:', error)
        return { success: false, error: '엑셀 가져오기에 실패했습니다.' }
    }
}
