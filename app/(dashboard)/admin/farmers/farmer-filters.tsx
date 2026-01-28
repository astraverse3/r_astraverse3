'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Search, X } from 'lucide-react'

export function FarmerFilters() {
    const router = useRouter()
    const searchParams = useSearchParams()

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

    const handleApply = () => {
        const params = new URLSearchParams()
        if (groupName) params.set('groupName', groupName)
        if (farmerName) params.set('farmerName', farmerName)
        if (certType && certType !== 'ALL') params.set('certType', certType)
        if (cropYear && cropYear !== 'ALL') params.set('cropYear', cropYear)

        router.push(`/admin/farmers?${params.toString()}`)
    }

    const handleReset = () => {
        setGroupName('')
        setFarmerName('')
        setCertType('ALL')
        setCropYear('ALL')
        router.push('/admin/farmers')
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleApply()
        }
    }

    return (
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500">생산년도</Label>
                    <Select value={cropYear} onValueChange={setCropYear}>
                        <SelectTrigger className="h-9 text-sm">
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
                    <Label className="text-xs font-bold text-slate-500">작목반명</Label>
                    <Input
                        placeholder="작목반 검색"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="h-9 text-sm"
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500">생산자명</Label>
                    <Input
                        placeholder="이름 검색"
                        value={farmerName}
                        onChange={(e) => setFarmerName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="h-9 text-sm"
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500">인증구분</Label>
                    <Select value={certType} onValueChange={setCertType}>
                        <SelectTrigger className="h-9 text-sm">
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

                <div className="flex gap-2">
                    <Button
                        onClick={handleApply}
                        className="flex-1 h-9 bg-slate-800 hover:bg-slate-900 text-white gap-2"
                    >
                        <Search className="h-4 w-4" />
                        검색
                    </Button>
                    {activeFilterCount > 0 && (
                        <Button
                            variant="outline"
                            onClick={handleReset}
                            className="h-9 w-9 p-0 text-slate-500 hover:text-red-500 hover:bg-red-50"
                            title="필터 초기화"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
