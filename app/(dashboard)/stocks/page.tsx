import { getStocks } from '@/app/actions/stock'
import { AddStockDialog } from './add-stock-dialog'
import { EditStockDialog } from './edit-stock-dialog'
import { DeleteStockButton } from './delete-stock-button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Info } from 'lucide-react'
// import { Stock } from '@prisma/client'

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
        <div className="container mx-auto space-y-6 md:space-y-12 px-2 md:px-4 max-w-6xl animate-in fade-in duration-1000">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 md:gap-6 border-l-4 border-primary pl-4 md:pl-6 py-1 md:py-2">
                <div className="space-y-0.5 md:space-y-1">
                    <h1 className="text-3xl md:text-6xl font-black tracking-tighter text-stone-900 italic leading-none uppercase">
                        재고 <span className="text-stone-300 not-italic">현황</span>
                    </h1>
                    <p className="text-stone-500 font-medium tracking-tight text-[10px] md:text-sm flex items-center gap-2">
                        <span className="w-4 md:w-8 h-px bg-stone-300"></span>
                        벼 원료곡 입고 현황 및 재고 관리
                    </p>
                </div>
                <AddStockDialog />
            </div>

            <Card className="border-none bg-white/40 shadow-xl md:shadow-2xl backdrop-blur-sm rounded-2xl md:rounded-3xl overflow-hidden">
                <CardHeader className="bg-stone-900 p-4 md:p-8">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-white font-bold tracking-tight flex items-center gap-2 italic text-sm md:text-xl">
                            재고 목록 <span className="text-stone-500 font-normal not-italic text-xs md:text-base">CURRENT STOCKS</span>
                        </CardTitle>
                        <Badge variant="outline" className="text-stone-400 border-stone-800 font-mono text-[9px] md:text-xs">
                            {stocks.length} ITEMS
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-stone-50 border-b border-stone-100 divide-x divide-stone-100">
                                    <TableHead className="py-3 md:py-6 px-3 md:px-6 font-black text-stone-400 text-[9px] md:text-[10px] tracking-widest">입고일</TableHead>
                                    <TableHead className="px-3 md:px-6 font-black text-stone-400 text-[9px] md:text-[10px] tracking-widest">생산년도</TableHead>
                                    <TableHead className="px-3 md:px-6 font-black text-stone-400 text-[9px] md:text-[10px] tracking-widest">농가</TableHead>
                                    <TableHead className="px-3 md:px-6 font-black text-stone-400 text-[9px] md:text-[10px] tracking-widest">품종</TableHead>
                                    <TableHead className="px-3 md:px-6 font-black text-stone-400 text-[9px] md:text-[10px] tracking-widest">인증</TableHead>
                                    <TableHead className="px-3 md:px-6 font-black text-stone-400 text-[9px] md:text-[10px] tracking-widest">번호</TableHead>
                                    <TableHead className="text-right px-3 md:px-6 font-black text-stone-400 text-[9px] md:text-[10px] tracking-widest">중량(kG)</TableHead>
                                    <TableHead className="text-center px-3 md:px-6 font-black text-stone-400 text-[9px] md:text-[10px] tracking-widest">상태</TableHead>
                                    <TableHead className="text-right px-3 md:px-6 font-black text-stone-400 text-[9px] md:text-[10px] tracking-widest">관리</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="divide-y divide-stone-50">
                                {stocks.length > 0 ? (
                                    stocks.map((stock: Stock) => (
                                        <TableRow key={stock.id} className="group hover:bg-stone-50 transition-all duration-300 ease-out divide-x divide-stone-50 font-medium text-stone-600">
                                            <TableCell className="py-3 md:py-6 px-3 md:px-6 font-mono font-bold text-stone-900 text-[11px] md:text-[13px]">
                                                {new Date(stock.createdAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                                            </TableCell>
                                            <TableCell className="px-3 md:px-6 font-black text-stone-900 text-xs md:text-sm">
                                                {stock.productionYear}
                                            </TableCell>
                                            <TableCell className="px-3 md:px-6 font-black text-stone-900 italic text-xs md:text-sm">
                                                {stock.farmerName}
                                            </TableCell>
                                            <TableCell className="px-3 md:px-6 text-stone-900 text-xs md:text-sm">
                                                {stock.variety}
                                            </TableCell>
                                            <TableCell className="px-3 md:px-6">
                                                <Badge variant="outline" className="text-[9px] md:text-[10px] border-stone-200 text-stone-500 font-bold px-1 md:px-2 py-0">
                                                    {stock.certType}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="px-3 md:px-6 font-mono text-stone-400 text-xs md:text-sm">
                                                #{stock.bagNo}
                                            </TableCell>
                                            <TableCell className="text-right px-3 md:px-6 font-mono font-bold text-stone-900 text-xs md:text-sm">
                                                {stock.weightKg.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-center px-3 md:px-6">
                                                {stock.status === 'AVAILABLE' ? (
                                                    <div className="inline-flex items-center gap-1 px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-primary/10 text-primary text-[8px] md:text-[10px] font-black uppercase tracking-widest border border-primary/20">
                                                        <span className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-primary animate-pulse"></span>
                                                        재고
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1 px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-stone-100 text-stone-400 text-[8px] md:text-[10px] font-black uppercase tracking-widest border border-stone-200">
                                                        사용완료
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right px-3 md:px-6">
                                                <div className="flex justify-end gap-0.5 md:gap-1">
                                                    <EditStockDialog stock={stock} />
                                                    <DeleteStockButton
                                                        stockId={stock.id}
                                                        stockTitle={`${stock.farmerName} (${stock.variety})`}
                                                        isConsumed={stock.status === 'CONSUMED'}
                                                    />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-48 md:h-64 text-center">
                                            <div className="flex flex-col items-center gap-2 md:gap-4 py-8 md:py-12">
                                                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-stone-50 flex items-center justify-center">
                                                    <Info className="h-6 w-6 md:h-8 md:w-8 text-stone-200" />
                                                </div>
                                                <p className="font-bold text-stone-300 uppercase tracking-widest text-[10px] md:text-sm italic">재고 정보가 없습니다</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
