'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { deleteMiscPackage, deleteMiscPurchase, type GetPackagesParams, type PackageItem, type PackageRow } from '@/app/actions/packages'
import { hasPermission } from '@/lib/permissions'
import { triggerDataUpdate } from '@/components/last-updated'
import { PackageListClient } from './package-list-client'
import { PackageSearchDialog } from './package-search-dialog'
import { ActivePackageFilters } from './active-package-filters'
import { PackageExcelButtons } from './package-excel-buttons'
import { MiscPackageDialog } from './misc-package-dialog'
import { EditMiscPackageDialog } from './edit-misc-package-dialog'
import { MiscPurchaseDialog } from './misc-purchase-dialog'
import { EditMiscPurchaseDialog } from './edit-misc-purchase-dialog'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { RepackToggleButton } from './repack-toggle-button'
import { DeductToggleButton } from './deduct-toggle-button'
import { MovementHistoryDialog } from './movement-history-dialog'
import type { PackageSelectMode } from './package-list-client'

interface Props {
    items: PackageItem[]
    varieties: { id: number; name: string }[]
    filters: GetPackagesParams
}

/**
 * 잡곡 제품재고 패널.
 * [+ 포장하기]: 진입점 ② — stock selector 포함 다이얼로그.
 * [+ 매입 등록]: #8b — 외부매입 잡곡 등록 다이얼로그.
 * 행 메뉴 (수정/삭제): MILLED는 잡곡 포장 다이얼로그(#7c), PURCHASED는 잡곡 매입 다이얼로그(#8c)로 분기.
 */
