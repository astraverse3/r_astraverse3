'use client'

import { ReactNode } from 'react'
import { MillingListClient } from './milling-list-client'
import type { MillingBatch } from './milling-table-row'
import type { GetMillingLogsParams } from '@/app/actions/milling'
import { MillingPageClient } from './milling-page-client'
import { useBulkDeleteMilling } from './use-bulk-delete-milling'
import { ActiveMillingFilters } from './active-milling-filters'

interface MillingPageWrapperProps {
    logs: MillingBatch[]
    filters: GetMillingLogsParams
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
                filters={filters}
            >
                <ActiveMillingFilters totalCount={logs.length} defaultStartDate={filters.startDate} defaultEndDate={filters.endDate} />
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
