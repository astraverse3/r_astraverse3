'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { exportReleaseLogs } from '@/app/actions/release-excel'
import { FullScreenLoader } from '@/components/ui/full-screen-loader'
import { toast } from 'sonner'

export function ReleaseExcelButton({ filters }: { filters?: { startDate?: Date; endDate?: Date; keyword?: string } }) {
    const [exporting, setExporting] = useState(false)

    const handleExport = async () => {
        setExporting(true)
        const result = await exportReleaseLogs(filters)

        if (result.success && result.daa) {
            const base64Data = result.daa
            const link = document.createElement('a')
            link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64Data}`
            link.download = result.fileName || 'release_logs.xlsx'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        } else {
            toast.error(result.error)
        }
        setExporting(false)
    }

    // Navigation Guard (Prevent Tab Close)
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (exporting) {
                e.preventDefault()
                e.returnValue = '' // Chrome requires returnValue to be set
                return ''
            }
        }

        if (exporting) {
            window.addEventListener('beforeunload', handleBeforeUnload)
        }

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
        }
    }, [exporting])

    return (
        <>
            {exporting && <FullScreenLoader message="데이터 다운로드 중..." />}
            <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 border-slate-200 bg-slate-50 text-slate-500 hover:bg-green-100 hover:text-green-700 hover:border-green-400 transition-colors shrink-0"
                onClick={handleExport}
                disabled={exporting}
                title="엑셀 다운로드"
            >
                <Download className="w-4 h-4" />
            </Button>
        </>
    )
}
