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
    // 포장 = MILLING_MANAGE / 매입 = STOCK_MANAGE
    // @ts-ignore
    const canMill = hasPermission(session?.user, 'MILLING_MANAGE')
    // @ts-ignore
    const canPurchase = hasPermission(session?.user, 'STOCK_MANAGE')
    const canAnyRow = canMill || canPurchase

    const [packageOpen, setPackageOpen] = useState(false)
    const [purchaseOpen, setPurchaseOpen] = useState(false)
    const [editPackageId, setEditPackageId] = useState<number | null>(null)
    const [editOpen, setEditOpen] = useState(false)
    const [editPurchaseId, setEditPurchaseId] = useState<number | null>(null)
    const [editPurchaseOpen, setEditPurchaseOpen] = useState(false)

    const totalCount = items.reduce(
        (sum, it) => sum + (it.type === 'group' ? it.rows.length : 1),
        0,
    )

    const handleEditRow = (row: PackageRow) => {
        if (row.source === 'MILLED') {
            if (!canMill) {
                toast.error('포장 수정 권한(MILLING_MANAGE)이 없어요.')
                return
            }
            setEditPackageId(row.id)
            setEditOpen(true)
        } else if (row.source === 'PURCHASED') {
            if (!canPurchase) {
                toast.error('매입 수정 권한(STOCK_MANAGE)이 없어요.')
                return
            }
            setEditPurchaseId(row.id)
            setEditPurchaseOpen(true)
        }
    }

    const handleDeleteRow = async (row: PackageRow) => {
        if (row.source === 'MILLED') {
            if (!canMill) {
                toast.error('포장 삭제 권한(MILLING_MANAGE)이 없어요.')
                return
            }
            const ok = confirm(
                `이 포장을 삭제할까요?\n${row.variety} / ${row.producer} / ${row.spec} × ${row.qty}개 (${row.sub.toLocaleString()}kg)\n\n포장 자체가 없었던 것으로 처리되며, 원물 재고가 복원됩니다.`,
            )
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
                toast.error('매입 삭제 권한(STOCK_MANAGE)이 없어요.')
                return
            }
            const ok = confirm(
                `이 매입을 삭제할까요?\n${row.variety} / ${row.producer} / ${row.spec} × ${row.qty}개 (${row.sub.toLocaleString()}kg)`,
            )
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
                <PackageExcelButtons filters={filters} />
                <PackageSearchDialog category="MISC_GRAIN" varieties={varieties} />
                {/* 핸드오프 §3.4: 추가 버튼은 primary. 잡곡은 분기가 둘이라 첫 번째는 보조(outline)로 톤다운 */}
                {canMill && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPackageOpen(true)}
                        className="h-8 px-3 font-semibold rounded-md"
                    >
                        + 포장<span className="hidden sm:inline">하기</span>
                    </Button>
                )}
                {canPurchase && (
                    <Button
                        size="sm"
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

            <ActivePackageFilters totalCount={totalCount} varieties={varieties} />

            <PackageListClient
                items={items}
                emptyMessage="아직 등록된 잡곡 제품재고가 없어요."
                emptyHint="상단 [+ 포장하기]로 잡곡 원물재고를 포장해 등록하세요."
                onEditRow={canAnyRow ? handleEditRow : undefined}
                onDeleteRow={canAnyRow ? handleDeleteRow : undefined}
            />
        </div>
    )
}
