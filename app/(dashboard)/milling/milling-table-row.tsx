'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { MoreHorizontal, Lock, Package, AlertCircle, Trash2 } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { AddPackagingDialog } from './add-packaging-dialog'
import { closeMillingBatch, reopenMillingBatch, deleteMillingBatch } from '@/app/actions/milling'
import { MillingStockListDialog } from './stock-list-dialog'

interface MillingBatch {
    id: number
    title: string
    remarks: string | null
    millingType: string
    date: Date
    totalInputKg: number
    isClosed: boolean
    stocks: any[]
    outputs: any[]
}

interface Props {
    log: MillingBatch
}

export function MillingTableRow({ log }: Props) {
    const [packagingOpen, setPackagingOpen] = useState(false)
    const [isActionLoading, setIsActionLoading] = useState(false)

    const totalRiceKg = log.outputs.reduce((sum: number, o: any) => sum + o.totalWeight, 0)
    const yieldRate = log.totalInputKg > 0 ? (totalRiceKg / log.totalInputKg) * 100 : 0
    const varieties = [...new Set((log.stocks || []).map((s: any) => s.variety?.name || 'Unknown'))].join(', ')
    const tonbagCount = (log.stocks || []).length

    // Determine display remarks (Hide '백미')
    const displayRemarks = log.millingType === '백미' || !log.millingType
        ? log.title
        : `${log.millingType} / ${log.title}`

    const handleRowClick = async () => {
        if (log.isClosed) {
            if (confirm('마감된 작업입니다. 다시 작업하시겠습니까? (마감 해제)')) {
                setIsActionLoading(true)
                const result = await reopenMillingBatch(log.id)
                setIsActionLoading(false)

                if (result.success) {
                    setPackagingOpen(true)
                } else {
                    alert(result.error || '마감 해제 실패')
                }
            }
        } else {
            setPackagingOpen(true)
        }
    }

    return (
        <>
            <TableRow
                className="group hover:bg-blue-50/50 transition-colors border-b border-slate-100 last:border-0"
            >
                {/* 1. Date */}
                <TableCell className="py-2 px-2 text-center text-xs font-mono font-medium text-slate-500 w-[50px] tracking-tighter">
                    {new Date(log.date).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }).replace(/\. /g, '').replace('.', '')}
                </TableCell>

                {/* 2. Status - Clickable for Packaging/Edit */}
                <TableCell className="py-2 px-1 text-center w-[40px]">
                    <div onClick={handleRowClick} className="cursor-pointer inline-block">
                        {log.isClosed ? (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-slate-200 text-slate-400 hover:bg-slate-100">마감</Badge>
                        ) : (
                            <Badge variant="default" className="text-[10px] px-1 py-0 bg-blue-500 hover:bg-blue-600 animate-pulse">진행</Badge>
                        )}
                    </div>
                </TableCell>

                {/* 3. Variety - Clickable for Input History */}
                {/* 3. Variety - Clickable for Input History */}
                <TableCell className="py-2 px-1 text-xs font-bold text-slate-800 max-w-[50px] md:max-w-[200px]">
                    <MillingStockListDialog
                        batchId={log.id}
                        stocks={(log.stocks || []).map((s: any) => ({
                            id: s.id,
                            bagNo: s.bagNo,
                            weightKg: s.weightKg,
                            farmerName: s.farmer?.name || 'Unknown',
                            variety: s.variety?.name || 'Unknown',
                            certType: s.farmer?.group?.certType || 'Unknown'
                        }))}
                        varieties={varieties}
                        canDelete={log.outputs.length === 0}
                        trigger={
                            <div className="group cursor-pointer hover:text-blue-600 hover:underline" title={varieties}>
                                <span className="md:hidden">
                                    {varieties.length > 4 ? `${varieties.slice(0, 4)}..` : varieties}
                                </span>
                                <span className="hidden md:inline truncate block">
                                    {varieties}
                                </span>
                            </div>
                        }
                    />
                </TableCell>

                {/* 4. Tonbag Count */}
                <TableCell className="py-2 px-1 text-right text-xs font-mono text-slate-400">
                    {tonbagCount}백
                </TableCell>

                {/* 5. Input Weight */}
                <TableCell className="py-2 px-1 text-right text-xs font-bold text-slate-600">
                    {log.totalInputKg.toLocaleString()}
                </TableCell>

                {/* 6. Output Weight */}
                <TableCell className="py-2 px-1 text-right text-xs font-bold text-blue-600">
                    {totalRiceKg > 0 ? totalRiceKg.toLocaleString() : '-'}
                </TableCell>

                {/* 7. Yield */}
                <TableCell className="py-2 px-1 text-center text-xs font-mono font-bold text-slate-500">
                    {totalRiceKg > 0 ? `${Math.round(yieldRate)}%` : '-'}
                </TableCell>

                {/* 8. Remarks (Truncated on mobile, Full on PC) */}
                <TableCell className="py-2 px-1 text-left text-xs text-slate-400 max-w-[50px] md:max-w-[300px]">
                    <div className="truncate md:truncate block" title={log.remarks || ''}>
                        {log.remarks || '-'}
                    </div>
                </TableCell>
            </TableRow>

            <AddPackagingDialog
                batchId={log.id}
                millingType={log.millingType}
                totalInputKg={log.totalInputKg}
                isClosed={log.isClosed}
                initialOutputs={log.outputs}
                open={packagingOpen}
                onOpenChange={setPackagingOpen}
                trigger={<></>}
            />
        </>
    )
}
