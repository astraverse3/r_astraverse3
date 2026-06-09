import { getVarieties } from '@/app/actions/admin'
import { VarietyDialog } from './variety-dialog'
import { VarietyPageWrapper } from './variety-page-wrapper'
import { SectionLoader } from '@/components/ui/section-loader'
import { Suspense } from 'react'

export default async function VarietyPage() {
    const result = await getVarieties()
    const varieties = (result.success && result.data ? result.data : []) as { id: number; name: string; type: string }[]

    return (
        <Suspense fallback={<SectionLoader message="품종 목록을 불러오는 중" />}>
            <VarietyPageWrapper
                varieties={varieties}
                addDialogSlot={<VarietyDialog mode="create" />}
            />
        </Suspense>
    )
}