export function MiscPackagePanel({ items, varieties, filters }: Props) {
    const router = useRouter()
    const { data: session } = useSession()
    // 매트릭스: docs/permission-matrix.md
    // 포장 = OPERATION_MANAGE / 매입 = SUPPLY_MANAGE
    // @ts-ignore
    const canMill = hasPermission(session?.user, 'OPERATION_MANAGE')
    // @ts-ignore
    const canPurchase = hasPermission(session?.user, 'SUPPLY_MANAGE')
    const canAnyRow = canMill || canPurchase

    const [packageOpen, setPackageOpen] = useState(false)
    const [purchaseOpen, setPurchaseOpen] = useState(false)
    // 재포장·차감도 포장 작업이라 canMill과 같은 권한 (결정 #43 §3.7 · N4).
    // 두 선택 모드는 배타 — 하나로 관리한다 (D4)
    const [mode, setMode] = useState<PackageSelectMode>(null)
    const [editPackageId, setEditPackageId] = useState<number | null>(null)
    const [editOpen, setEditOpen] = useState(false)
    const [editPurchaseId, setEditPurchaseId] = useState<number | null>(null)
    const [editPurchaseOpen, setEditPurchaseOpen] = useState(false)
    // 차감 이력 다이얼로그 (D6)
    const [historyRow, setHistoryRow] = useState<PackageRow | null>(null)
    const [historyOpen, setHistoryOpen] = useState(false)

    const allRows = items.flatMap(it => (it.type === 'group' ? it.rows : [it]))
    const totalCount = allRows.length
    const deductedCount = allRows.filter(r => r.available <= 0).length

    const handleEditRow = (row: PackageRow) => {
        if (row.source === 'MILLED') {
            if (!canMill) {
                toast.error('포장 수정 권한(OPERATION_MANAGE)이 없어요.')
                return
            }
            setEditPackageId(row.id)
            setEditOpen(true)
        } else if (row.source === 'PURCHASED') {
            if (!canPurchase) {
                toast.error('매입 수정 권한(SUPPLY_MANAGE)이 없어요.')
                return
            }
            setEditPurchaseId(row.id)
            setEditPurchaseOpen(true)
        }
    }

    const handleDeleteRow = async (row: PackageRow) => {
        if (row.source === 'MILLED') {
            if (!canMill) {
                toast.error('포장 삭제 권한(OPERATION_MANAGE)이 없어요.')
                return
            }
            const ok = await confirmDialog({
                description: `이 포장을 삭제할까요?\n${row.variety} / ${row.producer} / ${row.spec} × ${row.qty}개 (${row.sub.toLocaleString()}kg)\n\n포장 자체가 없었던 것으로 처리되며, 원물 재고가 복원됩니다.`,
                destructive: true,
                confirmText: '삭제',
            })
            if (!ok) return
            const result = await deleteMiscPackage(row.id)
            if (result.success) {
                toast.success('포장이 삭제되었습니다.')
                triggerDataUpdate()
                router.refresh()
            } else {
                toast.error(result.error || '삭제에 실패했습니다.')
            }
        } else if (row.source === 'PURCHASED') {
            if (!canPurchase) {
                toast.error('매입 삭제 권한(SUPPLY_MANAGE)이 없어요.')
                return
            }
            const ok = await confirmDialog({
                description: `이 매입을 삭제할까요?\n${row.variety} / ${row.producer} / ${row.spec} × ${row.qty}개 (${row.sub.toLocaleString()}kg)`,
                destructive: true,
                confirmText: '삭제',
            })
            if (!ok) return
            const result = await deleteMiscPurchase(row.id)
            if (result.success) {
                toast.success('매입이 삭제되었습니다.')
                triggerDataUpdate()
                router.refresh()
            } else {
                toast.error(result.error || '삭제에 실패했습니다.')
            }
        }
    }

    return (
        <div className="grid grid-cols-1 gap-2 px-1">
            <section className="flex items-center justify-end gap-2 px-1">
                <PackageExcelButtons filters={filters} disabled={mode !== null} />
                {/* 재포장·차감은 도구 그룹(구분선 왼쪽) — 가진 재고를 다루는 도구라
                    등록 버튼과 같은 편에 두지 않는다. 두 토글은 배타 (D4) */}
                {canMill && (
                    <RepackToggleButton
                        active={mode === 'repack'}
                        disabled={mode === 'deduct'}
                        onToggle={next => setMode(next ? 'repack' : null)}
                    />
                )}
                {canMill && (
                    <DeductToggleButton
                        active={mode === 'deduct'}
                        disabled={mode === 'repack'}
                        onToggle={next => setMode(next ? 'deduct' : null)}
                    />
                )}
                <PackageSearchDialog
                    category="MISC_GRAIN"
                    varieties={varieties}
                    disabled={mode !== null}
                />
                <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
                {/* 핸드오프 §3.4: 추가 버튼은 primary. 잡곡은 분기가 둘이라 첫 번째는 보조(outline)로 톤다운 */}
                {canMill && (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={mode !== null}
                        onClick={() => setPackageOpen(true)}
                        className="h-8 px-3 font-semibold rounded-md"
                    >
                        + 포장<span className="hidden sm:inline">하기</span>
                    </Button>
                )}
                {canPurchase && (
                    <Button
                        size="sm"
                        disabled={mode !== null}
                        onClick={() => setPurchaseOpen(true)}
                        className="h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-md"
                    >
                        + 매입<span className="hidden sm:inline"> 등록</span>
                    </Button>
                )}
            </section>

            <MiscPackageDialog
                open={packageOpen}
                onOpenChange={setPackageOpen}
                onSuccess={() => router.refresh()}
            />

            <MiscPurchaseDialog
                open={purchaseOpen}
                onOpenChange={setPurchaseOpen}
                onSuccess={() => router.refresh()}
            />

            <EditMiscPackageDialog
                open={editOpen}
                onOpenChange={(o) => {
                    setEditOpen(o)
                    if (!o) setEditPackageId(null)
                }}
                packageId={editPackageId}
                onSuccess={() => router.refresh()}
            />

            <EditMiscPurchaseDialog
                open={editPurchaseOpen}
                onOpenChange={(o) => {
                    setEditPurchaseOpen(o)
                    if (!o) setEditPurchaseId(null)
                }}
                packageId={editPurchaseId}
                onSuccess={() => router.refresh()}
            />

            <ActivePackageFilters
                totalCount={totalCount}
                varieties={varieties}
                deductedCount={deductedCount}
            />

            <PackageListClient
                items={items}
                emptyMessage="아직 등록된 잡곡 제품재고가 없어요."
                emptyHint="상단 [+ 포장하기]로 잡곡 원물재고를 포장해 등록하세요."
                onEditRow={canAnyRow ? handleEditRow : undefined}
                onDeleteRow={canAnyRow ? handleDeleteRow : undefined}
                onHistoryRow={row => {
                    setHistoryRow(row)
                    setHistoryOpen(true)
                }}
                mode={mode}
                onExitSelectMode={() => setMode(null)}
            />

            <MovementHistoryDialog
                open={historyOpen}
                onOpenChange={o => {
                    setHistoryOpen(o)
                    if (!o) setHistoryRow(null)
                }}
                row={historyRow}
                canCancel={canMill}
            />
        </div>
    )
}
