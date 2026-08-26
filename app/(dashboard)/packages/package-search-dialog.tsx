'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
import type { PackageCategory, PackageSort } from '@/app/actions/packages'

const YEAR_OPTIONS = [
    { label: '2026년', value: '2026' },
    { label: '2025년', value: '2025' },
    { label: '2024년', value: '2024' },
    { label: '2023년', value: '2023' },
]

const SOURCE_OPTIONS = [
    { label: '도정산', value: 'MILLED' },
    { label: '매입', value: 'PURCHASED' },
]

const SORT_OPTIONS: { value: PackageSort; label: string }[] = [
    { value: 'weight_desc', label: '재고량 많은순' },
    { value: 'latest', label: '최신순' },
    { value: 'oldest', label: '오래된순' },
]

interface Props {
    category: PackageCategory
    varieties: { id: number; name: string }[]
    /** 재포장 선택 모드 동안 잠근다 — 필터가 바뀌면 골라둔 선택이 날아간다 */
    disabled?: boolean
}

/**
 * 제품재고 검색 다이얼로그 — 핸드오프 §4.6.
 *  - 카테고리(category)는 URL 쿼리에 노출하지 않고, 탭 전환에서 결정
 *  - source 필터는 잡곡 탭에서만 노출 (벼는 사실상 MILLED만)
 *  - 정렬은 일단 본 다이얼로그 안. 윤곽 본 후 헤더로 분리 검토
 */
export function PackageSearchDialog({ category, varieties, disabled = false }: Props) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()
    const [open, setOpen] = useState(false)

    const parseMulti = (param: string | null) =>
        param ? param.split(',').map(s => s.trim()).filter(Boolean) : []

    const [years, setYears] = useState<string[]>([])
    const [varietyIds, setVarietyIds] = useState<string[]>([])
    const [sources, setSources] = useState<string[]>([])
    const [sort, setSort] = useState<PackageSort>('weight_desc')

    // URL → 위젯 sync. open 시점뿐 아니라 URL 변경 시에도 동기화.
    // useState 초기값은 빈 값 — SSR/CSR hydration 안전성 + 단일 진실 원천(URL).
    useEffect(() => {
        setYears(parseMulti(searchParams.get('productionYear')))
        setVarietyIds(parseMulti(searchParams.get('varietyId')))
        setSources(parseMulti(searchParams.get('source')))
        const raw = searchParams.get('sort')
        const isValid = SORT_OPTIONS.some(o => o.value === raw)
        setSort(isValid ? (raw as PackageSort) : 'weight_desc')
    }, [searchParams, open])

    const activeFilterCount = [
        years.length > 0,
        varietyIds.length > 0,
        category === 'MISC_GRAIN' && sources.length > 0,
        sort !== 'weight_desc',
    ].filter(Boolean).length

    const buildUrl = (params: URLSearchParams) => {
        if (category === 'MISC_GRAIN') params.set('tab', 'misc')
        return `/packages?${params.toString()}`
    }

    const handleApply = () => {
        const params = new URLSearchParams()
        if (years.length > 0) params.set('productionYear', years.join(','))
        if (varietyIds.length > 0) params.set('varietyId', varietyIds.join(','))
        if (category === 'MISC_GRAIN' && sources.length > 0) params.set('source', sources.join(','))
        if (sort !== 'weight_desc') params.set('sort', sort)
        startTransition(() => router.push(buildUrl(params)))
        setOpen(false)
    }

    const handleReset = () => {
        setYears([])
        setVarietyIds([])
        setSources([])
        setSort('weight_desc')

        const params = new URLSearchParams()
        startTransition(() => router.push(buildUrl(params)))
        setOpen(false)
    }

    const varietyOptions = varieties.map(v => ({ label: v.name, value: v.id.toString() }))

    return (
        <>
            {isPending && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/50 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        <p className="text-slate-600 font-medium">데이터를 불러오는 중입니다...</p>
                    </div>
                </div>
            )}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    {/* 핸드오프 §3.4: 검색 버튼은 항상 blue-50. 활성 필터 수는 카운트 배지로 표시 */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 sm:pl-3 sm:pr-2 gap-1.5 bg-blue-50 border-blue-200 text-primary font-semibold hover:bg-blue-100 hover:text-primary"
                        disabled={disabled}
                    >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">검색</span>
                        {activeFilterCount > 0 && (
                            <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-white border border-blue-200 text-[10px] font-bold text-primary tabular-nums">
                                {activeFilterCount}
                            </span>
                        )}
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{category === 'MISC_GRAIN' ? '잡곡 제품재고 검색' : '벼 제품재고 검색'}</DialogTitle>
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
                                <Label>정렬</Label>
                                <Select value={sort} onValueChange={(v) => setSort(v as PackageSort)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="정렬 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SORT_OPTIONS.map(o => (
                                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                        ))}
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
                            {category === 'MISC_GRAIN' ? (
                                <div className="space-y-2">
                                    <Label>출처</Label>
                                    <MultiSelect
                                        options={SOURCE_OPTIONS}
                                        value={sources}
                                        onValueChange={setSources}
                                        placeholder="전체"
                                    />
                                </div>
                            ) : (
                                <div /> /* 벼 탭은 출처 분기 없음 — 좌측 절반만 사용 */
                            )}
                        </div>
                    </div>
                    <DialogFooter className="flex flex-row justify-between items-center sm:justify-between w-full mt-2">
                        <Button variant="ghost" size="sm" onClick={handleReset} disabled={isPending} className="text-slate-500 hover:text-slate-700 px-2">
                            초기화
                        </Button>
                        <Button size="sm" onClick={handleApply} disabled={isPending} className="px-6">
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '적용하기'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
