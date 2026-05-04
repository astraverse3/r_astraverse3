'use client'

import type { PackageItem } from '@/app/actions/packages'
import { PackageListClient } from './package-list-client'

interface Props {
    items: PackageItem[]
}

export function RicePackagePanel({ items }: Props) {
    const totalCount = items.reduce(
        (sum, it) => sum + (it.type === 'group' ? it.rows.length : 1),
        0,
    )

    return (
        <div className="grid grid-cols-1 gap-2 px-1">
            <section className="flex items-center justify-between text-xs text-slate-500 px-2 pt-1">
                <span className="tabular-nums">검색결과 {totalCount.toLocaleString()}건</span>
            </section>

            <PackageListClient items={items} />
        </div>
    )
}
