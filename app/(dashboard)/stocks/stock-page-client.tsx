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
        <div className="grid grid-cols-1 gap-1 pb-24 sm:pb-2 px-1.5 sm:px-0">
            {/* Header */}
            <section className="flex flex-col gap-2 pt-2 px-1">
                <div className="flex items-center justify-between gap-2">
                    {/* Desktop: show selected count */}
                    <div className="hidden sm:flex items-center gap-2">
                        {selectedIds.size > 0 && (
                            <span className="text-sm font-bold text-[#00a2e8]">
                                {selectedIds.size}건 선택
                            </span>
                        )}
                    </div>

                    {/* Mobile: show selected count only */}
                    <div className="sm:hidden">
                        {selectedIds.size > 0 && (
                            <span className="text-[13px] font-bold text-[#00a2e8]">
                                {selectedIds.size}건 선택
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {excelSlot}
                        {filtersSlot}
                        {canStock && addDialogSlot}
                    </div>
                </div>
            </section>

            {children}

            {/* Floating Action Bar (above bottom nav on mobile, fixed bottom on desktop) */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))] sm:bottom-4 left-0 right-0 sm:left-auto sm:right-4 z-50 animate-in slide-in-from-bottom-4 duration-200 sm:w-auto flex justify-center sm:justify-end">
                    <div className="w-fit bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg px-3 sm:px-4 py-2">
                        <div className="flex items-center gap-1 sm:gap-2.5 justify-end">
                            <span className="text-[10px] sm:text-xs text-slate-500 font-medium shrink-0">{selectedIds.size}건 선택</span>
                            {canStock && (
                                <Button variant="outline" size="sm" onClick={onShowDelete}
                                    className="text-red-600 border-red-200 hover:bg-red-600 hover:text-white h-7 sm:h-8 px-1.5 sm:px-3 text-[10px] sm:text-xs rounded-lg gap-0.5">
                                    <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />삭제
                                </Button>
                            )}
                            {canMilling && (
                                <Button variant="outline" size="sm" onClick={onAddToCart}
                                    className="text-emerald-600 border-emerald-200 hover:bg-emerald-600 hover:text-white h-7 sm:h-8 px-1.5 sm:px-3 text-[10px] sm:text-xs rounded-lg gap-0.5">
                                    <ShoppingCart className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />담기
                                </Button>
                            )}
                            {isAllAvailable && canMilling && (
                                <Button variant="outline" size="sm" onClick={onStartMilling}
                                    className="text-[#00a2e8] border-[#00a2e8]/30 hover:bg-[#00a2e8] hover:text-white h-7 sm:h-8 px-1.5 sm:px-3 text-[10px] sm:text-xs rounded-lg gap-0.5">
                                    <ClipboardList className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />도정
                                </Button>
                            )}
                            {isAllAvailable && canStock && (
                                <Button variant="outline" size="sm" onClick={onShowRelease}
                                    className="text-slate-600 border-slate-200 hover:bg-slate-600 hover:text-white h-7 sm:h-8 px-1.5 sm:px-3 text-[10px] sm:text-xs rounded-lg gap-0.5">
                                    <Truck className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />출고
                                </Button>
                            )}
                            {isAllReleased && canStock && (
                                <Button variant="outline" size="sm" onClick={onCancelRelease} disabled={isCanceling}
                                    className="text-amber-700 border-amber-200 hover:bg-amber-600 hover:text-white h-7 sm:h-8 px-1.5 sm:px-3 text-[10px] sm:text-xs rounded-lg gap-0.5">
                                    <RotateCcw className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />{isCanceling ? '취소중' : '출고취소'}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
