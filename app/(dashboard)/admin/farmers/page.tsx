import { Suspense } from 'react'
import { getFarmersWithGroups } from '@/app/actions/admin'
import { AddFarmerDialog } from './add-farmer-dialog'
import { ExcelButtons } from './excel-buttons'
import { FarmerFilters } from './farmer-filters'
import { FarmerPageClient } from './farmer-page-client'
import { SectionLoader } from '@/components/ui/section-loader'

export default async function AdminFarmersPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const resolvedParams = await searchParams

    const filters = {
        groupName: typeof resolvedParams.groupName === 'string' ? resolvedParams.groupName : undefined,
        farmerName: typeof resolvedParams.farmerName === 'string' ? resolvedParams.farmerName : undefined,
        certType: typeof resolvedParams.certType === 'string' ? resolvedParams.certType : undefined,
        cropYear: typeof resolvedParams.cropYear === 'string' && resolvedParams.cropYear !== 'ALL' ? resolvedParams.cropYear : undefined,
        producesMiscGrain: resolvedParams.producesMiscGrain === '1',
        sortBy: 'group' as const, // Force Sort by Group for Admin List
    }

    const response = await getFarmersWithGroups(filters)
    const farmers = response.success ? response.data || [] : []

    return (
        <Suspense fallback={<SectionLoader message="농가 목록을 불러오는 중" />}>
            <FarmerPageClient
                farmers={farmers}
                filtersSlot={<FarmerFilters />}
                excelSlot={<ExcelButtons />}
                addDialogSlot={<AddFarmerDialog />}
            />
        </Suspense>
    )
}
