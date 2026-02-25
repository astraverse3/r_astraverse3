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
import { createFarmer, updateFarmer, getProducerGroups, updateProducerGroup, type FarmerFormData } from '@/app/actions/admin'
import { triggerDataUpdate } from '@/components/last-updated'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

// Extended Farmer type to match list
interface Farmer {
    id: number
    name: string
    farmerNo: string | null
    items: string | null
    phone: string | null
    groupId: number | null
    group: {
        id: number
        code: string
        name: string
        certNo: string
        cropYear: number
    } | null
}

interface ProducerGroup {
    id: number
    code: string
    name: string
    certNo: string
    cropYear: number
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
    const [isNewGroup, setIsNewGroup] = useState(false)
    const [editedGroupName, setEditedGroupName] = useState<string>('')

    // Helper for default crop year
    const getDefaultCropYear = () => {
        const now = new Date()
        const month = now.getMonth() + 1 // 0-indexed
        const year = now.getFullYear()
        // If Nov(11) or Dec(12), use current year. Else use previous year.
        return month >= 11 ? year : year - 1
    }

    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen

    // Fetch Groups on open
    useEffect(() => {
        if (open) {
            getProducerGroups().then(res => {
                if (res.success && res.data) setGroups(res.data)
            })
            // Reset state when opening
            if (!farmer) {
                setIsNewGroup(false)
            } else if (farmer.group) {
                setEditedGroupName(farmer.group.name)
            }
        }
    }, [open, farmer])

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
        const farmerName = formData.get('name') as string
        const farmerNo = formData.get('farmerNo') as string
        const items = formData.get('items') as string || undefined
        const phone = formData.get('phone') as string || undefined

        let result
        try {
            // Update group name if changed (only when editing farmer)
            if (farmer && farmer.group && editedGroupName && editedGroupName !== farmer.group.name) {
                await updateProducerGroup(farmer.group.id, { name: editedGroupName })
            }

            if (isNewGroup) {
                // Create New Group + Farmer
                const rawCertNo = formData.get('certNo') as string;
                const groupData = {
                    code: formData.get('groupCode') as string,
                    name: formData.get('groupName') as string,
                    certNo: rawCertNo.trim() || '-', // Default to '-' for General
                    cropYear: parseInt(formData.get('cropYear') as string) || getDefaultCropYear()
                }

                // Import Dynamically or Assume it exists (Need to import createFarmerWithGroup)
                const { createFarmerWithGroup } = await import('@/app/actions/admin')
                result = await createFarmerWithGroup({
                    name: farmerName,
                    farmerNo,
                    items,
                    phone
                }, groupData)

            } else {
                // Determine Group ID
                const groupIdStr = formData.get('groupId') as string
                // Allow empty group (General Farmer)
                // Use undefined for "no group" to match FarmerFormData type
                const groupId = groupIdStr && groupIdStr !== 'null_value_placeholder' ? parseInt(groupIdStr) : undefined;

                const data: FarmerFormData = {
                    groupId,
                    farmerNo,
                    name: farmerName,
                    items,
                    phone,
                }

                if (farmer) {
                    result = await updateFarmer(farmer.id, data)
                } else {
                    result = await createFarmer(data)
                }
            }

            if (result.success) {
                triggerDataUpdate()
                setOpen(false)
                // Refresh groups for next time
                getProducerGroups().then(res => {
                    if (res.success && res.data) setGroups(res.data)
                })
            } else {
                toast.error((result as any).error || '저장 실패')
            }
        } catch (error: any) {
            console.error(error)
            toast.error(error.message || '오류가 발생했습니다.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!isControlled && (
                <DialogTrigger asChild>
                    <Button className="bg-[#8dc540] hover:bg-[#7db037] text-white">
                        <Plus className="mr-2 h-4 w-4" /> 생산자 등록
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{farmer ? '생산자 정보 수정' : '새 생산자 등록'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="grid gap-4 py-4">

                    <div className="space-y-4 border rounded-md p-4 bg-slate-50">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="groupId" className="font-bold text-slate-700">작목반 정보</Label>
                            {!farmer && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="newGroupToggle"
                                        className="h-4 w-4 rounded border-gray-300 text-[#00a2e8] focus:ring-[#00a2e8]"
                                        checked={isNewGroup}
                                        onChange={(e) => setIsNewGroup(e.target.checked)}
                                    />
                                    <Label htmlFor="newGroupToggle" className="cursor-pointer text-sm font-normal text-slate-600">
                                        새 작목반 등록
                                    </Label>
                                </div>
                            )}
                        </div>

                        {isNewGroup ? (
                            <div className="grid gap-3 animate-in fade-in slide-in-from-top-2">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="cropYear" className="text-xs">생산년도</Label>
                                        <Input id="cropYear" name="cropYear" defaultValue={getDefaultCropYear()} required />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="groupCode" className="text-xs">작목반번호</Label>
                                        <Input id="groupCode" name="groupCode" placeholder="예: 1" required />
                                    </div>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="groupName" className="text-xs">작목반명</Label>
                                    <Input id="groupName" name="groupName" placeholder="예: 땅끝황토친환경" required />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="certNo" className="text-xs">인증번호 (일반은 생략)</Label>
                                    <Input id="certNo" name="certNo" placeholder="입력 없으면 '일반'으로 저장됨" />
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                {farmer && farmer.group ? (
                                    <>
                                        <input type="hidden" name="groupId" value={farmer.group.id} />
                                        <div className="text-xs text-slate-500 mb-1">
                                            <span className="font-mono">[{farmer.group.cropYear}]</span> [{farmer.group.code}] 인증번호: {farmer.group.certNo}
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="editGroupName" className="text-xs">작목반명 (수정 가능)</Label>
                                            <Input
                                                id="editGroupName"
                                                value={editedGroupName}
                                                onChange={(e) => setEditedGroupName(e.target.value)}
                                                placeholder="작목반명"
                                                className="bg-white"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <Select name="groupId" defaultValue={farmer?.groupId?.toString() || ''}>
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="작목반 선택" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {groups.map(group => (
                                                <SelectItem key={group.id} value={group.id.toString()}>
                                                    <span className="font-mono">[{group.cropYear}]</span> [{group.code}] {group.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="farmerNo">생산자번호</Label>
                            <Input id="farmerNo" name="farmerNo" defaultValue={farmer?.farmerNo || ''} placeholder="예: 1" required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="name">생산자명 (필수)</Label>
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
                        <Button type="submit" disabled={isLoading} className="bg-[#8dc540] hover:bg-[#7db037] text-white">
                            {isLoading ? '저장 중...' : '저장'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
