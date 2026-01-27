import { getStocks, GetStocksParams } from '@/app/actions/stock'
import { AddStockDialog } from './add-stock-dialog'
import { StockTableRow } from './stock-table-row'
import { StockFilters } from './stock-filters'
import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface Stock {
    id: number
    productionYear: number
    bagNo: number
    farmerName: string
    variety: string
    certType: string
    weightKg: number
    status: string
    createdAt: Date
    updatedAt: Date
}

export default async function StockPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined }
}) {
    // Parse searchParams into GetStocksParams
    const filters: GetStocksParams = {
        productionYear: typeof searchParams.productionYear === 'string' ? searchParams.productionYear : undefined,
        variety: typeof searchParams.variety === 'string' ? searchParams.variety : undefined,
        farmerName: typeof searchParams.farmerName === 'string' ? searchParams.farmerName : undefined,
        certType: typeof searchParams.certType === 'string' ? searchParams.certType : undefined,
        status: typeof searchParams.status === 'string' ? searchParams.status : undefined,
        sort: typeof searchParams.sort === 'string' ? searchParams.sort : undefined,
    }

    const result = await getStocks(filters)
    const stocks = result.success && result.data ? result.data : []

    return (
        <div className="grid grid-cols-1 gap-2 pb-24">
            {/* Header */}
            <section className="flex items-center justify-between pt-2 px-1">
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-slate-800">재고 관리</h1>
                    <Badge variant="secondary" className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0">
                        {stocks.length}
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    <StockFilters />
                    <AddStockDialog />
                </div>
            </section>

            {/* Dense Table */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-slate-50">
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[60px]">년도</TableHead>
                            <TableHead className="py-2 px-1 text-xs font-bold text-slate-500">품종</TableHead>
                            <TableHead className="py-2 px-1 text-xs font-bold text-slate-500">농가</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500">인증</TableHead>
                            <TableHead className="py-2 px-1 text-right text-xs font-bold text-slate-500">톤백#</TableHead>
                            <TableHead className="py-2 px-1 text-right text-xs font-bold text-slate-500">중량</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[40px]">상태</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {stocks.length > 0 ? (
                            stocks.map((stock: Stock) => (
                                <StockTableRow key={stock.id} stock={stock} />
                            ))
                        ) : (
                            <TableRow>
                                <TableHead colSpan={7} className="h-32 text-center text-xs text-slate-400 font-medium">
                                    {Object.keys(filters).length > 0 ? '검색 결과가 없습니다.' : '등록된 재고가 없습니다.'}
                                </TableHead>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </section>
        </div>
    )
}

