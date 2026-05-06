'use client'

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { PackageItem } from '@/app/actions/packages'
import { PackageListClient } from './package-list-client'
import { PackageSearchDialog } from './package-search-dialog'
import { ActivePackageFilters } from './active-package-filters'

interface Props {
    items: PackageItem[]
    varieties: { id: number; name: string }[]
}

/**
 * 잡곡 제품재고 패널.
 * #7a: [+ 포장하기] 트리거 자리만(클릭 시 토스트). 본 구현은 #7b.
 * [+ 매입 등록]은 여전히 #8에서 활성.
 */
export function MiscPackagePanel({ items, varieties }: Props) {
    const totalCount = items.reduce(
        (sum, it) => sum + (it.type === 'group' ? it.rows.length : 1),
        0,
    )

    const handlePackageClick = () => {
        toast.info('포장 다이얼로그는 #7b에서 활성화돼요.')
    }

    return (
        <div className="grid grid-cols-1 gap-2 px-1">
            <section className="flex items-center justify-end gap-2 px-1">
                <PackageSearchDialog category="MISC_GRAIN" varieties={varieties} />
                {/* 핸드오프 §3.4: 추가 버튼은 primary. 잡곡은 분기가 둘이라 첫 번째는 보조(outline)로 톤다운 */}
                <Button
                    size="sm"
                    variant="outline"
                    onClick={handlePackageClick}
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

            <ActivePackageFilters totalCount={totalCount} varieties={varieties} />

            <PackageListClient
                items={items}
                emptyMessage="아직 등록된 잡곡 제품재고가 없어요."
                emptyHint="잡곡 포장(#7b) · 매입 등록(#8) 다이얼로그가 머지되면 채워집니다."
            />
        </div>
    )
}
