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

interface Stock {
    id: number
    productionYear: number
    bagNo: number
    farmerName: string
    variety: string
    certType: string
    weightKg: number
    status: string
}

interface Props {
    stock: Stock
    open?: boolean
    onOpenChange?: (open: boolean) => void
    trigger?: React.ReactNode
}

export function EditStockDialog({ stock, open: controlledOpen, onOpenChange: setControlledOpen, trigger }: Props) {
    const [internalOpen, setInternalOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen
    const setOpen = isControlled ? setControlledOpen! : setInternalOpen

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

        const result = await updateStock(stock.id, data)
        setIsLoading(false)

        if (result.success) {
            setOpen(false)
        } else {
            alert('Failed to update stock: ' + result.error)
        }
    }

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault() // Prevent form submission if button is inside form

        // Confirmation Logic
        let message = `[${stock.farmerName}/${stock.variety}] 정보를 삭제하시겠습니까?`
        if (stock.status === 'CONSUMED') {
            message = `[${stock.farmerName}/${stock.variety}]는 이미 도정 작업에 사용되었습니다. 삭제 시 데이터 불일치가 발생할 수 있습니다. 그래도 삭제하시겠습니까?`
        }

        if (!confirm(message)) return

        setIsDeleting(true)
        const result = await deleteStock(stock.id)
        setIsDeleting(false)

        if (result.success) {
            setOpen(false)
            // The list will update automatically via server action revalidation
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
            <DialogContent className="sm:max-w-[425px]">
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
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="productionYear" className="text-right">
                            생산년도
                        </Label>
                        <Input
                            id="productionYear"
                            name="productionYear"
                            type="number"
                            defaultValue={stock.productionYear || new Date().getFullYear()}
                            className="col-span-3 h-9"
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
                            defaultValue={stock.farmerName}
                            className="col-span-3 h-9"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="variety" className="text-right">
                            품종
                        </Label>
                        <Input
                            id="variety"
                            name="variety"
                            defaultValue={stock.variety}
                            className="col-span-3 h-9"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="certType" className="text-right">
                            인증
                        </Label>
                        <Select name="certType" defaultValue={stock.certType}>
                            <SelectTrigger className="col-span-3 h-9">
                                <SelectValue placeholder="인증 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="일반">일반</SelectItem>
                                <SelectItem value="무농약">무농약</SelectItem>
                                <SelectItem value="유기농">유기농</SelectItem>
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
                            defaultValue={stock.bagNo}
                            className="col-span-3 h-9"
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
                            defaultValue={stock.weightKg}
                            className="col-span-3 h-9"
                            required
                        />
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
