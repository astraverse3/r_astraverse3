import { Suspense } from 'react'
import { getFarmersWithGroups } from '@/app/actions/admin'
import { AddFarmerDialog } from './add-farmer-dialog'
import { ExcelButtons } from './excel-buttons'
import { FarmerFilters } from './farmer-filters'
import { FarmerPageClient } from './farmer-page-client'

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
        cropYear: typeof resolvedParams.cropYear === 'string' && resolvedParams.cropYear !== 'ALL' ? parseInt(resolvedParams.cropYear) : undefined,
    }

    const response = await getFarmersWithGroups(filters)
    const farmers = response.success ? response.data || [] : []

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <FarmerPageClient
                farmers={farmers}
                filtersSlot={<FarmerFilters />}
                excelSlot={<ExcelButtons />}
                addDialogSlot={<AddFarmerDialog />}
            />
        </Suspense>
    )
}
