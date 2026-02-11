import { getMillingLogs, GetMillingLogsParams } from '@/app/actions/milling'
import { getVarieties } from '@/app/actions/admin'
import { MillingFilters } from './milling-filters'
import { MillingPageWrapper } from './milling-page-wrapper'
import { Suspense } from 'react'
import { subMonths } from 'date-fns'

export default async function MillingListPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const resolvedParams = await searchParams

    const today = new Date()
    const oneMonthAgo = subMonths(today, 3)

    const startDate = typeof resolvedParams.startDate === 'string' ? new Date(resolvedParams.startDate) : oneMonthAgo
    const endDate = typeof resolvedParams.endDate === 'string' ? new Date(resolvedParams.endDate) : today

    const filters: GetMillingLogsParams = {
        status: typeof resolvedParams.status === 'string' ? resolvedParams.status : undefined,
        variety: typeof resolvedParams.variety === 'string' ? resolvedParams.variety : undefined,
        millingType: typeof resolvedParams.millingType === 'string' ? resolvedParams.millingType : undefined,
        keyword: typeof resolvedParams.keyword === 'string' ? resolvedParams.keyword : undefined,
        yieldRate: typeof resolvedParams.yieldRate === 'string' ? resolvedParams.yieldRate : undefined,
        startDate,
        endDate
    }

    const result = await getMillingLogs(filters)
    const logs = result.success && result.data ? result.data : []

    const varietyResult = await getVarieties()
    const varieties = (varietyResult.success && varietyResult.data ? varietyResult.data : []) as { id: number; name: string }[]

    const serializedLogs = JSON.parse(JSON.stringify(logs))

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <MillingPageWrapper
                logs={serializedLogs}
                filters={filters}
                filtersSlot={
                    <MillingFilters
                        varieties={varieties}
                        defaultStartDate={startDate}
                        defaultEndDate={endDate}
                    />
                }
            />
        </Suspense>
    )
}
