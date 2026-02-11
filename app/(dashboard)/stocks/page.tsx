import { getStocks, GetStocksParams, getStockGroups } from '@/app/actions/stock'
import { getVarieties, getFarmersWithGroups } from '@/app/actions/admin'
import { AddStockDialog } from './add-stock-dialog'
import { StockFilters } from './stock-filters'
import { StockExcelButtons } from './stock-excel-buttons'
import { StockPageWrapper } from './stock-page-wrapper'
import { Suspense } from 'react'

export interface Stock {
    id: number
    productionYear: number
    bagNo: number
    weightKg: number
    status: string
    incomingDate: Date
    createdAt: Date
    updatedAt: Date
    lotNo: string | null
    variety: {
        name: string
        type: string
    }
    farmer: {
        name: string
        group: {
            certType: string
            name: string
        }
    }
}

export default async function StocksPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const resolvedParams = await searchParams

    const filters: GetStocksParams = {
        productionYear: typeof resolvedParams.productionYear === 'string' ? resolvedParams.productionYear : undefined,
        varietyId: typeof resolvedParams.varietyId === 'string' ? resolvedParams.varietyId : undefined,
        farmerId: typeof resolvedParams.farmerId === 'string' ? resolvedParams.farmerId : undefined,
        farmerName: typeof resolvedParams.farmerName === 'string' ? resolvedParams.farmerName : undefined, // Added
        status: typeof resolvedParams.status === 'string' ? resolvedParams.status : undefined,
        sort: typeof resolvedParams.sort === 'string' ? resolvedParams.sort : undefined,
        certType: typeof resolvedParams.certType === 'string' ? resolvedParams.certType : undefined,
    }

    // 4. Fetch Stock Groups (Server Side Grouping for Lazy Loading)
    const stockGroupsResult = await getStockGroups({
        productionYear: typeof resolvedParams.productionYear === 'string' ? resolvedParams.productionYear : undefined,
        varietyId: typeof resolvedParams.varietyId === 'string' ? resolvedParams.varietyId : undefined,
        farmerId: typeof resolvedParams.farmerId === 'string' ? resolvedParams.farmerId : undefined,
        farmerName: typeof resolvedParams.farmerName === 'string' ? resolvedParams.farmerName : undefined,
        status: typeof resolvedParams.status === 'string' ? resolvedParams.status : undefined,
        certType: typeof resolvedParams.certType === 'string' ? resolvedParams.certType : undefined,
        sort: typeof resolvedParams.sort === 'string' ? resolvedParams.sort : undefined,
    })

    const initialGroups = stockGroupsResult.success && stockGroupsResult.data ? stockGroupsResult.data : []

    const varietyResult = await getVarieties()
    const varieties = (varietyResult.success && varietyResult.data ? varietyResult.data : []) as { id: number; name: string }[]

    const farmerResult = await getFarmersWithGroups()
    const farmers = (farmerResult.success && farmerResult.data ? farmerResult.data : []) as { id: number; name: string, group: { id: number; name: string; certType: string; certNo: string; cropYear: number } }[]

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <StockPageWrapper
                initialGroups={initialGroups}
                farmers={farmers}
                varieties={varieties}
                filters={filters}
                filtersSlot={<StockFilters varieties={varieties} farmers={farmers} />}
                excelSlot={<StockExcelButtons />}
                addDialogSlot={<AddStockDialog varieties={varieties} farmers={farmers} />}
            />
        </Suspense>
    )
}
