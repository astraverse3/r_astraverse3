'use client'

import { ReactNode } from 'react'
import { Trash2, Truck, RotateCcw, ClipboardList, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'

interface StockPageClientProps {
    children: ReactNode
    filtersSlot: ReactNode
    excelSlot: ReactNode
    addDialogSlot: ReactNode
    selectedIds: Set<number>
    onShowDelete: () => void
    onShowRelease: () => void
    onStartMilling: () => void
    onAddToCart: () => void
    onCancelRelease: () => void
    isAllReleased: boolean
    isAllAvailable: boolean
    isCanceling: boolean
}

export function StockPageClient({
    children,
    filtersSlot,
    excelSlot,
    addDialogSlot,
    selectedIds,
    onShowDelete,
    onShowRelease,
    onStartMilling,
    onAddToCart,
    onCancelRelease,
    isAllReleased,
    isAllAvailable,
    isCanceling
}: StockPageClientProps) {
    const { data: session } = useSession()
    // @ts-ignore
    const canStock = hasPermission(session?.user, 'STOCK_MANAGE')
    // @ts-ignore
    const canMilling = hasPermission(session?.user, 'MILLING_MANAGE')

    return (
        <div className="grid grid-cols-1 gap-1 pb-24">
            {/* Header */}
            <section className="flex flex-col gap-2 pt-2 px-1">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        {selectedIds.size > 0 ? (
                            <>
                                {canStock && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={onShowDelete}
                                        className="text-red-600 border-red-200 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors"
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        삭제 ({selectedIds.size})
                                    </Button>
                                )}

                                {canMilling && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={onAddToCart}
                                        className="text-emerald-600 border-emerald-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-colors"
                                    >
                                        <ShoppingCart className="mr-2 h-4 w-4" />
                                        담기 ({selectedIds.size})
                                    </Button>
                                )}

                                {isAllAvailable && (
                                    <>
                                        {canMilling && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={onStartMilling}
                                                className="text-[#00a2e8] border-[#00a2e8]/30 hover:bg-[#00a2e8] hover:text-white hover:border-[#00a2e8] transition-colors"
                                            >
                                                <ClipboardList className="mr-2 h-4 w-4" />
                                                도정 ({selectedIds.size})
                                            </Button>
                                        )}

                                        {canStock && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={onShowRelease}
                                                className="text-slate-600 border-slate-200 hover:bg-slate-600 hover:text-white hover:border-slate-600 transition-colors"
                                            >
                                                <Truck className="mr-2 h-4 w-4" />
                                                출고 ({selectedIds.size})
                                            </Button>
                                        )}
                                    </>
                                )}

                                {isAllReleased && canStock && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={onCancelRelease}
                                        disabled={isCanceling}
                                        className="text-amber-700 border-amber-200 hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-colors"
                                    >
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        {isCanceling ? '취소 중...' : `출고 취소 (${selectedIds.size})`}
                                    </Button>
                                )}
                            </>
                        ) : canStock ? (
                            <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="text-slate-400"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                삭제
                            </Button>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                        {excelSlot}
                        {filtersSlot}
                        {canStock && addDialogSlot}
                    </div>
                </div>
            </section>

            {children}
        </div>
    )
}
