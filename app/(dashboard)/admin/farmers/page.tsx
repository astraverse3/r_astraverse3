import { Suspense } from 'react'
import { getFarmersWithGroups } from '@/app/actions/admin'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddFarmerDialog } from './add-farmer-dialog'
import { FarmerListWrapper } from './farmer-list-wrapper'
import { ExcelButtons } from './excel-buttons'
import { FarmerFilters } from './farmer-filters'

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
        <div className="space-y-6">
            <div className="flex items-center justify-end gap-2">
                <FarmerFilters />
                <ExcelButtons />
                <AddFarmerDialog />
            </div>

            <Suspense fallback={<div>Loading...</div>}>
                <FarmerListWrapper farmers={farmers} />
            </Suspense>
        </div>
    )
}
