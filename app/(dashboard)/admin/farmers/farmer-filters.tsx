'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { SlidersHorizontal } from 'lucide-react'

export function FarmerFilters() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [open, setOpen] = useState(false)

    // Filter States
    const [groupName, setGroupName] = useState(searchParams.get('groupName') || '')
    const [farmerName, setFarmerName] = useState(searchParams.get('farmerName') || '')
    const [certType, setCertType] = useState(searchParams.get('certType') || 'ALL')
    const [cropYear, setCropYear] = useState(searchParams.get('cropYear') || 'ALL')

    const activeFilterCount = [
        groupName !== '',
        farmerName !== '',
        certType !== 'ALL',
        cropYear !== 'ALL'
    ].filter(Boolean).length

    // Sync from URL when opening
    useEffect(() => {
        if (open) {
            setGroupName(searchParams.get('groupName') || '')
            setFarmerName(searchParams.get('farmerName') || '')
            setCertType(searchParams.get('certType') || 'ALL')
            setCropYear(searchParams.get('cropYear') || 'ALL')
        }
    }, [open, searchParams])

    const handleApply = () => {
        const params = new URLSearchParams()
        if (groupName) params.set('groupName', groupName)
        if (farmerName) params.set('farmerName', farmerName)
        if (certType && certType !== 'ALL') params.set('certType', certType)
        if (cropYear && cropYear !== 'ALL') params.set('cropYear', cropYear)

        router.push(`/admin/farmers?${params.toString()}`)
        setOpen(false)
    }

    const handleReset = () => {
        setGroupName('')
        setFarmerName('')
        setCertType('ALL')
        setCropYear('ALL')
        router.push('/admin/farmers')
        setOpen(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleApply()
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className={`h-8 gap-1.5 ${activeFilterCount > 0 ? 'bg-blue-50 text-blue-600 border-blue-200' : 'text-slate-600'}`}>
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    검색
                    {activeFilterCount > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 bg-blue-100 text-blue-700 ml-0.5 rounded-full text-[10px]">
                            {activeFilterCount}
                        </Badge>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>검색</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>생산년도</Label>
                        <Select value={cropYear} onValueChange={setCropYear}>
                            <SelectTrigger>
                                <SelectValue placeholder="전체" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">전체</SelectItem>
                                <SelectItem value="2024">2024년</SelectItem>
                                <SelectItem value="2025">2025년</SelectItem>
                                <SelectItem value="2026">2026년</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>작목반명</Label>
                        <Input
                            placeholder="작목반 검색"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>생산자명</Label>
                        <Input
                            placeholder="이름 검색"
                            value={farmerName}
                            onChange={(e) => setFarmerName(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>인증구분</Label>
                        <Select value={certType} onValueChange={setCertType}>
                            <SelectTrigger>
                                <SelectValue placeholder="전체" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">전체</SelectItem>
                                <SelectItem value="유기농">유기농</SelectItem>
                                <SelectItem value="무농약">무농약</SelectItem>
                                <SelectItem value="일반">일반</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter className="flex gap-2 sm:justify-between">
                    <Button variant="ghost" onClick={handleReset} className="mr-auto text-slate-500">초기화</Button>
                    <Button onClick={handleApply}>적용하기</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
