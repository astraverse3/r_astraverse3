'use client'

import React, { Suspense, Fragment } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FarmerListWrapper, useBulkDelete } from './farmer-list-wrapper'
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'

interface Farmer {
    id: number
    name: string
    farmerNo: string
    items: string | null
    phone: string | null
    groupId: number
    group: {
        id: number
        code: string
        name: string
        certNo: string
        certType: string
        cropYear: number
    }
}

export function FarmerPageClient({
    farmers,
    filtersSlot,
    excelSlot,
    addDialogSlot
}: {
    farmers: Farmer[]
    filtersSlot: React.ReactNode
    excelSlot: React.ReactNode
    addDialogSlot: React.ReactNode
}) {
    const { selectedIds, setSelectedIds, showDeleteDialog, DeleteDialog } = useBulkDelete()
    const { data: session } = useSession()
    // @ts-ignore
    const canManage = hasPermission(session?.user, 'FARMER_MANAGE')

    return (
        <div className="grid grid-cols-1 gap-1 pb-24 sm:pb-0 px-1.5 sm:px-0">
            <section className="flex flex-col gap-2 pt-2">
                <div className="flex items-center justify-between gap-2">
                    {/* PC View Delete Button */}
                    {canManage && (
                        <Button
                            variant={selectedIds.size > 0 ? "destructive" : "outline"}
                            size="sm"
                            onClick={showDeleteDialog}
                            disabled={selectedIds.size === 0}
                            className="hidden sm:flex"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            삭제 {selectedIds.size > 0 && `(${selectedIds.size})`}
                        </Button>
                    )}
                    {/* Mobile View Selected Count */}
                    <div className="sm:hidden text-sm font-medium text-red-500">
                        {selectedIds.size > 0 ? `${selectedIds.size}개 선택` : ''}
                    </div>

                    <div className="flex items-center justify-end gap-2 flex-wrap">
                        <Fragment key="filters">{filtersSlot}</Fragment>
                        <Fragment key="excel">{excelSlot}</Fragment>
                        {canManage && <Fragment key="add">{addDialogSlot}</Fragment>}
                    </div>
                </div>
            </section>

            <FarmerListWrapper
                farmers={farmers}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onDeleteClick={showDeleteDialog}
            />

            <DeleteDialog />

            {/* Floating Action Bar (mobile) */}
            {canManage && selectedIds.size > 0 && (
                <div className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] sm:bottom-4 left-0 right-0 sm:left-auto sm:right-4 z-50 animate-in slide-in-from-bottom-4 duration-200 sm:w-auto flex justify-center sm:hidden">
                    <div className="w-fit bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-medium shrink-0">{selectedIds.size}개 선택</span>
                            <Button variant="outline" size="sm" onClick={showDeleteDialog}
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
