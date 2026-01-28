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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { createFarmer, updateFarmer, getProducerGroups, type FarmerFormData } from '@/app/actions/admin'
import { Plus } from 'lucide-react'

// Extended Farmer type to match list
interface Farmer {
    id: number
    name: string
    farmerNo: string
    items: string | null
    phone: string | null
    groupId: number
}

interface ProducerGroup {
    id: number
    code: string
    name: string
    certNo: string
}

interface Props {
    farmer?: Farmer
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function AddFarmerDialog({ farmer, open: controlledOpen, onOpenChange: setControlledOpen }: Props) {
    const [internalOpen, setInternalOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [groups, setGroups] = useState<ProducerGroup[]>([])

    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen

    // Fetch Groups on open
    useEffect(() => {
        if (open) {
            getProducerGroups().then(res => {
                if (res.success && res.data) setGroups(res.data)
            })
        }
    }, [open])

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
        const groupId = parseInt(formData.get('groupId') as string)

        const data: FarmerFormData = {
            groupId,
            farmerNo: formData.get('farmerNo') as string,
            name: formData.get('name') as string,
            items: formData.get('items') as string || undefined,
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
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{farmer ? '농가 정보 수정' : '새 농가 등록'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="groupId">작목반 (필수)</Label>
                        <Select name="groupId" defaultValue={farmer?.groupId.toString()} required>
                            <SelectTrigger>
                                <SelectValue placeholder="작목반 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                {groups.map(group => (
                                    <SelectItem key={group.id} value={group.id.toString()}>
                                        [{group.code}] {group.name} ({group.certNo})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="farmerNo">농가번호 (필수)</Label>
                            <Input id="farmerNo" name="farmerNo" defaultValue={farmer?.farmerNo} placeholder="예: 1" required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="name">농가명 (필수)</Label>
                            <Input id="name" name="name" defaultValue={farmer?.name} placeholder="생산자 이름" required />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="items">취급품목</Label>
                        <Input id="items" name="items" defaultValue={farmer?.items || ''} placeholder="취급 품목 (쉼표 구분)" />
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
