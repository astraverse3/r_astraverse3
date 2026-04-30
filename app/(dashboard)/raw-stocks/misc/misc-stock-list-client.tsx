'use client'

import { useState, Fragment } from 'react'
import { ChevronRight, ChevronDown, Loader2 } from 'lucide-react'
import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
    TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
    getMiscStocksByGroup,
    type MiscStockGroup,
    type GetMiscStocksParams,
} from '@/app/actions/misc-stock'
import { MiscStockTableRow, MiscStockMobileCard } from './misc-stock-table-row'

interface Props {
    initialGroups: MiscStockGroup[]
    filters: GetMiscStocksParams
}

export function MiscStockListClient({ initialGroups, filters }: Props) {
    const [loadedItems, setLoadedItems] = useState<Record<string, any[]>>({})
    const [loadingGroups, setLoadingGroups] = useState<Set<string>>(new Set())
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

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

    const toggleGroup = (group: MiscStockGroup) => {
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
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[120px]">생산자</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[60px] hidden md:table-cell">인증</TableHead>
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

                                return (
                                    <Fragment key={group.key}>
                                        {/* Summary Row — handoff §4.2 */}
                                        <TableRow
                                            className="bg-slate-50 hover:bg-slate-100 cursor-pointer border-y border-slate-200 font-bold text-slate-800 h-12"
                                            onClick={() => toggleGroup(group)}
                                        >
                                            <TableCell className="text-center">
                                                {isLoading ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mx-auto text-slate-500" />
                                                ) : isExpanded ? (
                                                    <ChevronDown className="h-4 w-4 mx-auto text-slate-500" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4 mx-auto text-slate-500" />
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center text-sm hidden sm:table-cell">{group.year}</TableCell>
                                            <TableCell className="text-center text-sm">{group.variety}</TableCell>
                                            <TableCell className="text-center text-sm text-slate-600">
                                                {group.farmerSetSize}명
                                            </TableCell>
                                            <TableCell className="text-center text-sm font-medium hidden md:table-cell">
                                                <Badge variant="outline" className="font-normal">
                                                    {group.certType}
                                                </Badge>
                                            </TableCell>
                                            <TableCell></TableCell>
                                            <TableCell></TableCell>
                                            <TableCell className="text-right text-sm">{group.count}개</TableCell>
                                            <TableCell></TableCell>
                                            <TableCell className="text-right text-sm text-primary">
                                                {group.totalWeight.toLocaleString()}
                                            </TableCell>
                                            <TableCell></TableCell>
                                            <TableCell></TableCell>
                                        </TableRow>

                                        {/* Detail Rows */}
                                        {isExpanded && items.map((stock: any) => (
                                            <MiscStockTableRow key={stock.id} stock={stock} />
                                        ))}
                                        {isExpanded && isLoading && items.length === 0 && (
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
                                <TableCell colSpan={12} className="h-32 text-center text-xs text-slate-400 font-medium">
                                    {filterCount > 0 ? '검색 결과가 없습니다.' : '등록된 잡곡 재고가 없습니다.'}
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
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-emerald-200 text-emerald-600 bg-emerald-50 whitespace-nowrap leading-none rounded-sm">
                                                {group.certType}
                                            </Badge>
                                        </div>
                                        {isLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-slate-500 shrink-0" />
                                        ) : isExpanded ? (
                                            <ChevronDown className="text-slate-400 h-5 w-5 shrink-0" />
                                        ) : (
                                            <ChevronRight className="text-slate-400 h-5 w-5 shrink-0" />
                                        )}
                                    </div>

                                    <div className="flex items-end justify-between mt-1">
                                        <div className="text-[12px] text-slate-600 font-medium whitespace-nowrap">
                                            생산자 <span className="font-bold text-slate-800">{group.farmerSetSize}명</span>
                                        </div>
                                        <div className="flex items-baseline gap-2.5 text-right w-full justify-end">
                                            <div className="text-[11px] text-slate-500 whitespace-nowrap">
                                                {group.count}건
                                            </div>
                                            <div className="text-[17px] font-black text-primary tracking-tight leading-none whitespace-nowrap">
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
                    <div className="text-center text-sm text-slate-400 py-10 bg-white rounded-xl border border-slate-200">
                        {filterCount > 0 ? '검색 결과가 없습니다.' : '등록된 잡곡 재고가 없습니다.'}
                    </div>
                )}
            </div>
        </section>
    )
}
