'use client'

import { useState, useMemo, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { createStock, findFirstLot, type StockFormData } from '@/app/actions/stock'
import { triggerDataUpdate } from '@/components/last-updated'
import { toast } from 'sonner'
import { defaultProductionYear, productionYearOptions } from '@/lib/production-year'
import { todayKst } from '@/lib/kst-date'
import { shouldAlignToFirstLot, type FirstLot } from '@/lib/lot-generation'
import { settle } from '@/lib/settle-action'

/** 'yyyy-mm-dd' → '10/20' */
const monthDay = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`

interface Farmer {
    id: number
    name: string
    group: {
        id: number
        name: string
        certType: string
        certNo: string
        cropYear: number
    } | null
}

interface Variety {
    id: number
    name: string
}

export function AddStockDialog({ varieties, farmers }: { varieties: Variety[], farmers: Farmer[] }) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [selectedFarmerId, setSelectedFarmerId] = useState<string>('')

    // 벼는 9월부터 당해년도분이 들어온다 (`lib/production-year.ts`)
    const defaultYear = defaultProductionYear('RICE')
    const yearOptions = useMemo(() => productionYearOptions(), [])

    const [productionYear, setProductionYear] = useState<number>(defaultYear)
    const [certType, setCertType] = useState<string>('유기농')

    // Filter farmers by selected year AND cert type
    const filteredFarmers = farmers.filter(f => {
        // 1. Year Filter
        if (f.group && f.group.cropYear !== productionYear) return false

        // 2. Cert Type Filter
        if (f.group) {
            return f.group.certType === certType
        } else {
            // General farmers (no group) are considered '일반'
            return certType === '일반'
        }
    })

    // Derived state for certifications based on selected farmer
    const selectedFarmer = farmers.find(f => f.id.toString() === selectedFarmerId)

    const [varietyId, setVarietyId] = useState<string>('')
    const [incomingDate, setIncomingDate] = useState<string>(todayKst())

    // 첫 로트 재사용 (plan-로트재사용경고.md) — 같은 연도·생산자·품종의 로트가 이미 있으면
    // 입고일자를 그 날짜로 채워 같은 로트로 모은다. 새 로트로 하려면 날짜만 바꾸면 된다.
    // 받은 값에 「어느 조합 것인지」를 붙여 둔다 — 생산자·품종을 바꾸면 옛 안내가 잠깐 남지 않게
    const lotKey = `${productionYear}|${selectedFarmerId}|${varietyId}`
    const [firstLotGot, setFirstLotGot] = useState<{ key: string; data: FirstLot | null } | null>(null)
    const firstLot = firstLotGot?.key === lotKey ? firstLotGot.data : null

    useEffect(() => {
        if (!open || !selectedFarmerId || !varietyId) return
        let alive = true
        void settle(findFirstLot({
            productionYear,
            farmerId: parseInt(selectedFarmerId),
            varietyId: parseInt(varietyId),
        })).then(res => {
            if (!alive) return
            // 못 읽으면 안내 없이 지금처럼 등록된다(새 로트) — 등록 자체를 막을 일은 아니다
            const data = res.success ? res.data : null
            setFirstLotGot({ key: lotKey, data })
            if (data) setIncomingDate(prev => (shouldAlignToFirstLot(data, prev) ? data.date : prev))
        })
        return () => {
            alive = false
        }
    }, [open, productionYear, selectedFarmerId, varietyId, lotKey])

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setIsLoading(true)

        const formData = new FormData(event.currentTarget)

        // Validation check for Selects
        if (!selectedFarmerId) {
            toast.warning('생산자를 선택해주세요.')
            setIsLoading(false)
            return
        }

        const data: StockFormData = {
            productionYear, // Select는 FormData에 안 실린다 — state가 유일한 원천
            bagNo: parseInt(formData.get('bagNo') as string, 10),
            weightKg: parseFloat(formData.get('weightKg') as string),
            incomingDate: new Date(formData.get('incomingDate') as string),
            // IDs
            farmerId: parseInt(selectedFarmerId),
            varietyId: parseInt(formData.get('varietyId') as string),
            actualFarmer: (formData.get('actualFarmer') as string) || undefined,
        }

        const result = await createStock(data)
        setIsLoading(false)

        if (result.success) {
            setOpen(false)
            resetForm()
            triggerDataUpdate()
            // Optional: Show toast
        } else {
            toast.error('재고 등록에 실패했습니다.')
        }
    }

    function resetForm() {
        setSelectedFarmerId('')
        // 예전엔 두 칸이 비제어라 창을 닫으면 저절로 초기화됐다 — 제어로 바꿨으니 여기서 맞춘다
        setVarietyId('')
        setIncomingDate(todayKst())
    }

    return (
        <Dialog open={open} onOpenChange={(open) => {
            setOpen(open)
            if (!open) resetForm()
        }}>
            <DialogTrigger asChild>
                <Button size="sm" className="px-2 sm:px-3 font-semibold">
                    <Plus className="sm:mr-1 h-4 w-4" />
                    <span className="hidden sm:inline">입고 등록</span>
                </Button>
            </DialogTrigger>
            <DialogContent
                className="sm:max-w-[500px] flex flex-col max-h-[85vh]"
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle>벼 입고 등록</DialogTitle>
                </DialogHeader>
                <form id="add-stock-form" onSubmit={onSubmit} className="grid gap-4 py-2 overflow-y-auto px-1 flex-1 min-h-0">
                    {/* 1. Context: Year & Cert Type */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="min-w-0 space-y-2">
                            <Label className="text-[13px]">생산년도</Label>
                            <Select
                                value={productionYear.toString()}
                                onValueChange={(v) => setProductionYear(parseInt(v))}
                            >
                                <SelectTrigger className="text-[13px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {yearOptions.map(y => (
                                        <SelectItem key={y} value={y.toString()}>{y}년</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="min-w-0 space-y-2">
                            <Label className="text-[13px]">인증 구분</Label>
                            <Select value={certType} onValueChange={setCertType}>
                                <SelectTrigger className="text-[13px]">
                                    <SelectValue placeholder="유기농" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="유기농">유기농</SelectItem>
                                    <SelectItem value="무농약">무농약</SelectItem>
                                    <SelectItem value="일반">일반</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* 2. Target: Farmer + Actual Farmer */}
                    <div className="min-w-0 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="min-w-0 space-y-2">
                                <Label className="text-[13px]">생산자</Label>
                                <Select
                                    value={selectedFarmerId}
                                    onValueChange={setSelectedFarmerId}
                                >
                                    <SelectTrigger className="text-[13px]">
                                        <SelectValue placeholder="생산자 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredFarmers.map((f) => (
                                            <SelectItem key={f.id} value={f.id.toString()}>
                                                {f.group
                                                    ? `${f.name} (${f.group.name})`
                                                    : `${f.name} (작목반 없음)`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="min-w-0 space-y-2">
                                <Label htmlFor="actualFarmer" className="text-[13px]">농가명 (선택)</Label>
                                <Input
                                    id="actualFarmer"
                                    name="actualFarmer"
                                    placeholder="실제 농사짓는 분"
                                    className="text-[13px]"
                                />
                            </div>
                        </div>
                        {selectedFarmer && (
                            <div className="bg-slate-50 p-2 rounded text-xs text-slate-600 mt-1 border border-slate-100">
                                {selectedFarmer.group ? (
                                    <>
                                        <span className="font-bold text-slate-800">{selectedFarmer.group.certType}</span> | 인증번호: {selectedFarmer.group.certNo} | {selectedFarmer.group.name}
                                    </>
                                ) : (
                                    <>일반 재배 (작목반 미소속)</>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 3. Meta: Variety & Incoming Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="min-w-0 space-y-2">
                            <Label htmlFor="varietyId" className="text-[13px]">품종</Label>
                            <Select name="varietyId" required value={varietyId} onValueChange={setVarietyId}>
                                <SelectTrigger className="text-[13px]">
                                    <SelectValue placeholder="품종 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    {varieties.map((v) => (
                                        <SelectItem key={v.id} value={v.id.toString()}>
                                            {v.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="min-w-0 space-y-2">
                            <Label htmlFor="incomingDate" className="text-[13px]">입고일자 (Lot 기준)</Label>
                            <Input
                                id="incomingDate"
                                name="incomingDate"
                                type="date"
                                required
                                value={incomingDate}
                                onChange={(e) => setIncomingDate(e.target.value)}
                                className="text-[13px]"
                            />
                        </div>
                    </div>

                    {firstLot && (incomingDate === firstLot.date ? (
                        <div className="bg-slate-50 p-2 rounded text-xs text-slate-600 border border-slate-100 -mt-2 space-y-0.5">
                            <div>
                                <span className="font-bold text-slate-800">첫 로트와 같은 로트로 들어가요</span>
                                {' · '}
                                {/* 로트번호는 하이픈에서 줄이 끊기면 읽기 어렵다 — 통째로 넘긴다 */}
                                <span className="whitespace-nowrap">{firstLot.lotNo}</span>
                            </div>
                            <div>첫 입고 {monthDay(firstLot.date)} · 이미 {firstLot.count}건 · 새 로트로 하려면 입고일자를 바꾸세요.</div>
                        </div>
                    ) : (
                        <div className="bg-amber-50 p-2 rounded text-xs text-amber-800 border border-amber-200 -mt-2 flex items-center justify-between gap-2">
                            <span>
                                첫 로트({monthDay(firstLot.date)}, {firstLot.count}건)와 날짜가 달라 <span className="font-bold">새 로트</span>가 생겨요.
                            </span>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 shrink-0 text-xs"
                                onClick={() => setIncomingDate(firstLot.date)}
                            >
                                {monthDay(firstLot.date)}로 맞추기
                            </Button>
                        </div>
                    ))}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="min-w-0 space-y-2">
                            <Label htmlFor="bagNo" className="text-[13px]">톤백번호</Label>
                            <Input id="bagNo" name="bagNo" type="number" placeholder="1234" required className="text-[13px]" />
                        </div>
                        <div className="min-w-0 space-y-2">
                            <Label htmlFor="weightKg" className="text-[13px]">중량(kg)</Label>
                            <Input id="weightKg" name="weightKg" type="number" step="0.1" placeholder="800" required className="text-[13px]" />
                        </div>
                    </div>

                </form>
                <DialogFooter className="-mx-6 px-6 pt-3 border-t border-slate-100 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <Button type="submit" form="add-stock-form" disabled={isLoading} className="text-[13px]">
                        {isLoading ? '저장 중...' : '저장'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
