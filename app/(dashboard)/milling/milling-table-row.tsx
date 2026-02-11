'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableRow } from '@/components/ui/table'
import { AddPackagingDialog } from './add-packaging-dialog'
import { reopenMillingBatch } from '@/app/actions/milling'
import { MillingStockListDialog } from './stock-list-dialog'
import { triggerDataUpdate } from '@/components/last-updated'

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
    selected: boolean
    onSelect: (checked: boolean) => void
}

export function MillingTableRow({ log, selected, onSelect }: Props) {
    const [packagingOpen, setPackagingOpen] = useState(false)
    const [isActionLoading, setIsActionLoading] = useState(false)

    const totalRiceKg = log.outputs.reduce((sum: number, o: any) => sum + o.totalWeight, 0)
    const yieldRate = log.totalInputKg > 0 ? (totalRiceKg / log.totalInputKg) * 100 : 0
    const varieties = [...new Set((log.stocks || []).map((s: any) => s.variety?.name || 'Unknown'))].join(', ')
    const tonbagCount = (log.stocks || []).length

    const handleRowClick = async () => {
        if (log.isClosed) {
            if (confirm('마감된 작업입니다. 다시 작업하시겠습니까? (마감 해제)')) {
                setIsActionLoading(true)
                const result = await reopenMillingBatch(log.id)
                setIsActionLoading(false)

                if (result.success) {
                    triggerDataUpdate()
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
                className="group hover:bg-blue-50/50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                onClick={handleRowClick}
            >
                {/* Checkbox */}
                <TableCell className="py-4 px-3 w-[50px] text-center">
                    <Checkbox
                        checked={selected}
                        onCheckedChange={onSelect}
                        onClick={(e) => e.stopPropagation()}
                    />
                </TableCell>

                {/* 1. Date */}
                <TableCell className="py-4 px-3 text-center text-sm font-mono font-medium text-slate-500 w-[100px] tracking-tight">
                    {new Date(log.date).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace('.', '')}
                </TableCell>

                {/* 2. Status - Clickable for Packaging/Edit */}
                <TableCell className="py-4 px-3 text-center w-[80px]">
                    <div className="inline-block">
                        {log.isClosed ? (
                            <Badge variant="outline" className="text-xs px-2 py-0.5 border-slate-200 text-slate-500 hover:bg-slate-100 font-medium">마감</Badge>
                        ) : (
                            <Badge variant="default" className="text-xs px-2 py-0.5 bg-blue-500 hover:bg-blue-600 animate-pulse font-bold">진행</Badge>
                        )}
                    </div>
                </TableCell>

                {/* 3. Variety - Clickable for Input History */}
                <TableCell className="py-4 px-3 text-sm font-bold text-slate-800 md:w-[220px]">
                    <div className="flex items-center gap-2">
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
                                <div className="group hover:text-blue-600 hover:underline cursor-pointer flex items-center gap-1.5" title={varieties} onClick={(e) => e.stopPropagation()}>
                                    <span className="font-bold text-slate-900 line-clamp-1 break-all">
                                        {varieties}
                                    </span>
                                </div>
                            }
                        />
                    </div>
                </TableCell>

                {/* 4. Tonbag Count */}
                <TableCell className="py-4 px-3 text-right text-sm font-mono text-slate-500 w-[80px]">
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-bold text-slate-600 mr-1">{tonbagCount}</span>
                    <span className="text-xs text-slate-400">백</span>
                </TableCell>

                {/* 5. Input Weight */}
                <TableCell className="py-4 px-3 text-right text-sm font-bold text-slate-700 w-[100px]">
                    {log.totalInputKg.toLocaleString()}
                </TableCell>

                {/* 6. Output Weight */}
                <TableCell className="py-4 px-3 text-right text-sm font-bold text-blue-600 w-[100px]">
                    {totalRiceKg > 0 ? totalRiceKg.toLocaleString() : <span className="text-slate-300">-</span>}
                </TableCell>

                {/* 7. Yield */}
                <TableCell className="py-4 px-3 text-center text-sm font-mono font-bold w-[80px]">
                    {totalRiceKg > 0 ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs ${yieldRate >= 70 ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'}`}>
                            {Math.round(yieldRate)}%
                        </span>
                    ) : <span className="text-slate-300">-</span>}
                </TableCell>

                {/* 8. Remarks (Truncated on mobile, Full on PC) */}
                <TableCell className="py-4 px-3 text-left text-sm text-slate-500 md:max-w-[300px]">
                    <div className="line-clamp-1 text-slate-400" title={log.remarks || ''}>
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
