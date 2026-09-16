'use client'

import { ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'

interface VarietyPageClientProps {
    children: ReactNode
    addDialogSlot: ReactNode
    searchSlot: ReactNode
}

// 일괄삭제(체크박스 열·상단 삭제 버튼·모바일 선택 FAB)는 2026-09-16에 없앴다 —
// 품종은 하나씩 고치고 어쩌다 하나 지우는 대상이라 행 ⋯ 메뉴로 옮겼고, 그 자리를 검색이 받는다.
export function VarietyPageClient({ children, addDialogSlot, searchSlot }: VarietyPageClientProps) {
    const { data: session } = useSession()
    const canManage = hasPermission(session?.user, 'SUPPLY_MANAGE')

    return (
        <div className="grid grid-cols-1 gap-1 pb-24 sm:pb-2 px-1.5 sm:px-0">
            {/* Header — 검색과 등록 버튼이 한 줄 */}
            <section className="flex flex-col gap-2 pt-2 px-1">
                <div className="flex items-center justify-between gap-2">
                    {searchSlot}
                    <div className="shrink-0">{canManage && addDialogSlot}</div>
                </div>
            </section>

            {children}

            <p className="text-[11px] sm:text-xs text-slate-400 text-center px-4 mt-2">
                * 등록된 품종은 재고 관리 및 도정 기록 시 선택할 수 있습니다.
            </p>
        </div>
    )
}
