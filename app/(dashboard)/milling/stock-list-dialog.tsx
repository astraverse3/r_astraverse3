'use client'

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface Stock {
    id: number
    bagNo: number
    farmerName: string
    variety: string
    certType: string
    weightKg: number
}

interface Props {
    stocks: Stock[]
    varieties: string
    trigger?: React.ReactNode
}

export function MillingStockListDialog({ stocks, varieties, trigger }: Props) {
    const totalWeight = stocks.reduce((sum, s) => sum + s.weightKg, 0)

    return (
        <Dialog>
            <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                {trigger ? (
                    <div className="cursor-pointer inline-flex items-center">{trigger}</div>
                ) : (
                    <button className="text-stone-900 font-bold hover:text-blue-600 hover:underline transition-colors text-left cursor-pointer">
                        {varieties || '-'}
                    </button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col p-0 overflow-hidden bg-white">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-lg font-bold">
                        투입 상세 내역
                    </DialogTitle>
                    <p className="text-sm text-stone-500 mt-1">도정 작업에 투입된 벼(원료곡) 상세 내역입니다.</p>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-2 custom-scrollbar">
                    <Table>
                        <TableHeader className="sticky top-0 bg-white z-10">
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                                <TableHead className="w-[80px]">번호</TableHead>
                                <TableHead>농가명</TableHead>
                                <TableHead>품종</TableHead>
                                <TableHead>인증</TableHead>
                                <TableHead className="text-right">중량(kg)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stocks.map((stock) => (
                                <TableRow key={stock.id}>
                                    <TableCell className="font-mono text-stone-500">{stock.bagNo}</TableCell>
                                    <TableCell className="font-bold text-stone-900">{stock.farmerName}</TableCell>
                                    <TableCell>{stock.variety}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="text-[10px] py-0 px-1 font-normal bg-stone-100 text-stone-600 border-none">
                                            {stock.certType}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold">
                                        {stock.weightKg.toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <div className="p-6 bg-stone-50 border-t border-stone-100 flex justify-between items-center">
                    <div className="text-sm text-stone-500">총 <span className="font-bold text-stone-900">{stocks.length}</span>개 톤백</div>
                    <div className="text-stone-500">
                        합계 <span className="text-2xl font-black text-stone-900 ml-1">{totalWeight.toLocaleString()} <span className="text-sm font-medium">kg</span></span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
