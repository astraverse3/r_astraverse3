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
    // @ts-ignore
    const canSales = hasPermission(session?.user, 'SALES_MANAGE')

    return (
        <div className="grid grid-cols-1 gap-2 pb-24 sm:pb-2 px-1.5 sm:px-0">
            {/* Header */}
            <section className="flex flex-col gap-2 px-1">
                <div className="flex items-center justify-between gap-2">
                    {/* Desktop: show selected count */}
                    <div className="hidden sm:flex items-center gap-2">
                        {selectedIds.size > 0 && (
                            <span className="text-sm font-bold text-primary">
                                {selectedIds.size}건 선택
                            </span>
                        )}
                    </div>

                    {/* Mobile: show selected count only */}
                    <div className="sm:hidden">
                        {selectedIds.size > 0 && (
                            <span className="text-[13px] font-bold text-primary">
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

            {/* Floating Action Bar (above bottom nav on mobile, fixed bottom on desktop)
                - 모바일: 아이콘 정사각 버튼(h-9 w-9), 라벨 숨김 — 6개까지 들어가도 잘림 없음
                - sm↑: 기존 라벨+아이콘 유지 */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))] sm:bottom-4 left-0 right-0 sm:left-auto sm:right-4 z-50 animate-in slide-in-from-bottom-4 duration-200 sm:w-auto flex justify-center sm:justify-end px-3 sm:px-0">
                    <div className="w-fit bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg px-2.5 sm:px-4 py-1.5 sm:py-2">
                        <div className="flex items-center gap-1.5 sm:gap-2.5 justify-end">
                            <span className="text-[12px] sm:text-xs text-slate-700 font-semibold sm:font-medium sm:text-slate-500 shrink-0 mr-0.5">{selectedIds.size}건</span>
                            {canStock && (
                                <Button variant="outline" onClick={onShowDelete}
                                    className="text-red-600 border-red-200 hover:bg-red-600 hover:text-white h-9 w-9 p-0 sm:w-auto sm:px-3 text-[11px] sm:text-xs rounded-lg gap-0 sm:gap-1 shrink-0">
                                    <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0" />
                                    <span className="hidden sm:inline">삭제</span>
                                </Button>
                            )}
                            {canMilling && (
                                <Button variant="outline" onClick={onAddToCart}
                                    className="text-emerald-600 border-emerald-200 hover:bg-emerald-600 hover:text-white h-9 w-9 p-0 sm:w-auto sm:px-3 text-[11px] sm:text-xs rounded-lg gap-0 sm:gap-1 shrink-0">
                                    <ShoppingCart className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0" />
                                    <span className="hidden sm:inline">담기</span>
                                </Button>
                            )}
                            {isAllAvailable && canMilling && (
                                <Button variant="outline" onClick={onStartMilling}
                                    className="text-primary border-primary/30 hover:bg-primary hover:text-white h-9 w-9 p-0 sm:w-auto sm:px-3 text-[11px] sm:text-xs rounded-lg gap-0 sm:gap-1 shrink-0">
                                    <ClipboardList className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0" />
                                    <span className="hidden sm:inline">도정</span>
                                </Button>
                            )}
                            {isAllAvailable && canSales && (
                                <Button variant="outline" onClick={onShowRelease}
                                    className="text-slate-600 border-slate-200 hover:bg-slate-600 hover:text-white h-9 w-9 p-0 sm:w-auto sm:px-3 text-[11px] sm:text-xs rounded-lg gap-0 sm:gap-1 shrink-0">
                                    <Truck className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0" />
                                    <span className="hidden sm:inline">출고</span>
                                </Button>
                            )}
                            {isAllReleased && canSales && (
                                <Button variant="outline" onClick={onCancelRelease} disabled={isCanceling}
                                    className="text-amber-700 border-amber-200 hover:bg-amber-600 hover:text-white h-9 w-9 p-0 sm:w-auto sm:px-3 text-[11px] sm:text-xs rounded-lg gap-0 sm:gap-1 shrink-0">
                                    <RotateCcw className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0" />
                                    <span className="hidden sm:inline">{isCanceling ? '취소중' : '출고취소'}</span>
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
