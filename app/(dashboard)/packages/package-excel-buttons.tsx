'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { exportPackages, type GetPackagesParams } from '@/app/actions/packages'
import { FullScreenLoader } from '@/components/ui/full-screen-loader'
import { toast } from 'sonner'

/**
 * 제품재고 엑셀 다운로드 버튼 (#10).
 * 벼/잡곡 양쪽 패널에서 동일 컴포넌트 사용. category prop으로 분기.
 * 업로드는 본 단계 범위 외.
 */
export function PackageExcelButtons({ filters }: { filters: GetPackagesParams }) {
    const [exporting, setExporting] = useState(false)

    const handleExport = async () => {
        setExporting(true)
        const result = await exportPackages(filters)
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
                className="h-8 w-8 p-0 border-slate-200 bg-slate-50 text-slate-500 hover:bg-[#8dc540]/20 hover:text-[#7db037] hover:border-[#8dc540]/50 transition-colors"
                onClick={handleExport}
                disabled={exporting}
                title="엑셀 다운로드"
            >
                <Download className="w-4 h-4" />
            </Button>
        </>
    )
}
