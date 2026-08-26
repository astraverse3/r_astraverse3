'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'
import type { GetPackagesParams, PackageItem } from '@/app/actions/packages'
import { PackageListClient } from './package-list-client'
import { PackageSearchDialog } from './package-search-dialog'
import { ActivePackageFilters } from './active-package-filters'
import { PackageExcelButtons } from './package-excel-buttons'
import { RepackToggleButton } from './repack-toggle-button'

interface Props {
    items: PackageItem[]
    varieties: { id: number; name: string }[]
    filters: GetPackagesParams
}

export function RicePackagePanel({ items, varieties, filters }: Props) {
    const { data: session } = useSession()
    // 재포장 = 포장 작업 (결정 #43 §3.7) — 잡곡 패널의 canMill과 같은 키
    const canRepack = hasPermission(session?.user, 'OPERATION_MANAGE')
    const [selectMode, setSelectMode] = useState(false)
    const totalCount = items.reduce(
        (sum, it) => sum + (it.type === 'group' ? it.rows.length : 1),
        0,
    )

    return (
        <div className="grid grid-cols-1 gap-2 px-1">
            {/* 조회 도구(엑셀·검색) │ 액션(재포장). 재포장 모드 동안 조회 도구는 잠근다 */}
            <section className="flex items-center justify-end gap-2 px-1">
                <PackageExcelButtons filters={filters} disabled={selectMode} />
                <PackageSearchDialog category="RICE" varieties={varieties} disabled={selectMode} />
                {canRepack && (
                    <>
                        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
                        <RepackToggleButton active={selectMode} onToggle={setSelectMode} />
                    </>
                )}
            </section>

            <ActivePackageFilters totalCount={totalCount} varieties={varieties} />

            <PackageListClient
                items={items}
                selectMode={selectMode}
                onExitSelectMode={() => setSelectMode(false)}
            />
        </div>
    )
}
