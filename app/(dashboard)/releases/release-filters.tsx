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
import { SlidersHorizontal } from 'lucide-react'
import { format, subYears, subMonths } from 'date-fns'
import { Calendar as CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function ReleaseFilters() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [open, setOpen] = useState(false)

    // Default: 1 year ago to today
    const [dateRange, setDateRange] = useState<{
        from: Date | undefined;
        to: Date | undefined;
    }>({
        from: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : subYears(new Date(), 1),
        to: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : new Date(),
    })

    const [keyword, setKeyword] = useState(searchParams.get('keyword') || '')

    // Sync from URL when opening
    useEffect(() => {
        if (open) {
            const start = searchParams.get('startDate')
            const end = searchParams.get('endDate')
            setDateRange({
                from: start ? new Date(start) : subYears(new Date(), 1),
                to: end ? new Date(end) : new Date(),
            })
            setKeyword(searchParams.get('keyword') || '')
        }
    }, [open, searchParams])

    const activeFilterCount = [
        keyword !== '',
        searchParams.has('startDate') || searchParams.has('endDate')
    ].filter(Boolean).length

    const handleApply = () => {
        const params = new URLSearchParams()

        if (dateRange.from) params.set('startDate', format(dateRange.from, 'yyyy-MM-dd'))
        if (dateRange.to) params.set('endDate', format(dateRange.to, 'yyyy-MM-dd'))
        if (keyword) params.set('keyword', keyword)

        router.push(`/releases?${params.toString()}`)
        setOpen(false)
    }

    const handleReset = () => {
        const defaultFrom = subYears(new Date(), 1)
        const defaultTo = new Date()
        setDateRange({ from: defaultFrom, to: defaultTo })
        setKeyword('')
        router.push(`/releases?startDate=${format(defaultFrom, 'yyyy-MM-dd')}&endDate=${format(defaultTo, 'yyyy-MM-dd')}`)
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
                    <DialogTitle>출고 내역 검색</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>기간 설정</Label>
                            <div className="flex gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-[10px] text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                    onClick={() => setDateRange({ from: subMonths(new Date(), 3), to: new Date() })}
                                >
                                    3개월
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-[10px] text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                    onClick={() => setDateRange({ from: subMonths(new Date(), 6), to: new Date() })}
                                >
                                    6개월
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-[10px] text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                    onClick={() => setDateRange({ from: subYears(new Date(), 1), to: new Date() })}
                                >
                                    1년
                                </Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "justify-start text-left font-normal h-9 px-2 min-w-0",
                                            !dateRange.from && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">
                                            {dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : "시작일"}
                                        </span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={dateRange.from}
                                        onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                            <span className="text-slate-400 text-xs text-center shrink-0">~</span>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "justify-start text-left font-normal h-9 px-2 min-w-0",
                                            !dateRange.to && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">
                                            {dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : "종료일"}
                                        </span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={dateRange.to}
                                        onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>내용 검색 (출고처 / 비고)</Label>
                        <Input
                            placeholder="검색어를 입력하세요"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
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
