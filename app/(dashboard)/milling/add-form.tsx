'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Minus, Trash2 } from 'lucide-react'
import { startMillingBatch } from '@/app/actions/milling'
import { useRouter } from 'next/navigation'

interface Stock {
    id: number
    bagNo: number
    farmerName: string
    variety: string
    weightKg: number
    [key: string]: any
}

interface Props {
    availableStocks: Stock[]
}

const PACKAGE_TEMPLATES = [
    { label: '20kg', weight: 20 },
    { label: '10kg', weight: 10 },
    { label: '5kg', weight: 5 },
]

export function AddMillingLogForm({ availableStocks }: Props) {
    const router = useRouter()
    const [selectedStockIds, setSelectedStockIds] = useState<number[]>([])
    const [remarks, setRemarks] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    // Calculate total input weight based on selection
    const totalInputKg = useMemo(() => {
        return availableStocks
            .filter(s => selectedStockIds.includes(s.id))
            .reduce((sum, s) => sum + s.weightKg, 0)
    }, [availableStocks, selectedStockIds])

    const toggleStock = (id: number) => {
        setSelectedStockIds(prev =>
            prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
        )
    }

    async function handleSubmit() {
        if (selectedStockIds.length === 0) {
            alert('투입할 재고를 선택해주세요.')
            return
        }

        const title = remarks.trim()

        setIsLoading(true)
        const result = await startMillingBatch({
            date: new Date(),
            title,
            totalInputKg,
            selectedStockIds,
        })
        setIsLoading(false)

        if (result && !result.success) {
            alert('저장 실패: ' + result.error)
        }
    }

    return (
        <div className="max-w-2xl mx-auto">
            <Card>

                <CardContent className="space-y-4 p-4">
                    {/* Top Action Bar & Summary */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <div className="text-xs font-medium text-stone-500 mb-1">총 투입량</div>
                            <div className="text-2xl font-black text-stone-900 leading-none">
                                {totalInputKg.toLocaleString()} <span className="text-sm font-medium text-stone-500">kg</span>
                            </div>
                        </div>
                        <Button
                            className="h-12 px-6 text-lg font-bold bg-stone-900 hover:bg-stone-800 rounded-xl shadow-lg transition-transform active:scale-[0.98]"
                            disabled={isLoading || selectedStockIds.length === 0}
                            onClick={handleSubmit}
                        >
                            {isLoading ? '저장 중...' : '도정 작업 시작'}
                        </Button>
                    </div>

                    {/* Remarks Input */}
                    <div>
                        <Label htmlFor="remarks" className="text-xs font-bold text-stone-600 mb-1.5 block">비고 (발주처)</Label>
                        <Input
                            id="remarks"
                            placeholder="발주처 입력 (선택사항)"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            className="h-9 rounded-lg border-stone-200 focus:ring-amber-500 text-sm"
                        />
                    </div>

                    {/* Stock List Header */}
                    <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                        <div className="text-sm font-bold text-stone-800">
                            투입할 톤백 선택 <span className="text-stone-400 font-normal ml-1">({selectedStockIds.length}개 선택됨)</span>
                        </div>
                    </div>

                    {/* Dense Stock List */}
                    <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                        {availableStocks.map(stock => (
                            <div
                                key={stock.id}
                                className={`group flex items-center justify-between py-2 px-3 border rounded-lg cursor-pointer transition-colors ${selectedStockIds.includes(stock.id) ? 'bg-amber-50 border-amber-500' : 'bg-white border-stone-100 hover:bg-stone-50 hover:border-stone-300'}`}
                                onClick={() => toggleStock(stock.id)}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${selectedStockIds.includes(stock.id) ? 'bg-amber-500 border-amber-500' : 'bg-white border-stone-300'}`}>
                                        {selectedStockIds.includes(stock.id) && <Plus className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                    <div className="truncate">
                                        <div className="text-sm font-bold text-stone-900 leading-none truncate">
                                            {stock.farmerName} <span className="text-stone-400 font-normal mx-1">|</span> {stock.variety}
                                        </div>
                                        <div className="text-[10px] text-stone-500 mt-1 leading-none font-mono">
                                            #{stock.bagNo} • {stock.certType}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-sm font-black text-stone-800 flex-shrink-0 pl-2">
                                    {stock.weightKg.toLocaleString()} <span className="text-[10px] font-medium text-stone-400">kg</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
