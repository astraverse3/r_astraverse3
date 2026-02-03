import { getStocks, GetStocksParams } from '@/app/actions/stock'
import { getVarieties, getFarmersWithGroups } from '@/app/actions/admin'
import { AddStockDialog } from './add-stock-dialog'
import { StockFilters } from './stock-filters'
import { ActiveStockFilters } from './active-filters'
import { StockExcelButtons } from './stock-excel-buttons'
import { StockListClient } from './stock-list-client'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

// Updated Stock Interface to match getStocks return type (relations)
export interface Stock {
    id: number
    productionYear: number
    bagNo: number
    weightKg: number
    status: string
    incomingDate: Date
    createdAt: Date
    updatedAt: Date
    lotNo: string | null // Added LotNo field
    variety: {
        name: string
    }
    farmer: {
        name: string
        group: {
            certType: string
            name: string
        }
    }
}

export default async function StockPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const resolvedParams = await searchParams

    // Parse searchParams into GetStocksParams
    const filters: GetStocksParams = {
        productionYear: typeof resolvedParams.productionYear === 'string' ? resolvedParams.productionYear : undefined,
        varietyId: typeof resolvedParams.varietyId === 'string' ? resolvedParams.varietyId : undefined,
        farmerId: typeof resolvedParams.farmerId === 'string' ? resolvedParams.farmerId : undefined,
        certType: typeof resolvedParams.certType === 'string' ? resolvedParams.certType : undefined,
        status: typeof resolvedParams.status === 'string' ? resolvedParams.status : undefined,
        sort: typeof resolvedParams.sort === 'string' ? resolvedParams.sort : undefined,
    }

    const result = await getStocks(filters)
    // Cast the result data to our Stock interface (Prisma return type is complex)
    const stocks = (result.success && result.data ? result.data : []) as unknown as Stock[]

    // Fetch master data for Dialogs and Filters
    const [varietyResult, farmerResult] = await Promise.all([
        getVarieties(),
        getFarmersWithGroups()
    ]);

    const varieties = (varietyResult.success && varietyResult.data ? varietyResult.data : []) as { id: number; name: string }[]
    const farmers = (farmerResult.success && farmerResult.data ? farmerResult.data : []) as { id: number; name: string, group: { id: number; name: string; certType: string; certNo: string } }[]

    return (
        <div className="grid grid-cols-1 gap-1 pb-24">
            {/* Header */}
            <section className="flex flex-col gap-2 pt-2 px-1">
                <div className="flex items-center justify-end gap-2">
                    <StockFilters varieties={varieties} farmers={farmers} />
                    <StockExcelButtons />
                    <AddStockDialog varieties={varieties} farmers={farmers} />
                </div>
                <ActiveStockFilters />
            </section>

            <StockListClient
                stocks={stocks}
                farmers={farmers}
                varieties={varieties}
                filters={filters}
            />
        </div >
    )
}
