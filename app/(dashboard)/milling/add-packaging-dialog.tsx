'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Minus, Package, Trash2, Lock } from 'lucide-react'
import { updatePackagingLogs, reopenMillingBatch, closeMillingBatch, deleteMillingBatch, type MillingOutputInput } from '@/app/actions/milling'
import { useRouter } from 'next/navigation'
import { triggerDataUpdate } from '@/components/last-updated'

interface Props {
    batchId: number
    millingType?: string
    totalInputKg?: number
    isClosed?: boolean
    initialOutputs?: MillingOutputInput[]
}

const PACKAGE_TEMPLATES = [
    { label: '20kg', weight: 20 },
    { label: '10kg', weight: 10 },
    { label: '5kg', weight: 5 },
]

export function AddPackagingDialog({ batchId, millingType, totalInputKg, isClosed, initialOutputs = [], open: controlledOpen, onOpenChange: setControlledOpen, trigger }: Props & { open?: boolean, onOpenChange?: (open: boolean) => void, trigger?: React.ReactNode }) {
    const router = useRouter()
    const [internalOpen, setInternalOpen] = useState(false)
    const [outputs, setOutputs] = useState<MillingOutputInput[]>(initialOutputs)
    const [isLoading, setIsLoading] = useState(false)

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
            alert((result as any).error || '마감 해제 실패')
        }
    }

    const handleCloseBatch = async () => {
        if (!confirm('작업을 마감하시겠습니까?')) return

        setIsLoading(true)

        // Auto-save current outputs before closing
        const validOutputs = outputs.filter(o => o.count > 0)
        if (validOutputs.length > 0) {
            const saveResult = await updatePackagingLogs(batchId, validOutputs)
            if (!saveResult.success) {
                setIsLoading(false)
                alert('포장 기록 저장에 실패했습니다.')
                return
            }
        }

        const result = await closeMillingBatch(batchId)
        setIsLoading(false)

        if (result.success) {
            triggerDataUpdate()
            setOpen(false)
            router.refresh()
        } else {
            alert((result as any).error || '마감 실패')
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
            alert('포장 기록 삭제 실패')
        }
    }

    const addPackage = (template: { label: string, weight: number }) => {
        if (template.label === '톤백') {
            setOutputs(prev => [...prev, {
                packageType: template.label,
                weightPerUnit: template.weight,
                count: 1,
                totalWeight: template.weight
            }])
            return
        }

        setOutputs(prev => {
            const existingIndex = prev.findIndex(o => o.packageType === template.label && o.packageType !== '톤백')
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
                totalWeight: template.weight
            }]
        })
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
            alert('포장 내역을 입력해주세요.')
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
            alert((result as any).error || '저장 실패')
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
                    <div className="flex items-center gap-2 mt-1">
                        {millingType && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">
                                {millingType}
                            </span>
                        )}
                        <span className="text-sm font-bold text-slate-700">
                            투입: {totalInputKg?.toLocaleString()}kg
                        </span>
                    </div>
                </DialogHeader>
                <div className="py-6 space-y-6">
                    {/* Template buttons - only when editable */}
                    {!isClosed && (
                        <div className="space-y-3">
                            <Label>규격 선택</Label>
                            <div className="flex gap-2 flex-wrap">
                                <Button variant="secondary" className="flex-1 border-dashed border-stone-300 hover:bg-stone-200 transition-colors" onClick={() => addPackage({ label: '톤백', weight: 1000 })}>
                                    톤백
                                </Button>
                                {PACKAGE_TEMPLATES.map(t => (
                                    <Button key={t.label} variant="secondary" className="flex-1 hover:bg-stone-200 transition-colors" onClick={() => addPackage(t)}>
                                        {t.label}
                                    </Button>
                                ))}
                                <Button variant="secondary" className="flex-1 border-dashed border-stone-300 hover:bg-stone-200 transition-colors" onClick={() => addPackage({ label: '잔량', weight: 0 })}>
                                    잔량
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        <Label>생산(포장) 내역</Label>
                        <div className="space-y-2 min-h-[60px] max-h-[300px] overflow-y-auto custom-scrollbar">
                            {outputs.length === 0 && (
                                <div className="text-center text-sm text-stone-400 py-6">포장 내역이 없습니다</div>
                            )}
                            {outputs.map((o, i) => (
                                <div key={`${o.packageType}-${i}`} className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg border border-stone-200">
                                    <span className="font-bold text-sm w-10 shrink-0">{o.packageType}</span>
                                    {(o.packageType === '톤백' || o.packageType === '잔량') ? (
                                        isClosed ? (
                                            <span className="text-xs text-stone-500">{o.weightPerUnit.toLocaleString()}kg</span>
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <Input
                                                    type="number"
                                                    value={o.weightPerUnit}
                                                    onChange={(e) => setWeight(i, parseFloat(e.target.value))}
                                                    onFocus={(e) => e.target.select()}
                                                    className="h-7 w-[5.5rem] text-right px-1 py-0 text-xs"
                                                />
                                                <span className="text-[10px] text-stone-500">kg</span>
                                            </div>
                                        )
                                    ) : (
                                        <span className="text-xs text-stone-400 w-16 text-right">{(o.weightPerUnit * o.count).toLocaleString()}kg</span>
                                    )}
                                    {isClosed ? (
                                        <span className="text-sm font-mono text-stone-600 ml-auto">{o.count}개</span>
                                    ) : (
                                        <div className="flex items-center gap-1 ml-auto">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateCount(i, -1)}><Minus className="h-3 w-3" /></Button>
                                            <Input
                                                type="number"
                                                value={o.count === 0 ? '' : o.count}
                                                onChange={(e) => setCount(i, parseInt(e.target.value))}
                                                onFocus={(e) => e.target.select()}
                                                className="w-12 h-7 text-center text-sm"
                                            />
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateCount(i, 1)}><Plus className="h-3 w-3" /></Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-300 hover:text-red-500" onClick={() => removePackage(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="pt-4 border-t space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="text-sm font-medium">총 포장 중량: <span className="font-bold text-lg">{outputs.reduce((sum, o) => sum + o.totalWeight, 0).toLocaleString()} kg</span></div>
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
                </div>
            </DialogContent>
        </Dialog>
    )
}
