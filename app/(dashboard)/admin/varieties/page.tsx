import { getVarieties } from '@/app/actions/admin'
import { VarietyDialog } from './variety-dialog'
import { VarietyPageWrapper } from './variety-page-wrapper'
import { Suspense } from 'react'

export default async function VarietyPage() {
    const result = await getVarieties()
    const varieties = (result.success && result.data ? result.data : []) as { id: number; name: string; type: string }[]

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <VarietyPageWrapper
                varieties={varieties}
                addDialogSlot={<VarietyDialog mode="create" />}
            />
        </Suspense>
    )
}
