'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Upload } from 'lucide-react'
import { exportFarmers, importFarmers } from '@/app/actions/excel'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

export function ExcelButtons() {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [importing, setImporting] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [targetYear, setTargetYear] = useState<string>('2025')

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
            <Select value={targetYear} onValueChange={setTargetYear}>
                <SelectTrigger className="w-[100px] h-9 text-sm bg-white">
                    <SelectValue placeholder="년도" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="2024">2024년</SelectItem>
                    <SelectItem value="2025">2025년</SelectItem>
                    <SelectItem value="2026">2026년</SelectItem>
                </SelectContent>
            </Select>

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
