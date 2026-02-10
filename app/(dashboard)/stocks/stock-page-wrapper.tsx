'use client'

import { ReactNode, useState, useMemo } from 'react'
import { StockListClient } from './stock-list-client'
import { StockPageClient } from './stock-page-client'
import { useBulkDeleteStocks } from './use-bulk-delete-stocks'
import { ActiveStockFilters } from './active-filters'
import { ReleaseStockDialog } from './release-stock-dialog'
import { StartMillingDialog } from './start-milling-dialog'
import { cancelStockRelease } from '@/app/actions/release'
import { getStocksByGroup, StockGroup } from '@/app/actions/stock'

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
    initialGroups: StockGroup[] // Changed from stocks
    farmers: any[]
    varieties: any[]
    filters: any
    filtersSlot: ReactNode
    excelSlot: ReactNode
    addDialogSlot: ReactNode
}

export function StockPageWrapper({
    initialGroups,
    farmers,
    varieties,
    filters,
    filtersSlot,
    excelSlot,
    addDialogSlot
}: StockPageWrapperProps) {
    const { selectedIds, setSelectedIds, showDeleteDialog, DeleteDialog } = useBulkDeleteStocks()
    const [showReleaseDialog, setShowReleaseDialog] = useState(false)
    const [showMillingDialog, setShowMillingDialog] = useState(false)
    const [isCanceling, setIsCanceling] = useState(false)

    // Lazy Loading State (Lifted Up)
    const [loadedItems, setLoadedItems] = useState<Record<string, Stock[]>>({})
    const [loadingGroups, setLoadingGroups] = useState<Set<string>>(new Set())

    const fetchGroupItems = async (group: StockGroup) => {
        if (loadedItems[group.key] || loadingGroups.has(group.key)) return

        setLoadingGroups(prev => new Set(prev).add(group.key))
        try {
            const result = await getStocksByGroup({
                year: group.year,
                variety: group.variety,
                certType: group.certType
            }, filters)

            if (result.success && result.data) {
                setLoadedItems(prev => ({
                    ...prev,
                    [group.key]: result.data as Stock[]
                }))
            }
        } catch (error) {
            console.error('Failed to load group items', error)
        } finally {
            setLoadingGroups(prev => {
                const newSet = new Set(prev)
                newSet.delete(group.key)
                return newSet
            })
        }
    }

    // Derive Flat List of Stocks from Loaded Items for Selection Logic
    // Only includes items that have been loaded.
    const stocks = useMemo(() => {
        return Object.values(loadedItems).flat()
    }, [loadedItems])

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
            // Need to reload? 
            // In a perfect world we re-fetch the affected groups. 
            // For now, revalidatePath in action handles it, but client state might be stale.
            // Ideally we clear loadedItems for affected groups? 
            // Using window.location.reload() is crude but effective.
            window.location.reload()
        } else {
            alert(result.error || '출고 취소 실패')
        }
    }

    return (
        <>
            <StockPageClient
                selectedIds={selectedIds}
                onShowDelete={showDeleteDialog}
                onShowRelease={() => setShowReleaseDialog(true)}
                onStartMilling={() => setShowMillingDialog(true)}
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
                    initialGroups={initialGroups}
                    loadedItems={loadedItems}
                    loadingGroups={loadingGroups}
                    fetchGroupItems={fetchGroupItems}
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
            <StartMillingDialog
                open={showMillingDialog}
                onOpenChange={setShowMillingDialog}
                selectedStocks={selectedStocks}
                onSuccess={() => setSelectedIds(new Set())}
            />
        </>
    )
}
