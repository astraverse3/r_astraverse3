import { GetStocksParams, getStockGroups } from '@/app/actions/stock'
import { getRiceVarieties, getFarmersWithGroups } from '@/app/actions/admin'
import {
    getMiscVarieties,
    getMiscFarmers,
    getMillingVendors,
    getSproutingVendors,
    getMiscStocks,
    type GetMiscStocksParams,
} from '@/app/actions/misc-stock'
import { AddStockDialog } from './add-stock-dialog'
import { StockFilters } from './stock-filters'
import { StockExcelButtons } from './stock-excel-buttons'
import { StockPageWrapper } from './stock-page-wrapper'
import { RawStocksTabs, type RawStockTab } from './raw-stocks-tabs'
import { MiscStockPanel } from './misc/misc-stock-panel'
import { SectionLoader } from '@/components/ui/section-loader'
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
    actualFarmer: string | null
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

    const tab: RawStockTab = resolvedParams.tab === 'misc' ? 'misc' : 'rice'

    return (
        <Suspense fallback={<SectionLoader message="재고를 불러오는 중" />}>
            <div className="grid grid-cols-1 gap-2 pb-24 sm:pb-2 px-1.5 sm:px-0">
                <div className="pt-2 px-1">
                    <RawStocksTabs activeTab={tab} />
                </div>
                {tab === 'misc' ? (
                    <MiscStockPanelLoader resolvedParams={resolvedParams} />
                ) : (
                    <RiceStockPanel resolvedParams={resolvedParams} />
                )}
            </div>
        </Suspense>
    )
}

async function RiceStockPanel({
    resolvedParams,
}: {
    resolvedParams: { [key: string]: string | string[] | undefined }
}) {
    const filters: GetStocksParams = {
        productionYear: typeof resolvedParams.productionYear === 'string' ? resolvedParams.productionYear : undefined,
        varietyId: typeof resolvedParams.varietyId === 'string' ? resolvedParams.varietyId : undefined,
        farmerId: typeof resolvedParams.farmerId === 'string' ? resolvedParams.farmerId : undefined,
        farmerName: typeof resolvedParams.farmerName === 'string' ? resolvedParams.farmerName : undefined,
        status: typeof resolvedParams.status === 'string' ? resolvedParams.status : undefined,
        sort: typeof resolvedParams.sort === 'string' ? resolvedParams.sort : undefined,
        certType: typeof resolvedParams.certType === 'string' ? resolvedParams.certType : undefined,
        weightKg: typeof resolvedParams.weightKg === 'string' ? resolvedParams.weightKg : undefined,
    }

    const stockGroupsResult = await getStockGroups({
        productionYear: typeof resolvedParams.productionYear === 'string' ? resolvedParams.productionYear : undefined,
        varietyId: typeof resolvedParams.varietyId === 'string' ? resolvedParams.varietyId : undefined,
        farmerId: typeof resolvedParams.farmerId === 'string' ? resolvedParams.farmerId : undefined,
        farmerName: typeof resolvedParams.farmerName === 'string' ? resolvedParams.farmerName : undefined,
        status: typeof resolvedParams.status === 'string' ? resolvedParams.status : undefined,
        certType: typeof resolvedParams.certType === 'string' ? resolvedParams.certType : undefined,
        weightKg: typeof resolvedParams.weightKg === 'string' ? resolvedParams.weightKg : undefined,
        sort: typeof resolvedParams.sort === 'string' ? resolvedParams.sort : undefined,
    })

    const initialGroups = stockGroupsResult.success && stockGroupsResult.data ? stockGroupsResult.data : []

    const varietyResult = await getRiceVarieties()
    const varieties = (varietyResult.success && varietyResult.data ? varietyResult.data : []) as { id: number; name: string }[]

    const farmerResult = await getFarmersWithGroups()
    const farmers = (farmerResult.success && farmerResult.data ? farmerResult.data : []) as { id: number; name: string, group: { id: number; name: string; certType: string; certNo: string; cropYear: number } }[]

    return (
        <StockPageWrapper
            initialGroups={initialGroups}
            farmers={farmers}
            varieties={varieties}
            filters={filters}
            filtersSlot={<StockFilters varieties={varieties} farmers={farmers} />}
            excelSlot={<StockExcelButtons filters={filters} />}
            addDialogSlot={<AddStockDialog varieties={varieties} farmers={farmers} />}
        />
    )
}

async function MiscStockPanelLoader({
    resolvedParams,
}: {
    resolvedParams: { [key: string]: string | string[] | undefined }
}) {
    const filters: GetMiscStocksParams = {
        productionYear: typeof resolvedParams.productionYear === 'string' ? resolvedParams.productionYear : undefined,
        varietyId: typeof resolvedParams.varietyId === 'string' ? resolvedParams.varietyId : undefined,
        farmerName: typeof resolvedParams.farmerName === 'string' ? resolvedParams.farmerName : undefined,
        certType: typeof resolvedParams.certType === 'string' ? resolvedParams.certType : undefined,
        sourceType: typeof resolvedParams.sourceType === 'string' ? resolvedParams.sourceType : undefined,
        status: typeof resolvedParams.status === 'string' ? resolvedParams.status : undefined,
        sort: typeof resolvedParams.sort === 'string' ? resolvedParams.sort : undefined,
    }

    const [farmersRes, varietiesRes, millingVendorsRes, sproutingVendorsRes, stocksRes] = await Promise.all([
        getMiscFarmers(),
        getMiscVarieties(),
        getMillingVendors(),
        getSproutingVendors(),
        getMiscStocks(filters),
    ])

    const farmers = farmersRes.success && farmersRes.data ? farmersRes.data : []
    const varieties = (varietiesRes.success && varietiesRes.data ? varietiesRes.data : []) as { id: number; name: string }[]
    const millingVendors = (millingVendorsRes.success && millingVendorsRes.data ? millingVendorsRes.data : []) as string[]
    const sproutingVendors = (sproutingVendorsRes.success && sproutingVendorsRes.data ? sproutingVendorsRes.data : []) as string[]
    const initialStocks = stocksRes.success && stocksRes.data ? stocksRes.data : []

    return (
        <MiscStockPanel
            farmers={farmers}
            varieties={varieties}
            millingVendors={millingVendors}
            sproutingVendors={sproutingVendors}
            initialStocks={initialStocks}
            filters={filters}
        />
    )
}
