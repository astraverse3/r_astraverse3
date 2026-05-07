'use client'

import { useEffect, useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    getMiscPackageEditContext,
    updateMiscPackage,
    type MiscPackageEditContext,
} from '@/app/actions/packages'
import { triggerDataUpdate } from '@/components/last-updated'
import { toast } from 'sonner'

const PACKAGE_TEMPLATES_MISC = [
    { label: '10kg', weight: 10 },
    { label: '5kg', weight: 5 },
    { label: '1kg', weight: 1 },
    { label: '800g', weight: 0.8 },
    { label: '500g', weight: 0.5 },
    { label: '420g', weight: 0.42 },
    { label: '기타', weight: 0 },
] as const

const KNOWN_LABELS: Set<string> = new Set(
    PACKAGE_TEMPLATES_MISC.map(t => t.label).filter(l => l !== '기타'),
)

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    packageId: number | null
    onSuccess?: () => void
}

export function EditMiscPackageDialog({ open, onOpenChange, packageId, onSuccess }: Props) {
    const [ctx, setCtx] = useState<MiscPackageEditContext | null>(null)
    const [loading, setLoading] = useState(false)

    const [packageLabel, setPackageLabel] = useState<string>('5kg')
    const [customLabelStr, setCustomLabelStr] = useState<string>('')
    const [customWeightStr, setCustomWeightStr] = useState<string>('')
    const [countStr, setCountStr] = useState<string>('')
    const [isSaving, setIsSaving] = useState(false)

    // 다이얼로그 open 시 컨텍스트 lazy fetch + prefill
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        if (!open || packageId == null) return
        let cancelled = false
        setLoading(true)
        getMiscPackageEditContext(packageId).then(res => {
            if (cancelled) return
            if (res.success) {
                const data = res.data
                setCtx(data)
                const known = KNOWN_LABELS.has(data.packageType)
                setPackageLabel(known ? data.packageType : '기타')
                setCustomLabelStr(known ? '' : data.packageType)
                setCustomWeightStr(known ? '' : String(data.weightPerUnit))
                setCountStr(String(data.count))
            } else {
                toast.error(res.error)
                onOpenChange(false)
            }
            setLoading(false)
        })
        return () => {
            cancelled = true
        }
    }, [open, packageId, onOpenChange])

    // 다이얼로그 닫힘 → state 정리 (다음 열림 시 stale 방지)
    function handleOpenChange(next: boolean) {
        if (!next) {
            setCtx(null)
            setPackageLabel('5kg')
            setCustomLabelStr('')
            setCustomWeightStr('')
            setCountStr('')
        }
        onOpenChange(next)
    }

    const isCustom = packageLabel === '기타'
    const weightPerUnit = useMemo(() => {
        if (!isCustom) {
            return PACKAGE_TEMPLATES_MISC.find(t => t.label === packageLabel)?.weight ?? 0
        }
        const w = parseFloat(customWeightStr)
        return Number.isFinite(w) && w > 0 ? w : 0
    }, [isCustom, packageLabel, customWeightStr])

    const count = parseInt(countStr) || 0
    const newTotalWeight = +(weightPerUnit * count).toFixed(3)

    const limit = ctx ? ctx.stockWeightKg - ctx.otherSum : 0
    const isOver = !!ctx && newTotalWeight > 0 && newTotalWeight - limit > 0.001

    const canSubmit =
        !!ctx &&
        weightPerUnit > 0 &&
        count > 0 &&
        !isOver &&
        !isSaving &&
        (!isCustom || (customLabelStr.trim().length > 0 && customLabelStr.trim().length <= 20))

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!canSubmit || !ctx) return

        const packageType = isCustom ? customLabelStr.trim() : packageLabel

        setIsSaving(true)
        const result = await updateMiscPackage(ctx.id, {
            packageType,
            weightPerUnit,
            count,
        })
        setIsSaving(false)

        if (result.success) {
            toast.success('포장이 수정되었습니다.')
            triggerDataUpdate()
            onSuccess?.()
            handleOpenChange(false)
        } else {
            toast.error(result.error || '포장 수정에 실패했습니다.')
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className="sm:max-w-[460px]"
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="h-4 w-4 text-slate-500" />
                        포장 수정
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <p className="text-sm text-slate-500 py-6 text-center">불러오는 중…</p>
                ) : !ctx ? null : (
                    <form onSubmit={onSubmit} className="grid gap-4 py-2 max-h-[80vh] overflow-y-auto px-1">
                        {/* 대상 정보 (readonly) */}
                        <div className="rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2 text-[12px] text-slate-700">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold">{ctx.variety}</span>
                                <span className="text-slate-400">·</span>
                                <span>{ctx.producer}</span>
                                {ctx.lotNo && (
                                    <span className="ml-auto font-mono text-[11px] text-slate-600 bg-white border border-slate-200 rounded px-1.5 py-[1px]">
                                        {ctx.lotNo}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* 포장단위 */}
                        <div className="space-y-2">
                            <Label className="text-[13px]">포장단위</Label>
                            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                                {PACKAGE_TEMPLATES_MISC.map(tpl => (
                                    <button
                                        key={tpl.label}
                                        type="button"
                                        onClick={() => setPackageLabel(tpl.label)}
                                        className={`h-9 rounded-md border text-[12px] font-medium transition-colors ${
                                            packageLabel === tpl.label
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                        }`}
                                    >
                                        {tpl.label}
                                    </button>
                                ))}
                            </div>
                            {isCustom && (
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    <div className="space-y-1">
                                        <Label className="text-[11px] text-slate-500">규격 라벨</Label>
                                        <Input
                                            value={customLabelStr}
                                            onChange={(e) => setCustomLabelStr(e.target.value)}
                                            placeholder="예: 200g, 30kg"
                                            maxLength={20}
                                            className="h-9 text-[13px]"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] text-slate-500">단중(kg)</Label>
                                        <Input
                                            type="number"
                                            inputMode="decimal"
                                            step="0.01"
                                            min="0"
                                            value={customWeightStr}
                                            onChange={(e) => setCustomWeightStr(e.target.value)}
                                            placeholder="0.2"
                                            className="h-9 text-[13px] tabular-nums"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 개수 + 미리보기 */}
                        <div className="flex items-end justify-between gap-3">
                            <div className="space-y-1 w-[140px]">
                                <Label className="text-[13px]">개수</Label>
                                <Input
                                    type="number"
                                    inputMode="numeric"
                                    min="1"
                                    value={countStr}
                                    onChange={(e) => setCountStr(e.target.value)}
                                    placeholder="개수"
                                    className="h-9 text-[13px] tabular-nums"
                                />
                            </div>
                            <div className="text-right pb-1">
                                <p className="text-[10px] text-slate-500">총 포장중량</p>
                                <p className={`text-lg font-bold tabular-nums leading-tight ${isOver ? 'text-red-600' : 'text-primary'}`}>
                                    {newTotalWeight.toLocaleString()}<span className="text-xs font-semibold ml-0.5 opacity-70">kg</span>
                                </p>
                            </div>
                        </div>

                        {/* 한도 미리보기 */}
                        <div className={`rounded-md border px-3 py-2 text-[12px] ${isOver ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                            {isOver ? (
                                <p className="text-red-700 font-medium">
                                    수정 가능 한도 {limit.toFixed(2)}kg를 초과했어요.
                                </p>
                            ) : (
                                <p className="text-slate-600">
                                    수정 가능 한도:
                                    <span className="font-bold text-slate-900 tabular-nums ml-1">
                                        {limit.toFixed(2)}kg
                                    </span>
                                    <span className="text-slate-400 ml-1">
                                        (원물 {ctx.stockWeightKg.toLocaleString()}kg − 다른 포장 {ctx.otherSum.toFixed(2)}kg)
                                    </span>
                                </p>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenChange(false)}
                                disabled={isSaving}
                            >
                                취소
                            </Button>
                            <Button type="submit" size="sm" disabled={!canSubmit}>
                                {isSaving ? '저장 중…' : '수정'}
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}
