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

export function AddStockDialog({ varieties }: { varieties: { id: number; name: string }[] }) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setIsLoading(true)

        const formData = new FormData(event.currentTarget)
        const data: StockFormData = {
            productionYear: parseInt(formData.get('productionYear') as string, 10),
            farmerName: formData.get('farmerName') as string,
            variety: formData.get('variety') as string,
            bagNo: parseInt(formData.get('bagNo') as string, 10),
            certType: formData.get('certType') as string,
            weightKg: parseFloat(formData.get('weightKg') as string),
        }

        const result = await createStock(data)
        setIsLoading(false)

        if (result.success) {
            setOpen(false)
            // Optional: Show toast
        } else {
            alert('Failed to create stock')
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>입고 등록</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>벼 입고 등록</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="productionYear" className="text-right">
                            생산년도
                        </Label>
                        <Input
                            id="productionYear"
                            name="productionYear"
                            type="number"
                            defaultValue={new Date().getFullYear()}
                            className="col-span-3"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="farmerName" className="text-right">
                            농가명
                        </Label>
                        <Input
                            id="farmerName"
                            name="farmerName"
                            placeholder="홍길동"
                            className="col-span-3"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="variety" className="text-right">
                            품종
                        </Label>
                        <Select name="variety" required>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="품종 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                {varieties.map((v) => (
                                    <SelectItem key={v.id} value={v.name}>
                                        {v.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="certType" className="text-right">
                            인증
                        </Label>
                        <Select name="certType" defaultValue="유기농">
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="인증 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="유기농">유기농</SelectItem>
                                <SelectItem value="무농약">무농약</SelectItem>
                                <SelectItem value="일반">일반</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="bagNo" className="text-right">
                            톤백번호
                        </Label>
                        <Input
                            id="bagNo"
                            name="bagNo"
                            type="number"
                            placeholder="1234"
                            className="col-span-3"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="weightKg" className="text-right">
                            중량(kg)
                        </Label>
                        <Input
                            id="weightKg"
                            name="weightKg"
                            type="number"
                            step="0.1"
                            placeholder="800"
                            className="col-span-3"
                            required
                        />
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
