'use client'

import { useState } from 'react'
import { Inbox } from 'lucide-react'
import type { PackageItem, PackageRow as PackageRowData } from '@/app/actions/packages'
import {
    PackageColumnHeader,
    PackageGroupRow,
    PackageSingleRow,
    type PackageRowActions,
} from './package-row'
import {
    MobilePackageGroupCard,
    MobilePackageSingleCard,
} from './mobile-package-card'

interface Props {
    items: PackageItem[]
    emptyMessage?: string
    emptyHint?: string
    /** 행 액션 콜백 — 미전달 시 메뉴 안 보임 (벼 탭은 미전달, 잡곡 탭은 전달) */
    onEditRow?: (row: PackageRowData) => void
    onDeleteRow?: (row: PackageRowData) => void
}

/**
 * 제품재고 목록 — 데스크톱 테이블 + 모바일 카드 통합 클라이언트.
 *  - 그룹 펼침 상태는 varietyId 기준 Set으로 관리
 *  - 빈 상태 메시지/힌트는 props로 주입 (벼/잡곡 패널이 컨텍스트 다르게 줌)
 */
export function PackageListClient({ items, emptyMessage, emptyHint, onEditRow, onDeleteRow }: Props) {
    const [openGroups, setOpenGroups] = useState<Set<number>>(new Set())
    const actions: PackageRowActions | undefined =
        onEditRow || onDeleteRow ? { onEdit: onEditRow, onDelete: onDeleteRow } : undefined

    const toggle = (varietyId: number) => {
        setOpenGroups(prev => {
            const next = new Set(prev)
            if (next.has(varietyId)) next.delete(varietyId)
            else next.add(varietyId)
            return next
        })
    }

    if (items.length === 0) {
        return (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <Inbox className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-sm text-slate-600">
                    {emptyMessage ?? '아직 등록된 제품재고가 없어요.'}
                </p>
                {emptyHint && <p className="text-xs text-slate-400">{emptyHint}</p>}
            </div>
        )
    }

    return (
        <>
            {/* 모바일 카드 리스트 */}
            <section className="sm:hidden flex flex-col gap-2 px-1">
                {items.map(item =>
                    item.type === 'group' ? (
                        <MobilePackageGroupCard
                            key={`g-${item.varietyId}`}
                            item={item}
                            isOpen={openGroups.has(item.varietyId)}
                            onToggle={() => toggle(item.varietyId)}
                            actions={actions}
                        />
                    ) : (
                        <MobilePackageSingleCard
                            key={`s-${item.id}`}
                            item={item}
                            actions={actions}
                        />
                    ),
                )}
            </section>

            {/* 데스크톱 테이블 */}
            <section className="hidden sm:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <PackageColumnHeader />
                <div className="divide-y divide-slate-100">
                    {items.map(item =>
                        item.type === 'group' ? (
                            <PackageGroupRow
                                key={`g-${item.varietyId}`}
                                item={item}
                                isOpen={openGroups.has(item.varietyId)}
                                onToggle={() => toggle(item.varietyId)}
                                actions={actions}
                            />
                        ) : (
                            <PackageSingleRow key={`s-${item.id}`} item={item} actions={actions} />
                        ),
                    )}
                </div>
            </section>
        </>
    )
}
