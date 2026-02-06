'use client'

import { ReactNode } from 'react'
import { Trash2, Truck, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StockPageClientProps {
    children: ReactNode
    filtersSlot: ReactNode
    excelSlot: ReactNode
    addDialogSlot: ReactNode
    selectedIds: Set<number>
    onShowDelete: () => void
    onShowRelease: () => void
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
    onCancelRelease,
    isAllReleased,
    isAllAvailable,
    isCanceling
}: StockPageClientProps) {
    return (
        <div className="grid grid-cols-1 gap-1 pb-24">
            {/* Header */}
            <section className="flex flex-col gap-2 pt-2 px-1">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        {selectedIds.size > 0 ? (
                            <>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={onShowDelete}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    선택 삭제 ({selectedIds.size})
                                </Button>

                                {isAllAvailable && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={onShowRelease}
                                        className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                                    >
                                        <Truck className="mr-2 h-4 w-4" />
                                        출고 처리 ({selectedIds.size})
                                    </Button>
                                )}

                                {isAllReleased && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={onCancelRelease}
                                        disabled={isCanceling}
                                        className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                    >
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        {isCanceling ? '취소 중...' : `출고 취소 (${selectedIds.size})`}
                                    </Button>
                                )}
                            </>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="text-slate-400"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                선택 삭제
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {filtersSlot}
                        {excelSlot}
                        {addDialogSlot}
                    </div>
                </div>
            </section>

            {children}
        </div>
    )
}
