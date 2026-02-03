'use client'

import { ReactNode } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface MillingPageClientProps {
    children: ReactNode
    filtersSlot: ReactNode
    selectedIds: Set<number>
    onShowDelete: () => void
}

export function MillingPageClient({
    children,
    filtersSlot,
    selectedIds,
    onShowDelete
}: MillingPageClientProps) {
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
                        <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg h-8 text-xs font-bold px-3">
                            <Link href="/milling/new" className="flex items-center gap-1.5">
                                <Plus className="h-3.5 w-3.5" />
                                작업 등록
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>

            {children}
        </div>
    )
}
