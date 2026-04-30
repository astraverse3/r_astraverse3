'use client'

import { useState, useEffect, Fragment } from 'react'
import { ChevronRight, Loader2, Inbox } from 'lucide-react'
import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
    TableCell,
} from '@/components/ui/table'
import {
    getMiscStocksByGroup,
    type MiscStockGroup,
    type GetMiscStocksParams,
} from '@/app/actions/misc-stock'
import { MiscStockTableRow, MiscStockMobileCard, CERT_BADGE_CLASS } from './misc-stock-table-row'

interface Props {
    initialGroups: MiscStockGroup[]
    filters: GetMiscStocksParams
}

export function MiscStockListClient({ initialGroups, filters }: Props) {
    const [loadedItems, setLoadedItems] = useState<Record<string, any[]>>({})
    const [loadingGroups, setLoadingGroups] = useState<Set<string>>(new Set())
    // 단일 건 그룹은 기본 펼친 상태로 시작
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
        () => new Set(initialGroups.filter(g => g.count === 1).map(g => g.key)),
    )

    const fetchGroupItems = async (group: MiscStockGroup) => {
        if (loadedItems[group.key] || loadingGroups.has(group.key)) return

        setLoadingGroups(prev => new Set(prev).add(group.key))
        try {
            const result = await getMiscStocksByGroup(
                { year: group.year, variety: group.variety, certType: group.certType },
                filters,
            )
            if (result.success && result.data) {
                setLoadedItems(prev => ({ ...prev, [group.key]: result.data as any[] }))
            }
        } finally {
            setLoadingGroups(prev => {
                const next = new Set(prev)
                next.delete(group.key)
                return next
            })
        }
    }

    // 단일 건 그룹은 자동으로 펼치고 lazy load 트리거 (필터 변경 시에도 동작)
    useEffect(() => {
        const singletons = initialGroups.filter(g => g.count === 1)
        if (singletons.length === 0) return
        setExpandedGroups(prev => {
            let changed = false
            const next = new Set(prev)
            singletons.forEach(g => {
                if (!next.has(g.key)) {
                    next.add(g.key)
                    changed = true
                }
            })
            return changed ? next : prev
        })
        singletons.forEach(g => fetchGroupItems(g))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialGroups])

    const toggleGroup = (group: MiscStockGroup) => {
        // 단일 건 그룹은 그룹 헤더가 안 보여 토글 기회 없음 — 안전장치로만 무시
        if (group.count <= 1) return
        const next = new Set(expandedGroups)
        if (next.has(group.key)) {
            next.delete(group.key)
        } else {
            next.add(group.key)
            if (!loadedItems[group.key]) fetchGroupItems(group)
        }
        setExpandedGroups(next)
    }

    const filterCount = Object.keys(filters).filter(k => {
        const v = (filters as any)[k]
        return v !== undefined && v !== '' && v !== 'ALL' && !(typeof v === 'object' && Object.keys(v).length === 0)
    }).length

    return (
        <section className="overflow-hidden md:bg-white md:rounded-xl md:shadow-sm md:border md:border-slate-200">
            {/* Desktop */}
            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b border-slate-200">
                            <TableHead className="w-[40px] py-2 px-1 text-center"></TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[40px] hidden sm:table-cell">년도</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[80px]">품종</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[140px]">생산자</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[80px] hidden md:table-cell">입고일</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[110px]">Lot No</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[80px]">유형</TableHead>
                            <TableHead className="py-2 px-1 text-right text-xs font-bold text-slate-500 w-[50px]">번호</TableHead>
                            <TableHead className="py-2 px-1 text-right text-xs font-bold text-slate-500 w-[70px]">원료(kg)</TableHead>
                            <TableHead className="py-2 px-1 text-right text-xs font-bold text-slate-500 w-[70px]">입고(kg)</TableHead>
                            <TableHead className="py-2 px-1 text-right text-xs font-bold text-slate-500 w-[60px]">수율</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[60px]">상태</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {initialGroups.length > 0 ? (
                            initialGroups.map(group => {
                                const isExpanded = expandedGroups.has(group.key)
                                const isLoading = loadingGroups.has(group.key)
                                const items = loadedItems[group.key] || []
                                const isMulti = group.count > 1

                                return (
                                    <Fragment key={group.key}>
                                        {/* Summary Row — handoff §4.2 (단일 건은 헤더 안 보임) */}
                                        {isMulti && (
                                            <TableRow
                                                className="bg-slate-50 hover:bg-slate-100 cursor-pointer border-y border-slate-200 font-bold text-slate-800 h-12"
                                                onClick={() => toggleGroup(group)}
                                            >
                                                <TableCell className="text-center">
                                                    {isLoading ? (
                                                        <Loader2 className="h-4 w-4 animate-spin mx-auto text-slate-400" />
                                                    ) : (
                                                        <ChevronRight
                                                            className={`w-3.5 h-3.5 mx-auto text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                                                        />
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center text-sm tabular-nums hidden sm:table-cell">{group.year}</TableCell>
                                                <TableCell className="text-center text-sm">
                                                    <span className="inline-flex items-center gap-1.5 justify-center">
                                                        <span>{group.variety}</span>
                                                        <span className={`inline-flex items-center font-medium px-1.5 py-0 rounded-md border text-[10px] ${CERT_BADGE_CLASS[group.certType] ?? CERT_BADGE_CLASS['일반']}`}>
                                                            {group.certType}
                                                        </span>
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-center text-sm text-slate-600 tabular-nums">
                                                    {group.farmerSetSize}명
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell"></TableCell>
                                                <TableCell></TableCell>
                                                <TableCell></TableCell>
                                                <TableCell className="text-right text-sm tabular-nums">{group.count}개</TableCell>
                                                <TableCell></TableCell>
                                                <TableCell className="text-right text-sm text-primary tabular-nums">
                                                    {group.totalWeight.toLocaleString()}
                                                </TableCell>
                                                <TableCell></TableCell>
                                                <TableCell></TableCell>
                                            </TableRow>
                                        )}

                                        {/* Detail Rows — 단일 건 그룹은 무조건 표시, 다중은 isExpanded일 때만 */}
                                        {(!isMulti || isExpanded) && items.map((stock: any) => (
                                            <MiscStockTableRow key={stock.id} stock={stock} />
                                        ))}
                                        {(!isMulti || isExpanded) && isLoading && items.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={12} className="h-24 text-center">
                                                    <div className="flex items-center justify-center gap-2 text-slate-500">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        <span>데이터 불러오는 중...</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </Fragment>
                                )
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={12} className="py-16">
                                    <EmptyState filtered={filterCount > 0} />
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile */}
            <div className="md:hidden flex flex-col min-h-[40vh] py-3 gap-3 bg-transparent">
                {initialGroups.length > 0 ? (
                    initialGroups.map(group => {
                        const isExpanded = expandedGroups.has(group.key)
                        const isLoading = loadingGroups.has(group.key)
                        const items = loadedItems[group.key] || []
                        const isMulti = group.count > 1

                        // 단일 건 그룹은 헤더 카드 없이 상세 카드만 표시 (border 없음)
                        if (!isMulti) {
                            return (
                                <div key={group.key} className="flex flex-col gap-1.5">
                                    {isLoading && items.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-6 text-slate-400 bg-white rounded-lg border border-slate-100 shadow-sm">
                                            <Loader2 className="h-5 w-5 animate-spin mb-2" />
                                            <span className="text-xs">데이터 로딩 중...</span>
                                        </div>
                                    )}
                                    {items.map((stock: any) => (
                                        <MiscStockMobileCard key={stock.id} stock={stock} />
                                    ))}
                                </div>
                            )
                        }

                        return (
                            <div key={group.key} className="flex flex-col gap-2">
                                <div
                                    className={`flex flex-col p-3 rounded-xl border ${isExpanded ? 'border-slate-300 bg-slate-100 shadow-md' : 'border-slate-200 bg-slate-50 shadow-sm'} transition-colors`}
                                    onClick={() => toggleGroup(group)}
                                >
                                    <div className="flex items-center justify-between mb-1.5 gap-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-bold text-[#2a2a2a] text-[15px] leading-none">{group.variety}</span>
                                            <span className="text-[11px] text-slate-500 font-medium bg-white border border-slate-200 px-1 py-0.5 rounded shadow-sm leading-none whitespace-nowrap">
                                                {group.year}년
                                            </span>
                                            <span className={`inline-flex items-center font-medium px-1.5 py-0 rounded text-[10px] border whitespace-nowrap leading-none ${CERT_BADGE_CLASS[group.certType] ?? CERT_BADGE_CLASS['일반']}`}>
                                                {group.certType}
                                            </span>
                                        </div>
                                        {isLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />
                                        ) : (
                                            <ChevronRight
                                                className={`text-slate-400 h-5 w-5 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                                            />
                                        )}
                                    </div>

                                    <div className="flex items-end justify-between mt-1">
                                        <div className="text-[12px] text-slate-600 font-medium whitespace-nowrap">
                                            생산자 <span className="font-bold text-slate-800 tabular-nums">{group.farmerSetSize}명</span>
                                        </div>
                                        <div className="flex items-baseline gap-2.5 text-right w-full justify-end">
                                            <div className="text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                                                {group.count}건
                                            </div>
                                            <div className="text-[17px] font-black text-primary tracking-tight leading-none whitespace-nowrap tabular-nums">
                                                {group.totalWeight.toLocaleString()}<span className="text-[11px] font-bold ml-0.5 opacity-70">kg</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="flex flex-col gap-1.5 pl-3 border-l-2 border-primary/40 ml-4 mr-1 mb-2 relative">
                                        {isLoading && items.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-6 text-slate-400 bg-white rounded-lg border border-slate-100 shadow-sm">
                                                <Loader2 className="h-5 w-5 animate-spin mb-2" />
                                                <span className="text-xs">데이터 로딩 중...</span>
                                            </div>
                                        )}
                                        {items.map((stock: any) => (
                                            <MiscStockMobileCard key={stock.id} stock={stock} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200">
                        <EmptyState filtered={filterCount > 0} />
                    </div>
                )}
            </div>
        </section>
    )
}

// §5.3 빈 상태 + §7 친근체 카피
function EmptyState({ filtered }: { filtered: boolean }) {
    return (
        <div className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <Inbox className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm text-slate-600">
                {filtered ? '조건에 맞는 결과가 없어요. 필터를 바꿔보세요.' : '아직 등록된 잡곡 재고가 없어요.'}
            </p>
        </div>
    )
}
