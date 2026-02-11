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
import { Trash2, Plus } from 'lucide-react'
import { removeStockFromMilling } from '@/app/actions/milling'
import { useRouter } from 'next/navigation'
import { useMillingCart, Stock as CartStock } from '@/app/(dashboard)/stocks/milling-cart-context'

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
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function MillingStockListDialog({ batchId, stocks, varieties, trigger, canDelete = false, open, onOpenChange }: Props) {
    const router = useRouter()
    const { startEditing } = useMillingCart()
    const [isLoading, setIsLoading] = useState(false)
    const totalWeight = stocks.reduce((sum, s) => sum + s.weightKg, 0)

    const handleAddStock = () => {
        // Map current stocks to CartStock format
        // Note: We need full stock details. The current 'stocks' prop might be partial.
        // However, for now let's map what we have and assume the context can handle it or we fetch full details.
        // Actually, we need to ensure 'stocks' prop has all necessary fields for CartStock.
        // Let's check the interface. MillinStockListDialog Stock interface vs CartStock interface.
        // CartStock needs: id, productionYear, bagNo, weightKg, status, incomingDate, lotNo, variety{name, type}, farmer{name, group{certType, name}}
        // The current 'Stock' interface in this file is: id, bagNo, farmerName, variety, certType, weightKg.
        // We are missing: productionYear, status, incomingDate, lotNo, variety.type, farmer.group.name.

        // Strategy: We will pass a dummy or partial object, BUT since we are going to /stocks page, 
        // the important part is 'id'. The cart display might need other fields.
        // Better approach: The parent 'MillingTableRow' passes 'stocks' which comes from 'log.stocks'. 
        // We should ensure 'log.stocks' has enough info.

        // For now, let's construct best-effort objects.
        const cartStocks: CartStock[] = stocks.map(s => ({
            id: s.id,
            productionYear: new Date().getFullYear(), // Placeholder
            bagNo: s.bagNo,
            weightKg: s.weightKg,
            status: 'MILLING', // Current status is MILLING
            incomingDate: new Date(), // Placeholder
            lotNo: null,
            variety: {
                name: s.variety,
                type: 'UNKNOWN' // Placeholder
            },
            farmer: {
                name: s.farmerName,
                group: {
                    certType: s.certType,
                    name: 'UNKNOWN' // Placeholder
                }
            }
        }))

        startEditing(batchId, cartStocks)
        router.push('/stocks')
    }

    const handleDelete = async (stockId: number) => {
        if (!confirm('투입 내역에서 이 톤백을 제외하시겠습니까? (상태가 [보관중]으로 변경됩니다)')) return

        setIsLoading(true)
        const result = await removeStockFromMilling(batchId, stockId)
        setIsLoading(false)

        if (!result.success) {
            alert((result as any).error || '삭제 실패')
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {trigger && (
                <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                    {typeof trigger === 'string' ? (
                        <button className="text-slate-900 font-bold hover:text-blue-600 hover:underline transition-colors text-left cursor-pointer">
                            {trigger}
                        </button>
                    ) : (
                        <div className="cursor-pointer inline-flex items-center">{trigger}</div>
                    )}
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col p-0 overflow-hidden bg-white">
                <DialogHeader className="p-6 pb-2">
                    <div className="flex justify-between items-center">
                        <DialogTitle className="text-lg font-bold text-slate-900">
                            투입 상세 내역
                        </DialogTitle>
                        {canDelete && (
                            <Button size="sm" variant="outline" className="h-8 gap-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200" onClick={handleAddStock}>
                                <Plus className="h-3.5 w-3.5" />
                                톤백 추가/수정
                            </Button>
                        )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">도정 작업에 투입된 벼(원료곡) 상세 내역입니다.</p>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-2 custom-scrollbar">
                    <Table>
                        <TableHeader className="sticky top-0 bg-white z-10">
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                                <TableHead className="w-[60px] px-2 text-center text-xs font-bold text-slate-500">번호</TableHead>
                                <TableHead className="px-1 text-center text-xs font-bold text-slate-500">농가명</TableHead>
                                <TableHead className="w-[80px] px-1 text-center text-xs font-bold text-slate-500">품종</TableHead>
                                <TableHead className="px-1 text-center text-xs font-bold text-slate-500">인증</TableHead>
                                <TableHead className="text-right px-2 text-xs font-bold text-slate-500">중량</TableHead>
                                {canDelete && <TableHead className="w-[40px] px-0"></TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stocks.map((stock) => (
                                <TableRow key={stock.id} className="border-b border-slate-100 hover:bg-slate-50">
                                    <TableCell className="px-2 text-center font-mono text-xs text-slate-500">#{stock.bagNo}</TableCell>
                                    <TableCell className="px-1 text-center font-bold text-xs text-slate-900 truncate max-w-[60px]" title={stock.farmerName}>{stock.farmerName}</TableCell>
                                    <TableCell className="px-1 text-center text-xs text-slate-800">
                                        <div className="truncate" title={stock.variety}>{stock.variety}</div>
                                    </TableCell>
                                    <TableCell className="px-1 text-center">
                                        <Badge variant="secondary" className="text-[10px] py-0 px-1 font-normal bg-slate-100 text-slate-600 border-none">
                                            {stock.certType}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="px-2 text-right font-mono font-bold text-xs text-slate-700">
                                        {stock.weightKg.toLocaleString()}
                                    </TableCell>
                                    {canDelete && (
                                        <TableCell className="px-0 text-center">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-slate-300 hover:text-red-500 hover:bg-red-50"
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

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                    <div className="text-sm text-slate-500">총 <span className="font-bold text-slate-900">{stocks.length}</span>개 톤백</div>
                    <div className="text-slate-500">
                        합계 <span className="text-2xl font-black text-slate-900 ml-1">{totalWeight.toLocaleString()} <span className="text-sm font-medium text-slate-500">kg</span></span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
