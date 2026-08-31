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
            {/* 도구 그룹(엑셀·재포장·검색). 재포장은 새 데이터를 만드는 게 아니라 가진 재고를
                다시 나누는 도구라 여기 둔다. 벼 탭은 등록 버튼이 없어 구분선도 없다.
                재포장 모드 동안 나머지 도구는 잠근다 — 필터를 바꿔 선택이 날아가는 사고를 막는다 */}
            <section className="flex items-center justify-end gap-2 px-1">
                <PackageExcelButtons filters={filters} disabled={selectMode} />
                {canRepack && <RepackToggleButton active={selectMode} onToggle={setSelectMode} />}
                <PackageSearchDialog category="RICE" varieties={varieties} disabled={selectMode} />
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
