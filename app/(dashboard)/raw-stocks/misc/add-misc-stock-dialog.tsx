'use client'

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { createMiscStock, type MiscStockFormData } from '@/app/actions/misc-stock'
import { triggerDataUpdate } from '@/components/last-updated'
import { toast } from 'sonner'

interface Farmer {
    id: number
    name: string
    farmerNo: string | null
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

interface Props {
    farmers: Farmer[]
    varieties: Variety[]
    vendors: string[]
}

type SourceType = 'CONSIGNMENT' | 'FARMER_MILLED'

export function AddMiscStockDialog({ farmers, varieties, vendors }: Props) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    // 11월 이후면 올해, 그 외 작년 (벼 패턴 동일)
    const today = new Date()
    const defaultYear = today.getMonth() + 1 >= 11 ? today.getFullYear() : today.getFullYear() - 1

    const [productionYear, setProductionYear] = useState<number>(defaultYear)
    const [certType, setCertType] = useState<string>('유기농')
    const [selectedFarmerId, setSelectedFarmerId] = useState<string>('')
    const [varietyId, setVarietyId] = useState<string>('')
    const [sourceType, setSourceType] = useState<SourceType>('CONSIGNMENT')
    const [rawWeightStr, setRawWeightStr] = useState<string>('')
    const [weightStr, setWeightStr] = useState<string>('')
    const [millingVendor, setMillingVendor] = useState<string>('')

    // 인증유형 + 생산년도로 농가 필터 (벼 다이얼로그 동일 규칙)
    const filteredFarmers = useMemo(() => {
        return farmers.filter(f => {
            if (f.group) {
                if (f.group.cropYear !== productionYear) return false
                return f.group.certType === certType
            }
            // group 없는 농가는 '일반'으로 분류
            return certType === '일반'
        })
    }, [farmers, productionYear, certType])

    const selectedFarmer = farmers.find(f => f.id.toString() === selectedFarmerId)

    // 수율 미리보기 (위탁만)
    const yieldPreview = useMemo(() => {
        if (sourceType !== 'CONSIGNMENT') return null
        const raw = parseFloat(rawWeightStr)
        const w = parseFloat(weightStr)
        if (!raw || !w || raw <= 0) return null
        return ((w / raw) * 100).toFixed(1)
    }, [sourceType, rawWeightStr, weightStr])

    function resetForm() {
        setSelectedFarmerId('')
        setVarietyId('')
        setSourceType('CONSIGNMENT')
        setRawWeightStr('')
        setWeightStr('')
        setMillingVendor('')
        setProductionYear(defaultYear)
        setCertType('유기농')
    }

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()

        if (!selectedFarmerId) {
            toast.warning('생산자를 선택해주세요.')
            return
        }
        if (!varietyId) {
            toast.warning('품종을 선택해주세요.')
            return
        }

        const formData = new FormData(event.currentTarget)
        const bagNo = parseInt(formData.get('bagNo') as string, 10)
        const weightKg = parseFloat(formData.get('weightKg') as string)
        const incomingDate = new Date(formData.get('incomingDate') as string)
        const actualFarmer = (formData.get('actualFarmer') as string) || undefined

        if (!Number.isFinite(weightKg) || weightKg <= 0) {
            toast.warning('입고중량을 정확히 입력해주세요.')
            return
        }

        let payload: MiscStockFormData
        if (sourceType === 'CONSIGNMENT') {
            const rawWeightKg = parseFloat(formData.get('rawWeightKg') as string)
            const vendor = (formData.get('millingVendor') as string)?.trim() || ''
            if (!Number.isFinite(rawWeightKg) || rawWeightKg <= 0) {
                toast.warning('원물중량을 정확히 입력해주세요.')
                return
            }
            if (!vendor) {
                toast.warning('위탁 도정업체명을 입력해주세요.')
                return
            }
            payload = {
                sourceType: 'CONSIGNMENT',
                productionYear,
                bagNo,
                weightKg,
                incomingDate,
                farmerId: parseInt(selectedFarmerId),
                varietyId: parseInt(varietyId),
                actualFarmer,
                rawWeightKg,
                millingVendor: vendor,
            }
        } else {
            payload = {
                sourceType: 'FARMER_MILLED',
                productionYear,
                bagNo,
                weightKg,
                incomingDate,
                farmerId: parseInt(selectedFarmerId),
                varietyId: parseInt(varietyId),
                actualFarmer,
            }
        }

        setIsLoading(true)
        const result = await createMiscStock(payload)
        setIsLoading(false)

