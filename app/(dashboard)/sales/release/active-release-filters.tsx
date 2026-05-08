'use client'

import { useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

interface ActiveReleaseFiltersProps {
    totalCount: number
    defaultStartDate?: Date | string
    defaultEndDate?: Date | string
}

export function ActiveReleaseFilters({ totalCount, defaultStartDate, defaultEndDate }: ActiveReleaseFiltersProps) {
    const searchParams = useSearchParams()

    const keyword = searchParams.get('keyword') || ''

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
                {keyword && <Badge variant="outline" className="whitespace-nowrap bg-transparent text-[10px] px-1.5 py-0 text-slate-500 border-slate-200 font-normal">"{keyword}"</Badge>}
            </div>
        </div>
    )
}
