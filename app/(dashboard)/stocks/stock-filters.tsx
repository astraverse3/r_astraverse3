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

export function StockFilters({ varieties, farmers }: { varieties: { id: number; name: string }[], farmers: { id: number; name: string; group: { name: string; certType: string; certNo: string } }[] }) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [open, setOpen] = useState(false)

    // Default Year Logic: Previous Year until Oct, Current Year from Nov
    const today = new Date()
    const defaultYear = ((today.getMonth() + 1) >= 11 ? today.getFullYear() : today.getFullYear() - 1).toString()

    // Filter States
    const [year, setYear] = useState(searchParams.get('productionYear') || defaultYear)
    const [variety, setVariety] = useState(searchParams.get('varietyId') || 'ALL')
    const [farmer, setFarmer] = useState(searchParams.get('farmerId') || 'ALL')
    const [cert, setCert] = useState(searchParams.get('certType') || 'ALL')
    const [status, setStatus] = useState(searchParams.get('status') || 'ALL')

    // Sync from URL when opening
    useEffect(() => {
        if (open) {
            setYear(searchParams.get('productionYear') || defaultYear)
            setVariety(searchParams.get('varietyId') || 'ALL')
            setFarmer(searchParams.get('farmerId') || 'ALL')
            setCert(searchParams.get('certType') || 'ALL')
            setStatus(searchParams.get('status') || 'ALL')
        }
    }, [open, searchParams, defaultYear])

    const activeFilterCount = [
        year !== 'ALL',
        variety !== 'ALL',
        farmer !== 'ALL',
        cert !== 'ALL',
        status !== 'ALL'
    ].filter(Boolean).length

    const handleApply = () => {
        const params = new URLSearchParams()

        if (year && year !== 'ALL') params.set('productionYear', year)
        if (variety && variety !== 'ALL') params.set('varietyId', variety)
        if (farmer && farmer !== 'ALL') params.set('farmerId', farmer)
        if (cert && cert !== 'ALL') params.set('certType', cert)
        if (status && status !== 'ALL') params.set('status', status)

        router.push(`/stocks?${params.toString()}`)
        setOpen(false)
    }

    const handleReset = () => {
        setYear(defaultYear)
        setVariety('ALL')
        setFarmer('ALL')
        setCert('ALL')
        setStatus('ALL')
        router.push(`/stocks?productionYear=${defaultYear}`)
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
                            <Label>생산연도</Label>
                            <Select value={year} onValueChange={setYear}>
                                <SelectTrigger>
                                    <SelectValue placeholder="전체" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">전체</SelectItem>
                                    {[2026, 2025, 2024, 2023].map(y => (
                                        <SelectItem key={y} value={y.toString()}>{y}년</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>상태</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger>
                                    <SelectValue placeholder="상태 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">전체</SelectItem>
                                    <SelectItem value="AVAILABLE">보관중</SelectItem>
                                    <SelectItem value="CONSUMED">소진됨</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
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
                                    <SelectItem key={v.id} value={v.id.toString()}>
                                        {v.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>생산자</Label>
                            <Select value={farmer} onValueChange={setFarmer}>
                                <SelectTrigger>
                                    <SelectValue placeholder="전체" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">전체</SelectItem>
                                    {farmers.map((f) => (
                                        <SelectItem key={f.id} value={f.id.toString()}>
                                            {f.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>인증구분</Label>
                            <Select value={cert} onValueChange={setCert}>
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
                </div>
                <DialogFooter className="flex gap-2 sm:justify-between">
                    <Button variant="ghost" onClick={handleReset} className="mr-auto text-slate-500">초기화</Button>
                    <Button onClick={handleApply}>적용하기</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
