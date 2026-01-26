'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { MoreHorizontal, Lock, Package, AlertCircle, Trash2, Info } from 'lucide-react'
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
    const varieties = [...new Set((log.stocks || []).map((s: any) => s.variety))].join(', ')
    const tonbagCount = (log.stocks || []).length

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

    const handleCloseBatch = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('정말 마감하시겠습니까? 마감된 기록은 더 이상 수정할 수 없습니다.')) return

        setIsActionLoading(true)
        const result = await closeMillingBatch(log.id)
        setIsActionLoading(false)

        if (!result.success) {
            alert(result.error || '마감 실패')
        }
    }

    const handleDeleteBatch = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('정말 삭제하시겠습니까? 투입된 재고는 [보관중] 상태로 복구됩니다.')) return

        setIsActionLoading(true)
        const result = await deleteMillingBatch(log.id)
        setIsActionLoading(false)

        if (!result.success) {
            alert(result.error || '삭제 실패')
        }
    }

    return (
        <>
            <TableRow
                className="group hover:bg-blue-50/50 cursor-pointer transition-colors border-b border-slate-100 last:border-0"
                onClick={handleRowClick}
            >
                {/* 1. Date */}
                <TableCell className="py-2 px-2 text-center text-xs font-mono font-medium text-slate-500 w-[60px]">
                    {new Date(log.date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                </TableCell>

                {/* 2. Status */}
                <TableCell className="py-2 px-2 text-center w-[50px]">
                    {log.isClosed ? (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-slate-200 text-slate-400">마감</Badge>
                    ) : (
                        <Badge variant="default" className="text-[10px] px-1 py-0 bg-blue-500 hover:bg-blue-600 animate-pulse">진행</Badge>
                    )}
                </TableCell>

                {/* 3. Variety (Previously Title/Variety mixed) */}
                <TableCell className="py-2 px-2 text-xs font-bold text-slate-800 w-[100px]">
                    <div className="flex items-center gap-1">
                        <span className="truncate max-w-[90px]">{varieties}</span>
                        {/* Small info icon for stock list details */}
                        <MillingStockListDialog
                            stocks={log.stocks || []}
                            varieties={varieties}
                            trigger={<Info className="h-3 w-3 text-slate-300 hover:text-blue-500 transition-colors" />}
                        />
                    </div>
                </TableCell>

                {/* 4. Tonbag Count */}
                <TableCell className="py-2 px-2 text-right text-xs font-mono text-slate-400">
                    {tonbagCount}백
                </TableCell>

                {/* 5. Input Weight */}
                <TableCell className="py-2 px-2 text-right text-xs font-bold text-slate-600">
                    {log.totalInputKg.toLocaleString()}
                </TableCell>

                {/* 6. Output Weight */}
                <TableCell className="py-2 px-2 text-right text-xs font-bold text-blue-600">
                    {totalRiceKg > 0 ? totalRiceKg.toLocaleString() : '-'}
                </TableCell>

                {/* 7. Yield */}
                <TableCell className="py-2 px-2 text-center text-xs font-mono font-bold text-slate-500">
                    {totalRiceKg > 0 ? `${Math.round(yieldRate)}%` : '-'}
                </TableCell>

                {/* 8. Remarks (Title) */}
                <TableCell className="py-2 px-2 text-left text-xs text-slate-400 truncate max-w-[120px]">
                    {log.title}
                </TableCell>

                {/* 9. Actions */}
                <TableCell className="py-2 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300 hover:text-slate-600">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel className="text-xs">관리 메뉴</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setPackagingOpen(true)} className="gap-2 text-xs">
                                <Package className="h-3.5 w-3.5" />
                                포장 관리
                            </DropdownMenuItem>
                            {!log.isClosed && (
                                <>
                                    <DropdownMenuItem onClick={handleCloseBatch} className="gap-2 text-xs text-amber-600 focus:text-amber-700 focus:bg-amber-50">
                                        <Lock className="h-3.5 w-3.5" />
                                        작업 마감
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleDeleteBatch} className="gap-2 text-xs text-red-600 focus:text-red-700 focus:bg-red-50">
                                        <Trash2 className="h-3.5 w-3.5" />
                                        작업 삭제
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
            </TableRow>

            <AddPackagingDialog
                batchId={log.id}
                batchTitle={log.title}
                isClosed={log.isClosed}
                initialOutputs={log.outputs}
                open={packagingOpen}
                onOpenChange={setPackagingOpen}
                trigger={<></>}
            />
        </>
    )
}
