'use client'

import { useEffect, useMemo, useState } from 'react'
import { Package2 } from 'lucide-react'
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
    createMiscPackage,
    getAvailableMiscStocks,
    type AvailableMiscStock,
} from '@/app/actions/packages'
import { triggerDataUpdate } from '@/components/last-updated'
import { toast } from 'sonner'

// 잡곡 전용 포장단위 7칸 — plan-잡곡재고관리-#7.md §3.4
// "기타"는 weightPerUnit 직접 입력
const PACKAGE_TEMPLATES_MISC = [
    { label: '10kg', weight: 10 },
    { label: '5kg', weight: 5 },
    { label: '1kg', weight: 1 },
    { label: '800g', weight: 0.8 },
    { label: '500g', weight: 0.5 },
    { label: '420g', weight: 0.42 },
    { label: '기타', weight: 0 }, // weight=0 sentinel: 사용자 입력
] as const

const SOURCE_LABEL: Record<string, string> = {
    CONSIGNMENT: '도정위탁',
    FARMER_MILLED: '농가도정',
    GERMINATION: '발아위탁',
}

type SelectedStock = Pick<
    AvailableMiscStock,
    'id' | 'productionYear' | 'bagNo' | 'remainingKg' | 'weightKg' | 'lotNo' | 'sourceType' | 'variety' | 'farmer'
>

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** 진입점 ① (원물재고 행 메뉴): 미리 지정된 stock — selector 단계 스킵 */
    initialStock?: SelectedStock
    /** 저장 성공 후 콜백 — 부모가 list 갱신 트리거 */
    onSuccess?: () => void
}

