'use client'

import { ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'

interface ReleasePageClientProps {
    children: ReactNode
    filtersSlot: ReactNode
    excelSlot: ReactNode
    selectedIds: Set<number>
    onBulkCancel: () => void
}

export function ReleasePageClient({
    children,
    filtersSlot,
    excelSlot,
    selectedIds,
    onBulkCancel,
}: ReleasePageClientProps) {
    const { data: session } = useSession()
    // @ts-ignore
    const canManage = hasPermission(session?.user, 'STOCK_MANAGE')

    return (
        <div className="grid grid-cols-1 gap-1 pb-24 sm:pb-2 px-1.5 sm:px-0">
            {/* Header */}
            <section className="flex flex-col gap-2 pt-2 px-1">
                <div className="flex items-center justify-between gap-2">
                    {/* Desktop: bulk actions */}
                    <div className="hidden sm:flex items-center gap-2">
                        {canManage && selectedIds.size > 0 ? (
                            <Button
                                variant="destructive"
                                size="sm"
                                className="bg-red-600 hover:bg-red-700"
                                onClick={onBulkCancel}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                출고취소 ({selectedIds.size})
                            </Button>
                        ) : canManage ? (
                            <Button variant="outline" size="sm" disabled className="text-slate-400">
                                <Trash2 className="mr-2 h-4 w-4" />
                                출고취소
                            </Button>
                        ) : null}
                    </div>

                    {/* Mobile: selected count */}
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
                    </div>
                </div>
            </section>

            {children}

            {/* Floating Action Bar (mobile) */}
            {selectedIds.size > 0 && canManage && (
                <div className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] sm:bottom-4 left-0 right-0 sm:left-auto sm:right-4 z-50 animate-in slide-in-from-bottom-4 duration-200 sm:w-auto flex justify-center sm:justify-end sm:hidden">
                    <div className="w-fit bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-medium shrink-0">{selectedIds.size}건 선택</span>
                            <Button variant="outline" size="sm" onClick={onBulkCancel}
                                className="text-red-600 border-red-200 hover:bg-red-600 hover:text-white h-7 px-2 text-[10px] rounded-lg gap-0.5">
                                <Trash2 className="h-3 w-3 shrink-0" />출고취소
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
