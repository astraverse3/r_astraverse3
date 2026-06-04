'use client'

import { ReactNode, useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
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
import { confirmDialog } from '@/components/ui/confirm-dialog'

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
    const searchParams = useSearchParams()
    const isMiscTab = searchParams.get('tab') === 'misc'
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
    const stocks = useMemo(() => {
        return Object.values(loadedItems).flat()
    }, [loadedItems])

    // Calculate total item count across ALL initial groups (even unloaded ones)
    const totalItemCount = useMemo(() => {
        return initialGroups.reduce((acc, group) => acc + group.count, 0)
    }, [initialGroups])

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
        if (!(await confirmDialog(`선택한 ${selectedIds.size}개의 재고에 대한 출고 처리를 취소하시겠습니까?\n(재고가 다시 '보유' 상태로 변경됩니다)`))) return

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
                <ActiveStockFilters totalCount={totalItemCount} varieties={varieties} />
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

            {/* Floating Cart Button (Mobile/Desktop)
                - 잡곡 탭에선 비표시 (도정 카트는 벼 전용)
                - 모바일에서 BulkActionBar 활성 시(selectedIds>0) Y축 한 단 위로 — Y 충돌 회피
                - 카운트 배지: 알림(red)이 아닌 "담긴 수" → primary 토큰 + 안쪽 정렬 */}
            {cartItems.length > 0 && !isMiscTab && (
                <div className={`fixed ${selectedIds.size > 0 ? 'bottom-[calc(12rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(7.5rem+env(safe-area-inset-bottom))]'} sm:bottom-6 right-4 sm:right-6 z-50 transition-[bottom] duration-200`}>
                    <Button
                        onClick={() => setIsCartOpen(true)}
                        className="rounded-full w-12 h-12 sm:w-14 sm:h-14 shadow-2xl bg-primary hover:bg-primary text-white p-0 relative backdrop-blur-sm"
                    >
                        <ShoppingCart className="h-6 w-6" />
                        <span className="absolute top-0 right-0 bg-white text-primary text-[10px] font-bold min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full border-2 border-primary tabular-nums">
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
