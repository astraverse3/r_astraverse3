'use client'

import { ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBulkDeleteStocks } from './use-bulk-delete-stocks'

interface StockPageClientProps {
    children: ReactNode
    filtersSlot: ReactNode
    excelSlot: ReactNode
    addDialogSlot: ReactNode
    selectedIds: Set<number>
    onShowDelete: () => void
}

export function StockPageClient({
    children,
    filtersSlot,
    excelSlot,
    addDialogSlot,
    selectedIds,
    onShowDelete
}: StockPageClientProps) {
    return (
        <div className="grid grid-cols-1 gap-1 pb-24">
            {/* Header */}
            <section className="flex flex-col gap-2 pt-2 px-1">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        {selectedIds.size > 0 && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={onShowDelete}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                선택 삭제 ({selectedIds.size})
                            </Button>
                        )}
                        {selectedIds.size === 0 && (
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
