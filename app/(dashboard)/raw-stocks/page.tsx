import { getStocks, GetStocksParams, getStockGroups } from '@/app/actions/stock'
import { getVarieties, getFarmersWithGroups } from '@/app/actions/admin'
import { AddStockDialog } from './add-stock-dialog'
import { StockFilters } from './stock-filters'
import { StockExcelButtons } from './stock-excel-buttons'
import { StockPageWrapper } from './stock-page-wrapper'
import { RawStocksTabs, type RawStockTab } from './raw-stocks-tabs'
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
        <Suspense fallback={<div>Loading...</div>}>
            <div className="grid grid-cols-1 gap-2 pb-24 sm:pb-2 px-1.5 sm:px-0">
                <div className="pt-2 px-1">
                    <RawStocksTabs activeTab={tab} />
                </div>
                {tab === 'misc' ? (
                    <MiscStockPlaceholder />
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
    }

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

function MiscStockPlaceholder() {
    return (
        <div className="rounded-md border bg-white p-12 text-center">
            <p className="text-slate-500 text-sm">잡곡 원물재고 화면은 곧 추가됩니다.</p>
            <p className="text-slate-400 text-xs mt-2">#5c 입고 다이얼로그 · #5d 목록·필터 구현 예정</p>
        </div>
    )
}
