'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableRow } from '@/components/ui/table'
import { AddPackagingDialog } from './add-packaging-dialog'
import { reopenMillingBatch } from '@/app/actions/milling'
import { MillingStockListDialog } from './stock-list-dialog'
import { triggerDataUpdate } from '@/components/last-updated'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'

interface MillingBatch {
    id: number
    title: string
    remarks: string | null
    millingType: string
    date: Date | string
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
    const [stockListOpen, setStockListOpen] = useState(false)
    const [isActionLoading, setIsActionLoading] = useState(false)
    const { data: session } = useSession()
    // @ts-ignore
    const canManage = hasPermission(session?.user, 'MILLING_MANAGE')

    const totalRiceKg = log.outputs.reduce((sum: number, o: any) => sum + o.totalWeight, 0)
    const yieldRate = log.totalInputKg > 0 ? (totalRiceKg / log.totalInputKg) * 100 : 0
    const varietiesFull = [...new Set((log.stocks || []).map((s: any) => s.variety?.name || 'Unknown'))].join(', ')
    const varietiesSummary = useMemo(() => {
        const unique = [...new Set((log.stocks || []).map((s: any) => s.variety?.name || 'Unknown'))]
        if (unique.length > 1) {
            return `${unique[0]} 외 ${unique.length - 1}종`
        }
        return unique[0] || '-'
    }, [log.stocks])

    const tonbagCount = (log.stocks || []).length

    // Get unique farmers
    const farmersFull = Array.from(new Set((log.stocks || []).map((s: any) => s.farmer?.name).filter(Boolean))).join(', ')
    const farmersSummary = useMemo(() => {
        const uniqueFarmers = Array.from(new Set((log.stocks || []).map((s: any) => s.farmer?.name).filter(Boolean)));
        if (uniqueFarmers.length > 1) {
            return `${uniqueFarmers[0]} 외 ${uniqueFarmers.length - 1}명`
        }
        return uniqueFarmers[0] || '-'
    }, [log.stocks])

    // Determine Classification (구분)
    const classification = useMemo(() => {
        const primaryStock = log.stocks && log.stocks.length > 0 ? log.stocks[0] : null;
        if (!primaryStock) return '-';

        const varietyType = primaryStock.variety?.type;
        const varietyName = primaryStock.variety?.name;
        const millingType = log.millingType;

        if (varietyType === 'URUCHI') {
            return millingType; // 백미 or 현미
        } else if (varietyType === 'GLUTINOUS') {
            if (millingType === '백미') return '찹쌀';
            if (millingType === '현미') return '찰현미';
            return millingType;
        } else if (varietyType === 'INDICA') {
            return '인디카';
        } else {
            return varietyName || '-'; // Other -> Variety Name
        }
    }, [log.stocks, log.millingType])

    // Row Click -> Open Input History (Stock List)
    const handleRowClick = () => {
        setStockListOpen(true)
    }

