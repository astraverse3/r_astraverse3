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
    getMiscPurchaseEditContext,
    getPurchaseVarieties,
    getPurchaseVendors,
    updateMiscPurchase,
    type MiscPurchaseEditContext,
} from '@/app/actions/packages'
import { triggerDataUpdate } from '@/components/last-updated'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/confirm-dialog'

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

export function EditMiscPurchaseDialog({ open, onOpenChange, packageId, onSuccess }: Props) {
    const [ctx, setCtx] = useState<MiscPurchaseEditContext | null>(null)
    const [loading, setLoading] = useState(false)

    // 자동완성 후보
    const [vendors, setVendors] = useState<string[]>([])
    const [varieties, setVarieties] = useState<{ id: number; name: string }[]>([])

    // 폼 상태
    const [purchaseVendor, setPurchaseVendor] = useState('')
    const [varietyName, setVarietyName] = useState('')
    const [incomingDate, setIncomingDate] = useState('')
    const [packageLabel, setPackageLabel] = useState<string>('5kg')
    const [customLabelStr, setCustomLabelStr] = useState('')
    const [customWeightStr, setCustomWeightStr] = useState('')
    const [countStr, setCountStr] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    // open 시 컨텍스트 + 자동완성 후보 lazy fetch + prefill
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        if (!open || packageId == null) return
        let cancelled = false
        setLoading(true)
        Promise.all([
            getMiscPurchaseEditContext(packageId),
            getPurchaseVendors(),
            getPurchaseVarieties(),
        ]).then(([ctxRes, vendorsRes, varietiesRes]) => {
            if (cancelled) return
            if (ctxRes.success) {
                const data = ctxRes.data
                setCtx(data)
                setPurchaseVendor(data.purchaseVendor)
                setVarietyName(data.varietyName)
                setIncomingDate(data.incomingDate)
                const known = KNOWN_LABELS.has(data.packageType)
                setPackageLabel(known ? data.packageType : '기타')
                setCustomLabelStr(known ? '' : data.packageType)
                setCustomWeightStr(known ? '' : String(data.weightPerUnit))
                setCountStr(String(data.count))
            } else {
                toast.error(ctxRes.error)
                onOpenChange(false)
            }
            if (vendorsRes.success) setVendors(vendorsRes.data)
            if (varietiesRes.success) setVarieties(varietiesRes.data)
            setLoading(false)
        })
        return () => {
            cancelled = true
        }
    }, [open, packageId, onOpenChange])

    function handleOpenChange(next: boolean) {
        if (!next) {
            setCtx(null)
            setPurchaseVendor('')
            setVarietyName('')
            setIncomingDate('')
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
    const totalWeight = +(weightPerUnit * count).toFixed(3)

    const trimmedVariety = varietyName.trim()
    const isNewVariety =
        trimmedVariety.length > 0 &&
        !varieties.some(v => v.name.toLowerCase() === trimmedVariety.toLowerCase())

    const canSubmit =
        !!ctx &&
        purchaseVendor.trim().length > 0 &&
        trimmedVariety.length > 0 &&
        /^\d{4}-\d{2}-\d{2}$/.test(incomingDate) &&
        weightPerUnit > 0 &&
        count > 0 &&
        !isSaving &&
        (!isCustom || (customLabelStr.trim().length > 0 && customLabelStr.trim().length <= 20))

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!canSubmit || !ctx) return

        if (isNewVariety) {
            const ok = await confirmDialog(`새 품종 '${trimmedVariety}'을(를) 추가하고 매입 수정할게요. 계속할까요?`)
            if (!ok) return
        }

        const packageType = isCustom ? customLabelStr.trim() : packageLabel

        setIsSaving(true)
        const result = await updateMiscPurchase(ctx.id, {
            purchaseVendor: purchaseVendor.trim(),
            varietyName: trimmedVariety,
            incomingDate,
            packageType,
            weightPerUnit,
            count,
        })
        setIsSaving(false)

        if (result.success) {
            toast.success(
                result.data.varietyCreated
                    ? `새 품종 '${trimmedVariety}' 등록 + 매입 수정 완료`
                    : '매입이 수정되었습니다.',
            )
            triggerDataUpdate()
            onSuccess?.()
            handleOpenChange(false)
        } else {
            toast.error(result.error || '매입 수정에 실패했습니다.')
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className="sm:max-w-[500px]"
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="h-4 w-4 text-slate-500" />
                        매입 수정
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <p className="text-sm text-slate-500 py-6 text-center">불러오는 중…</p>
                ) : !ctx ? null : (
                    <form onSubmit={onSubmit} className="grid gap-4 py-2 max-h-[80vh] overflow-y-auto px-1">
                        {/* 매입처 */}
                        <div className="space-y-1">
                            <Label className="text-[13px]">매입처</Label>
                            <Input
                                value={purchaseVendor}
                                onChange={(e) => setPurchaseVendor(e.target.value)}
                                list="edit-misc-purchase-vendors"
                                maxLength={100}
                                className="h-9 text-[13px]"
                            />
                            <datalist id="edit-misc-purchase-vendors">
                                {vendors.map(v => (
                                    <option key={v} value={v} />
                                ))}
                            </datalist>
                        </div>

                        {/* 품종 */}
                        <div className="space-y-1">
                            <Label className="text-[13px]">품종</Label>
                            <Input
                                value={varietyName}
                                onChange={(e) => setVarietyName(e.target.value)}
                                list="edit-misc-purchase-varieties"
                                maxLength={50}
                                className="h-9 text-[13px]"
                            />
                            <datalist id="edit-misc-purchase-varieties">
                                {varieties.map(v => (
                                    <option key={v.id} value={v.name} />
                                ))}
                            </datalist>
                            {trimmedVariety.length > 0 && (
                                isNewVariety ? (
                                    <p className="text-[11px] text-amber-600">
                                        새 품종 '{trimmedVariety}' 으로 등록돼요
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-slate-400">기존 품종 사용</p>
                                )
                            )}
                        </div>

                        {/* 매입일 */}
                        <div className="space-y-1">
                            <Label className="text-[13px]">매입일</Label>
                            <Input
                                type="date"
                                value={incomingDate}
                                onChange={(e) => setIncomingDate(e.target.value)}
                                className="h-9 text-[13px] tabular-nums"
                            />
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
                                <p className="text-lg font-bold text-primary tabular-nums leading-tight">
                                    {totalWeight.toLocaleString()}
                                    <span className="text-xs font-semibold ml-0.5 opacity-70">kg</span>
                                </p>
                            </div>
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
