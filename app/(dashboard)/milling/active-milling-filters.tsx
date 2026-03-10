'use client'

import { useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

interface ActiveMillingFiltersProps {
    totalCount: number
    defaultStartDate?: Date | string
    defaultEndDate?: Date | string
}

export function ActiveMillingFilters({ totalCount, defaultStartDate, defaultEndDate }: ActiveMillingFiltersProps) {
    const searchParams = useSearchParams()

    const status = searchParams.get('status') || 'ALL'
    const variety = searchParams.get('variety') || 'ALL'
    const millingType = searchParams.get('millingType') || 'ALL'
    const keyword = searchParams.get('keyword') || ''
    const farmerName = searchParams.get('farmerName') || ''
    const yieldRate = searchParams.get('yieldRate') || 'ALL'

    const statusLabel = status === 'open' ? '진행중' : status === 'closed' ? '마감' : null

    // Date from URL or fallback to server-side defaults
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')

    const startDate = startDateStr ? new Date(startDateStr) : (defaultStartDate ? new Date(defaultStartDate) : null)
    const endDate = endDateStr ? new Date(endDateStr) : (defaultEndDate ? new Date(defaultEndDate) : null)

    const dateLabel = startDate && endDate
        ? `${format(startDate, 'MM.dd')}~${format(endDate, 'MM.dd')}`
        : null

    return (
        <div className="flex items-center justify-between gap-2 overflow-x-auto py-1 px-1 scrollbar-hide">
            <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap shrink-0">
                검색결과 <span className="font-bold text-slate-700">{totalCount}</span>건
            </span>
            <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                {dateLabel && <Badge variant="outline" className="whitespace-nowrap bg-transparent text-[10px] px-1.5 py-0 text-slate-500 border-slate-200 font-normal">{dateLabel}</Badge>}
                {statusLabel && <Badge variant="outline" className="whitespace-nowrap bg-transparent text-[10px] px-1.5 py-0 text-slate-500 border-slate-200 font-normal">{statusLabel}</Badge>}
                {variety !== 'ALL' && <Badge variant="outline" className="whitespace-nowrap bg-transparent text-[10px] px-1.5 py-0 text-slate-500 border-slate-200 font-normal">{variety}</Badge>}
                {millingType !== 'ALL' && <Badge variant="outline" className="whitespace-nowrap bg-transparent text-[10px] px-1.5 py-0 text-slate-500 border-slate-200 font-normal">{millingType}</Badge>}
                {farmerName && <Badge variant="outline" className="whitespace-nowrap bg-transparent text-[10px] px-1.5 py-0 text-slate-500 border-slate-200 font-normal">생산자: {farmerName}</Badge>}
                {yieldRate !== 'ALL' && <Badge variant="outline" className="whitespace-nowrap bg-transparent text-[10px] px-1.5 py-0 text-slate-500 border-slate-200 font-normal">{yieldRate}</Badge>}
                {keyword && <Badge variant="outline" className="whitespace-nowrap bg-transparent text-[10px] px-1.5 py-0 text-slate-500 border-slate-200 font-normal">"{keyword}"</Badge>}
            </div>
        </div>
    )
}
