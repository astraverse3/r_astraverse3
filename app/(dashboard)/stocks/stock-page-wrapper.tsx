'use client'

import { ReactNode, useState, useMemo, useEffect } from 'react'
import { StockListClient } from './stock-list-client'
import { StockPageClient } from './stock-page-client'
import { useBulkDeleteStocks } from './use-bulk-delete-stocks'
import { ActiveStockFilters } from './active-filters'
import { ReleaseStockDialog } from './release-stock-dialog'
import { StartMillingDialog } from './start-milling-dialog'
import { cancelStockRelease } from '@/app/actions/release'
import { getStocksByGroup, StockGroup } from '@/app/actions/stock'
import { useMillingCart } from './milling-cart-context'
import { MillingCartSheet } from '@/components/milling-cart-sheet'
import { Button } from '@/components/ui/button'
import { ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'

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
        type: string
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
    const [millingSource, setMillingSource] = useState<'SELECTION' | 'CART'>('SELECTION') // Track source
    const [isCanceling, setIsCanceling] = useState(false)

    const { items: cartItems, setIsOpen: setIsCartOpen, clearCart, addToCart, editingBatchId } = useMillingCart()

    // Lazy Loading State (Lifted Up)
    const [loadedItems, setLoadedItems] = useState<Record<string, Stock[]>>({})
    const [loadingGroups, setLoadingGroups] = useState<Set<string>>(new Set())

    // Clear loaded items when filters change to ensure fresh data is fetched
    useEffect(() => {
        setLoadedItems({})
    }, [filters])

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
    // Only includes items that have been loaded.
    const stocks = useMemo(() => {
        return Object.values(loadedItems).flat()
    }, [loadedItems])

    // Create a Set of IDs for items currently in the cart
    const cartItemIds = useMemo(() => {
        return new Set(cartItems.map(item => item.id))
    }, [cartItems])

    // Selection Analysis
    const selectedStocks = stocks.filter(s => selectedIds.has(s.id))

    // Determine which stocks to use for Milling Dialog
    const millingStocks = millingSource === 'CART' ? cartItems : selectedStocks

    const isAllReleased = selectedStocks.length > 0 && selectedStocks.every(s => s.status === 'RELEASED')
    const isAllAvailable = selectedStocks.length > 0 && selectedStocks.every(s => s.status === 'AVAILABLE')

    const handleCancelRelease = async () => {
        if (!confirm(`선택한 ${selectedIds.size}개의 재고에 대한 출고 처리를 취소하시겠습니까?\n(재고가 다시 '보유' 상태로 변경됩니다)`)) return

        setIsCanceling(true)
        const result = await cancelStockRelease(Array.from(selectedIds))
        setIsCanceling(false)

        if (result.success) {
            toast.success('출고 처리가 취소되었습니다.')
            setSelectedIds(new Set())
            // Need to reload? 
            // In a perfect world we re-fetch the affected groups. 
            // For now, revalidatePath in action handles it, but client state might be stale.
            // Ideally we clear loadedItems for affected groups? 
            // Using window.location.reload() is crude but effective.
            window.location.reload()
        } else {
            toast.error(result.error || '출고 취소 실패')
        }
    }

    const handleAddToCart = () => {
        if (selectedIds.size === 0) return

        // Use selectedStocks which is already filtered from all loaded items
        // Wait, selectedStocks depends on `stocks` which is flattened `loadedItems`.
        // So `selectedStocks` contains the full objects!
        if (selectedStocks.length === 0) return

        const result = addToCart(selectedStocks)
        if (result.success) {
            toast.success(`${selectedStocks.length}개 톤백을 장바구니에 담았습니다.`)
            setSelectedIds(new Set()) // Clear selection
        } else {
            toast.error(result.error || '장바구니 담기 실패')
        }
    }

    return (
        <>
            <StockPageClient
                selectedIds={selectedIds}
                onShowDelete={showDeleteDialog}
                onAddToCart={handleAddToCart}
                onShowRelease={() => setShowReleaseDialog(true)}
                onStartMilling={() => {
                    setMillingSource('SELECTION')
                    setShowMillingDialog(true)
                }}
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
                    cartItemIds={cartItemIds} // Pass cart IDs
                />
            </StockPageClient>

            {/* Floating Cart Button (Mobile/Desktop) */}
            {cartItems.length > 0 && (
                <div className="fixed bottom-6 right-6 z-50">
                    <Button
                        onClick={() => setIsCartOpen(true)}
                        className="rounded-full w-14 h-14 shadow-xl bg-[#00a2e8] hover:bg-[#008cc9] text-white p-0 relative"
                    >
                        <ShoppingCart className="h-6 w-6" />
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">
                            {cartItems.length}
                        </span>
                    </Button>
                </div>
            )}

            <MillingCartSheet
                onStartMilling={(items) => {
                    setMillingSource('CART')
                    setShowMillingDialog(true)
                }}
            />

            <DeleteDialog />
            <ReleaseStockDialog
                open={showReleaseDialog}
                onOpenChange={setShowReleaseDialog}
                selectedIds={selectedIds}
                onSuccess={() => setSelectedIds(new Set())}
            />
            <StartMillingDialog
                open={showMillingDialog}
                onOpenChange={(open) => {
                    setShowMillingDialog(open)
                    if (!open && millingSource === 'SELECTION') {
                        setSelectedIds(new Set())
                    }
                }}
                selectedStocks={millingStocks}
                editMode={millingSource === 'CART' && !!editingBatchId}
                onSuccess={() => {
                    setSelectedIds(new Set())
                    if (millingSource === 'CART') {
                        clearCart()
                    }
                }}
            />
        </>
    )
}
