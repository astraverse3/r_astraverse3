'use client'

import { useMillingCart } from '@/app/(dashboard)/stocks/milling-cart-context'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Trash2, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { updateMillingBatchStocks } from '@/app/actions/milling'
import { useRouter } from 'next/navigation'

interface Props {
    onStartMilling: (stocks: any[]) => void
}

export function MillingCartSheet({ onStartMilling }: Props) {
    const router = useRouter()
    const { items, removeFromCart, clearCart, isOpen, setIsOpen, editingBatchId } = useMillingCart()

    const totalWeight = items.reduce((sum, item) => sum + item.weightKg, 0)
    const uniqueVarieties = [...new Set(items.map(i => i.variety.name))]
    const uniqueFarmers = [...new Set(items.map(i => i.farmer.name))]

    const handleStart = () => {
        onStartMilling(items)
        setIsOpen(false)
    }

    const handleUpdate = async () => {
        if (!editingBatchId) return

        const stockIds = items.map(i => i.id)
        const result = await updateMillingBatchStocks(editingBatchId, stockIds)

        if (result.success) {
            clearCart() // This clears editingBatchId too
            router.push('/milling') // Go back to milling log
        } else {
            alert(result.error || '수정 실패')
        }
    }

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetContent className="w-full sm:max-w-md flex flex-col p-0 gap-0">
                <SheetHeader className="p-6 pb-2 border-b border-slate-100">
                    <SheetTitle className="text-lg font-bold flex items-center gap-2">
                        <span>도정 장바구니</span>
                        <Badge variant="secondary" className="rounded-full px-2">
                            {items.length}
                        </Badge>
                    </SheetTitle>
                    <div className="text-xs text-slate-500 font-medium">
                        {editingBatchId ? '투입 톤백을 수정합니다. 빠진 톤백은 목록에서 제외됩니다.' : '여러 검색 결과에서 톤백을 모아 한 번에 도정할 수 있습니다.'}
                    </div>
                </SheetHeader>

                <div className="bg-slate-50 p-4 border-b border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">Summary</span>
                        {items.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearCart} className="h-6 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2">
                                전체 비우기
                            </Button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded border border-slate-200 shadow-sm">
                            <div className="text-[10px] text-slate-400 font-bold mb-0.5">총 중량</div>
                            <div className="text-lg font-black text-blue-600 leading-none">
                                {totalWeight.toLocaleString()}<span className="text-xs font-medium text-slate-400 ml-1">kg</span>
                            </div>
                        </div>
                        <div className="bg-white p-3 rounded border border-slate-200 shadow-sm">
                            <div className="text-[10px] text-slate-400 font-bold mb-0.5">품종 / 생산자</div>
                            <div className="text-sm font-bold text-slate-700 leading-tight truncate">
                                {uniqueVarieties.length}종 / {uniqueFarmers.length}명
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-0 scrollbar-hide">
                    <div className="p-4 space-y-2">
                        {items.length === 0 ? (
                            <div className="h-40 flex flex-col items-center justify-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200 rounded-lg m-2">
                                <AlertCircle className="h-8 w-8 opacity-50" />
                                <span className="text-sm font-medium">장바구니가 비어있습니다</span>
                            </div>
                        ) : (
                            items.map(item => (
                                <div key={item.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center group hover:border-blue-300 transition-colors">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-1.5">
                                            <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 h-4 border-slate-200 text-slate-500 bg-slate-50">
                                                {item.bagNo}번
                                            </Badge>
                                            <span className="text-sm font-bold text-slate-800">{item.variety.name}</span>
                                            <span className="text-xs text-slate-400">|</span>
                                            <span className="text-xs font-medium text-slate-600">{item.farmer.name}</span>
                                        </div>

                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-sm font-bold text-blue-600 font-mono">
                                            {item.weightKg.toLocaleString()}
                                        </div>
                                        <button
                                            onClick={() => removeFromCart(item.id)}
                                            className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <SheetFooter className="p-4 border-t border-slate-100 bg-white">
                    <Button
                        className={`w-full h-11 text-base font-bold shadow-lg ${editingBatchId ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
                        disabled={items.length === 0}
                        onClick={editingBatchId ? handleUpdate : handleStart}
                    >
                        {editingBatchId ? `${items.length}개 톤백 수정 완료` : `${items.length}개 톤백 도정 시작`}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
