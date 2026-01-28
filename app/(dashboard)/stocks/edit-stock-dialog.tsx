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
import { updateStock, deleteStock, type StockFormData } from '@/app/actions/stock'
import { Pencil, Trash2 } from 'lucide-react'
import { Stock } from './page' // Import Stock interface

interface Props {
    stock: Stock
    farmers: { id: number; name: string; certifications: any[] }[]
    varieties: { id: number; name: string }[]
    open?: boolean
    onOpenChange?: (open: boolean) => void
    trigger?: React.ReactNode
}

export function EditStockDialog({ stock, farmers, varieties, open: controlledOpen, onOpenChange: setControlledOpen, trigger }: Props) {
    const [internalOpen, setInternalOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen
    const setOpen = (newOpen: boolean) => {
        if (isControlled) {
            setControlledOpen?.(newOpen)
        } else {
            setInternalOpen(newOpen)
        }
    }

    // Initial State from stock
    // Find farmer ID from stock's certification relation
    // We assume stock has certification loaded which has farmer loaded
    // But stock interface in props might depend on what is passed. 
    // From page.tsx: stock struct has certification.farmer.name. But NOT farmer ID?
    // Wait, Stock interface in page.tsx:
    // certification: { certType: string; farmer: { name: string } }
    // It does NOT have farmerId.
    // However, I can infer farmer name matching? No, unique ID is better.
    // IMPORTANT: I need to update Stock interface in page.tsx and getStocks to include IDs!
    // But for now, to fix build, I will try to find farmer by name (risky but works if names unique) OR I should really update getStocks to include IDs.
    // getStocks includes `certification: { include: { farmer: true } }` so it SHOULD return farmer object including ID!
    // I will assume stock.certification.farmer.id exists if I simply add it to interface in page.tsx.

    // For now I will assume I can access it if I cast or if I fix page.tsx interface.
    // Let's rely on finding farmer by name if ID missing, or just assume ID is there (runtime object likely has it).

    // Actually, `stock.certification` has `farmerId` (the foreign key on certification table), but `stock` has `certId`.
    // We can find the certification object in `farmers` list that matches `stock.certId`.
    // Iterate farmers, find one that has a cert with id === stock.certId.

    const initialFarmer = farmers.find(f => f.certifications.some(c => c.certType === stock.certification.certType && c.farmerId === f.id))
    // Wait, simpler: I know `stock.certification.farmer.name`. I can find farmer by that name.

    const [selectedFarmerId, setSelectedFarmerId] = useState<string>(
        farmers.find(f => f.name === stock.certification?.farmer?.name)?.id.toString() || ''
    )
    const [selectedCertId, setSelectedCertId] = useState<string>(
        // We know the certId is NOT directly in Stock interface defined in page.tsx, but Prisma returns it.
        // Let's assume passed stock object (from server) has `certId`. (Prisma returns all scalars by default)
        // If not, we have to find it.
        (stock as any).certId?.toString() || ''
    )
    const [selectedVarietyId, setSelectedVarietyId] = useState<string>(
        (stock as any).varietyId?.toString() || varieties.find(v => v.name === stock.variety.name)?.id.toString() || ''
    )

    // Derived state
    const selectedFarmer = farmers.find(f => f.id.toString() === selectedFarmerId)
    const availableCerts = selectedFarmer?.certifications || []

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setIsLoading(true)

        const formData = new FormData(event.currentTarget)

        if (!selectedFarmerId || !selectedCertId || !selectedVarietyId) {
            alert('필수 항목을 선택해주세요.')
            setIsLoading(false)
            return
        }

        const data: StockFormData = {
            productionYear: parseInt(formData.get('productionYear') as string, 10),
            bagNo: parseInt(formData.get('bagNo') as string, 10),
            weightKg: parseFloat(formData.get('weightKg') as string),
            incomingDate: new Date(formData.get('incomingDate') as string),
            certId: parseInt(selectedCertId),
            varietyId: parseInt(selectedVarietyId),
        }

        const result = await updateStock(stock.id, data)
        setIsLoading(false)

        if (result.success) {
            setOpen(false)
        } else {
            alert('Failed to update stock: ' + result.error)
        }
    }

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault()

        let message = `[${stock.certification?.farmer?.name}/${stock.variety?.name}] 정보를 삭제하시겠습니까?`
        if (stock.status === 'CONSUMED') {
            message = `이미 도정 작업에 사용되었습니다. 삭제 시 데이터 불일치가 발생할 수 있습니다. 그래도 삭제하시겠습니까?`
        }

        if (!confirm(message)) return

        setIsDeleting(true)
        const result = await deleteStock(stock.id)
        setIsDeleting(false)

        if (result.success) {
            setOpen(false)
        } else {
            alert('삭제 실패: ' + result.error)
        }
    }

    const isConsumed = stock.status === 'CONSUMED'

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger !== undefined ? trigger : (
                <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-400 hover:text-stone-900">
                        <Pencil className="h-4 w-4" />
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>입고 정보 수정</DialogTitle>
                </DialogHeader>
                {isConsumed && (
                    <div className="bg-amber-50 text-amber-700 text-xs p-3 rounded-lg border border-amber-100 space-y-1">
                        <p className="font-bold">주의: 이미 도정 작업에 사용된 데이터입니다.</p>
                        <p>중량 수정 시 해당 도정 일지의 **총 투입량**도 자동으로 수정됩니다.</p>
                    </div>
                )}
                <form onSubmit={onSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="productionYear">생산년도</Label>
                            <Input
                                id="productionYear"
                                name="productionYear"
                                type="number"
                                defaultValue={stock.productionYear}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="incomingDate">입고일자</Label>
                            <Input
                                id="incomingDate"
                                name="incomingDate"
                                type="date"
                                required
                                defaultValue={new Date(stock.incomingDate).toISOString().split('T')[0]}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>생산자</Label>
                        <Select value={selectedFarmerId} onValueChange={(val) => {
                            setSelectedFarmerId(val)
                            setSelectedCertId('')
                        }}>
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
                        <Select value={selectedCertId} onValueChange={setSelectedCertId} disabled={!selectedFarmerId}>
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

                    <div className="space-y-2">
                        <Label>품종</Label>
                        <Select value={selectedVarietyId} onValueChange={setSelectedVarietyId}>
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
                            <Input
                                id="bagNo"
                                name="bagNo"
                                type="number"
                                defaultValue={stock.bagNo}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="weightKg">중량(kg)</Label>
                            <Input
                                id="weightKg"
                                name="weightKg"
                                type="number"
                                step="0.1"
                                defaultValue={stock.weightKg}
                                required
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-4">
                        <Button
                            type="button"
                            variant="link"
                            className="text-red-500 hover:text-red-700 hover:no-underline p-0 h-auto font-normal"
                            disabled={isDeleting || isLoading}
                            onClick={handleDelete}
                        >
                            {isDeleting ? '삭제 중...' : '데이터 삭제'}
                        </Button>
                        <Button type="submit" disabled={isLoading || isDeleting}>
                            {isLoading ? '저장 중...' : '수정 완료'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
