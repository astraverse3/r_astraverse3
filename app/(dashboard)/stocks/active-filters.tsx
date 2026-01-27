'use client'

import { useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'

export function ActiveStockFilters() {
    const searchParams = useSearchParams()

    const currentYear = new Date().getFullYear().toString()

    const year = searchParams.get('productionYear') || currentYear
    const variety = searchParams.get('variety') || ''
    const farmer = searchParams.get('farmerName') || ''
    const cert = searchParams.get('certType') || '유기농'
    const status = searchParams.get('status') || 'AVAILABLE'
    const sort = searchParams.get('sort') || 'newest'

    const activeFilterCount = [
        year !== 'ALL',
        variety !== 'ALL' && variety !== '',
        farmer !== '',
        cert !== 'ALL',
        status !== 'ALL'
    ].filter(Boolean).length

    if (activeFilterCount === 0 && sort === 'newest') return null

    return (
        <div className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-hide">
            {year && <Badge variant="outline" className="whitespace-nowrap bg-white">{year}년</Badge>}
            {variety && <Badge variant="outline" className="whitespace-nowrap bg-white">{variety}</Badge>}
            {farmer && <Badge variant="outline" className="whitespace-nowrap bg-white">{farmer}</Badge>}
            {cert !== 'ALL' && <Badge variant="outline" className="whitespace-nowrap bg-white">{cert}</Badge>}
            {status !== 'ALL' && <Badge variant="outline" className="whitespace-nowrap bg-white">{status === 'AVAILABLE' ? '보관중' : '소진됨'}</Badge>}
            {sort !== 'newest' && <Badge variant="secondary" className="whitespace-nowrap text-[10px] text-slate-500 bg-slate-100">
                {sort === 'oldest' && '오래된순'}
                {sort === 'weight_desc' && '중량 높은순'}
                {sort === 'weight_asc' && '중량 낮은순'}
            </Badge>}
        </div>
    )
}
