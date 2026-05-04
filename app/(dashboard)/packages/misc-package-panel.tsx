'use client'

import { Button } from '@/components/ui/button'
import type { PackageItem } from '@/app/actions/packages'
import { PackageListClient } from './package-list-client'

interface Props {
    items: PackageItem[]
}

/**
 * 잡곡 제품재고 패널.
 * 헤더 액션의 [+ 포장하기] / [+ 매입 등록]은 비활성("준비중") — 활성화는 #7·#8.
 */
export function MiscPackagePanel({ items }: Props) {
    const totalCount = items.reduce(
        (sum, it) => sum + (it.type === 'group' ? it.rows.length : 1),
        0,
    )

    return (
        <div className="grid grid-cols-1 gap-2 px-1">
            <section className="flex flex-col gap-2 px-1">
                <div className="flex items-center justify-end gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled
                        className="h-8 px-3"
                        title="준비중 (#7에서 활성화)"
                    >
                        + 포장하기
                    </Button>
                    <Button
                        size="sm"
                        disabled
                        className="h-8 px-3"
                        title="준비중 (#8에서 활성화)"
                    >
                        + 매입 등록
                    </Button>
                </div>
            </section>

            <section className="flex items-center justify-between text-xs text-slate-500 px-2 pt-1">
                <span className="tabular-nums">검색결과 {totalCount.toLocaleString()}건</span>
            </section>

            <PackageListClient
                items={items}
                emptyMessage="아직 등록된 잡곡 제품재고가 없어요."
                emptyHint="잡곡 포장(#7) · 매입 등록(#8) 다이얼로그가 머지되면 채워집니다."
            />
        </div>
    )
}
