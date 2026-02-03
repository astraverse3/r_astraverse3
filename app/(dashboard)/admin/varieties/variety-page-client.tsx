'use client'

import { ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface VarietyPageClientProps {
    children: ReactNode
    addDialogSlot: ReactNode
    selectedIds: Set<number>
    onShowDelete: () => void
}

export function VarietyPageClient({
    children,
    addDialogSlot,
    selectedIds,
    onShowDelete
}: VarietyPageClientProps) {
    return (
        <div className="space-y-6 pb-20">
            {/* Header with Buttons */}
            <div className="flex items-center justify-between">
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
                <div>{addDialogSlot}</div>
            </div>

            {children}

            <p className="text-xs text-slate-400 text-center px-4">
                * 등록된 품종은 재고 관리 및 도정 기록 시 선택할 수 있습니다.
            </p>
        </div>
    )
}
