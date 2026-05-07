'use client'

import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'
import type { GetMiscStocksParams } from '@/app/actions/misc-stock'
import { AddMiscStockDialog } from './add-misc-stock-dialog'
import { MiscStockFilters } from './misc-stock-filters'
import { MiscStockListClient } from './misc-stock-list-client'
import { ActiveMiscFilters } from './active-misc-filters'
import { MiscStockExcelButtons } from './misc-stock-excel-buttons'

interface Farmer {
    id: number
    name: string
    farmerNo: string | null
    group: {
        id: number
        name: string
        certType: string
        certNo: string
        cropYear: number
    } | null
}

interface Variety {
    id: number
    name: string
}

interface Props {
    farmers: Farmer[]
    varieties: Variety[]
    millingVendors: string[]
    sproutingVendors: string[]
    initialStocks: any[]
    filters: GetMiscStocksParams
}

export function MiscStockPanel({
    farmers,
    varieties,
    millingVendors,
    sproutingVendors,
    initialStocks,
    filters,
}: Props) {
    const { data: session } = useSession()
    // @ts-ignore
    const canStock = hasPermission(session?.user, 'STOCK_MANAGE')

    const totalCount = initialStocks.length

    return (
        <div className="grid grid-cols-1 gap-2">
            {/* Header */}
            <section className="flex flex-col gap-2 px-1">
                <div className="flex items-center justify-end gap-2">
                    <MiscStockExcelButtons filters={filters} />
                    <MiscStockFilters varieties={varieties} />
                    {canStock && (
                        <AddMiscStockDialog
                            farmers={farmers}
                            varieties={varieties}
                            millingVendors={millingVendors}
                            sproutingVendors={sproutingVendors}
                        />
                    )}
                </div>
            </section>

            <ActiveMiscFilters totalCount={totalCount} varieties={varieties} />
            <MiscStockListClient
                initialStocks={initialStocks}
                filters={filters}
                farmers={farmers}
                varieties={varieties}
                millingVendors={millingVendors}
                sproutingVendors={sproutingVendors}
            />
        </div>
    )
}
