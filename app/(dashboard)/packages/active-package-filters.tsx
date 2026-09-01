'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'

const SOURCE_LABEL: Record<string, string> = {
    MILLED: '도정산',
    PURCHASED: '매입',
}

const SORT_LABEL: Record<string, string> = {
    latest: '최신순',
    oldest: '오래된순',
    weight_desc: '재고량순',
}

interface Props {
    totalCount: number
    varieties: { id: number; name: string }[]
    /** 「차감된 재고 보기」가 켜졌을 때 목록에 포함된 차감 완료 행 수 (D6) */
    deductedCount?: number
}

export function ActivePackageFilters({ totalCount, varieties, deductedCount = 0 }: Props) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    // 「차감된 재고 보기」 — URL 파라미터로 유지해 새로고침에 생존한다 (N6·D6)
    const includeDeducted = searchParams.get('includeDeducted') === '1'
    const toggleDeducted = (next: boolean) => {
        const params = new URLSearchParams(searchParams.toString())
        if (next) params.set('includeDeducted', '1')
        else params.delete('includeDeducted')
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const yearParam = searchParams.get('productionYear') || ''
    const varietyParam = searchParams.get('varietyId') || ''
    const sourceParam = searchParams.get('source') || ''
    const sort = searchParams.get('sort') || ''

    const years = yearParam ? yearParam.split(',').map(s => s.trim()).filter(Boolean) : []
    const varietyIds = varietyParam ? varietyParam.split(',').map(s => s.trim()).filter(Boolean) : []
    const sources = sourceParam ? sourceParam.split(',').map(s => s.trim()).filter(Boolean) : []

    const varietyNameMap = new Map(varieties.map(v => [v.id.toString(), v.name]))
    const varietyLabels = varietyIds.map(id => varietyNameMap.get(id) ?? id)

    const sortIsCustom = sort && sort !== 'weight_desc'

    const activeFilterCount = [
        years.length > 0,
        varietyIds.length > 0,
        sources.length > 0,
        sortIsCustom,
    ].filter(Boolean).length

    return (
        <div className="flex items-center justify-between gap-2 overflow-x-auto py-1 px-1 scrollbar-hide">
            <span className="text-xs text-slate-600 font-medium whitespace-nowrap tabular-nums">
                검색결과 {(totalCount - deductedCount).toLocaleString()}건
                {includeDeducted && deductedCount > 0 && (
                    <span className="text-slate-400"> · 차감 {deductedCount.toLocaleString()}건</span>
                )}
            </span>
            <label className="ml-auto flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs font-medium text-slate-700">
                <Switch size="sm" checked={includeDeducted} onCheckedChange={toggleDeducted} />
                차감된 재고 보기
            </label>
            {activeFilterCount > 0 && (
                <div className="flex gap-2 flex-wrap justify-end">
                    {years.map(y => (
                        <Badge key={y} variant="outline" className="whitespace-nowrap bg-transparent text-slate-500 border-slate-200 font-normal">
                            {y}년
                        </Badge>
                    ))}
                    {varietyLabels.map((label, i) => (
                        <Badge key={`${varietyIds[i]}-${label}`} variant="outline" className="whitespace-nowrap bg-transparent text-slate-500 border-slate-200 font-normal">
                            {label}
                        </Badge>
                    ))}
                    {sources.map(s => (
                        <Badge key={s} variant="outline" className="whitespace-nowrap bg-transparent text-slate-500 border-slate-200 font-normal">
                            {SOURCE_LABEL[s] ?? s}
                        </Badge>
                    ))}
                    {sortIsCustom && (
                        <Badge variant="outline" className="whitespace-nowrap bg-transparent text-slate-500 border-slate-200 font-normal">
                            {SORT_LABEL[sort] ?? sort}
                        </Badge>
                    )}
                </div>
            )}
        </div>
    )
}
