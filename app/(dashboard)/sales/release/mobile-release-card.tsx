'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Pencil, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { EditReleaseDialog } from './edit-release-dialog'
import { removeStockFromRelease } from '@/app/actions/release'
import { triggerDataUpdate } from '@/components/last-updated'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'
import { Button } from '@/components/ui/button'

interface Stock {
    id: number
    productionYear: number
    bagNo: number
    weightKg: number
    variety: { name: string }
    farmer: { name: string; group?: { name: string } | null }
}

interface ReleaseLog {
    id: number
    date: Date
    destination: string
    purpose: string | null
    stocks: Stock[]
}

interface Props {
    log: ReleaseLog
    selected: boolean
    onSelect: (checked: boolean) => void
}

export function MobileReleaseCard({ log, selected, onSelect }: Props) {
    const [editOpen, setEditOpen] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const { data: session } = useSession()
    // @ts-ignore
    const canManage = hasPermission(session?.user, 'STOCK_MANAGE')

    const totalWeight = log.stocks.reduce((sum, s) => sum + s.weightKg, 0)

    const varietiesSummary = useMemo(() => {
        const unique = [...new Set(log.stocks.map(s => s.variety.name))]
        if (unique.length > 1) return `${unique[0]} 외 ${unique.length - 1}종`
        return unique[0] || '-'
    }, [log.stocks])

    const handleRemoveStock = async (stockId: number) => {
        if (!confirm('이 톤백을 출고 내역에서 제외하시겠습니까?')) return
        const result = await removeStockFromRelease(stockId)
        if (result.success) {
            toast.success('항목이 제외되었습니다.')
            triggerDataUpdate()
        } else {
            toast.error(result.error || '항목 제외 실패')
        }
    }

    return (
        <div>
            <div
                className={`relative rounded-xl border bg-white shadow-sm transition-all ${selected ? 'border-[#00a2e8] ring-1 ring-[#00a2e8]/20 bg-[#f0f9ff]' : 'border-slate-200'} cursor-pointer active:scale-[0.99]`}
                onClick={() => setExpanded(!expanded)}
            >
                {/* Row 1: Checkbox + Destination + Date + Edit */}
                <div className="flex items-center px-2.5 pt-2 pb-0.5">
                    <div onClick={(e) => e.stopPropagation()} className="shrink-0 mr-2 flex items-center">
                        <Checkbox
                            checked={selected}
                            onCheckedChange={onSelect}
                            className="w-4 h-4 rounded border-slate-300 data-[state=checked]:bg-[#00a2e8] data-[state=checked]:border-[#00a2e8]"
                        />
                    </div>
                    <span className="font-bold text-[13px] text-slate-900 truncate">{log.destination}</span>
                    <span className="flex-1 min-w-[0.5rem]" />
                    <span className="text-[11px] text-slate-500 font-medium shrink-0 mr-1.5">
                        {format(new Date(log.date), 'yy.MM.dd')}
                    </span>
                    {canManage && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setEditOpen(true) }}
                            className="shrink-0 p-1 text-slate-400 hover:text-[#00a2e8]"
                        >
                            <Pencil className="h-3 w-3" />
                        </button>
                    )}
                    <button className="shrink-0 p-0.5 text-slate-400 ml-0.5">
                        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                </div>

                {/* Row 2: Variety + Purpose + Count + Weight */}
                <div className="flex items-center px-2.5 pb-1.5 pt-0.5" style={{ paddingLeft: 'calc(0.625rem + 1rem + 0.5rem)' }}>
                    <span className="text-[12px] text-slate-500 truncate shrink-0">{varietiesSummary}</span>
                    {log.purpose && (
                        <span className="text-[11px] text-slate-400 truncate ml-2 max-w-[6rem]">
                            {log.purpose}
                        </span>
                    )}
                    <span className="flex-1" />
                    <div className="flex items-center ml-auto shrink-0">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-slate-200 text-slate-500 bg-slate-50 font-bold mr-1">
                            {log.stocks.length}개
                        </Badge>
                        <span className="text-[12px] font-bold text-[#8dc540] tabular-nums">
                            {totalWeight.toLocaleString()}<span className="text-[9px] font-medium text-[#8dc540]/60 ml-0.5">kg</span>
                        </span>
                    </div>
                </div>

                {/* Expanded: Stock Details */}
                {expanded && (
                    <div className="border-t border-slate-100 px-2.5 py-2 bg-slate-50/50 rounded-b-xl">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 px-0.5">상세 톤백 내역</p>
                        <div className="space-y-1">
                            {log.stocks.map(stock => (
                                <div key={stock.id} className="flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5 border border-slate-100">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <Badge variant="outline" className="font-mono text-[9px] px-1 py-0 h-3.5 border-slate-200 text-slate-500 bg-slate-50 shrink-0">
                                            {stock.bagNo}번
                                        </Badge>
                                        <span className="text-[11px] font-bold text-slate-800 shrink-0">{stock.variety.name}</span>
                                        <span className="text-[11px] text-slate-500 truncate">{stock.farmer.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[11px] font-bold text-slate-600 tabular-nums">
                                            {stock.weightKg.toLocaleString()}
                                        </span>
                                        {canManage && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleRemoveStock(stock.id) }}
                                                className="text-slate-300 hover:text-red-500 p-0.5"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <EditReleaseDialog
                release={editOpen ? log : null}
                open={editOpen}
                onOpenChange={setEditOpen}
            />
        </div>
    )
}
