'use client'

import { ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'

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
    const { data: session } = useSession()
    // @ts-ignore
    const canManage = hasPermission(session?.user, 'VARIETY_MANAGE')

    return (
        <div className="grid grid-cols-1 gap-1 pb-24">
            {/* Header */}
            <section className="flex flex-col gap-2 pt-2 px-1">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        {canManage && selectedIds.size > 0 && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={onShowDelete}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                삭제 ({selectedIds.size})
                            </Button>
                        )}
                        {canManage && selectedIds.size === 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="text-slate-400"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                삭제
                            </Button>
                        )}
                    </div>
                    <div>{canManage && addDialogSlot}</div>
                </div>
            </section>

            {children}

            <p className="text-xs text-slate-400 text-center px-4">
                * 등록된 품종은 재고 관리 및 도정 기록 시 선택할 수 있습니다.
            </p>
        </div>
    )
}
