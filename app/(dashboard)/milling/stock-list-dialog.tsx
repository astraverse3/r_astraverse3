'use client'

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Plus, Pencil, Check, X } from 'lucide-react'
import { removeStockFromMilling, updateMillingBatchMetadata } from '@/app/actions/milling'
import { useRouter } from 'next/navigation'
import { useMillingCart, Stock as CartStock } from '@/app/(dashboard)/stocks/milling-cart-context'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface Stock {
    id: number
    bagNo: number
    farmerName: string
    variety: {
        name: string
        type: string
    }
    certType: string
    weightKg: number
}

interface Props {
    batchId: number
    millingType: string
    date: Date | string
    remarks: string | null
    stocks: Stock[]
    varieties: string
    trigger?: React.ReactNode
    canDelete?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function MillingStockListDialog({ batchId, millingType, date, remarks, stocks, varieties, trigger, canDelete = false, open, onOpenChange }: Props) {
    const router = useRouter()
    const { startEditing } = useMillingCart()
    const [isLoading, setIsLoading] = useState(false)
    const totalWeight = stocks.reduce((sum, s) => sum + s.weightKg, 0)

    // Inline editing state for date/remarks
    const [isEditingMeta, setIsEditingMeta] = useState(false)
    const [editDate, setEditDate] = useState(() => {
        const d = new Date(date)
        return d.toISOString().split('T')[0]
    })
    const [editRemarks, setEditRemarks] = useState(remarks || '')
    const [isSavingMeta, setIsSavingMeta] = useState(false)

    const handleSaveMeta = async () => {
        setIsSavingMeta(true)
        const result = await updateMillingBatchMetadata(batchId, {
            date: new Date(editDate),
            remarks: editRemarks,
        })
        setIsSavingMeta(false)
        if (result.success) {
            toast.success('수정되었습니다.')
            setIsEditingMeta(false)
        } else {
            toast.error('수정 실패: ' + result.error)
        }
    }

    const handleCancelMeta = () => {
        setEditDate(new Date(date).toISOString().split('T')[0])
        setEditRemarks(remarks || '')
        setIsEditingMeta(false)
    }

    const handleAddStock = () => {
        const cartStocks: CartStock[] = stocks.map(s => ({
            id: s.id,
            productionYear: new Date().getFullYear(),
            bagNo: s.bagNo,
            weightKg: s.weightKg,
            status: 'MILLING',
            incomingDate: new Date(),
            lotNo: null,
            variety: {
                name: s.variety.name,
                type: s.variety.type
            },
            farmer: {
                name: s.farmerName,
                group: {
                    certType: s.certType,
                    name: 'UNKNOWN'
                }
            }
        }))

        startEditing(
            batchId,
            cartStocks,
            new Date(date),
            remarks || '',
            millingType
        )
        router.push('/stocks')
    }

    const handleDelete = async (stockId: number) => {
        if (!confirm('투입 내역에서 이 톤백을 제외하시겠습니까? (상태가 [보관중]으로 변경됩니다)')) return

        setIsLoading(true)
        const result = await removeStockFromMilling(batchId, stockId)
        setIsLoading(false)

        if (!result.success) {
            toast.error((result as any).error || '삭제 실패')
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
                    <DialogTitle className="text-lg font-bold text-slate-900">
                        투입 상세 내역
                    </DialogTitle>
                    <p className="text-sm text-slate-500 mt-1">도정 작업에 투입된 벼(원료곡) 상세 내역입니다.</p>
                </DialogHeader>

                {/* 날짜 / 비고 수정 영역 */}
                <div className="px-6 py-3 border-b border-slate-100 bg-slate-50">
                    {isEditingMeta ? (
                        <div className="space-y-3">
                            <div className="flex gap-4 items-start">
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">작업 날짜</Label>
                                    <Input
                                        type="date"
                                        value={editDate}
                                        onChange={e => setEditDate(e.target.value)}
                                        className="h-8 w-[160px] text-sm"
                                    />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <Label className="text-xs text-slate-500">비고</Label>
                                    <Input
                                        value={editRemarks}
                                        onChange={e => setEditRemarks(e.target.value)}
                                        placeholder="비고 내용 입력"
                                        className="h-8 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleCancelMeta}>
                                    <X className="h-3 w-3 mr-1" />취소
                                </Button>
                                <Button size="sm" className="h-7 px-2 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleSaveMeta} disabled={isSavingMeta}>
                                    <Check className="h-3 w-3 mr-1" />
                                    {isSavingMeta ? '저장 중...' : '저장'}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 text-sm">
                                <div>
                                    <span className="text-xs text-slate-400 mr-1">날짜</span>
                                    <span className="font-semibold text-slate-700">
                                        {format(new Date(date), 'yyyy-MM-dd')}
                                    </span>
                                </div>
                                {(remarks || editRemarks) && (
                                    <div>
                                        <span className="text-xs text-slate-400 mr-1">비고</span>
                                        <span className="text-slate-700">{remarks || editRemarks}</span>
                                    </div>
                                )}
                                {!remarks && !editRemarks && (
                                    <span className="text-xs text-slate-400">비고 없음</span>
                                )}
                            </div>
                            {canDelete && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                    onClick={() => setIsEditingMeta(true)}
                                >
                                    <Pencil className="h-3 w-3 mr-1" />
                                    수정
                                </Button>
                            )}
                        </div>
                    )}
                </div>

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
                                        <div className="truncate" title={stock.variety.name}>{stock.variety.name}</div>
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
                    <div>
                        {canDelete ? (
                            <Button size="sm" variant="outline" className="h-9 gap-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200" onClick={handleAddStock}>
                                <Plus className="h-4 w-4" />
                                톤백 추가/수정
                            </Button>
                        ) : (
                            <div className="text-sm text-slate-500">총 <span className="font-bold text-slate-900">{stocks.length}</span>개 톤백</div>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        {canDelete && <div className="text-sm text-slate-500">총 <span className="font-bold text-slate-900">{stocks.length}</span>개</div>}
                        <div className="text-slate-500">
                            합계 <span className="text-2xl font-black text-slate-900 ml-1">{totalWeight.toLocaleString()} <span className="text-sm font-medium text-slate-500">kg</span></span>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog >
    )
}
