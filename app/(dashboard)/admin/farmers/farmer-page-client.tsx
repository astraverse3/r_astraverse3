'use client'

import { Suspense } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FarmerListWrapper, useBulkDelete } from './farmer-list-wrapper'

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

    return (
        <div className="grid grid-cols-1 gap-1 pb-24">
            <section className="flex flex-col gap-2 pt-2 px-1">
                <div className="flex items-center justify-between gap-2">
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={showDeleteDialog}
                        disabled={selectedIds.size === 0}
                        className="disabled:opacity-50"
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        선택 삭제 {selectedIds.size > 0 && `(${selectedIds.size})`}
                    </Button>
                    <div className="flex items-center gap-2">
                        {filtersSlot}
                        {excelSlot}
                        {addDialogSlot}
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
        </div>
    )
}
