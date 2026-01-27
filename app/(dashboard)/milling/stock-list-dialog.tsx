import { useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { removeStockFromMilling } from '@/app/actions/milling'

interface Stock {
    id: number
    bagNo: number
    farmerName: string
    variety: string
    certType: string
    weightKg: number
}

interface Props {
    batchId: number
    stocks: Stock[]
    varieties: string
    trigger?: React.ReactNode
    canDelete?: boolean
}

export function MillingStockListDialog({ batchId, stocks, varieties, trigger, canDelete = false }: Props) {
    const [isLoading, setIsLoading] = useState(false)
    const totalWeight = stocks.reduce((sum, s) => sum + s.weightKg, 0)

    const handleDelete = async (stockId: number) => {
        if (!confirm('투입 내역에서 이 톤백을 제외하시겠습니까? (상태가 [보관중]으로 변경됩니다)')) return

        setIsLoading(true)
        const result = await removeStockFromMilling(batchId, stockId)
        setIsLoading(false)

        if (!result.success) {
            alert(result.error || '삭제 실패')
        }
    }

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
                                {canDelete && <TableHead className="w-[40px]"></TableHead>}
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
                                    {canDelete && (
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-stone-300 hover:text-red-500 hover:bg-red-50"
                                                disabled={isLoading}
                                                onClick={() => handleDelete(stock.id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </TableCell>
                                    )}
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
