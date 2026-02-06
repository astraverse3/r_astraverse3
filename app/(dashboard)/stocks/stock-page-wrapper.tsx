'use client'

import { ReactNode, useState } from 'react'
import { StockListClient } from './stock-list-client'
import { StockPageClient } from './stock-page-client'
import { useBulkDeleteStocks } from './use-bulk-delete-stocks'
import { ActiveStockFilters } from './active-filters'
import { ReleaseStockDialog } from './release-stock-dialog'
import { cancelStockRelease } from '@/app/actions/release'

interface Stock {
    id: number
    productionYear: number
    bagNo: number
    weightKg: number
    status: string
    incomingDate: Date
    createdAt: Date
    updatedAt: Date
    lotNo: string | null
    variety: {
        name: string
    }
    farmer: {
        name: string
        group: {
            certType: string
            name: string
        }
    }
}

interface StockPageWrapperProps {
    stocks: Stock[]
    farmers: any[]
    varieties: any[]
    filters: any
    filtersSlot: ReactNode
    excelSlot: ReactNode
    addDialogSlot: ReactNode
}
export function StockPageWrapper({
    stocks,
    farmers,
    varieties,
    filters,
    filtersSlot,
    excelSlot,
    addDialogSlot
}: StockPageWrapperProps) {
    const { selectedIds, setSelectedIds, showDeleteDialog, DeleteDialog } = useBulkDeleteStocks()
    const [showReleaseDialog, setShowReleaseDialog] = useState(false)
    const [isCanceling, setIsCanceling] = useState(false)

    // Selection Analysis
    const selectedStocks = stocks.filter(s => selectedIds.has(s.id))
    const isAllReleased = selectedStocks.length > 0 && selectedStocks.every(s => s.status === 'RELEASED')
    const isAllAvailable = selectedStocks.length > 0 && selectedStocks.every(s => s.status === 'AVAILABLE')

    const handleCancelRelease = async () => {
        if (!confirm(`선택한 ${selectedIds.size}개의 재고에 대한 출고 처리를 취소하시겠습니까?\n(재고가 다시 '보유' 상태로 변경됩니다)`)) return

        setIsCanceling(true)
        const result = await cancelStockRelease(Array.from(selectedIds))
        setIsCanceling(false)

        if (result.success) {
            alert('출고 처리가 취소되었습니다.')
            setSelectedIds(new Set())
        } else {
            alert(result.error || '출고 취소 실패')
        }
    }

    return (
        <>
            <StockPageClient
                selectedIds={selectedIds}
                onShowDelete={showDeleteDialog}
                onShowRelease={() => setShowReleaseDialog(true)} // Added prop
                onCancelRelease={handleCancelRelease}
                isAllReleased={isAllReleased}
                isAllAvailable={isAllAvailable}
                isCanceling={isCanceling}
                filtersSlot={filtersSlot}
                excelSlot={excelSlot}
                addDialogSlot={addDialogSlot}
            >
                <ActiveStockFilters totalCount={stocks.length} />
                <StockListClient
                    stocks={stocks}
                    farmers={farmers}
                    varieties={varieties}
                    filters={filters}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                />
            </StockPageClient>
            <DeleteDialog />
            <ReleaseStockDialog
                open={showReleaseDialog}
                onOpenChange={setShowReleaseDialog}
                selectedIds={selectedIds}
                onSuccess={() => setSelectedIds(new Set())}
            />
        </>
    )
}
