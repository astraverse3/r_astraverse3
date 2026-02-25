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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { createStock, type StockFormData } from '@/app/actions/stock'
import { useRouter } from 'next/navigation'
import { triggerDataUpdate } from '@/components/last-updated'
import { toast } from 'sonner'

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

    // Default Year Logic: Previous Year until Oct, Current Year from Nov
    const today = new Date()
    const defaultYear = (today.getMonth() + 1) >= 11 ? today.getFullYear() : today.getFullYear() - 1

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
    // Cert Info is now fixed per farmer (via group)
    const certInfo = selectedFarmer?.group

    const router = useRouter()

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
            productionYear: parseInt(formData.get('productionYear') as string, 10),
            bagNo: parseInt(formData.get('bagNo') as string, 10),
            weightKg: parseFloat(formData.get('weightKg') as string),
            incomingDate: new Date(formData.get('incomingDate') as string),
            // IDs
            farmerId: parseInt(selectedFarmerId),
            varietyId: parseInt(formData.get('varietyId') as string),
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
    }

    return (
        <Dialog open={open} onOpenChange={(open) => {
            setOpen(open)
            if (!open) resetForm()
        }}>
            <DialogTrigger asChild>
                <Button className="bg-[#8dc540] hover:bg-[#7db037] text-white">입고 등록</Button>
            </DialogTrigger>
            <DialogContent
                className="sm:max-w-[500px]"
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle>벼 입고 등록</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="grid gap-4 py-4">
                    {/* 1. Context: Year & Cert Type */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="productionYear">생산년도</Label>
                            <Input
                                id="productionYear"
                                name="productionYear"
                                type="number"
                                value={productionYear}
                                onChange={(e) => setProductionYear(parseInt(e.target.value) || defaultYear)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>인증 구분</Label>
                            <Select value={certType} onValueChange={setCertType}>
                                <SelectTrigger>
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

                    {/* 2. Target: Farmer */}
                    <div className="space-y-2">
                        <Label>생산자</Label>
                        <Select
                            value={selectedFarmerId}
                            onValueChange={setSelectedFarmerId}
                        >
                            <SelectTrigger>
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
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="varietyId">품종</Label>
                            <Select name="varietyId" required>
                                <SelectTrigger>
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
                        <div className="space-y-2">
                            <Label htmlFor="incomingDate">입고일자 (Lot 기준)</Label>
                            <Input id="incomingDate" name="incomingDate" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="bagNo">톤백번호</Label>
                            <Input id="bagNo" name="bagNo" type="number" placeholder="1234" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="weightKg">중량(kg)</Label>
                            <Input id="weightKg" name="weightKg" type="number" step="0.1" placeholder="800" required />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={isLoading} className="bg-[#8dc540] hover:bg-[#7db037] text-white">
                            {isLoading ? '저장 중...' : '저장'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
