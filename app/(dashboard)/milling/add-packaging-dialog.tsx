'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Plus, Minus, Package, Trash2, Lock, Check, X } from 'lucide-react'
import { updatePackagingLogs, reopenMillingBatch, closeMillingBatch, deleteMillingBatch, type MillingOutputInput } from '@/app/actions/milling'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { generateLotNo } from '@/lib/lot-generation'
import { useRouter } from 'next/navigation'
import { triggerDataUpdate } from '@/components/last-updated'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'

interface Props {
    batchId: number
    millingType?: string
    totalInputKg?: number
    isClosed?: boolean
    initialOutputs?: MillingOutputInput[]
    stocks?: any[]
}

const PACKAGE_TEMPLATES = [
    { label: '20kg', weight: 20 },
    { label: '10kg', weight: 10 },
    { label: '8kg', weight: 8 },
    { label: '5kg', weight: 5 },
    { label: '4kg', weight: 4 },
    { label: '1kg', weight: 1 },
]

export function AddPackagingDialog({ batchId, millingType, totalInputKg, isClosed, initialOutputs = [], stocks = [], open: controlledOpen, onOpenChange: setControlledOpen, trigger }: Props & { open?: boolean, onOpenChange?: (open: boolean) => void, trigger?: React.ReactNode }) {
    const router = useRouter()
    const [internalOpen, setInternalOpen] = useState(false)
    const [outputs, setOutputs] = useState<MillingOutputInput[]>(initialOutputs)
    const [isLoading, setIsLoading] = useState(false)
    const [isCustomInput, setIsCustomInput] = useState(false)
    const [customWeight, setCustomWeight] = useState('')
    const scrollRef = useRef<HTMLDivElement>(null)
    const { data: session } = useSession()
    // @ts-ignore
    const canManage = hasPermission(session?.user, 'MILLING_MANAGE')

    // ... (keep state logic same) ...
    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen

    const setOpen = (newOpen: boolean) => {
        if (isControlled) {
            setControlledOpen?.(newOpen)
        } else {
            setInternalOpen(newOpen)
        }
    }

    useEffect(() => {
        if (open) {
            setOutputs(initialOutputs)
        }
    }, [open, initialOutputs])

    const handleOpenChange = (newOpen: boolean) => {
        if (newOpen) {
            setOutputs(initialOutputs)
        }
        setOpen(newOpen)
    }

    const handleReopenAndOpen = async () => {
        if (!confirm('마감된 작업을 다시 수정하시겠습니까?')) return

        setIsLoading(true)
        const result = await reopenMillingBatch(batchId)
        setIsLoading(false)

        if (result.success) {
            triggerDataUpdate()
            setOutputs(initialOutputs)
            setOpen(true)
            router.refresh()
        } else {
            toast.error((result as any).error || '마감 해제 실패')
        }
    }

    const handleCloseBatch = async () => {
        const hasUnsavedChanges = JSON.stringify(outputs) !== JSON.stringify(initialOutputs)

        if (hasUnsavedChanges) {
            const validOutputs = outputs.filter(o => o.count > 0)
            if (validOutputs.length === 0) {
                toast.warning('포장 내역을 입력해주세요.')
                return
            }
            if (!confirm('포장 데이터를 저장하고 마감하시겠습니까?')) return

            setIsLoading(true)
            const saveResult = await updatePackagingLogs(batchId, validOutputs)
            if (!saveResult.success) {
                setIsLoading(false)
                toast.error('포장 기록 저장 실패: ' + ((saveResult as any).error || ''))
                return
            }
        } else {
            if (!confirm('작업을 마감하시겠습니까?')) return
            setIsLoading(true)
        }

        const result = await closeMillingBatch(batchId)
        setIsLoading(false)

        if (result.success) {
            triggerDataUpdate()
            setOpen(false)
            router.refresh()
        } else {
            toast.error((result as any).error || '마감 실패')
        }
    }

    const handleClearPackaging = async () => {
        if (!confirm('포장 기록을 모두 삭제하시겠습니까?')) return

        setIsLoading(true)
        const result = await updatePackagingLogs(batchId, [])
        setIsLoading(false)

        if (result.success) {
            setOutputs([])
            triggerDataUpdate()
            router.refresh()
        } else {
            toast.error('포장 기록 삭제 실패')
        }
    }

    const scrollToBottom = () => {
        setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            }
        }, 50)
    }

    const getBestStockIdForNewPackage = (newTotalWeight: number) => {
        if (!stocks || stocks.length === 0) return undefined;
        // 단일 생산자면 무조건 그 사람
        if (stocks.length === 1) return stocks[0].id;
        
        let bestStockId = stocks[0].id;
        let minTotalError = Infinity;
        
        // 시뮬레이션: 이 새로운 중량을 각 생산자에게 주었을 때의 전체 오차 계산
        for (const candidateStock of stocks) {
            let currentTotalError = 0;
            
            for (const s of stocks) {
                const expected = s.weightKg * 0.69;
                let used = outputs.filter(o => o.stockId === s.id).reduce((sum, o) => sum + (o.totalWeight || 0), 0);
                
                if (s.id === candidateStock.id) {
                    used += newTotalWeight;
                }
                
                // 해당 생산자의 목표량 대비 실제 배정량 오차 (절댓값)
                const error = Math.abs(expected - used);
                currentTotalError += error;
            }
            
            if (currentTotalError < minTotalError) {
                minTotalError = currentTotalError;
                bestStockId = candidateStock.id;
            }
        }
        
        return bestStockId;
    }

    const addPackage = (template: { label: string, weight: number }) => {
        const targetStockId = getBestStockIdForNewPackage(template.weight);

        if (template.label === '톤백') {
            setOutputs(prev => [...prev, {
                packageType: template.label,
                weightPerUnit: 0,
                count: 1,
                totalWeight: 0,
                stockId: targetStockId
            }])
            scrollToBottom()
            return
        }

        setOutputs(prev => {
            const existingIndex = prev.findIndex(o => o.packageType === template.label && o.packageType !== '톤백' && o.packageType !== '잔량' && o.stockId === targetStockId)
            if (existingIndex >= 0) {
                const newOutputs = [...prev]
                const o = newOutputs[existingIndex]
                newOutputs[existingIndex] = { ...o, count: o.count + 1, totalWeight: (o.count + 1) * o.weightPerUnit }
                return newOutputs
            }
            return [...prev, {
                packageType: template.label,
                weightPerUnit: template.weight,
                count: 1,
                totalWeight: template.weight,
                stockId: targetStockId
            }]
        })
    }

    const handleCustomAdd = () => {
        const weight = parseFloat(customWeight)
        if (weight > 0) {
            addPackage({ label: `${weight}kg`, weight })
            setCustomWeight('')
            setIsCustomInput(false)
        } else {
            toast.warning('올바른 무게를 입력해주세요.')
        }
    }

    const setCount = (index: number, count: number) => {
        setOutputs(prev => prev.map((o, i) => {
            if (i === index) {
                const validCount = isNaN(count) ? 0 : Math.max(0, count)
                return { ...o, count: validCount, totalWeight: validCount * o.weightPerUnit }
            }
            return o
        }))
    }

    const setWeight = (index: number, weight: number) => {
        setOutputs(prev => prev.map((o, i) => {
            if (i === index) {
                const validWeight = isNaN(weight) ? 0 : Math.max(0, weight)
                return { ...o, weightPerUnit: validWeight, totalWeight: o.count * validWeight }
            }
            return o
        }))
    }

    const setStockId = (index: number, stockId: number) => {
        setOutputs(prev => prev.map((o, i) => i === index ? { ...o, stockId } : o))
    }

    const removePackage = (index: number) => {
        setOutputs(prev => prev.filter((_, i) => i !== index))
    }

    const updateCount = (index: number, delta: number) => {
        setOutputs(prev => prev.map((o, i) => {
            if (i === index) {
                const newCount = Math.max(0, o.count + delta)
                return { ...o, count: newCount, totalWeight: newCount * o.weightPerUnit }
            }
            return o
        }))
    }

    async function handleSubmit() {
        const validOutputs = outputs.filter(o => o.count > 0)
        if (validOutputs.length === 0) {
            toast.warning('포장 내역을 입력해주세요.')
            return
        }

        setIsLoading(true)
        const result = await updatePackagingLogs(batchId, validOutputs)
        setIsLoading(false)

        if (result.success) {
            triggerDataUpdate()
            setOpen(false)
            setOutputs([])
            router.refresh()
        } else {
            toast.error((result as any).error || '저장 실패')
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            {trigger !== undefined ? trigger : (
                <DialogTrigger asChild>
                    {isClosed ? (
                        <Button variant="outline" size="sm" onClick={(e) => { e.preventDefault(); handleReopenAndOpen(); }} disabled={isLoading}>
                            <Package className="mr-2 h-4 w-4" /> 마감완료
                        </Button>
                    ) : (
                        <Button variant="outline" size="sm">
                            <Package className="mr-2 h-4 w-4" /> 포장하기
                        </Button>
                    )}
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>포장 기록 관리</DialogTitle>
                    <div className="flex flex-col gap-2 mt-2">
                        <div className="flex items-center gap-2">
                            {millingType && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#00a2e8]/20 text-[#007ab3]">
                                    {millingType}
                                </span>
                            )}
                            <span className="text-[13px] font-bold text-slate-700">
                                총 투입: {totalInputKg?.toLocaleString()}kg
                            </span>
                        </div>
                        
                        {/* 텍스트 기반 기대 수율 및 로트번호 헤더 */}
                        {stocks && stocks.length > 0 && (
                            <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200 mt-2 space-y-2">
                                {stocks.map((s, idx) => {
                                    const expected = Math.round(s.weightKg * 0.69);
                                    const used = outputs.filter(o => o.stockId === s.id).reduce((sum, o) => sum + (o.totalWeight || 0), 0);
                                    const lotNoPreview = generateLotNo({
                                        incomingDate: new Date(s.incomingDate || Date.now()),
                                        varietyType: s.variety?.type || 'URUCHI',
                                        varietyName: s.variety?.name || '일반쌀',
                                        millingType: millingType || '백미',
                                        certNo: s.farmer?.group?.certNo || '00',
                                        farmerGroupCode: s.farmer?.group?.code || '00',
                                        farmerNo: s.farmer?.farmerNo || '00'
                                    });

                                    return (
                                        <div key={s.id} className="flex flex-col gap-1 text-[12px] text-stone-600 border-b border-stone-100 last:border-0 pb-1.5 last:pb-0">
                                            <div className="flex items-center justify-between">
                                                <div className="font-bold flex items-center gap-1.5 text-stone-700">
                                                    <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[9px] font-bold">{idx + 1}</span>
                                                    {s.farmerName || s.farmer?.name || '알수없음'} ({s.variety?.name})
                                                </div>
                                                <div className="flex items-center gap-1 font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-stone-200 text-stone-500" title="확정 로트번호">
                                                    {lotNoPreview}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-end gap-2 pr-1">
                                                <span>투입: {s.weightKg}kg</span>
                                                <span className="text-stone-300">→</span>
                                                <span>예상: <span className="font-bold text-[#00a2e8]">{expected}kg</span></span>
                                                <span className="text-stone-300">|</span>
                                                <span>사용: <span className={`font-bold ${used > expected ? 'text-rose-500' : 'text-stone-700'}`}>{used}kg</span></span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </DialogHeader>
                <div className="py-6 space-y-6">
                    {/* Template buttons - only when editable */}
                    {!isClosed && canManage && (
                        <div className="space-y-2">
                            <Label className="mb-2 block text-[13px]">규격 선택</Label>

                            {/* Row 1 */}
                            <div className="grid grid-cols-5 gap-1.5 h-9">
                                <Button variant="secondary" className="h-full px-1 text-[13px] border-dashed border-stone-300 hover:bg-stone-200 transition-colors" onClick={() => addPackage({ label: '톤백', weight: 0 })}>
                                    톤백
                                </Button>
                                {[{ label: '20kg', weight: 20 }, { label: '10kg', weight: 10 }, { label: '8kg', weight: 8 }, { label: '5kg', weight: 5 }].map(t => (
                                    <Button key={t.label} variant="secondary" className="h-full px-1 text-[13px] hover:bg-stone-200 transition-colors" onClick={() => addPackage(t)}>
                                        {t.label}
                                    </Button>
                                ))}
                            </div>

                            {/* Row 2 */}
                            <div className="grid grid-cols-5 gap-1.5 h-9">
                                {[{ label: '4kg', weight: 4 }, { label: '3kg', weight: 3 }, { label: '1kg', weight: 1 }].map(t => (
                                    <Button key={t.label} variant="secondary" className="h-full px-1 text-[13px] hover:bg-stone-200 transition-colors" onClick={() => addPackage(t)}>
                                        {t.label}
                                    </Button>
                                ))}
                                <Button variant="secondary" className="h-full px-1 text-[13px] border-dashed border-stone-300 hover:bg-stone-200 transition-colors" onClick={() => addPackage({ label: '잔량', weight: 0 })}>
                                    잔량
                                </Button>

                                {/* Custom Input Toggle */}
                                {isCustomInput ? (
                                    <div className="flex gap-0.5 h-full items-center bg-stone-100 rounded-md border border-stone-200">
                                        <div className="relative flex-1">
                                            <Input
                                                type="number"
                                                value={customWeight}
                                                onChange={(e) => setCustomWeight(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleCustomAdd()
                                                    if (e.key === 'Escape') setIsCustomInput(false)
                                                }}
                                                placeholder="입력"
                                                autoFocus
                                                className="h-full w-full pr-3 pl-1 text-xs text-right border-none shadow-none bg-transparent focus-visible:ring-0"
                                            />
                                            <span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[9px] text-stone-500 font-bold">kg</span>
                                        </div>
                                        <Button size="icon" variant="ghost" className="h-full w-6 shrink-0 text-[#00a2e8] p-0" onClick={handleCustomAdd}>
                                            <Check className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-full w-6 shrink-0 text-stone-400 p-0" onClick={() => setIsCustomInput(false)}>
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ) : (
                                    <Button variant="outline" className="h-full px-1 text-xs border-dashed border-stone-300 hover:bg-stone-100 text-stone-500 p-0" onClick={() => setIsCustomInput(true)}>
                                        직접입력
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        <Label className="text-[13px]">생산(포장) 내역</Label>
                        <div ref={scrollRef} className="space-y-2 min-h-[60px] max-h-[300px] overflow-y-auto custom-scrollbar">
                            {outputs.length === 0 && (
                                <div className="text-center text-[13px] text-stone-400 py-6">포장 내역이 없습니다</div>
                            )}
                            {outputs.map((o, i) => (
                                <div key={`${o.packageType}-${o.stockId}-${i}`} className="flex flex-col gap-2 p-2 bg-white rounded-xl border border-stone-200">
                                    <div className="flex items-center justify-between">
                                        {/* Left: Select Stock */}
                                        <Select 
                                            value={o.stockId?.toString() || (stocks && stocks.length > 0 ? stocks[0].id.toString() : '')} 
                                            onValueChange={(val) => setStockId(i, parseInt(val))}
                                            disabled={isClosed || !canManage}
                                        >
                                            <SelectTrigger className="w-[130px] h-8 text-[12px] font-bold bg-stone-50 border-stone-200 shadow-none px-2 rounded-lg">
                                                <SelectValue placeholder="생산자 선택" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {stocks?.map(s => (
                                                    <SelectItem key={s.id} value={s.id.toString()} className="text-[12px] font-medium font-sans">
                                                        {s.farmerName || s.farmer?.name || '알수없음'}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        {/* Right: Controls */}
                                        <div className="flex items-center shrink-0">
                                            {isClosed || !canManage ? (
                                                <span className="text-[13px] font-mono font-bold text-stone-600 px-2">{o.count}개</span>
                                            ) : (
                                                <div className="flex items-center gap-0.5">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full" onClick={() => updateCount(i, -1)}>
                                                        <Minus className="h-4 w-4" />
                                                    </Button>
                                                    <Input
                                                        type="number"
                                                        value={o.count === 0 ? '' : o.count}
                                                        onChange={(e) => setCount(i, parseInt(e.target.value))}
                                                        onFocus={(e) => e.target.select()}
                                                        className="w-10 h-8 text-center text-[13px] font-bold bg-transparent border-none shadow-none font-mono px-0"
                                                    />
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full" onClick={() => updateCount(i, 1)}>
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                    <div className="w-px h-4 bg-stone-200 mx-1"></div>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-full" onClick={() => removePackage(i)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Bottom: Package Info */}
                                    <div className="flex items-center justify-between pl-1">
                                        <div className="flex items-center gap-1.5">
                                            <Badge variant="secondary" className="bg-stone-100 text-stone-600 hover:bg-stone-100 px-1.5 py-0 rounded text-[11px]">{o.packageType}</Badge>
                                        </div>

                                        <div className="flex-1 flex items-center justify-end pr-2">
                                        {(o.packageType === '톤백' || o.packageType === '잔량') ? (
                                            isClosed ? (
                                                <div className="flex items-center gap-1 sm:gap-1.5 opacity-60">
                                                    <div className="h-8 w-14 sm:w-20 flex items-center justify-end pr-1 text-[13px] font-bold">
                                                        {o.weightPerUnit.toLocaleString()}
                                                    </div>
                                                    <span className="text-xs font-medium shrink-0">kg</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 sm:gap-1.5">
                                                    <Input
                                                        type="number"
                                                        value={o.weightPerUnit}
                                                        onChange={(e) => setWeight(i, parseFloat(e.target.value))}
                                                        onFocus={(e) => e.target.select()}
                                                        className="h-8 w-14 sm:w-20 text-right pr-1 sm:pr-2 text-[13px] font-medium border-stone-200 rounded-lg shadow-none px-1"
                                                    />
                                                    <span className="text-xs text-stone-400 font-medium shrink-0">kg</span>
                                                </div>
                                            )
                                        ) : (
                                            <div className="flex items-center gap-1 sm:gap-1.5 opacity-40">
                                                <div className="h-8 w-14 sm:w-20 flex items-center justify-end pr-1 text-[13px] font-bold">
                                                    {(o.weightPerUnit * o.count).toLocaleString()}
                                                </div>
                                                <span className="text-xs font-medium shrink-0">kg</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        </div>
                    </div>

                    {/* Footer - only for managers */}
                    {canManage && (
                        <div className="pt-4 border-t space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="text-[13px] font-medium">총 포장 중량: <span className="font-bold text-[15px] sm:text-lg">{outputs.reduce((sum, o) => sum + o.totalWeight, 0).toLocaleString()} kg</span></div>
                                {isClosed ? (
                                    <Button variant="outline" onClick={handleReopenAndOpen} disabled={isLoading}>
                                        <Lock className="mr-1 h-3 w-3" /> 마감 해제
                                    </Button>
                                ) : (
                                    <Button onClick={handleSubmit} disabled={isLoading || outputs.length === 0}>
                                        {isLoading ? '저장 중...' : '기록 저장'}
                                    </Button>
                                )}
                            </div>

                            {!isClosed && (
                                <div className="flex justify-between items-center pt-2 border-t border-dashed">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-auto p-0 px-2 py-1"
                                        disabled={isLoading}
                                        onClick={handleCloseBatch}
                                    >
                                        <Lock className="mr-1 h-3 w-3" /> 작업 마감
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-auto p-0 px-2 py-1 ml-auto"
                                        disabled={isLoading || outputs.length === 0}
                                        onClick={handleClearPackaging}
                                    >
                                        <Trash2 className="mr-1 h-3 w-3" /> 포장 초기화
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
