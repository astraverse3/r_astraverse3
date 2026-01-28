'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Upload } from 'lucide-react'
import { exportFarmers, importFarmers } from '@/app/actions/excel'
import { useSearchParams } from 'next/navigation'

export function ExcelButtons() {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [importing, setImporting] = useState(false)
    const [exporting, setExporting] = useState(false)
    const searchParams = useSearchParams()

    const handleExport = async () => {
        setExporting(true)
        const result = await exportFarmers()

        if (result.success && result.daa) {
            // Trigger Download
            const base64Data = result.daa
            const link = document.createElement('a')
            link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64Data}`
            link.download = result.fileName || 'farmers.xlsx'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        } else {
            alert(result.error)
        }
        setExporting(false)
    }

    const handleImportClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Determine year from search params or default
        const paramYear = searchParams.get('cropYear')
        const currentYear = new Date().getFullYear().toString()
        const targetYear = (paramYear && paramYear !== 'ALL') ? paramYear : currentYear

        if (!confirm(`${targetYear}년도 데이터로 등록하시겠습니까? (기준년도: ${targetYear})`)) {
            if (fileInputRef.current) fileInputRef.current.value = ''
            return
        }

        setImporting(true)
        const formData = new FormData()
        formData.append('file', file)
        formData.append('year', targetYear)

        const result = await importFarmers(formData)

        if (result.success) {
            alert(result.message)
        } else {
            alert(result.error)
        }

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = ''
        setImporting(false)
    }

    return (
        <div className="hidden md:flex gap-2 items-center">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".xlsx, .xls"
            />
            <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleImportClick}
                disabled={importing}
            >
                <Upload className="w-4 h-4" />
                {importing ? '업로드 중...' : '엑셀 등록'}
            </Button>
            <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleExport}
                disabled={exporting}
            >
                <Download className="w-4 h-4" />
                {exporting ? '다운로드 중...' : '엑셀 다운로드'}
            </Button>
        </div>
    )
}
