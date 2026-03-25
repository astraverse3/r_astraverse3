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
import { MultiSelect } from '@/components/ui/multi-select'
import { SlidersHorizontal } from 'lucide-react'

const CERT_OPTIONS = [
    { label: '유기농', value: '유기농' },
    { label: '무농약', value: '무농약' },
    { label: '일반', value: '일반' },
]

const YEAR_OPTIONS = [
    { label: '2026년', value: '2026' },
    { label: '2025년', value: '2025' },
    { label: '2024년', value: '2024' },
]

export function FarmerFilters() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [open, setOpen] = useState(false)

    const parseMulti = (param: string | null) =>
        param ? param.split(',').map(s => s.trim()).filter(Boolean) : []

    // Filter States
    const [groupName, setGroupName] = useState(searchParams.get('groupName') || '')
    const [farmerName, setFarmerName] = useState(searchParams.get('farmerName') || '')
    const [certTypes, setCertTypes] = useState<string[]>(() => parseMulti(searchParams.get('certType')))
    const [cropYears, setCropYears] = useState<string[]>(() => parseMulti(searchParams.get('cropYear')))

    const activeFilterCount = [
        groupName.trim() !== '',
        farmerName.trim() !== '',
        certTypes.length > 0,
        cropYears.length > 0
    ].filter(Boolean).length

    // Sync from URL when opening
    useEffect(() => {
        if (open) {
            setGroupName(searchParams.get('groupName') || '')
            setFarmerName(searchParams.get('farmerName') || '')
            setCertTypes(parseMulti(searchParams.get('certType')))
            setCropYears(parseMulti(searchParams.get('cropYear')))
        }
    }, [open, searchParams])

    const handleApply = () => {
        const params = new URLSearchParams()
        if (groupName.trim()) params.set('groupName', groupName.trim())
        if (farmerName.trim()) params.set('farmerName', farmerName.trim())
        if (certTypes.length > 0) params.set('certType', certTypes.join(','))
        if (cropYears.length > 0) params.set('cropYear', cropYears.join(','))

        router.push(`/admin/farmers?${params.toString()}`)
        setOpen(false)
    }

    const handleReset = () => {
        setGroupName('')
        setFarmerName('')
        setCertTypes([])
        setCropYears([])
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
                <Button variant="outline" size="sm" className={`h-8 gap-1.5 ${activeFilterCount > 0 ? 'bg-[#00a2e8]/10 text-[#00a2e8] border-[#00a2e8]/30' : 'text-slate-600'}`}>
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    검색
                    {activeFilterCount > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 bg-[#00a2e8]/20 text-[#008cc9] ml-0.5 rounded-full text-[10px]">
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
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label>생산년도</Label>
                            <MultiSelect
                                options={YEAR_OPTIONS}
                                value={cropYears}
                                onValueChange={setCropYears}
                                placeholder="전체"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>인증구분</Label>
                            <MultiSelect
                                options={CERT_OPTIONS}
                                value={certTypes}
                                onValueChange={setCertTypes}
                                placeholder="전체"
                            />
                        </div>
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
                            placeholder="예: 홍길동, 김철수"
                            value={farmerName}
                            onChange={(e) => setFarmerName(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                </div>
                <DialogFooter className="flex-row sm:justify-between sm:gap-0 gap-2 mt-4 pt-4 border-t border-slate-100">
                    <Button variant="ghost" onClick={handleReset} className="text-slate-500 hover:bg-slate-100 hover:text-slate-900 flex-1 sm:flex-none">초기화</Button>
                    <Button onClick={handleApply} className="bg-[#8dc540] hover:bg-[#7db037] text-white flex-1 sm:flex-none">적용하기</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
