'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { exportStatsRows, type StatsExcelRow } from '@/app/actions/stats-excel'

type Props = {
    /** 다운로드할 행 배열을 반환. 비어있어도 헤더 포함된 파일이 생성됨 */
    getRows: () => StatsExcelRow[]
    sheetName: string
    fileNamePrefix: string
    title?: string
    disabled?: boolean
}

export function StatsExcelButton({
    getRows,
    sheetName,
    fileNamePrefix,
    title = '엑셀 다운로드',
    disabled,
}: Props) {
    const [exporting, setExporting] = useState(false)

    async function handleClick() {
        setExporting(true)
        try {
            const rows = getRows()
            const result = await exportStatsRows(rows, sheetName, fileNamePrefix)
            if (result.success && result.data) {
                const link = document.createElement('a')
                link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.data}`
                link.download = result.fileName
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
            } else if (!result.success) {
                toast.error(result.error)
            }
        } catch {
            toast.error('엑셀 다운로드에 실패했습니다.')
        } finally {
            setExporting(false)
        }
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={disabled || exporting}
            title={title}
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-[#8dc540]/20 hover:text-[#7db037] hover:border-[#8dc540]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <Download className="w-4 h-4" />
        </button>
    )
}
