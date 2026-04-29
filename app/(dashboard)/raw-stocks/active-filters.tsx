'use client'

import { useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'

interface ActiveStockFiltersProps {
    totalCount: number
    varieties: { id: number; name: string }[]
}

export function ActiveStockFilters({ totalCount, varieties }: ActiveStockFiltersProps) {
    const searchParams = useSearchParams()

    const yearParam = searchParams.get('productionYear') || ''
    const varietyParam = searchParams.get('varietyId') || ''
    const farmer = searchParams.get('farmerName') || ''
    const certParam = searchParams.get('certType') || ''
    const status = searchParams.get('status')
    const sort = searchParams.get('sort') || 'newest'

    const years = yearParam ? yearParam.split(',').map(s => s.trim()).filter(Boolean) : []
    const certs = certParam ? certParam.split(',').map(s => s.trim()).filter(Boolean) : []

    const varietyIds = varietyParam ? varietyParam.split(',').map(s => s.trim()).filter(Boolean) : []
    const varietyNameMap = new Map(varieties.map(v => [v.id.toString(), v.name]))
    const varietyLabels = varietyIds.map(id => varietyNameMap.get(id) ?? id)

    const activeFilterCount = [
        years.length > 0,
        varietyIds.length > 0,
        farmer !== '',
        certs.length > 0,
        status && status !== 'ALL'
    ].filter(Boolean).length

    if (activeFilterCount === 0 && sort === 'newest') return null

    return (
        <div className="flex items-center justify-between gap-2 overflow-x-auto py-1 px-1 scrollbar-hide">
            <span className="text-xs text-slate-600 font-medium whitespace-nowrap">
                검색결과 {totalCount}건
            </span>
            <div className="flex gap-2 flex-wrap justify-end">
                {years.map(y => (
                    <Badge key={y} variant="outline" className="whitespace-nowrap bg-transparent text-slate-500 border-slate-200 font-normal">{y}년</Badge>
                ))}
                {varietyLabels.map((label, i) => (
                    <Badge key={`${varietyIds[i]}-${label}`} variant="outline" className="whitespace-nowrap bg-transparent text-slate-500 border-slate-200 font-normal">{label}</Badge>
                ))}
                {farmer && (
                    <Badge variant="outline" className="whitespace-nowrap bg-transparent text-slate-500 border-slate-200 font-normal">{farmer}</Badge>
                )}
                {certs.map(c => (
                    <Badge key={c} variant="outline" className="whitespace-nowrap bg-transparent text-slate-500 border-slate-200 font-normal">{c}</Badge>
                ))}
                {status && status !== 'ALL' && (
                    <Badge variant="outline" className="whitespace-nowrap bg-transparent text-slate-500 border-slate-200 font-normal">
                        {status === 'AVAILABLE' ? '보관중' : '소진됨'}
                    </Badge>
                )}
            </div>
        </div>
    )
}
