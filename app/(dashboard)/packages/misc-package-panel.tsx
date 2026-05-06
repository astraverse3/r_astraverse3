'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { PackageItem } from '@/app/actions/packages'
import { PackageListClient } from './package-list-client'
import { PackageSearchDialog } from './package-search-dialog'
import { ActivePackageFilters } from './active-package-filters'
import { MiscPackageDialog } from './misc-package-dialog'

interface Props {
    items: PackageItem[]
    varieties: { id: number; name: string }[]
}

/**
 * 잡곡 제품재고 패널.
 * [+ 포장하기]: 진입점 ② — stock selector 포함 다이얼로그.
 * [+ 매입 등록]: #8에서 활성.
 */
export function MiscPackagePanel({ items, varieties }: Props) {
    const router = useRouter()
    const [packageOpen, setPackageOpen] = useState(false)

    const totalCount = items.reduce(
        (sum, it) => sum + (it.type === 'group' ? it.rows.length : 1),
        0,
    )

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

            <ActivePackageFilters totalCount={totalCount} varieties={varieties} />

            <PackageListClient
                items={items}
                emptyMessage="아직 등록된 잡곡 제품재고가 없어요."
                emptyHint="상단 [+ 포장하기]로 잡곡 원물재고를 포장해 등록하세요."
            />
        </div>
    )
}
