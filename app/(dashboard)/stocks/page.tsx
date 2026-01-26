import { getStocks } from '@/app/actions/stock'
import { AddStockDialog } from './add-stock-dialog'
import { EditStockDialog } from './edit-stock-dialog'
import { DeleteStockButton } from './delete-stock-button'
import { Badge } from '@/components/ui/badge'
import { Package, Calendar, User, FileBadge } from 'lucide-react'

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
        <div className="grid grid-cols-1 gap-6 pb-24">
            {/* Header */}
            <section className="flex items-center justify-between pt-2">
                <h1 className="text-xl font-bold text-slate-800">재고 관리</h1>
                <AddStockDialog />
            </section>

            {/* List */}
            <section className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="flex flex-col divide-y divide-slate-100">
                    {stocks.length > 0 ? (
                        stocks.map((stock: Stock) => (
                            <div key={stock.id} className="p-4 flex flex-col gap-3 hover:bg-slate-50 transition-colors">
                                {/* Top Row: Basic Info & Status */}
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs font-bold text-slate-500 border-slate-200 px-2 py-0.5 rounded-md">
                                            {stock.productionYear}년
                                        </Badge>
                                        <h3 className="text-lg font-bold text-slate-800 tracking-tight">
                                            {stock.variety}
                                        </h3>
                                        <Badge variant="secondary" className="text-[10px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-100">
                                            {stock.certType}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {stock.status === 'AVAILABLE' ? (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold">
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                보관중
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold">
                                                사용완료
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Bottom Row: Details & Actions */}
                                <div className="flex items-end justify-between">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <User className="w-3.5 h-3.5" />
                                            <span className="text-sm font-medium">{stock.farmerName}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <FileBadge className="w-3.5 h-3.5" />
                                            <span className="text-xs font-mono">#{stock.bagNo}</span>
                                            <span className="text-xs text-slate-300">|</span>
                                            <span className="text-sm font-bold text-slate-700">{stock.weightKg.toLocaleString()} kg</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <EditStockDialog stock={stock} />
                                        <DeleteStockButton
                                            stockId={stock.id}
                                            stockTitle={`${stock.farmerName} (${stock.variety})`}
                                            isConsumed={stock.status === 'CONSUMED'}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-12 text-center text-slate-400 text-sm">
                            등록된 재고가 없습니다.
                        </div>
                    )}
                </div>
            </section>
        </div>
    )
}
