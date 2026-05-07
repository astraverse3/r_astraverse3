'use client'

import { useEffect, useMemo, useState } from 'react'
import { ShoppingBag } from 'lucide-react'
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
    createMiscPurchase,
    getPurchaseVarieties,
    getPurchaseVendors,
} from '@/app/actions/packages'
import { triggerDataUpdate } from '@/components/last-updated'
import { toast } from 'sonner'

// 잡곡 포장 다이얼로그와 동일 셋 (잡곡 매입도 같은 포장단위)
const PACKAGE_TEMPLATES_MISC = [
    { label: '10kg', weight: 10 },
    { label: '5kg', weight: 5 },
    { label: '1kg', weight: 1 },
    { label: '800g', weight: 0.8 },
    { label: '500g', weight: 0.5 },
    { label: '420g', weight: 0.42 },
    { label: '기타', weight: 0 },
] as const

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

function todayYmd(): string {
    return new Date().toISOString().slice(0, 10)
}

export function MiscPurchaseDialog({ open, onOpenChange, onSuccess }: Props) {
    // 자동완성 후보
    const [vendors, setVendors] = useState<string[]>([])
    const [varieties, setVarieties] = useState<{ id: number; name: string }[]>([])

    // 폼 상태
    const [purchaseVendor, setPurchaseVendor] = useState('')
    const [varietyName, setVarietyName] = useState('')
    const [incomingDate, setIncomingDate] = useState<string>(todayYmd())
    const [packageLabel, setPackageLabel] = useState<string>('5kg')
    const [customLabelStr, setCustomLabelStr] = useState('')
    const [customWeightStr, setCustomWeightStr] = useState('')
    const [countStr, setCountStr] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    function resetForm() {
        setPurchaseVendor('')
        setVarietyName('')
        setIncomingDate(todayYmd())
        setPackageLabel('5kg')
        setCustomLabelStr('')
        setCustomWeightStr('')
        setCountStr('')
    }

    function handleOpenChange(next: boolean) {
        if (!next) resetForm()
        onOpenChange(next)
    }

    // open 시 자동완성 후보 lazy fetch (병렬)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        if (!open) return
        let cancelled = false
        Promise.all([getPurchaseVendors(), getPurchaseVarieties()]).then(([vRes, varRes]) => {
            if (cancelled) return
            if (vRes.success) setVendors(vRes.data)
            if (varRes.success) setVarieties(varRes.data)
        })
        return () => {
            cancelled = true
        }
    }, [open])

    // 포장단위 → weightPerUnit
    const isCustom = packageLabel === '기타'
    const weightPerUnit = useMemo(() => {
        if (!isCustom) {
            const tpl = PACKAGE_TEMPLATES_MISC.find(t => t.label === packageLabel)
            return tpl?.weight ?? 0
        }
        const w = parseFloat(customWeightStr)
        return Number.isFinite(w) && w > 0 ? w : 0
    }, [isCustom, packageLabel, customWeightStr])

    const count = parseInt(countStr) || 0
    const totalWeight = +(weightPerUnit * count).toFixed(3)

    // 신규 품종 여부 — 품종 입력값이 자동완성 목록에 매칭되는지 (대소문자 무시)
    const trimmedVariety = varietyName.trim()
    const isNewVariety =
        trimmedVariety.length > 0 &&
        !varieties.some(v => v.name.toLowerCase() === trimmedVariety.toLowerCase())

    const canSubmit =
        purchaseVendor.trim().length > 0 &&
        trimmedVariety.length > 0 &&
        /^\d{4}-\d{2}-\d{2}$/.test(incomingDate) &&
        weightPerUnit > 0 &&
        count > 0 &&
        !isSaving &&
        (!isCustom || (customLabelStr.trim().length > 0 && customLabelStr.trim().length <= 20))

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!canSubmit) return

        // 신규 품종이면 한 번 더 확인 (마지막 안전장치)
        if (isNewVariety) {
            const ok = confirm(`새 품종 '${trimmedVariety}'을(를) 추가하고 매입 등록할게요. 계속할까요?`)
            if (!ok) return
        }

        const packageType = isCustom ? customLabelStr.trim() : packageLabel

        setIsSaving(true)
        const result = await createMiscPurchase({
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
                    ? `새 품종 '${trimmedVariety}' 등록 + 매입 등록 완료`
                    : '매입이 등록되었습니다.',
            )
            triggerDataUpdate()
            onSuccess?.()
            handleOpenChange(false)
        } else {
            toast.error(result.error || '매입 등록에 실패했습니다.')
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
                        <ShoppingBag className="h-4 w-4 text-primary" />
                        잡곡 매입 등록
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={onSubmit} className="grid gap-4 py-2 max-h-[80vh] overflow-y-auto px-1">
                    {/* 1. 매입처 — datalist 자동완성 */}
                    <div className="space-y-1">
                        <Label className="text-[13px]">매입처</Label>
                        <Input
                            value={purchaseVendor}
                            onChange={(e) => setPurchaseVendor(e.target.value)}
                            list="misc-purchase-vendors"
                            placeholder="예: ㅇㅇ농산"
                            maxLength={100}
                            className="h-9 text-[13px]"
                        />
                        <datalist id="misc-purchase-vendors">
                            {vendors.map(v => (
                                <option key={v} value={v} />
                            ))}
                        </datalist>
                    </div>

                    {/* 2. 품종 — datalist 자동완성 + 신규 품종 실시간 안내 */}
                    <div className="space-y-1">
                        <Label className="text-[13px]">품종</Label>
                        <Input
                            value={varietyName}
                            onChange={(e) => setVarietyName(e.target.value)}
                            list="misc-purchase-varieties"
                            placeholder="예: 흑보리, 통밀"
                            maxLength={50}
                            className="h-9 text-[13px]"
                        />
                        <datalist id="misc-purchase-varieties">
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

                    {/* 3. 매입일 */}
                    <div className="space-y-1">
                        <Label className="text-[13px]">매입일</Label>
                        <Input
                            type="date"
                            value={incomingDate}
                            onChange={(e) => setIncomingDate(e.target.value)}
                            className="h-9 text-[13px] tabular-nums"
                        />
                    </div>

                    {/* 4. 포장단위 7칸 그리드 */}
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

                    {/* 5. 개수 + 총 포장중량 미리보기 */}
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

                    {/* 6. 액션 */}
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
                            {isSaving ? '저장 중…' : '매입 등록'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