export function MiscPackageDialog({ open, onOpenChange, initialStock, onSuccess }: Props) {
    const isStockFixed = !!initialStock

    // 진입점 ② 용 stock 목록 — 다이얼로그 열릴 때 lazy fetch
    const [availableStocks, setAvailableStocks] = useState<AvailableMiscStock[]>([])
    const [loadingStocks, setLoadingStocks] = useState(false)
    const [selectedStockId, setSelectedStockId] = useState<string>('')

    // 폼 상태
    const [packageLabel, setPackageLabel] = useState<string>('5kg')
    const [customWeightStr, setCustomWeightStr] = useState<string>('')
    const [customLabelStr, setCustomLabelStr] = useState<string>('')
    const [countStr, setCountStr] = useState<string>('')
    const [isSaving, setIsSaving] = useState(false)

    function resetForm() {
        setSelectedStockId('')
        setPackageLabel('5kg')
        setCustomWeightStr('')
        setCustomLabelStr('')
        setCountStr('')
    }

    function handleOpenChange(next: boolean) {
        if (!next) resetForm()
        onOpenChange(next)
    }

    // 진입점 ②: open=true 전이 시 stock 목록 lazy fetch.
    // (부모가 open prop을 직접 toggle하므로 handleOpenChange로는 잡히지 않아 effect 사용)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        if (!open || isStockFixed) return
        let cancelled = false
        setLoadingStocks(true)
        getAvailableMiscStocks().then(res => {
            if (cancelled) return
            if (res.success) setAvailableStocks(res.data)
            else toast.error(res.error)
            setLoadingStocks(false)
        })
        return () => {
            cancelled = true
        }
    }, [open, isStockFixed])

    // 선택된 stock — fixed 또는 selector
    const selectedStock: SelectedStock | null = useMemo(() => {
        if (initialStock) return initialStock
        if (!selectedStockId) return null
        return availableStocks.find(s => s.id.toString() === selectedStockId) ?? null
    }, [initialStock, selectedStockId, availableStocks])

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

    const remainingKg = selectedStock?.remainingKg ?? 0
    const isOver = totalWeight > 0 && totalWeight - remainingKg > 0.001
    const remainingAfter = remainingKg - totalWeight
    const willConsume = totalWeight > 0 && remainingAfter <= 0.001

    const canSubmit =
        !!selectedStock &&
        weightPerUnit > 0 &&
        count > 0 &&
        !isOver &&
        !isSaving &&
        (!isCustom || (customLabelStr.trim().length > 0 && customLabelStr.trim().length <= 20))

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!canSubmit || !selectedStock) return

        const packageType = isCustom ? customLabelStr.trim() : packageLabel

        setIsSaving(true)
        const result = await createMiscPackage({
            stockId: selectedStock.id,
            packageType,
            weightPerUnit,
            count,
        })
        setIsSaving(false)

        if (result.success) {
            toast.success(
                willConsume
                    ? '포장이 등록되었습니다. 재고가 모두 소진됐어요.'
                    : '포장이 등록되었습니다.',
            )
            triggerDataUpdate()
            onSuccess?.()
            handleOpenChange(false)
        } else {
            toast.error(result.error || '포장 등록에 실패했습니다.')
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
                        <Package2 className="h-4 w-4 text-primary" />
                        잡곡 포장
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={onSubmit} className="grid gap-4 py-2 max-h-[80vh] overflow-y-auto px-1">
                    {/* 1. Stock 선택 — fixed면 정보 카드, 아니면 인라인 라디오 카드 목록 (한 줄) */}
                    {isStockFixed && selectedStock ? (
                        <StockInfoCard stock={selectedStock} />
                    ) : (
                        <div className="space-y-2">
                            <Label className="text-[13px]">원물재고 선택</Label>
                            {loadingStocks ? (
                                <p className="text-xs text-slate-500">불러오는 중…</p>
                            ) : availableStocks.length === 0 ? (
                                <p className="text-xs text-slate-500">포장 가능한 잡곡 재고가 없어요.</p>
                            ) : (
                                <StockRadioList
                                    stocks={availableStocks}
                                    selectedId={selectedStockId}
                                    onSelect={setSelectedStockId}
                                />
                            )}
                        </div>
                    )}

                    {/* 2. 포장단위 7칸 그리드 */}
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

                    {/* 3. 개수 + 미리보기 */}
                    <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                        <div className="space-y-1">
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
                                {totalWeight.toLocaleString()}<span className="text-xs font-semibold ml-0.5 opacity-70">kg</span>
                            </p>
                        </div>
                    </div>

                    {/* 4. 잔여 미리보기 + 검증 메시지 */}
                    {selectedStock && (
                        <div className={`rounded-md border px-3 py-2 text-[12px] ${isOver ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                            {isOver ? (
                                <p className="text-red-700 font-medium">
                                    재고 {Math.round(remainingKg).toLocaleString()}kg를 초과했어요.
                                </p>
                            ) : totalWeight > 0 ? (
                                <p className="text-slate-700">
                                    포장 후 잔여 재고:
                                    <span className="font-bold text-slate-900 tabular-nums ml-1">
                                        {Math.max(0, remainingAfter).toFixed(2)}kg
                                    </span>
                                    {willConsume && (
                                        <span className="ml-2 inline-flex items-center px-1.5 py-0 rounded bg-amber-100 text-amber-700 text-[10px] font-medium">
                                            소진 처리됨
                                        </span>
                                    )}
                                </p>
                            ) : (
                                <p className="text-slate-500">포장단위와 개수를 입력하세요.</p>
                            )}
                        </div>
                    )}

                    {/* 5. 액션 */}
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
                            {isSaving ? '저장 중…' : '포장 등록'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}

// 선택된 stock 정보 카드
function StockInfoCard({ stock }: { stock: SelectedStock }) {
    const certType = stock.farmer.group?.certType
    const sourceLabel = stock.sourceType ? SOURCE_LABEL[stock.sourceType] : null
    return (
        <div className="rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2 grid gap-1">
            <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[14px] font-bold text-slate-800">{stock.variety.name}</span>
                <span className="text-[11px] text-slate-500">{stock.productionYear}년</span>
                {certType && (
                    <span className="inline-flex items-center font-medium px-1.5 py-0 rounded text-[10px] border border-slate-200 bg-white text-slate-600">
                        {certType}
                    </span>
                )}
                {sourceLabel && (
                    <span className="inline-flex items-center font-medium px-1.5 py-0 rounded text-[10px] border border-primary/30 text-primary bg-primary/10">
                        {sourceLabel}
                    </span>
                )}
            </div>
            <div className="flex items-center justify-between text-[12px] text-slate-600">
                <span>
                    {stock.farmer.name}
                    {stock.lotNo && (
                        <span className="ml-1.5 font-mono text-[10px] text-slate-400" title={stock.lotNo}>
                            #{stock.bagNo}
                        </span>
                    )}
                </span>
                <span className="tabular-nums">
                    재고 <span className="font-bold text-primary">{Math.round(stock.remainingKg).toLocaleString()}</span>
                    <span className="opacity-60">/{stock.weightKg.toLocaleString()}kg</span>
                </span>
            </div>
        </div>
    )
}

// ISO yyyy-mm-dd → yy.mm.dd
function formatShortDate(iso: string): string {
    return iso.length >= 10 ? `${iso.slice(2, 4)}.${iso.slice(5, 7)}.${iso.slice(8, 10)}` : iso
}

// 인라인 라디오 카드 목록 — 한 줄 표현.
// lot은 selector 식별 정보로 결정적이지 않아 제외(품종+생산자+입고일이 식별 키).
// 호버 시 lot 풀 표시는 title 툴팁에서 보강.
function StockRadioList({
    stocks,
    selectedId,
    onSelect,
}: {
    stocks: AvailableMiscStock[]
    selectedId: string
    onSelect: (id: string) => void
}) {
    return (
        <div className="border border-slate-200 rounded-md max-h-[240px] overflow-y-auto bg-white">
            {stocks.map(s => {
                const idStr = s.id.toString()
                const selected = idStr === selectedId
                return (
                    <label
                        key={s.id}
                        title={s.lotNo ? `Lot ${s.lotNo}` : undefined}
                        className={`flex items-center gap-3 px-2.5 py-2 cursor-pointer text-[12.5px] border-b border-slate-100 last:border-b-0 transition-colors ${
                            selected ? 'bg-primary/5' : 'hover:bg-slate-50'
                        }`}
                    >
                        <input
                            type="radio"
                            name="misc-package-stock"
                            checked={selected}
                            onChange={() => onSelect(idStr)}
                            className="h-3.5 w-3.5 shrink-0 text-primary focus:ring-ring"
                        />
                        <span className="font-semibold text-slate-800 truncate min-w-0 flex-1">
                            {s.variety.name}
                        </span>
                        <span className="text-slate-600 truncate min-w-0 flex-1">
                            {s.farmer.name}
                        </span>
                        <span className="text-slate-500 tabular-nums shrink-0 text-[11px]">
                            {formatShortDate(s.incomingDate)}
                        </span>
                        <span className="text-primary font-semibold tabular-nums shrink-0 text-right min-w-[68px]">
                            {Math.round(s.remainingKg).toLocaleString()}kg
                        </span>
                    </label>
                )
            })}
        </div>
    )
}
