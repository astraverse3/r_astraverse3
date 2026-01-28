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

interface Farmer {
    id: number
    name: string
    certifications: {
        id: number
        certType: string
        certNo: string
    }[]
}

interface Variety {
    id: number
    name: string
}

export function AddStockDialog({ varieties, farmers }: { varieties: Variety[], farmers: Farmer[] }) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [selectedFarmerId, setSelectedFarmerId] = useState<string>('')
    const [selectedCertId, setSelectedCertId] = useState<string>('')

    // Derived state for certifications based on selected farmer
    const selectedFarmer = farmers.find(f => f.id.toString() === selectedFarmerId)
    const availableCerts = selectedFarmer?.certifications || []

    const router = useRouter()

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setIsLoading(true)

        const formData = new FormData(event.currentTarget)

        // Validation check for Selects (since they might not be part of native form validation if controlled improperly)
        if (!selectedFarmerId || !selectedCertId) {
            alert('생산자와 인증을 선택해주세요.')
            setIsLoading(false)
            return
        }

        const data: StockFormData = {
            productionYear: parseInt(formData.get('productionYear') as string, 10),
            bagNo: parseInt(formData.get('bagNo') as string, 10),
            weightKg: parseFloat(formData.get('weightKg') as string),
            incomingDate: new Date(formData.get('incomingDate') as string),
            // IDs
            certId: parseInt(selectedCertId),
            varietyId: parseInt(formData.get('varietyId') as string),
        }

        const result = await createStock(data)
        setIsLoading(false)

        if (result.success) {
            setOpen(false)
            resetForm()
            // Optional: Show toast
        } else {
            alert('Failed to create stock')
        }
    }

    function resetForm() {
        setSelectedFarmerId('')
        setSelectedCertId('')
    }

    return (
        <Dialog open={open} onOpenChange={(open) => {
            setOpen(open)
            if (!open) resetForm()
        }}>
            <DialogTrigger asChild>
                <Button>입고 등록</Button>
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
                    {/* 1. Production Year & Incoming Date */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="productionYear">생산년도</Label>
                            <Input id="productionYear" name="productionYear" type="number" defaultValue={new Date().getFullYear()} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="incomingDate">입고일자 (Lot 기준)</Label>
                            <Input id="incomingDate" name="incomingDate" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                        </div>
                    </div>

                    {/* 2. Farmer & Certification */}
                    <div className="space-y-2">
                        <Label>생산자</Label>
                        <Select
                            value={selectedFarmerId}
                            onValueChange={(val) => {
                                setSelectedFarmerId(val)
                                setSelectedCertId('') // Reset cert when farmer changes
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="생산자 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                {farmers.map((f) => (
                                    <SelectItem key={f.id} value={f.id.toString()}>
                                        {f.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>인증 정보</Label>
                        <Select
                            value={selectedCertId}
                            onValueChange={setSelectedCertId}
                            disabled={!selectedFarmerId}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={!selectedFarmerId ? "생산자를 먼저 선택하세요" : "인증 선택"} />
                            </SelectTrigger>
                            <SelectContent>
                                {availableCerts.map((c) => (
                                    <SelectItem key={c.id} value={c.id.toString()}>
                                        {c.certType} ({c.certNo})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 3. Variety & Bag info */}
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
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? '저장 중...' : '저장'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
