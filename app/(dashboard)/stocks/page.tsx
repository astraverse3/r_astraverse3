
import { getStocks } from '@/app/actions/stock'
import { AddStockDialog } from './add-stock-dialog'
import { StockTableRow } from './stock-table-row'
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

export default async function StockPage() {
    const result = await getStocks()
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
                <AddStockDialog />
            </section>

            {/* Dense Table */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-slate-50">
                            <TableHead className="py-2 px-0.5 text-center text-[10px] font-bold text-slate-500 w-[24px]">년</TableHead>
                            <TableHead className="py-2 px-0.5 text-xs font-bold text-slate-500">품종</TableHead>
                            <TableHead className="py-2 px-0.5 text-[11px] font-bold text-slate-500">농가</TableHead>
                            <TableHead className="py-2 px-0.5 text-center text-[10px] font-bold text-slate-500">인증</TableHead>
                            <TableHead className="py-2 px-0.5 text-right text-[11px] font-bold text-slate-500">톤백#</TableHead>
                            <TableHead className="py-2 px-1 text-right text-xs font-bold text-slate-500">중량</TableHead>
                            <TableHead className="py-2 px-0.5 text-center text-[10px] font-bold text-slate-500 w-[20px]">상</TableHead>
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
                                    등록된 재고가 없습니다.
                                </TableHead>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </section>
        </div>
    )
}

