'use client'

import { useState } from 'react'
import { ReactNode } from 'react'
import { ReleaseHistoryList } from './release-history-list'
import { ReleasePageClient } from './release-page-client'
import { ActiveReleaseFilters } from './active-release-filters'
import { deleteStockReleases } from '@/app/actions/release'
import { triggerDataUpdate } from '@/components/last-updated'
import { toast } from 'sonner'

interface ReleasePageWrapperProps {
    logs: any[]
    filters: any
    filtersSlot: ReactNode
    excelSlot: ReactNode
}

export function ReleasePageWrapper({
    logs,
    filters,
    filtersSlot,
    excelSlot
}: ReleasePageWrapperProps) {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

    const handleBulkCancel = async () => {
        if (selectedIds.size === 0) return
        if (!confirm(`선택한 ${selectedIds.size}건의 출고를 취소하시겠습니까? (포함된 재고는 다시 입고됩니다)`)) return

        try {
            const result = await deleteStockReleases(Array.from(selectedIds))
            if (result.success) {
                toast.success('출고가 취소되었습니다.')
                triggerDataUpdate()
                setSelectedIds(new Set())
            } else {
                toast.error(result.error || '출고 취소 실패')
            }
        } catch (error) {
            toast.error('오류가 발생했습니다.')
        }
    }

    return (
        <ReleasePageClient
            selectedIds={selectedIds}
            onBulkCancel={handleBulkCancel}
            filtersSlot={filtersSlot}
            excelSlot={excelSlot}
        >
            <>
                <ActiveReleaseFilters totalCount={logs.length} defaultStartDate={filters.startDate} defaultEndDate={filters.endDate} />
                <ReleaseHistoryList
                    logs={logs}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                />
            </>
        </ReleasePageClient>
    )
}
