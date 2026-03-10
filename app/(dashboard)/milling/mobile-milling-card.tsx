'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
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

export function MobileMillingCard({ log, selected, onSelect }: Props) {
    const [packagingOpen, setPackagingOpen] = useState(false)
    const [stockListOpen, setStockListOpen] = useState(false)
    const [isActionLoading, setIsActionLoading] = useState(false)
    const { data: session } = useSession()
    // @ts-ignore
    const canManage = hasPermission(session?.user, 'MILLING_MANAGE')

    const totalRiceKg = log.outputs.reduce((sum: number, o: any) => sum + o.totalWeight, 0)
    const yieldRate = log.totalInputKg > 0 ? (totalRiceKg / log.totalInputKg) * 100 : 0

    const varietiesSummary = useMemo(() => {
        const unique = [...new Set((log.stocks || []).map((s: any) => s.variety?.name || 'Unknown'))]
        if (unique.length > 1) return `${unique[0]} 외 ${unique.length - 1}종`
        return unique[0] || '-'
    }, [log.stocks])

    const varietiesFull = [...new Set((log.stocks || []).map((s: any) => s.variety?.name || 'Unknown'))].join(', ')
    const tonbagCount = (log.stocks || []).length

    const farmersSummary = useMemo(() => {
        const uniqueFarmers = Array.from(new Set((log.stocks || []).map((s: any) => s.farmer?.name).filter(Boolean)))
        if (uniqueFarmers.length > 1) return `${uniqueFarmers[0]} 외 ${uniqueFarmers.length - 1}명`
        return uniqueFarmers[0] || '-'
    }, [log.stocks])

    const classification = useMemo(() => {
        const primaryStock = log.stocks && log.stocks.length > 0 ? log.stocks[0] : null
        if (!primaryStock) return '-'
        const varietyType = primaryStock.variety?.type
        const millingType = log.millingType
        if (varietyType === 'GLUTINOUS') {
            if (millingType === '백미') return '찹쌀'
            if (millingType === '현미') return '찰현미'
            return millingType
        }
        return millingType || '-'
    }, [log.stocks, log.millingType])

    const handleCardClick = () => {
        setStockListOpen(true)
    }

    const handleStatusClick = async (e: React.MouseEvent) => {
        e.stopPropagation()
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
            <div
                className={`relative rounded-xl border bg-white shadow-sm transition-all ${selected ? 'border-[#00a2e8] ring-1 ring-[#00a2e8]/20 bg-[#f0f9ff]' : 'border-slate-200'} cursor-pointer active:scale-[0.99]`}
                onClick={handleCardClick}
            >
                {/* Row 1: Checkbox + Variety + Classification + Date */}
                <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
                    <div className="flex items-center gap-2 min-w-0">
                        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                            <Checkbox
                                checked={selected}
                                onCheckedChange={onSelect}
                                className="w-4.5 h-4.5 rounded-md border-slate-300 data-[state=checked]:bg-[#00a2e8] data-[state=checked]:border-[#00a2e8]"
                            />
                        </div>
                        <span className="font-bold text-[14px] text-slate-900 truncate">{varietiesSummary}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-[#00a2e8]/30 text-[#00a2e8] bg-[#00a2e8]/5 shrink-0 whitespace-nowrap rounded-sm font-bold">
                            {classification}
                        </Badge>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono shrink-0 ml-2">
                        {format(new Date(log.date), 'yy.MM.dd')}
                    </span>
                </div>

                {/* Row 2: Farmer + Tonbag + Input Weight */}
                <div className="flex items-center justify-between px-3 py-0.5 pl-[2.75rem]">
                    <span className="text-[12px] text-slate-600 truncate">{farmersSummary}</span>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-400">
                            <span className="bg-slate-100 px-1 py-0.5 rounded text-[10px] font-bold text-slate-500">{tonbagCount}</span>
                            <span className="ml-0.5">백</span>
                        </span>
                        <span className="text-[13px] font-bold text-slate-700">
                            {log.totalInputKg.toLocaleString()}<span className="text-[10px] text-slate-400 ml-0.5">kg</span>
                        </span>
                    </div>
                </div>

                {/* Row 3: Output + Yield + Status Badge */}
                <div className="flex items-center justify-between px-3 pb-2.5 pt-1 pl-[2.75rem]">
                    <div className="flex items-center gap-2">
                        {totalRiceKg > 0 ? (
                            <>
                                <span className="text-[12px] text-slate-500">
                                    생산 <span className="font-bold text-[#00a2e8]">{totalRiceKg.toLocaleString()}</span><span className="text-[10px] ml-0.5">kg</span>
                                </span>
                                <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${yieldRate >= 70 ? 'bg-[#00a2e8]/10 text-[#00a2e8]' : yieldRate >= 60 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                                    {Math.round(yieldRate)}%
                                </span>
                            </>
                        ) : (
                            <span className="text-[11px] text-slate-300">생산 미입력</span>
                        )}
                    </div>
                    <button onClick={handleStatusClick} className="transition-transform hover:scale-105 active:scale-95">
                        {log.isClosed ? (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-[#8dc540]/30 text-[#7db037] hover:bg-[#8dc540]/10 font-bold cursor-pointer">마감</Badge>
                        ) : (
                            <Badge variant="default" className="text-[10px] px-2 py-0.5 bg-[#00a2e8] hover:bg-[#00a2e8] animate-pulse font-bold cursor-pointer">포장</Badge>
                        )}
                    </button>
                </div>

                {/* Remarks indicator */}
                {log.remarks && (
                    <div className="px-3 pb-2 pl-[2.75rem]">
                        <span className="text-[10px] text-slate-400 line-clamp-1">📝 {log.remarks}</span>
                    </div>
                )}
            </div>

            {/* Dialogs */}
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
                canDelete={!log.isClosed && canManage}
                open={stockListOpen}
                onOpenChange={setStockListOpen}
            />

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
