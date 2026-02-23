import { Suspense } from 'react'
import { getReleaseLogs } from '@/app/actions/release'
import { ReleaseHistoryList } from './release-history-list'
import { ReleaseFilters } from './release-filters'
import { ReleaseExcelButton } from './release-excel-button'
import { subYears, startOfDay, endOfDay } from 'date-fns'

export default async function ReleaseHistoryPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const resolvedParams = await searchParams

    // Default filters: 1 year ago to today if not provided
    const filters = {
        startDate: resolvedParams.startDate ? startOfDay(new Date(resolvedParams.startDate as string)) : subYears(new Date(), 1),
        endDate: resolvedParams.endDate ? endOfDay(new Date(resolvedParams.endDate as string)) : new Date(),
        keyword: resolvedParams.keyword as string | undefined
    }

    const result = await getReleaseLogs(filters)
    const logs = result.success && result.data ? result.data : []

    return (
        <div className="grid grid-cols-1 gap-1 pb-24">
            <Suspense fallback={<div>출고 내역을 불러오는 중...</div>}>
                <ReleaseHistoryList
                    initialLogs={logs}
                    filtersSlot={<ReleaseFilters />}
                    excelSlot={<ReleaseExcelButton filters={filters} />}
                />
            </Suspense>
        </div>
    )
}
