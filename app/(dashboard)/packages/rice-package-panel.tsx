'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'
import type { GetPackagesParams, PackageItem, PackageRow } from '@/app/actions/packages'
import { PackageListClient, type PackageSelectMode } from './package-list-client'
import { PackageSearchDialog } from './package-search-dialog'
import { ActivePackageFilters } from './active-package-filters'
import { PackageExcelButtons } from './package-excel-buttons'
import { RepackToggleButton } from './repack-toggle-button'
import { DeductToggleButton } from './deduct-toggle-button'
import { MovementHistoryDialog } from './movement-history-dialog'

interface Props {
    items: PackageItem[]
    varieties: { id: number; name: string }[]
    filters: GetPackagesParams
}

export function RicePackagePanel({ items, varieties, filters }: Props) {
    const { data: session } = useSession()
    // 재포장·차감 = 포장 작업 (결정 #43 §3.7 · N4) — 잡곡 패널의 canMill과 같은 키
    const canOperate = hasPermission(session?.user, 'OPERATION_MANAGE')
    // 두 선택 모드는 배타 — 하나로 관리한다 (D4)
    const [mode, setMode] = useState<PackageSelectMode>(null)
    // 차감 이력 다이얼로그 (D6) — 벼 탭 ⋮ 메뉴는 이것 하나다
    const [historyRow, setHistoryRow] = useState<PackageRow | null>(null)
    const [historyOpen, setHistoryOpen] = useState(false)

    const allRows = items.flatMap(it => (it.type === 'group' ? it.rows : [it]))
    const totalCount = allRows.length
    const deductedCount = allRows.filter(r => r.available <= 0).length

    return (
        <div className="grid grid-cols-1 gap-2 px-1">
            {/* 도구 그룹(엑셀·재포장·차감·검색). 재포장·차감은 새 데이터를 만드는 게 아니라
                가진 재고를 다루는 도구라 여기 둔다. 벼 탭은 등록 버튼이 없어 구분선도 없다.
                선택 모드 동안 나머지 도구는 잠근다 — 필터를 바꿔 선택이 날아가는 사고를 막는다 */}
            <section className="flex items-center justify-end gap-2 px-1">
                <PackageExcelButtons filters={filters} disabled={mode !== null} />
                {canOperate && (
                    <RepackToggleButton
                        active={mode === 'repack'}
                        disabled={mode === 'deduct'}
                        onToggle={next => setMode(next ? 'repack' : null)}
                    />
                )}
                {canOperate && (
                    <DeductToggleButton
                        active={mode === 'deduct'}
                        disabled={mode === 'repack'}
                        onToggle={next => setMode(next ? 'deduct' : null)}
                    />
                )}
                <PackageSearchDialog category="RICE" varieties={varieties} disabled={mode !== null} />
            </section>

            <ActivePackageFilters
                totalCount={totalCount}
                varieties={varieties}
                deductedCount={deductedCount}
            />

            <PackageListClient
                items={items}
                mode={mode}
                onExitSelectMode={() => setMode(null)}
                onHistoryRow={row => {
                    setHistoryRow(row)
                    setHistoryOpen(true)
                }}
            />

            <MovementHistoryDialog
                open={historyOpen}
                onOpenChange={o => {
                    setHistoryOpen(o)
                    if (!o) setHistoryRow(null)
                }}
                row={historyRow}
                canCancel={canOperate}
            />
        </div>
    )
}
