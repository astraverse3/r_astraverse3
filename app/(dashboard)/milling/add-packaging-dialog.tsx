'use client'

import { useState } from 'react'
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
import { Plus, Minus, Package, Trash2 } from 'lucide-react'
import { updatePackagingLogs, reopenMillingBatch, type MillingOutputInput } from '@/app/actions/milling'

interface Props {
    batchId: number
    batchTitle: string
    isClosed?: boolean
    initialOutputs?: MillingOutputInput[]
}

const PACKAGE_TEMPLATES = [
    { label: '20kg', weight: 20 },
    { label: '10kg', weight: 10 },
    { label: '5kg', weight: 5 },
]

export function AddPackagingDialog({ batchId, batchTitle, isClosed, initialOutputs = [], open: controlledOpen, onOpenChange: setControlledOpen, trigger }: Props & { open?: boolean, onOpenChange?: (open: boolean) => void, trigger?: React.ReactNode }) {
    const [internalOpen, setInternalOpen] = useState(false)
    const [outputs, setOutputs] = useState<MillingOutputInput[]>(initialOutputs)
    const [isLoading, setIsLoading] = useState(false)

    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen

    // Custom setOpen that handles both controlled and internal state
    const setOpen = (newOpen: boolean) => {
        if (isControlled) {
            setControlledOpen?.(newOpen)
        } else {
            setInternalOpen(newOpen)
        }
    }

    // Reset internal state to initialOutputs whenever the dialog is opened
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
            setOutputs(initialOutputs)
            setOpen(true)
        } else {
            alert(result.error || '마감 해제 실패')
        }
    }

    // ... (rest of logic) ...

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
                    <DialogTitle>포장 기록 추가</DialogTitle>
                    <div className="text-sm text-stone-500">{batchTitle}</div>
                </DialogHeader>
                <div className="py-6 space-y-6">
                    <div className="space-y-3">
                        <Label>규격 선택</Label>
                        <div className="flex gap-2">
                            {PACKAGE_TEMPLATES.map(t => (
                                <Button key={t.label} variant="secondary" className="flex-1" onClick={() => addPackage(t)}>
                                    {t.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label>입력된 내역</Label>
                        <div className="space-y-2 min-h-[100px]">
                            {outputs.map((o) => (
                                <div key={o.packageType} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-200">
                                    <div className="flex flex-col">
                                        <div className="font-bold">{o.packageType}</div>
                                        <div className="text-[10px] text-stone-400">{(o.weightPerUnit * o.count).toLocaleString()}kg</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateCount(o.packageType, -1)}><Minus className="h-3 w-3" /></Button>
                                        <Input
                                            type="number"
                                            value={o.count === 0 ? '' : o.count}
                                            onChange={(e) => setCount(o.packageType, parseInt(e.target.value))}
                                            className="w-16 h-8 text-center"
                                        />
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateCount(o.packageType, 1)}><Plus className="h-3 w-3" /></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-300 hover:text-red-500" onClick={() => removePackage(o.packageType)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 flex justify-between items-center border-t">
                        <div className="text-sm font-medium">총 포장 중량: <span className="font-bold text-lg">{outputs.reduce((sum, o) => sum + o.totalWeight, 0).toLocaleString()} kg</span></div>
                        <Button onClick={handleSubmit} disabled={isLoading || outputs.length === 0}>
                            {isLoading ? '저장 중...' : '기록 저장'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