        if (result.success) {
            toast.success('잡곡 입고가 등록되었습니다.')
            triggerDataUpdate()
            setOpen(false)
            resetForm()
        } else {
            toast.error(result.error || '잡곡 입고 등록에 실패했습니다.')
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                setOpen(o)
                if (!o) resetForm()
            }}
        >
            <DialogTrigger asChild>
                <Button size="sm" className="bg-[#8dc540] hover:bg-[#7db037] text-white px-2 sm:px-3">
                    <Plus className="sm:mr-1 h-4 w-4" />
                    <span className="hidden sm:inline">잡곡 입고</span>
                </Button>
            </DialogTrigger>
            <DialogContent
                className="sm:max-w-[500px]"
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle>잡곡 입고 등록</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="grid gap-4 py-2 max-h-[80vh] overflow-y-auto px-1">
                    {/* 0. 입고 유형 토글 */}
                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
                        <button
                            type="button"
                            onClick={() => setSourceType('CONSIGNMENT')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                sourceType === 'CONSIGNMENT'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            위탁도정
                        </button>
                        <button
                            type="button"
                            onClick={() => setSourceType('FARMER_MILLED')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                sourceType === 'FARMER_MILLED'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            농가도정
                        </button>
                    </div>

                    {/* 1. Context: Year & Cert */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="productionYear" className="text-[13px]">생산년도</Label>
                            <Input
                                id="productionYear"
                                name="productionYear"
                                type="number"
                                value={productionYear}
                                onChange={(e) => setProductionYear(parseInt(e.target.value) || defaultYear)}
                                className="text-[13px]"
                                required
                            />
                        </div>
                        <div className="space-y-2">
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

                    {/* 2. 생산자 + 농가명 */}
                    <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[13px]">생산자</Label>
                                <Select value={selectedFarmerId} onValueChange={setSelectedFarmerId}>
                                    <SelectTrigger className="text-[13px]">
                                        <SelectValue placeholder={filteredFarmers.length === 0 ? '해당 조건 농가 없음' : '생산자 선택'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredFarmers.map(f => (
                                            <SelectItem key={f.id} value={f.id.toString()}>
                                                {f.group ? `${f.name} (${f.group.name})` : `${f.name} (작목반 없음)`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
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
                                        <span className="font-bold text-slate-800">{selectedFarmer.group.certType}</span>
                                        {' | 인증번호: '}{selectedFarmer.group.certNo}{' | '}{selectedFarmer.group.name}
                                    </>
                                ) : (
                                    <>일반 재배 (작목반 미소속)</>
                                )}
                            </div>
                        )}
                        {filteredFarmers.length === 0 && (
                            <div className="bg-amber-50 p-2 rounded text-xs text-amber-700 border border-amber-100">
                                선택한 인증·년도 조합에 잡곡 생산자로 등록된 농가가 없습니다. 생산자 관리에서 "잡곡도 생산"을 체크해주세요.
                            </div>
                        )}
                    </div>

                    {/* 3. 품종 + 입고일 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="varietyId" className="text-[13px]">품종</Label>
                            <Select value={varietyId} onValueChange={setVarietyId}>
                                <SelectTrigger className="text-[13px]">
                                    <SelectValue placeholder={varieties.length === 0 ? '잡곡 품종 없음' : '품종 선택'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {varieties.map(v => (
                                        <SelectItem key={v.id} value={v.id.toString()}>
                                            {v.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="incomingDate" className="text-[13px]">입고일자 (Lot 기준)</Label>
                            <Input
                                id="incomingDate"
                                name="incomingDate"
                                type="date"
                                required
                                defaultValue={new Date().toISOString().split('T')[0]}
                                className="text-[13px]"
                            />
                        </div>
                    </div>

                    {/* 4. 일련번호 + 입고중량 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="bagNo" className="text-[13px]">일련번호</Label>
                            <Input id="bagNo" name="bagNo" type="number" placeholder="1" required className="text-[13px]" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="weightKg" className="text-[13px]">입고중량(kg)</Label>
                            <Input
                                id="weightKg"
                                name="weightKg"
                                type="number"
                                step="0.1"
                                placeholder="540"
                                required
                                className="text-[13px]"
                                value={weightStr}
                                onChange={(e) => setWeightStr(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* 5. 위탁 전용 — 원물중량 + 도정업체 */}
                    {sourceType === 'CONSIGNMENT' && (
                        <div className="grid grid-cols-2 gap-4 rounded-md border border-slate-200 bg-slate-50/60 p-3">
                            <div className="space-y-2">
                                <Label htmlFor="rawWeightKg" className="text-[13px]">원물중량(kg)</Label>
                                <Input
                                    id="rawWeightKg"
                                    name="rawWeightKg"
                                    type="number"
                                    step="0.1"
                                    placeholder="800"
                                    required
                                    className="text-[13px]"
                                    value={rawWeightStr}
                                    onChange={(e) => setRawWeightStr(e.target.value)}
                                />
                                {yieldPreview && (
                                    <p className="text-[11px] text-slate-500">수율 {yieldPreview}%</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="millingVendor" className="text-[13px]">위탁 도정업체</Label>
                                <Input
                                    id="millingVendor"
                                    name="millingVendor"
                                    list="milling-vendors"
                                    placeholder="예: 한국미곡"
                                    required
                                    value={millingVendor}
                                    onChange={(e) => setMillingVendor(e.target.value)}
                                    className="text-[13px]"
                                />
                                <datalist id="milling-vendors">
                                    {vendors.map(v => (
                                        <option key={v} value={v} />
                                    ))}
                                </datalist>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-2">
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="bg-[#00a2e8] hover:bg-[#008cc9] text-white text-[13px]"
                        >
                            {isLoading ? '저장 중...' : '저장'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
