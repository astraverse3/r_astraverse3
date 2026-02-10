'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Upload } from 'lucide-react'
import { exportFarmers, importFarmers } from '@/app/actions/excel'
import { formatImportResult } from '@/lib/excel-utils'
import { FullScreenLoader } from '@/components/ui/full-screen-loader'

export function ExcelButtons() {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [importing, setImporting] = useState(false)
    const [exporting, setExporting] = useState(false)

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

        if (!confirm('파일을 업로드하여 데이터를 등록하시겠습니까? (파일 내 생산년도 기준)')) {
            if (fileInputRef.current) fileInputRef.current.value = ''
            return
        }

        setImporting(true)
        const formData = new FormData()
        formData.append('file', file)

        const result = await importFarmers(formData)

        if (result.success) {
            alert(formatImportResult(result))
        } else {
            alert(result.message || '업로드에 실패했습니다.')
        }

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = ''
        setImporting(false)
    }

    // Navigation Guard
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (importing || exporting) {
                e.preventDefault()
                e.returnValue = ''
                return ''
            }
        }

        if (importing || exporting) {
            window.addEventListener('beforeunload', handleBeforeUnload)
        }

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
        }
    }, [importing, exporting])

    return (
        <>
            {(importing || exporting) && <FullScreenLoader message={importing ? "데이터 업로드 및 분석 중..." : "데이터 다운로드 중..."} />}
            <div className="flex gap-1 items-center">
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
                    className="h-8 w-8 p-0 border-slate-200 bg-slate-50 text-slate-500 hover:bg-blue-100 hover:text-blue-700 hover:border-blue-400 transition-colors"
                    onClick={handleImportClick}
                    disabled={importing}
                    title="엑셀 등록"
                >
                    <Upload className="w-4 h-4" />
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 border-slate-200 bg-slate-50 text-slate-500 hover:bg-green-100 hover:text-green-700 hover:border-green-400 transition-colors"
                    onClick={handleExport}
                    disabled={exporting}
                    title="엑셀 다운로드"
                >
                    <Download className="w-4 h-4" />
                </Button>
            </div>
        </>
    )
}