    // Status Click -> Packaging / Reopen
    const handleStatusClick = async (e: React.MouseEvent) => {
        e.stopPropagation() // Prevent row click

        if (log.isClosed) {
            if (!canManage) {
                setPackagingOpen(true)
                return
            }

            if (confirm('마감된 작업입니다. 다시 작업하시겠습니까? (마감 해제)')) {
                setIsActionLoading(true)
                const result = await reopenMillingBatch(log.id)
                setIsActionLoading(false)

                if (result.success) {
                    triggerDataUpdate()
                    setPackagingOpen(true)
                } else {
                    toast.error(result.error || '마감 해제 실패')
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
                <TableCell className="py-3 px-3 w-[50px] text-center">
                    <Checkbox
                        checked={selected}
                        onCheckedChange={onSelect}
                        onClick={(e) => e.stopPropagation()}
                    />
                </TableCell>

                {/* 1. Date (yyMMdd) */}
                <TableCell className="py-3 px-3 text-center text-sm font-mono font-medium text-slate-500 w-[90px] tracking-tight">
                    {format(new Date(log.date), 'yyMMdd')}
                </TableCell>

                {/* 2. Variety - Clickable for Input History */}
                <TableCell className="py-3 px-3 text-sm font-bold text-slate-800 md:w-[140px]">
                    <div className="flex items-center gap-2">
                        <div className="group hover:text-blue-600 hover:underline cursor-pointer flex items-center gap-1.5" title={varietiesFull}>
                            <span className="font-bold text-slate-900 line-clamp-1 break-all">
                                {varietiesSummary}
                            </span>
                        </div>
                    </div>
                </TableCell>

                {/* 3. Producer */}
                <TableCell className="py-3 px-3 text-sm text-slate-600 md:w-[100px] truncate" title={farmersFull}>
                    {farmersSummary}
                </TableCell>

                {/* 4. Classification */}
                <TableCell className="py-3 px-3 text-center text-sm font-bold text-slate-700 w-[80px]">
                    {classification}
                </TableCell>

                {/* 5. Tonbag Count */}
                <TableCell className="py-3 px-3 text-right text-sm font-mono text-slate-500 w-[70px]">
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-bold text-slate-600 mr-1">{tonbagCount}</span>
                    <span className="text-xs text-slate-400">백</span>
                </TableCell>

                {/* 6. Input Weight */}
                <TableCell className="py-3 px-3 text-right text-sm font-bold text-slate-700 w-[90px]">
                    {log.totalInputKg.toLocaleString()}
                </TableCell>

                {/* 7. Output Weight - Clickable to open packaging */}
                <TableCell className="py-3 px-3 text-right text-sm font-bold text-blue-600 w-[90px]">
                    <span
                        className="cursor-pointer underline decoration-dashed decoration-blue-300 underline-offset-2 hover:decoration-blue-500 hover:text-blue-700 transition-colors"
                        onClick={(e) => { e.stopPropagation(); setPackagingOpen(true) }}
                        title="포장 내역 보기"
                    >
                        {totalRiceKg > 0 ? totalRiceKg.toLocaleString() : <span className="text-slate-300 no-underline">-</span>}
                    </span>
                </TableCell>

                {/* 8. Yield */}
                <TableCell className="py-3 px-3 text-center text-sm font-mono font-bold w-[60px]">
                    {totalRiceKg > 0 ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs ${yieldRate >= 70 ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'}`}>
                            {Math.round(yieldRate)}%
                        </span>
                    ) : <span className="text-slate-300">-</span>}
                </TableCell>

                {/* 9. Remarks (Truncated on mobile, Full on PC) */}
                <TableCell className="py-3 px-3 text-left text-sm text-slate-500 md:max-w-[300px]">
                    <div className="line-clamp-1 text-slate-400" title={log.remarks || ''}>
                        {log.remarks || '-'}
                    </div>
                </TableCell>

                {/* 10. Status - Clickable for Packaging */}
                <TableCell className="py-3 px-3 text-center w-[60px]">
                    <button onClick={handleStatusClick} className="inline-block transition-transform hover:scale-105 active:scale-95">
                        {log.isClosed ? (
                            <Badge variant="outline" className="text-xs px-2 py-0.5 border-slate-200 text-slate-500 hover:bg-slate-100 font-medium cursor-pointer">마감</Badge>
                        ) : (
                            <Badge variant="default" className="text-xs px-2 py-0.5 bg-blue-500 hover:bg-blue-600 hover:bg-blue-600 animate-pulse font-bold cursor-pointer">포장</Badge>
                        )}
                    </button>
                </TableCell>
            </TableRow>

            {/* Input History Dialog (Controlled) */}
            <MillingStockListDialog
                batchId={log.id}
                millingType={log.millingType}
                date={log.date}
                remarks={log.remarks}
                stocks={(log.stocks || []).map((s: any) => ({
                    id: s.id,
                    bagNo: s.bagNo,
                    weightKg: s.weightKg,
                    farmerName: s.farmer?.name || 'Unknown',
                    variety: {
                        name: s.variety?.name || 'Unknown',
                        type: s.variety?.type || 'UNKNOWN'
                    },
                    certType: s.farmer?.group?.certType || 'Unknown'
                }))}
                varieties={varietiesFull}
                canDelete={!log.isClosed}
                open={stockListOpen}
                onOpenChange={setStockListOpen}
            />

            {/* Packaging Dialog */}
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
