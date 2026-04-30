'use client'

import { useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'

const SOURCE_LABEL: Record<string, string> = {
    CONSIGNMENT: '도정위탁',
    FARMER_MILLED: '농가도정',
    GERMINATION: '발아위탁',
}

interface Props {
    totalCount: number
    varieties: { id: number; name: string }[]
}

export function ActiveMiscFilters({ totalCount, varieties }: Props) {
    const searchParams = useSearchParams()

    const yearParam = searchParams.get('productionYear') || ''
    const varietyParam = searchParams.get('varietyId') || ''
    const farmer = searchParams.get('farmerName') || ''
    const certParam = searchParams.get('certType') || ''
    const sourceParam = searchParams.get('sourceType') || ''
    const status = searchParams.get('status')

    const years = yearParam ? yearParam.split(',').map(s => s.trim()).filter(Boolean) : []
    const certs = certParam ? certParam.split(',').map(s => s.trim()).filter(Boolean) : []
    const sources = sourceParam ? sourceParam.split(',').map(s => s.trim()).filter(Boolean) : []

    const varietyIds = varietyParam ? varietyParam.split(',').map(s => s.trim()).filter(Boolean) : []
    const varietyNameMap = new Map(varieties.map(v => [v.id.toString(), v.name]))
    const varietyLabels = varietyIds.map(id => varietyNameMap.get(id) ?? id)

    const activeFilterCount = [
        years.length > 0,
        varietyIds.length > 0,
        farmer !== '',
        certs.length > 0,
        sources.length > 0,
        status && status !== 'ALL',
    ].filter(Boolean).length

    if (activeFilterCount === 0) return null

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
                {sources.map(s => (
                    <Badge key={s} variant="outline" className="whitespace-nowrap bg-transparent text-slate-500 border-slate-200 font-normal">
                        {SOURCE_LABEL[s] ?? s}
                    </Badge>
                ))}
                {status && status !== 'ALL' && (
                    <Badge variant="outline" className="whitespace-nowrap bg-transparent text-slate-500 border-slate-200 font-normal">
                        {status === 'AVAILABLE' ? '보관중' : status === 'CONSUMED' ? '소진됨' : status}
                    </Badge>
                )}
            </div>
        </div>
    )
}
