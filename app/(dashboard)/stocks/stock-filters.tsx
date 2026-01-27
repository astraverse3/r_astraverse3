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
import { SlidersHorizontal, X } from 'lucide-react'

export function StockFilters() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [open, setOpen] = useState(false)

    // Default Year
    const currentYear = new Date().getFullYear().toString()

    // Filter States
    const [year, setYear] = useState(searchParams.get('productionYear') || currentYear)
    const [variety, setVariety] = useState(searchParams.get('variety') || '')
    const [farmer, setFarmer] = useState(searchParams.get('farmerName') || '')
    const [cert, setCert] = useState(searchParams.get('certType') || '유기농')
    const [status, setStatus] = useState(searchParams.get('status') || 'AVAILABLE')

    // Sort is always newest by default request
    const sort = 'newest'

    // Sync from URL when opening
    useEffect(() => {
        if (open) {
            setYear(searchParams.get('productionYear') || currentYear)
            setVariety(searchParams.get('variety') || '')
            setFarmer(searchParams.get('farmerName') || '')
            setCert(searchParams.get('certType') || '유기농')
            setStatus(searchParams.get('status') || 'AVAILABLE')
        }
    }, [open, searchParams, currentYear])

    const activeFilterCount = [
        year && year !== currentYear,
        variety,
        farmer,
        cert !== '유기농',
        status !== 'AVAILABLE'
    ].filter(Boolean).length

    const handleApply = () => {
        const params = new URLSearchParams()
        // If values match defaults, don't set them in URL to keep it clean? 
        // Or always set them to be explicit? User request implies these are defaults for the UI.
        // Let's set them if they differ from "ALL", but here defaults are specific values.
        // If I want "All" behavior, I need "ALL" option. 
        // User said: "Production Year: Latest Default", "Status: Stored Default", "Variety: All Default", "Cert: Organic Default".

        if (year && year !== 'ALL') params.set('productionYear', year)
        if (variety) params.set('variety', variety)
        if (farmer) params.set('farmerName', farmer)
        if (cert && cert !== 'ALL') params.set('certType', cert)
        if (status && status !== 'ALL') params.set('status', status)

        // Removed sort param management as UI is removed and default is implied newest.

        router.push(`/stocks?${params.toString()}`)
        setOpen(false)
    }

    const handleReset = () => {
        setYear(currentYear)
        setVariety('')
        setFarmer('')
        setCert('유기농')
        setStatus('AVAILABLE')
        router.push(`/stocks?productionYear=${currentYear}&certType=유기농&status=AVAILABLE`)
        setOpen(false)
    }

    return (
        <>
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
                            <Input placeholder="품종명 입력" value={variety} onChange={e => setVariety(e.target.value)} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>농가명</Label>
                                <Input placeholder="농가명 입력" value={farmer} onChange={e => setFarmer(e.target.value)} />
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

            {/* Active Filters Display (Horizontal Scroll) */}
            {(activeFilterCount > 0 || sort !== 'newest') && (
                <div className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-hide">
                    {year && <Badge variant="outline" className="whitespace-nowrap bg-white">{year}년</Badge>}
                    {variety && <Badge variant="outline" className="whitespace-nowrap bg-white">{variety}</Badge>}
                    {farmer && <Badge variant="outline" className="whitespace-nowrap bg-white">{farmer}</Badge>}
                    {cert !== 'ALL' && <Badge variant="outline" className="whitespace-nowrap bg-white">{cert}</Badge>}
                    {status !== 'ALL' && <Badge variant="outline" className="whitespace-nowrap bg-white">{status === 'AVAILABLE' ? '보관중' : '소진됨'}</Badge>}
                    {sort !== 'newest' && <Badge variant="secondary" className="whitespace-nowrap text-[10px] text-slate-500 bg-slate-100">
                        {sort === 'oldest' && '오래된순'}
                        {sort === 'weight_desc' && '중량 높은순'}
                        {sort === 'weight_asc' && '중량 낮은순'}
                    </Badge>}
                </div>
            )}
        </>
    )
}
