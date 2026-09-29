'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { MillingStatusBadge } from '@/components/ui/milling-status-badge'
import { ArrowRight, StickyNote } from 'lucide-react'
import { AddPackagingDialog } from './add-packaging-dialog'
import { reopenMillingBatch, type MillingOutputInput } from '@/app/actions/milling'
import { MillingStockListDialog } from './stock-list-dialog'
import type { MillingLogStock } from './milling-table-row'
import { getDisplayMillingType } from '@/lib/milling-type-display'
import { triggerDataUpdate } from '@/components/last-updated'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { getYieldLevel, YIELD_BADGE_CLASS } from '@/lib/milling-yield'
import { useYieldRates } from '@/app/(dashboard)/yield-rates-context'

interface MillingBatch {
    id: number
    remarks: string | null
    millingType: string
    date: Date | string
    totalInputKg: number
    isClosed: boolean
    stocks: MillingLogStock[]
    outputs: MillingOutputInput[]
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
    const yieldRates = useYieldRates()
    const [packagingOpen, setPackagingOpen] = useState(false)
    const [stockListOpen, setStockListOpen] = useState(false)
    const [, setIsActionLoading] = useState(false)
    const { data: session } = useSession()
    const canManage = hasPermission(session?.user, 'OPERATION_MANAGE')

    const totalRiceKg = log.outputs.reduce((sum: number, o) => sum + o.totalWeight, 0)
    const yieldRate = log.totalInputKg > 0 ? (totalRiceKg / log.totalInputKg) * 100 : 0

    const varietiesSummary = useMemo(() => {
        const unique = [...new Set((log.stocks || []).map((s) => s.variety?.name || 'Unknown'))]
        if (unique.length > 1) return `${unique[0]} 외 ${unique.length - 1}종`
        return unique[0] || '-'
    }, [log.stocks])

    const varietiesFull = [...new Set((log.stocks || []).map((s) => s.variety?.name || 'Unknown'))].join(', ')
    const tonbagCount = (log.stocks || []).length

    const farmersSummary = useMemo(() => {
        const uniqueFarmers = Array.from(new Set((log.stocks || []).map((s) => s.farmer?.name).filter(Boolean)))
        if (uniqueFarmers.length > 1) return `${uniqueFarmers[0]} 외 ${uniqueFarmers.length - 1}명`
        return uniqueFarmers[0] || '-'
    }, [log.stocks])

    const classification = useMemo(() => {
        const primaryStock = log.stocks && log.stocks.length > 0 ? log.stocks[0] : null
        if (!primaryStock) return '-'
        return getDisplayMillingType(log.millingType, primaryStock.variety?.type) || '-'
    }, [log.stocks, log.millingType])

    const classStyle = getMillingTypeStyle(classification)

    // 비고는 2번째 줄 왼쪽에 앞 10자만 (백로그 §6) — 전체는 카드를 눌러 여는 투입 원물 목록에 나온다
    const remarkChars = log.remarks ? [...log.remarks.trim()] : []
    const remarkShort = remarkChars.length === 0 ? null
        : remarkChars.length > 10 ? `${remarkChars.slice(0, 10).join('')}…` : remarkChars.join('')

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
            if (await confirmDialog('마감된 작업입니다. 다시 작업하시겠습니까? (마감 해제)')) {
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
                className={`relative rounded-xl border bg-white shadow-sm transition-all ${selected ? 'border-primary ring-1 ring-primary/20 bg-blue-50' : 'border-slate-200'} cursor-pointer active:scale-[0.99]`}
                onClick={handleCardClick}
            >
                {/* Row 1: Checkbox + Variety + Classification + Farmer + Date + Status
                    생산자는 품종·도정구분 뒤 (백로그 §6). 좁으면 생산자만 말줄임 — 품종·날짜·상태는 안 줄인다 */}
                <div className="flex items-center px-2.5 pt-2 pb-0.5">
                    <div onClick={(e) => e.stopPropagation()} className="shrink-0 mr-2 flex items-center">
                        <Checkbox
                            checked={selected}
                            onCheckedChange={onSelect}
                            className="w-4 h-4 rounded border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                    </div>
                    <span className="font-bold text-[13px] text-slate-900 shrink-0">{varietiesSummary}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ml-1.5 shrink-0 whitespace-nowrap rounded-sm font-bold border ${classStyle.bg} ${classStyle.text} ${classStyle.border}`}>
                        {classification}
                    </Badge>
                    <span className="text-[12px] text-slate-500 truncate min-w-0 ml-1.5">{farmersSummary}</span>
                    <span className="flex-1 min-w-[1rem]" />
                    <span className="text-[11px] text-slate-500 font-medium shrink-0 mr-2">
                        {format(new Date(log.date), 'yy.MM.dd')}
                    </span>
                    {/* hit-area: p-1.5 -m-1.5로 시각 위치 유지하며 hit 44px 가까이 확보 */}
                    <button onClick={handleStatusClick} className="shrink-0 flex items-center cursor-pointer p-1.5 -m-1.5">
                        <MillingStatusBadge isClosed={log.isClosed} hasOutputs={(log.outputs?.length ?? 0) > 0} size="sm" />
                    </button>
                </div>

                {/* Row 2: Remarks(앞 10자) + TonbagCount + Input → Output + Yield — 비고가 있어도 2줄 고정 (백로그 §6) */}
                <div className="flex items-center px-2.5 pb-1.5 pt-0.5" style={{ paddingLeft: 'calc(0.625rem + 1rem + 0.5rem)' }}>
                    {remarkShort && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-400 min-w-0 mr-2">
                            <StickyNote className="w-3 h-3 shrink-0" strokeWidth={1.8} />
                            <span className="truncate">{remarkShort}</span>
                        </span>
                    )}
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
                                    className="text-[12px] font-bold text-primary tabular-nums underline underline-offset-2 decoration-primary/40 hover:decoration-primary"
                                >
                                    {totalRiceKg.toLocaleString()}<span className="text-[9px] font-medium text-primary/60 ml-0.5 no-underline">kg</span>
                                </button>
                                <span className={`text-[10px] px-1 ml-1 py-0 rounded-full font-bold ${YIELD_BADGE_CLASS[getYieldLevel(yieldRate, log.millingType, yieldRates, log.stocks?.[0]?.variety?.type)]}`}>
                                    {Math.round(yieldRate)}%
                                </span>
                            </>
                        ) : (
                            <span className="text-[10px] text-slate-300">-</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Dialogs */}
            <MillingStockListDialog
                batchId={log.id}
                millingType={log.millingType}
                date={log.date}
                remarks={log.remarks}
                stocks={(log.stocks || []).map((s) => ({
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
