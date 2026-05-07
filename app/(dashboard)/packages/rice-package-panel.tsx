'use client'

import type { GetPackagesParams, PackageItem } from '@/app/actions/packages'
import { PackageListClient } from './package-list-client'
import { PackageSearchDialog } from './package-search-dialog'
import { ActivePackageFilters } from './active-package-filters'
import { PackageExcelButtons } from './package-excel-buttons'

interface Props {
    items: PackageItem[]
    varieties: { id: number; name: string }[]
    filters: GetPackagesParams
}

export function RicePackagePanel({ items, varieties, filters }: Props) {
    const totalCount = items.reduce(
        (sum, it) => sum + (it.type === 'group' ? it.rows.length : 1),
        0,
    )

    return (
        <div className="grid grid-cols-1 gap-2 px-1">
            <section className="flex items-center justify-end gap-2 px-1">
                <PackageExcelButtons filters={filters} />
                <PackageSearchDialog category="RICE" varieties={varieties} />
            </section>

            <ActivePackageFilters totalCount={totalCount} varieties={varieties} />

            <PackageListClient items={items} />
        </div>
    )
}
