'use client'

import { useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'

export function ActiveStockFilters() {
    const searchParams = useSearchParams()

    const year = searchParams.get('productionYear')
    const variety = searchParams.get('variety') || ''
    const farmer = searchParams.get('farmerName') || ''
    const cert = searchParams.get('certType')
    const status = searchParams.get('status')
    const sort = searchParams.get('sort') || 'newest'

    const activeFilterCount = [
        year && year !== 'ALL',
        variety !== 'ALL' && variety !== '',
        farmer !== '',
        cert && cert !== 'ALL',
        status && status !== 'ALL'
    ].filter(Boolean).length

    if (activeFilterCount === 0 && sort === 'newest') return null

    return (
        <div className="flex gap-2 overflow-x-auto py-1 px-1 scrollbar-hide justify-end">
            {year && year !== 'ALL' && <Badge variant="outline" className="whitespace-nowrap bg-transparent text-slate-500 border-slate-200 font-normal">{year}년</Badge>}
            {variety && <Badge variant="outline" className="whitespace-nowrap bg-transparent text-slate-500 border-slate-200 font-normal">{variety}</Badge>}
            {farmer && <Badge variant="outline" className="whitespace-nowrap bg-transparent text-slate-500 border-slate-200 font-normal">{farmer}</Badge>}
            {cert && cert !== 'ALL' && <Badge variant="outline" className="whitespace-nowrap bg-transparent text-slate-500 border-slate-200 font-normal">{cert}</Badge>}
            {status && status !== 'ALL' && <Badge variant="outline" className="whitespace-nowrap bg-transparent text-slate-500 border-slate-200 font-normal">{status === 'AVAILABLE' ? '보관중' : '소진됨'}</Badge>}
        </div>
    )
}
