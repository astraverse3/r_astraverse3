import { getStocks, GetStocksParams } from '@/app/actions/stock'
import { getVarieties, getFarmersWithGroups } from '@/app/actions/admin' // Updated import
import { AddStockDialog } from './add-stock-dialog'
import { StockTableRow } from './stock-table-row'
import { StockFilters } from './stock-filters'
import { ActiveStockFilters } from './active-filters'
import { StockExcelButtons } from './stock-excel-buttons'
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
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-slate-800">재고 관리</h1>
                        <Badge variant="secondary" className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0">
                            {stocks.length}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Filters might need update to accept farmers/varieties too */}
                        <StockFilters varieties={varieties} farmers={farmers} />
                        <StockExcelButtons />
                        <AddStockDialog varieties={varieties} farmers={farmers} />
                    </div>
                </div>
                <ActiveStockFilters />
            </section>

            {/* Dense Table */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-slate-50">
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[40px] hidden sm:table-cell">년도</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[70px]">품종</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[60px]">농가</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[40px] hidden md:table-cell">인증</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[140px]">Lot No</TableHead>
                            <TableHead className="py-2 px-1 text-right text-xs font-bold text-slate-500 w-[40px]">톤백</TableHead>
                            <TableHead className="py-2 px-1 text-right text-xs font-bold text-slate-500 w-[60px]">중량</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[50px]">상태</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[40px]">관리</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {stocks.length > 0 ? (
                            stocks.map((stock: Stock) => (
                                <StockTableRow key={stock.id} stock={stock} farmers={farmers} varieties={varieties} />
                            ))
                        ) : (
                            <TableRow>
                                <TableHead colSpan={8} className="h-32 text-center text-xs text-slate-400 font-medium">
                                    {Object.keys(filters).length > 0 ? '검색 결과가 없습니다.' : '등록된 재고가 없습니다.'}
                                </TableHead>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </section>
        </div >
    )
}
