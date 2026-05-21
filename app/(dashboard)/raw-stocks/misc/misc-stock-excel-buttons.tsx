'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { exportMiscStocks, type GetMiscStocksParams } from '@/app/actions/misc-stock'
import { FullScreenLoader } from '@/components/ui/full-screen-loader'
import { toast } from 'sonner'

/**
 * 잡곡 원물재고 엑셀 다운로드 버튼 (#10).
 * 업로드는 본 단계 범위 외 (실데이터 적어 수동 등록).
 */
export function MiscStockExcelButtons({ filters }: { filters?: GetMiscStocksParams }) {
    const [exporting, setExporting] = useState(false)

    const handleExport = async () => {
        setExporting(true)
        const result = await exportMiscStocks(filters)
        if (result.success) {
            const link = document.createElement('a')
            link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.data}`
            link.download = result.fileName
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        } else {
            toast.error(result.error)
        }
        setExporting(false)
    }

    // 다운로드 중 페이지 이탈 방지
    useEffect(() => {
        if (!exporting) return
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            e.returnValue = ''
            return ''
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [exporting])

    return (
        <>
            {exporting && <FullScreenLoader message="데이터 다운로드 중..." />}
            <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 border-slate-200 bg-slate-50 text-slate-500 hover:bg-emerald-600/20 hover:text-emerald-700 hover:border-emerald-600/50 transition-colors"
                onClick={handleExport}
                disabled={exporting}
                title="엑셀 다운로드"
            >
                <Download className="w-4 h-4" />
            </Button>
        </>
    )
}
