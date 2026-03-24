'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ArrowRight } from 'lucide-react'
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

// Milling type badge color map
const millingTypeColors: Record<string, { bg: string; text: string; border: string }> = {
    '백미': { bg: 'bg-white', text: 'text-slate-600', border: 'border-slate-300' },
    '현미': { bg: 'bg-amber-800/10', text: 'text-amber-800', border: 'border-amber-800/30' },
    '칠분도미': { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-300' },
    '오분도미': { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-300' },
    '찹쌀': { bg: 'bg-white', text: 'text-slate-600', border: 'border-slate-300' },
    '기타': { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-300' },
}

function getMillingTypeStyle(type: string) {
    return millingTypeColors[type] || millingTypeColors['기타']
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

    const classStyle = getMillingTypeStyle(classification)

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
        <div>
            <div
                className={`relative rounded-xl border bg-white shadow-sm transition-all ${selected ? 'border-[#00a2e8] ring-1 ring-[#00a2e8]/20 bg-[#f0f9ff]' : 'border-slate-200'} cursor-pointer active:scale-[0.99]`}
                onClick={handleCardClick}
            >
                {/* Row 1: Checkbox + Variety + Classification + Date + Status */}
                <div className="flex items-center px-2.5 pt-2 pb-0.5">
                    <div onClick={(e) => e.stopPropagation()} className="shrink-0 mr-2 flex items-center">
                        <Checkbox
                            checked={selected}
                            onCheckedChange={onSelect}
                            className="w-4 h-4 rounded border-slate-300 data-[state=checked]:bg-[#00a2e8] data-[state=checked]:border-[#00a2e8]"
                        />
                    </div>
                    <span className="font-bold text-[13px] text-slate-900 shrink-0">{varietiesSummary}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ml-1.5 shrink-0 whitespace-nowrap rounded-sm font-bold border ${classStyle.bg} ${classStyle.text} ${classStyle.border}`}>
                        {classification}
                    </Badge>
                    <span className="flex-1 min-w-[1rem]" />
                    <span className="text-[11px] text-slate-500 font-medium shrink-0 mr-2">
                        {format(new Date(log.date), 'yy.MM.dd')}
                    </span>
                    <button onClick={handleStatusClick} className="shrink-0 flex items-center">
                        {log.isClosed ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-[18px] leading-none border-[#8dc540]/30 text-[#7db037] hover:bg-[#8dc540]/10 font-bold cursor-pointer">마감</Badge>
                        ) : (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-[18px] leading-none bg-[#00a2e8] hover:bg-[#00a2e8] animate-pulse font-bold cursor-pointer">포장</Badge>
                        )}
                    </button>
                </div>

                {/* Row 2: Farmer + TonbagCount + Input → Output + Yield */}
                <div className="flex items-center px-2.5 pb-1.5 pt-0.5" style={{ paddingLeft: 'calc(0.625rem + 1rem + 0.5rem)' }}>
                    <span className="text-[12px] text-slate-500 truncate shrink-0 min-w-[3.5rem]">{farmersSummary}</span>
                    <span className="flex-1" />
                    <div className="flex items-center ml-auto shrink-0">
                        <span className="text-[10px] text-slate-400 shrink-0 mr-1">
                            <span className="bg-slate-100 px-1 py-0.5 rounded font-bold text-slate-500">{tonbagCount}</span>백
                        </span>
                        <span className="text-[12px] font-bold text-slate-700 tabular-nums text-right">
                            {log.totalInputKg.toLocaleString()}<span className="text-[9px] font-medium text-slate-400 ml-0.5">kg</span>
                        </span>
                        <ArrowRight className="h-3 w-3 text-slate-300 shrink-0 mx-1" />
                        {totalRiceKg > 0 ? (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setPackagingOpen(true) }}
                                    className="text-[12px] font-bold text-[#00a2e8] tabular-nums underline underline-offset-2 decoration-[#00a2e8]/40 hover:decoration-[#00a2e8]"
                                >
                                    {totalRiceKg.toLocaleString()}<span className="text-[9px] font-medium text-[#00a2e8]/60 ml-0.5 no-underline">kg</span>
                                </button>
                                <span className={`text-[10px] px-1 ml-1 py-0 rounded-full font-bold ${yieldRate >= 70 ? 'bg-[#00a2e8]/10 text-[#00a2e8]' : yieldRate >= 60 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                                    {Math.round(yieldRate)}%
                                </span>
                            </>
                        ) : (
                            <span className="text-[10px] text-slate-300">-</span>
                        )}
                    </div>
                </div>

                {/* Row 3: Remarks (optional) */}
                {log.remarks && (
                    <div className="px-2.5 pb-1.5" style={{ paddingLeft: 'calc(0.625rem + 1rem + 0.5rem)' }}>
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
                stocks={log.stocks}
                open={packagingOpen}
                onOpenChange={setPackagingOpen}
                trigger={<></>}
            />
        </div>
    )
}
