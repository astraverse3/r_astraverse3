import { Suspense } from 'react'
import { getReleaseLogs } from '@/app/actions/release'
import { ReleasePageWrapper } from './release-page-wrapper'
import { ReleaseFilters } from './release-filters'
import { ReleaseExcelButton } from './release-excel-button'
import { startOfYear, endOfDay } from 'date-fns'

export default async function ReleaseHistoryPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const resolvedParams = await searchParams

    // Default Year: Previous Year until Oct, Current Year from Nov (same as stock page)
    const today = new Date()
    const defaultYear = (today.getMonth() + 1) >= 11 ? today.getFullYear() : today.getFullYear() - 1

    const startDate = resolvedParams.startDate
        ? new Date(resolvedParams.startDate as string)
        : startOfYear(new Date(defaultYear, 0, 1))
    const endDate = resolvedParams.endDate
        ? endOfDay(new Date(resolvedParams.endDate as string))
        : new Date()

    const filters = {
        startDate,
        endDate,
        keyword: resolvedParams.keyword as string | undefined
    }

    const result = await getReleaseLogs(filters)
    const logs = result.success && result.data ? result.data : []

    return (
        <Suspense fallback={<div>출고 내역을 불러오는 중...</div>}>
            <ReleasePageWrapper
                logs={logs}
                filters={filters}
                filtersSlot={<ReleaseFilters key="filters-slot" />}
                excelSlot={<ReleaseExcelButton key="excel-slot" filters={filters} />}
            />
        </Suspense>
    )
}
