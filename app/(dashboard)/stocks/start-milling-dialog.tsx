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
    editMode?: boolean  // 명시적으로 편집 모드 여부를 전달
}

import { useMillingCart } from './milling-cart-context'

export function StartMillingDialog({ open, onOpenChange, selectedStocks, onSuccess, editMode = false }: Props) {
    const router = useRouter()
    const { editingBatchId, editingDate, editingRemarks, editingMillingType, clearCart } = useMillingCart()

    // editMode prop이 false면 항상 신규 작업 모드 (editingBatchId 무시)
    const isEditing = editMode && !!editingBatchId
    const [remarks, setRemarks] = useState('')
    const [millingType, setMillingType] = useState('백미')
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (open && isEditing) {
            if (editingDate) setDate(new Date(editingDate).toISOString().split('T')[0])
            setRemarks(editingRemarks || '')
            if (editingMillingType) setMillingType(editingMillingType)
        }
    }, [open, isEditing])

    const totalInputKg = useMemo(() => {
        return selectedStocks.reduce((sum, s) => sum + s.weightKg, 0)
    }, [selectedStocks])

    async function handleSubmit() {
        if (selectedStocks.length === 0) return

        setIsLoading(true)

        const payload = {
            id: isEditing ? (editingBatchId || undefined) : undefined,
            date: new Date(date),
            remarks: remarks.trim(),
            millingType,
            totalInputKg,
            selectedStockIds: selectedStocks.map(s => s.id),
        }

        const result = await startMillingBatch(payload)

        setIsLoading(false)

        if (result && !result.success) {
            toast.error((isEditing ? '작업 수정 실패: ' : '작업 시작 실패: ') + result.error)
        } else {
            onOpenChange(false)
            onSuccess()
            triggerDataUpdate()

            if (isEditing) {
                toast.success('작업이 수정되었습니다.')
                clearCart()
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
                    <DialogTitle className="text-[15px]">{isEditing ? '도정 작업을 수정합니다' : '도정 작업 시작'}</DialogTitle>
                </DialogHeader>

                <div className="space-y-3 py-1">
                    {/* Date Selection */}
                    <div className="space-y-1">
                        <Label htmlFor="date" className="text-[13px]">작업 일자</Label>
                        <Input
                            id="date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-[240px] text-[13px]"
                        />
                    </div>

                    {/* Summary Card */}
                    <div className="bg-slate-50 px-3 py-2.5 rounded-lg border border-slate-100 flex justify-between items-center">
                        <div>
                            <div className="text-[11px] font-medium text-slate-500">선택한 톤백</div>
                            <div className="font-bold text-[14px] text-slate-900">{selectedStocks.length}개</div>
                        </div>
                        <div className="text-right">
                            <div className="text-[11px] font-medium text-slate-500">총 투입 중량</div>
                            <div className="text-xl font-black text-[#00a2e8]">
                                {totalInputKg.toLocaleString()} <span className="text-[11px] text-slate-500 font-medium">kg</span>
                            </div>
                        </div>
                    </div>

                    {/* Milling Type */}
                    <div className="space-y-1">
                        <Label className="text-[13px]">도정 구분</Label>
                        <div className="grid grid-cols-3 gap-1.5">
                            {['백미', '현미', '5분도미', '7분도미', '찹쌀', '기타'].map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    className={`py-1.5 text-[12px] font-bold rounded-lg border transition-all ${millingType === type
                                        ? 'bg-[#00a2e8] border-[#00a2e8] text-white shadow-md'
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
                    <div className="space-y-1">
                        <Label htmlFor="remarks" className="text-[13px]">비고 (발주처 등)</Label>
                        <Input
                            id="remarks"
                            placeholder="내용 입력 (선택)"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            className="text-[13px]"
                        />
                    </div>

                    {/* Stock List Preview */}
                    <div className="space-y-1">
                        <Label className="text-[13px]">투입 톤백 목록</Label>
                        <div className="border rounded-lg max-h-[200px] overflow-y-auto bg-slate-50 p-1.5 space-y-1">
                            {selectedStocks.map(stock => (
                                <div key={stock.id} className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-slate-100 text-[12px]">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{stock.bagNo}</span>
                                        <span className="font-medium text-slate-900">{stock.variety.name}</span>
                                        <span className="text-slate-500">{stock.farmer.name}</span>
                                    </div>
                                    <div className="font-bold text-slate-700 shrink-0">
                                        {stock.weightKg.toLocaleString()} kg
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-3 sm:gap-2 pt-4 border-t border-slate-100 mt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="text-[13px]">취소</Button>
                    <Button onClick={handleSubmit} disabled={isLoading} className="bg-[#00a2e8] hover:bg-[#008cc9] text-[13px]">
                        {isLoading ? '처리 중...' : (isEditing ? '작업 수정 완료' : '작업 시작')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
