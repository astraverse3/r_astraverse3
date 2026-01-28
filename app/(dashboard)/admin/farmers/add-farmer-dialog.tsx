'use client'

import { useState, useEffect } from 'react'
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
import { createFarmer, updateFarmer, type FarmerFormData } from '@/app/actions/admin'
import { Plus } from 'lucide-react'

interface Farmer {
    id: number
    name: string
    phone: string | null
}

interface Props {
    farmer?: Farmer
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function AddFarmerDialog({ farmer, open: controlledOpen, onOpenChange: setControlledOpen }: Props) {
    const [internalOpen, setInternalOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen
    const setOpen = (newOpen: boolean) => {
        if (isControlled) {
            setControlledOpen?.(newOpen)
        } else {
            setInternalOpen(newOpen)
        }
    }

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setIsLoading(true)

        const formData = new FormData(event.currentTarget)
        const data: FarmerFormData = {
            name: formData.get('name') as string,
            phone: formData.get('phone') as string || undefined,
        }

        let result
        if (farmer) {
            result = await updateFarmer(farmer.id, data)
        } else {
            result = await createFarmer(data)
        }

        setIsLoading(false)

        if (result.success) {
            setOpen(false)
        } else {
            alert(result.error || '저장 실패')
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!isControlled && (
                <DialogTrigger asChild>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> 농가 등록
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{farmer ? '농가 정보 수정' : '새 농가 등록'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">이름 (필수)</Label>
                        <Input id="name" name="name" defaultValue={farmer?.name} required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="phone">연락처</Label>
                        <Input id="phone" name="phone" defaultValue={farmer?.phone || ''} placeholder="010-1234-5678" />
                    </div>
                    <div className="flex justify-end pt-2">
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? '저장 중...' : '저장'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
