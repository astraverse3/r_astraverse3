'use client'

import { useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'

export function ActiveMillingFilters() {
    const searchParams = useSearchParams()

    const status = searchParams.get('status') || 'ALL'
    const variety = searchParams.get('variety') || 'ALL'
    const millingType = searchParams.get('millingType') || 'ALL'
    const keyword = searchParams.get('keyword') || ''
    const yieldRate = searchParams.get('yieldRate') || 'ALL'

    const activeFilterCount = [
        status !== 'ALL',
        variety !== 'ALL',
        millingType !== 'ALL',
        keyword !== '',
        yieldRate !== 'ALL'
    ].filter(Boolean).length

    if (activeFilterCount === 0) return null

    const getYieldLabel = (val: string) => {
        if (val === 'upto_50') return '수율 50%↓'
        if (val === 'upto_60') return '수율 60%↓'
        if (val === 'upto_70') return '수율 70%↓'
        if (val === 'over_70') return '수율 70%↑'
        return val
    }

    return (
        <div className="flex gap-2 overflow-x-auto py-1 px-1 scrollbar-hide justify-end">
            {status !== 'ALL' && <Badge variant="outline" className="whitespace-nowrap bg-transparent text-slate-500 border-slate-200 font-normal">{status === 'open' ? '진행중' : '마감'}</Badge>}
            {variety !== 'ALL' && <Badge variant="outline" className="whitespace-nowrap bg-transparent text-slate-500 border-slate-200 font-normal">{variety}</Badge>}
            {millingType !== 'ALL' && <Badge variant="outline" className="whitespace-nowrap bg-transparent text-slate-500 border-slate-200 font-normal">{millingType}</Badge>}
            {yieldRate !== 'ALL' && <Badge variant="outline" className="whitespace-nowrap bg-transparent text-slate-500 border-slate-200 font-normal">{getYieldLabel(yieldRate)}</Badge>}
            {keyword && <Badge variant="outline" className="whitespace-nowrap bg-transparent text-slate-500 border-slate-200 font-normal">"{keyword}"</Badge>}
        </div>
    )
}
