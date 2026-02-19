'use client'

import { useState, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { startMillingBatch } from '@/app/actions/milling'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { triggerDataUpdate } from '@/components/last-updated'

interface Stock {
    id: number
    bagNo: number
    weightKg: number
    lotNo: string | null // Added
    variety: { name: string }
    farmer: { name: string, group: { certType: string } | null }
}

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    selectedStocks: Stock[]
    onSuccess: () => void
}

import { useMillingCart } from './milling-cart-context'

export function StartMillingDialog({ open, onOpenChange, selectedStocks, onSuccess }: Props) {
    const router = useRouter()
    const { editingBatchId, editingDate, editingRemarks, editingMillingType, clearCart } = useMillingCart()

    const [remarks, setRemarks] = useState('')
    const [millingType, setMillingType] = useState('백미')
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
    const [isLoading, setIsLoading] = useState(false)

    // 다이얼로그가 열릴 때 편집 상태로 form 초기화
    useEffect(() => {
        if (open && editingBatchId) {
            if (editingDate) setDate(new Date(editingDate).toISOString().split('T')[0])
            setRemarks(editingRemarks || '')
            if (editingMillingType) setMillingType(editingMillingType)
        }
    }, [open, editingBatchId])

    const totalInputKg = useMemo(() => {
        return selectedStocks.reduce((sum, s) => sum + s.weightKg, 0)
    }, [selectedStocks])

    async function handleSubmit() {
        if (selectedStocks.length === 0) return

        setIsLoading(true)

        const payload = {
            id: editingBatchId || undefined,
            date: new Date(date),
            remarks: remarks.trim(),
            millingType,
            totalInputKg,
            selectedStockIds: selectedStocks.map(s => s.id),
        }

        const result = await startMillingBatch(payload) // We will modify this action to handle ID

        setIsLoading(false)

        if (result && !result.success) {
            toast.error((editingBatchId ? '작업 수정 실패: ' : '작업 시작 실패: ') + result.error)
        } else {
            onOpenChange(false)
            onSuccess() // Clear selection / cart logic handling
            triggerDataUpdate()

            if (editingBatchId) {
                toast.success('작업이 수정되었습니다.')
                clearCart() // Clear editing state
                router.push('/milling')
            } else {
                router.push('/milling')
            }
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editingBatchId ? '도정 작업을 수정합니다' : '도정 작업 시작'}</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-2">
                    {/* Date Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="date">작업 일자</Label>
                        <Input
                            id="date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-[240px]"
                        />
                    </div>

                    {/* Summary Card */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex justify-between items-center">
                        <div>
                            <div className="text-xs font-medium text-slate-500">선택한 톤백</div>
                            <div className="font-bold text-slate-900">{selectedStocks.length}개</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs font-medium text-slate-500">총 투입 중량</div>
                            <div className="text-2xl font-black text-blue-600">
                                {totalInputKg.toLocaleString()} <span className="text-sm text-slate-500 font-medium">kg</span>
                            </div>
                        </div>
                    </div>

                    {/* Milling Type */}
                    <div className="space-y-2">
                        <Label>도정 구분</Label>
                        <div className="flex gap-2">
                            {['백미', '현미', '칠분도미', '기타'].map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    className={`flex-1 py-2 text-sm font-bold rounded-lg border transition-all ${millingType === type
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                        }`}
                                    onClick={() => setMillingType(type)}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Remarks */}
                    <div className="space-y-2">
                        <Label htmlFor="remarks">비고 (발주처 등)</Label>
                        <Input
                            id="remarks"
                            placeholder="내용 입력 (선택)"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                        />
                    </div>

                    {/* Stock List Preview */}
                    <div className="space-y-2">
                        <Label>투입 톤백 목록</Label>
                        <div className="border rounded-lg max-h-[150px] overflow-y-auto bg-slate-50 p-2 space-y-1">
                            {selectedStocks.map(stock => (
                                <div key={stock.id} className="text-xs flex items-center justify-between bg-white p-2 rounded border border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{stock.bagNo}</span>
                                        <span className="font-medium text-slate-900">{stock.variety.name}</span>
                                        <span className="text-slate-500">{stock.farmer.name}</span>
                                        {stock.lotNo && (
                                            <span className="text-slate-400 border-l pl-2 ml-1">{stock.lotNo}</span>
                                        )}
                                    </div>
                                    <div className="font-bold text-slate-700">
                                        {stock.weightKg.toLocaleString()} kg
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
                    <Button onClick={handleSubmit} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
                        {isLoading ? '처리 중...' : (editingBatchId ? '작업 수정 완료' : '작업 시작')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
