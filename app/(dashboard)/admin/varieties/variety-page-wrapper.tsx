'use client'

import { ReactNode, useState } from 'react'
import { VarietyListClient } from './variety-list-client'
import { VarietyPageClient } from './variety-page-client'
import { useBulkDeleteVarieties } from './use-bulk-delete-varieties'

interface Variety {
    id: number
    name: string
    type: string
}

interface VarietyPageWrapperProps {
    varieties: Variety[]
    addDialogSlot: ReactNode
}

export function VarietyPageWrapper({
    varieties,
    addDialogSlot
}: VarietyPageWrapperProps) {
    const { selectedIds, setSelectedIds, showDeleteDialog, DeleteDialog } = useBulkDeleteVarieties()

    return (
        <>
            <VarietyPageClient
                selectedIds={selectedIds}
                onShowDelete={showDeleteDialog}
                addDialogSlot={addDialogSlot}
            >
                <VarietyListClient
                    varieties={varieties}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                />
            </VarietyPageClient>
            <DeleteDialog />
        </>
    )
}
