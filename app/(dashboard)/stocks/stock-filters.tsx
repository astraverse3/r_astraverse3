'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
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
    const [isPending, startTransition] = useTransition()

    const [open, setOpen] = useState(false)
    const [hasAttemptedAutoOpen, setHasAttemptedAutoOpen] = useState(false)

    // Default Year Logic: Previous Year until Oct, Current Year from Nov
    const today = new Date()
    const defaultYear = ((today.getMonth() + 1) >= 11 ? today.getFullYear() : today.getFullYear() - 1).toString()

    // Filter States
    const [year, setYear] = useState(searchParams.get('productionYear') || defaultYear)
    const [variety, setVariety] = useState(searchParams.get('varietyId') || 'ALL')
    const [farmerName, setFarmerName] = useState(searchParams.get('farmerName') || '')
    const [cert, setCert] = useState(searchParams.get('certType') || 'ALL')
    const [status, setStatus] = useState(searchParams.get('status') || 'ALL')

    // Sync from URL when opening
    useEffect(() => {
        if (open) {
            setYear(searchParams.get('productionYear') || defaultYear)
            setVariety(searchParams.get('varietyId') || 'ALL')
            setFarmerName(searchParams.get('farmerName') || '')
            setCert(searchParams.get('certType') || 'ALL')
            setStatus(searchParams.get('status') || 'ALL')
        }
    }, [open, searchParams, defaultYear])

    const activeFilterCount = [
        year !== 'ALL',
        variety !== 'ALL',
        farmerName !== '',
        cert !== 'ALL',
        status !== 'ALL'
    ].filter(Boolean).length

    // Auto-open on mobile if no filters are applied (Search First strategy)
    useEffect(() => {
        if (!hasAttemptedAutoOpen && typeof window !== 'undefined') {
            // Check if it's mobile (sm or smaller, usually < 768px for md breakpoint)
            const isMobile = window.innerWidth < 768
            // Check if there are no meaningful search params (ignore just having defaultYear)
            const hasNoFilters = Array.from(searchParams.entries()).filter(([key, val]) => {
                if (key === 'productionYear' && val === defaultYear) return false
                return true
            }).length === 0

            if (isMobile && hasNoFilters) {
                setOpen(true)
            }
            setHasAttemptedAutoOpen(true)
        }
    }, [searchParams, defaultYear, hasAttemptedAutoOpen])

    const handleApply = () => {
        const params = new URLSearchParams()

        if (year && year !== 'ALL') params.set('productionYear', year)
        if (variety && variety !== 'ALL') params.set('varietyId', variety)
        if (farmerName) params.set('farmerName', farmerName)
        if (cert && cert !== 'ALL') params.set('certType', cert)
        if (status && status !== 'ALL') params.set('status', status)

        startTransition(() => {
            router.push(`/stocks?${params.toString()}`)
        })
        setOpen(false)
    }

    const handleReset = () => {
        setYear(defaultYear)
        setVariety('ALL')
        setFarmerName('')
        setCert('ALL')
        setStatus('ALL')

        startTransition(() => {
            router.push(`/stocks?productionYear=${defaultYear}`)
        })
        setOpen(false)
    }

    return (
        <>
            {isPending && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/50 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
                        <Loader2 className="w-10 h-10 text-[#00a2e8] animate-spin" />
                        <p className="text-slate-600 font-medium">데이터를 불러오는 중입니다...</p>
                    </div>
                </div>
            )}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className={`h-8 gap-1.5 px-2 sm:px-3 ${activeFilterCount > 0 ? 'bg-[#00a2e8]/10 text-[#00a2e8] border-[#00a2e8]/30' : 'text-slate-600'}`}>
                        <SlidersHorizontal className="h-4 w-4" />
                        <span className="hidden sm:inline">검색</span>
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

                        <div className="grid grid-cols-2 gap-4">
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

                        <div className="space-y-2">
                            <Label htmlFor="farmerNameSearch">생산자</Label>
                            <Input
                                id="farmerNameSearch"
                                name="farmerNameSearch"
                                placeholder="생산자명 검색"
                                value={farmerName}
                                onChange={(e) => setFarmerName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleApply()
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex flex-row justify-between items-center sm:justify-between w-full mt-2">
                        <Button variant="ghost" size="sm" onClick={handleReset} disabled={isPending} className="text-slate-500 hover:text-slate-700 px-2">초기화</Button>
                        <Button size="sm" onClick={handleApply} disabled={isPending} className="bg-[#00a2e8] hover:bg-[#008cc9] px-6">
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '적용하기'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
