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

        const title = remarks.trim() || `${new Date().toLocaleDateString('ko-KR')} 도정 작업`

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
                <CardHeader>
                    <CardTitle>원료곡(벼) 투입 시작</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="remarks">비고 (기타 사항)</Label>
                        <Input
                            id="remarks"
                            placeholder="예: 특이사항 없음, 또는 작업 관련 메모"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            className="rounded-xl border-stone-200 focus:ring-amber-500"
                        />
                    </div>

                    <div className="bg-stone-50 p-6 rounded-xl flex justify-between items-center border border-stone-100">
                        <div className="space-y-1">
                            <span className="text-sm font-medium text-stone-500 uppercase tracking-wider">총 투입량</span>
                            <div className="text-3xl font-black text-stone-900">{totalInputKg.toLocaleString()} <span className="text-xl font-medium">kg</span></div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-stone-400 mb-1">선택된 톤백</div>
                            <div className="text-xl font-bold text-stone-700">{selectedStockIds.length} <span className="text-sm font-normal">개</span></div>
                        </div>
                    </div>

                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {availableStocks.map(stock => (
                            <div
                                key={stock.id}
                                className={`group flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${selectedStockIds.includes(stock.id) ? 'bg-amber-50 border-amber-500 shadow-md' : 'hover:bg-stone-50 border-stone-200 hover:border-stone-300'}`}
                                onClick={() => toggleStock(stock.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${selectedStockIds.includes(stock.id) ? 'bg-amber-500 border-amber-500' : 'bg-white border-stone-300 group-hover:border-stone-400'}`}>
                                        {selectedStockIds.includes(stock.id) && <Plus className="w-4 h-4 text-white" />}
                                    </div>
                                    <div>
                                        <div className="font-bold text-stone-900 leading-tight">{stock.farmerName} <span className="text-stone-400 font-normal">|</span> {stock.variety}</div>
                                        <div className="text-xs text-stone-500 mt-0.5">톤백 번호: {stock.bagNo} • {stock.certType}</div>
                                    </div>
                                </div>
                                <div className="text-lg font-black text-stone-800">{stock.weightKg.toLocaleString()} <span className="text-sm font-medium">kg</span></div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-4">
                        <Button
                            className="w-full h-14 text-xl font-bold bg-stone-900 hover:bg-stone-800 rounded-xl shadow-lg transition-transform active:scale-[0.98]"
                            disabled={isLoading || selectedStockIds.length === 0}
                            onClick={handleSubmit}
                        >
                            {isLoading ? '저장 중...' : '도정 작업 시작'}
                        </Button>
                        <p className="text-center text-xs text-stone-400 mt-4">작업을 시작하면 해당 톤백들은 자동으로 사용 완료 처리됩니다.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
