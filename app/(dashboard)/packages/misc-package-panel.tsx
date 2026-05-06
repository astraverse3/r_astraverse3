'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { deleteMiscPackage, type PackageItem, type PackageRow } from '@/app/actions/packages'
import { triggerDataUpdate } from '@/components/last-updated'
import { PackageListClient } from './package-list-client'
import { PackageSearchDialog } from './package-search-dialog'
import { ActivePackageFilters } from './active-package-filters'
import { MiscPackageDialog } from './misc-package-dialog'
import { EditMiscPackageDialog } from './edit-misc-package-dialog'

interface Props {
    items: PackageItem[]
    varieties: { id: number; name: string }[]
}

/**
 * 잡곡 제품재고 패널.
 * [+ 포장하기]: 진입점 ② — stock selector 포함 다이얼로그.
 * [+ 매입 등록]: #8에서 활성.
 * 행 메뉴 (수정/삭제): MILLED만 활성. PURCHASED는 #8과 함께.
 */
export function MiscPackagePanel({ items, varieties }: Props) {
    const router = useRouter()
    const [packageOpen, setPackageOpen] = useState(false)
    const [editPackageId, setEditPackageId] = useState<number | null>(null)
    const [editOpen, setEditOpen] = useState(false)

    const totalCount = items.reduce(
        (sum, it) => sum + (it.type === 'group' ? it.rows.length : 1),
        0,
    )

    const handleEditRow = (row: PackageRow) => {
        if (row.source !== 'MILLED') return
        setEditPackageId(row.id)
        setEditOpen(true)
    }

    const handleDeleteRow = async (row: PackageRow) => {
        if (row.source !== 'MILLED') return
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
    }

    return (
        <div className="grid grid-cols-1 gap-2 px-1">
            <section className="flex items-center justify-end gap-2 px-1">
                <PackageSearchDialog category="MISC_GRAIN" varieties={varieties} />
                {/* 핸드오프 §3.4: 추가 버튼은 primary. 잡곡은 분기가 둘이라 첫 번째는 보조(outline)로 톤다운 */}
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPackageOpen(true)}
                    className="h-8 px-3 font-semibold rounded-md"
                >
                    + 포장하기
                </Button>
                <Button
                    size="sm"
                    disabled
                    className="h-8 px-3 bg-primary text-primary-foreground font-semibold rounded-md"
                    title="준비중 (#8에서 활성화)"
                >
                    + 매입 등록
                </Button>
            </section>

            <MiscPackageDialog
                open={packageOpen}
                onOpenChange={setPackageOpen}
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

            <ActivePackageFilters totalCount={totalCount} varieties={varieties} />

            <PackageListClient
                items={items}
                emptyMessage="아직 등록된 잡곡 제품재고가 없어요."
                emptyHint="상단 [+ 포장하기]로 잡곡 원물재고를 포장해 등록하세요."
                onEditRow={handleEditRow}
                onDeleteRow={handleDeleteRow}
            />
        </div>
    )
}
