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

export function MillingFilters({ varieties }: { varieties: { id: number; name: string }[] }) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [open, setOpen] = useState(false)

    // Filter States
    const [status, setStatus] = useState(searchParams.get('status') || 'ALL')
    const [variety, setVariety] = useState(searchParams.get('variety') || 'ALL')
    const [millingType, setMillingType] = useState(searchParams.get('millingType') || 'ALL')
    const [keyword, setKeyword] = useState(searchParams.get('keyword') || '')
    const [yieldRate, setYieldRate] = useState(searchParams.get('yieldRate') || 'ALL')

    // Sync from URL when opening
    useEffect(() => {
        if (open) {
            setStatus(searchParams.get('status') || 'ALL')
            setVariety(searchParams.get('variety') || 'ALL')
            setMillingType(searchParams.get('millingType') || 'ALL')
            setKeyword(searchParams.get('keyword') || '')
            setYieldRate(searchParams.get('yieldRate') || 'ALL')
        }
    }, [open, searchParams])

    const activeFilterCount = [
        status !== 'ALL',
        variety !== 'ALL',
        millingType !== 'ALL',
        keyword !== '',
        yieldRate !== 'ALL'
    ].filter(Boolean).length

    const handleApply = () => {
        const params = new URLSearchParams()

        if (status && status !== 'ALL') params.set('status', status)
        if (variety && variety !== 'ALL') params.set('variety', variety)
        if (millingType && millingType !== 'ALL') params.set('millingType', millingType)
        if (keyword) params.set('keyword', keyword)
        if (yieldRate && yieldRate !== 'ALL') params.set('yieldRate', yieldRate)

        router.push(`/milling?${params.toString()}`)
        setOpen(false)
    }

    const handleReset = () => {
        setStatus('ALL')
        setVariety('ALL')
        setMillingType('ALL')
        setKeyword('')
        setYieldRate('ALL')
        router.push(`/milling`)
        setOpen(false)
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
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>상태</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger>
                                    <SelectValue placeholder="전체" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">전체</SelectItem>
                                    <SelectItem value="open">진행중</SelectItem>
                                    <SelectItem value="closed">마감</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>품종</Label>
                            <Select value={variety} onValueChange={setVariety}>
                                <SelectTrigger>
                                    <SelectValue placeholder="전체" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">전체</SelectItem>
                                    {varieties.map((v) => (
                                        <SelectItem key={v.id} value={v.name}>
                                            {v.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>도정구분</Label>
                            <Select value={millingType} onValueChange={setMillingType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="전체" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">전체</SelectItem>
                                    <SelectItem value="백미">백미</SelectItem>
                                    <SelectItem value="현미">현미</SelectItem>
                                    <SelectItem value="7분도">7분도</SelectItem>
                                    <SelectItem value="5분도">5분도</SelectItem>
                                    <SelectItem value="찹쌀">찹쌀</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>수율</Label>
                            <Select value={yieldRate} onValueChange={setYieldRate}>
                                <SelectTrigger>
                                    <SelectValue placeholder="전체" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">전체</SelectItem>
                                    <SelectItem value="upto_50">50% 이하</SelectItem>
                                    <SelectItem value="upto_60">60% 이하</SelectItem>
                                    <SelectItem value="upto_70">70% 이하</SelectItem>
                                    <SelectItem value="over_70">70% 이상</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>비고 (텍스트 검색)</Label>
                        <Input
                            placeholder="검색어 입력"
                            value={keyword}
                            onChange={e => setKeyword(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleApply()
                            }}
                        />
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
