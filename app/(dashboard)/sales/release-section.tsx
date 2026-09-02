import { Suspense } from 'react'
import { startOfYear, endOfDay } from 'date-fns'
import { getReleaseLogs } from '@/app/actions/release'
import { ReleasePageWrapper } from './release/release-page-wrapper'
import { ReleaseFilters } from './release/release-filters'
import { ReleaseExcelButton } from './release/release-excel-button'
import { SectionLoader } from '@/components/ui/section-loader'
import { defaultProductionYear } from '@/lib/production-year'

export async function ReleaseSection({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined }
}) {
    // 조회 기간 시작 = 그해 1월 1일. 연도 규칙은 `lib/production-year.ts`
    const defaultYear = defaultProductionYear('RICE')

    const startDate = searchParams.startDate
        ? new Date(searchParams.startDate as string)
        : startOfYear(new Date(defaultYear, 0, 1))
    const endDate = searchParams.endDate
        ? endOfDay(new Date(searchParams.endDate as string))
        : new Date()

    const filters = {
        startDate,
        endDate,
        keyword: searchParams.keyword as string | undefined,
    }

    const result = await getReleaseLogs(filters)
    const logs = result.success && result.data ? result.data : []

    return (
        <Suspense fallback={<SectionLoader message="출고 내역을 불러오는 중" />}>
            <ReleasePageWrapper
                logs={logs}
                filters={filters}
                filtersSlot={<ReleaseFilters key="filters-slot" />}
                excelSlot={<ReleaseExcelButton key="excel-slot" filters={filters} />}
            />
        </Suspense>
    )
}
