'use client'

import { ReactNode } from 'react'
import { MillingListClient } from './milling-list-client'
import { MillingPageClient } from './milling-page-client'
import { useBulkDeleteMilling } from './use-bulk-delete-milling'
import { ActiveMillingFilters } from './active-milling-filters'

interface MillingPageWrapperProps {
    logs: any[]
    filters: any
    filtersSlot: ReactNode
}

export function MillingPageWrapper({
    logs,
    filters,
    filtersSlot
}: MillingPageWrapperProps) {
    const { selectedIds, setSelectedIds, showDeleteDialog, DeleteDialog } = useBulkDeleteMilling()

    return (
        <>
            <MillingPageClient
                selectedIds={selectedIds}
                onShowDelete={showDeleteDialog}
                filtersSlot={filtersSlot}
            >
                <ActiveMillingFilters totalCount={logs.length} />
                <MillingListClient
                    logs={logs}
                    filters={filters}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                />
            </MillingPageClient>
            <DeleteDialog />
        </>
    )
}
