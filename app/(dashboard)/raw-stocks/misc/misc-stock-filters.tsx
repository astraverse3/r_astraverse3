'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, SlidersHorizontal } from 'lucide-react'
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
    DialogFooter,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { MultiSelect } from '@/components/ui/multi-select'

const CERT_OPTIONS = [
    { label: '유기농', value: '유기농' },
    { label: '무농약', value: '무농약' },
    { label: '일반', value: '일반' },
]

const YEAR_OPTIONS = [
    { label: '2026년', value: '2026' },
    { label: '2025년', value: '2025' },
    { label: '2024년', value: '2024' },
    { label: '2023년', value: '2023' },
]

const SOURCE_OPTIONS = [
    { label: '도정위탁', value: 'CONSIGNMENT' },
    { label: '농가도정', value: 'FARMER_MILLED' },
    { label: '발아위탁', value: 'GERMINATION' },
]

interface Props {
    varieties: { id: number; name: string }[]
}

export function MiscStockFilters({ varieties }: Props) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()
    const [open, setOpen] = useState(false)

    const today = new Date()
    const defaultYear = ((today.getMonth() + 1) >= 11 ? today.getFullYear() : today.getFullYear() - 1).toString()

    const parseMulti = (param: string | null) =>
        param ? param.split(',').map(s => s.trim()).filter(Boolean) : []

    const [years, setYears] = useState<string[]>(() => {
        const param = searchParams.get('productionYear')
        return param ? parseMulti(param) : [defaultYear]
    })
    const [varietyIds, setVarietyIds] = useState<string[]>(() => parseMulti(searchParams.get('varietyId')))
    const [farmerName, setFarmerName] = useState(searchParams.get('farmerName') || '')
    const [certs, setCerts] = useState<string[]>(() => parseMulti(searchParams.get('certType')))
    const [sourceTypes, setSourceTypes] = useState<string[]>(() => parseMulti(searchParams.get('sourceType')))
    const [status, setStatus] = useState(searchParams.get('status') || 'ALL')

    useEffect(() => {
        if (open) {
            const yearParam = searchParams.get('productionYear')
            setYears(yearParam ? parseMulti(yearParam) : [defaultYear])
            setVarietyIds(parseMulti(searchParams.get('varietyId')))
            setFarmerName(searchParams.get('farmerName') || '')
            setCerts(parseMulti(searchParams.get('certType')))
            setSourceTypes(parseMulti(searchParams.get('sourceType')))
            setStatus(searchParams.get('status') || 'ALL')
        }
    }, [open, searchParams, defaultYear])

    const activeFilterCount = [
        years.length > 0,
        varietyIds.length > 0,
        farmerName.trim() !== '',
        certs.length > 0,
        sourceTypes.length > 0,
        status !== 'ALL',
    ].filter(Boolean).length

    const buildUrl = (params: URLSearchParams) => {
        // tab=misc 유지
        params.set('tab', 'misc')
        return `/raw-stocks?${params.toString()}`
    }

    const handleApply = () => {
        const params = new URLSearchParams()
        if (years.length > 0) params.set('productionYear', years.join(','))
        if (varietyIds.length > 0) params.set('varietyId', varietyIds.join(','))
        if (farmerName.trim()) params.set('farmerName', farmerName.trim())
        if (certs.length > 0) params.set('certType', certs.join(','))
        if (sourceTypes.length > 0) params.set('sourceType', sourceTypes.join(','))
        if (status && status !== 'ALL') params.set('status', status)

        startTransition(() => router.push(buildUrl(params)))
        setOpen(false)
    }

    const handleReset = () => {
        setYears([defaultYear])
        setVarietyIds([])
        setFarmerName('')
        setCerts([])
        setSourceTypes([])
        setStatus('ALL')

        const params = new URLSearchParams()
        params.set('productionYear', defaultYear)
        startTransition(() => router.push(buildUrl(params)))
        setOpen(false)
    }

    const varietyOptions = varieties.map(v => ({ label: v.name, value: v.id.toString() }))

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
                        <DialogTitle>잡곡 검색</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>생산연도</Label>
                                <MultiSelect
                                    options={YEAR_OPTIONS}
                                    value={years}
                                    onValueChange={setYears}
                                    placeholder="전체"
                                />
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
                                <MultiSelect
                                    options={varietyOptions}
                                    value={varietyIds}
                                    onValueChange={setVarietyIds}
                                    placeholder="전체"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>인증구분</Label>
                                <MultiSelect
                                    options={CERT_OPTIONS}
                                    value={certs}
                                    onValueChange={setCerts}
                                    placeholder="전체"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>입고 유형</Label>
                            <MultiSelect
                                options={SOURCE_OPTIONS}
                                value={sourceTypes}
                                onValueChange={setSourceTypes}
                                placeholder="전체"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="miscFarmerNameSearch">생산자 / 농가명</Label>
                            <Input
                                id="miscFarmerNameSearch"
                                placeholder="예: 홍길동"
                                value={farmerName}
                                onChange={(e) => setFarmerName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleApply()
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex flex-row justify-between items-center sm:justify-between w-full mt-2">
                        <Button variant="ghost" size="sm" onClick={handleReset} disabled={isPending} className="text-slate-500 hover:text-slate-700 px-2">
                            초기화
                        </Button>
                        <Button size="sm" onClick={handleApply} disabled={isPending} className="bg-[#00a2e8] hover:bg-[#008cc9] px-6">
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '적용하기'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
