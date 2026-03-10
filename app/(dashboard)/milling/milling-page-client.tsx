'use client'

import { ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GetMillingLogsParams } from '@/app/actions/milling'
import { MillingExcelButton } from './milling-excel-button'
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'

interface MillingPageClientProps {
    children: ReactNode
    filtersSlot: ReactNode
    selectedIds: Set<number>
    onShowDelete: () => void
    filters?: GetMillingLogsParams
}

export function MillingPageClient({
    children,
    filtersSlot,
    selectedIds,
    onShowDelete,
    filters
}: MillingPageClientProps) {
    const { data: session } = useSession()
    // @ts-ignore
    const canManage = hasPermission(session?.user, 'MILLING_MANAGE')

    return (
        <div className="grid grid-cols-1 gap-1 pb-24 pt-1.5 sm:px-6 sm:pt-6 sm:pb-8 flex-1 flex flex-col">
            {/* Header */}
            <section className="flex flex-col gap-2 pt-2 px-1">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        {/* Delete button only on desktop (mobile uses floating bar) */}
                        {canManage && selectedIds.size > 0 && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={onShowDelete}
                                className="hidden sm:flex"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                삭제 ({selectedIds.size})
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <MillingExcelButton filters={filters} />
                        {filtersSlot}
                    </div>
                </div>
            </section>

            {children}

            {/* Floating Action Bar (mobile) */}
            {selectedIds.size > 0 && canManage && (
                <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] sm:bottom-4 left-0 right-0 sm:left-auto sm:right-4 z-40 animate-in slide-in-from-bottom-4 duration-200 sm:w-auto flex justify-center sm:justify-end sm:hidden">
                    <div className="w-fit bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-medium shrink-0">{selectedIds.size}건 선택</span>
                            <Button variant="outline" size="sm" onClick={onShowDelete}
                                className="text-red-600 border-red-200 hover:bg-red-600 hover:text-white h-7 px-2 text-[10px] rounded-lg gap-0.5">
                                <Trash2 className="h-3 w-3 shrink-0" />삭제
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
