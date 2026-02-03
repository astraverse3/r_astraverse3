'use client'

import { ReactNode, useState } from 'react'
import { StockListClient } from './stock-list-client'
import { StockPageClient } from './stock-page-client'
import { useBulkDeleteStocks } from './use-bulk-delete-stocks'
import { ActiveStockFilters } from './active-filters'

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

    return (
        <>
            <StockPageClient
                selectedIds={selectedIds}
                onShowDelete={showDeleteDialog}
                filtersSlot={filtersSlot}
                excelSlot={excelSlot}
                addDialogSlot={addDialogSlot}
            >
                <ActiveStockFilters />
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
        </>
    )
}
