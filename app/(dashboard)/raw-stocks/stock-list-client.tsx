'use client'

import { useState, useEffect, useMemo, Fragment } from 'react'
import { ChevronRight, ChevronDown, Loader2, MoreVertical, Edit, Trash2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { StockTableRow } from './stock-table-row'
import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
    TableCell,
} from '@/components/ui/table'
import { getStocksByGroup, StockGroup, deleteStock } from '@/app/actions/stock'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'
import { EditStockDialog } from './edit-stock-dialog'
import { EmptyState } from '@/components/empty-state'
import { confirmDialog } from '@/components/ui/confirm-dialog'

interface StockListClientProps {
    initialGroups: StockGroup[]
    filters: any
    selectedIds: Set<number>
    onSelectionChange: (ids: Set<number>) => void
    farmers: any[]
    varieties: any[]
    loadedItems: Record<string, any[]>
    loadingGroups: Set<string>
    fetchGroupItems: (group: StockGroup) => Promise<void>
    cartItemIds?: Set<number>
}

export function StockListClient({
    initialGroups,
    farmers,
    varieties,
    filters,
    selectedIds,
    onSelectionChange,
    loadedItems, // Prop
    loadingGroups, // Prop
    fetchGroupItems, // Prop 
    cartItemIds = new Set() // New Prop
}: StockListClientProps) {
    // Local state removed (lifted to parent)

    const handleSelectOne = (id: number, checked: boolean) => {
        const newSet = new Set(selectedIds)
        if (checked) {
            newSet.add(id)
        } else {
            newSet.delete(id)
        }
        onSelectionChange(newSet)
    }

    // fetchGroupItems removed (passed from parent)



    return (
        <section className={`overflow-hidden md:bg-white md:rounded-xl md:shadow-sm md:border md:border-slate-200 ${Object.keys(filters).length === 0 ? 'bg-transparent' : 'bg-white'}`}>
            {/* --- DESKTOP VIEW --- */}
            <div className="hidden md:block">
                <Table className="table-fixed">
                    {/* 컬럼 폭 % (합 100). Lot No는 스펙상 24% 이상 */}
                    <colgroup>
                        <col className="w-[5%]" /><col className="w-[5%]" /><col className="w-[12%]" />
                        <col className="w-[15%]" /><col className="w-[5%]" /><col className="w-[24%]" />
                        <col className="w-[6%]" /><col className="w-[13%]" /><col className="w-[9%]" />
                        <col className="w-[6%]" />
                    </colgroup>
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-transparent">
                            <TableHead className="px-1 text-center">
                                {/* Global Select All Removed */}
                            </TableHead>
                            <TableHead className="text-center hidden sm:table-cell">년도</TableHead>
                            <TableHead className="text-center">품종</TableHead>
                            <TableHead className="text-center">생산자</TableHead>
                            <TableHead className="text-center hidden md:table-cell">인증</TableHead>
                            <TableHead className="text-center">Lot No</TableHead>
                            <TableHead className="text-right">톤백</TableHead>
                            <TableHead className="text-right">중량(kg)</TableHead>
                            <TableHead className="text-center">상태</TableHead>
                            <TableHead className="text-center">수정</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {initialGroups.length > 0 ? (
                            <GroupedStockRows
                                groups={initialGroups}
                                loadedItems={loadedItems}
                                loadingGroups={loadingGroups}
                                fetchGroupItems={fetchGroupItems}
                                farmers={farmers}
                                varieties={varieties}
                                selectedIds={selectedIds}
                                onSelectOne={handleSelectOne}
                                onSelectionChange={onSelectionChange}
                                cartItemIds={cartItemIds}
                            />
                        ) : (
                            <TableRow>
                                <TableHead colSpan={10} className="text-center">
                                    <EmptyState filtered={Object.keys(filters).length > 0} emptyText="아직 등록된 벼 재고가 없어요." />
                                </TableHead>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* --- MOBILE VIEW (Search First Strategy) --- */}
            <div className={`md:hidden flex flex-col min-h-[50vh] ${Object.keys(filters).length === 0 ? 'bg-transparent' : 'py-3 gap-3 bg-transparent'}`}>
                {Object.keys(filters).length === 0 ? null : initialGroups.length > 0 ? (
                    <GroupedStockMobileCards
                        groups={initialGroups}
                        loadedItems={loadedItems}
                        loadingGroups={loadingGroups}
                        fetchGroupItems={fetchGroupItems}
                        farmers={farmers}
                        varieties={varieties}
                        selectedIds={selectedIds}
                        onSelectOne={handleSelectOne}
                        onSelectionChange={onSelectionChange}
                        cartItemIds={cartItemIds}
                    />
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200">
                        <EmptyState filtered={Object.keys(filters).length > 0} emptyText="아직 등록된 벼 재고가 없어요." />
                    </div>
                )}
            </div>
        </section>
    )
}

function GroupedStockRows({
    groups,
    loadedItems,
    loadingGroups,
    fetchGroupItems,
    farmers,
    varieties,
    selectedIds,
    onSelectOne,
    onSelectionChange,
    cartItemIds
}: any) {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

    const toggleGroup = (group: StockGroup) => {
        const newSet = new Set(expandedGroups)
        if (newSet.has(group.key)) {
            newSet.delete(group.key)
        } else {
            newSet.add(group.key)
            // Lazy Load if needed
            if (!loadedItems[group.key]) {
                fetchGroupItems(group)
            }
        }
        setExpandedGroups(newSet)
    }

    // 미로드 그룹 체크 시: 로드 완료되면 자동으로 선택 (두 번 클릭 불필요)
    const [pendingSelect, setPendingSelect] = useState<Set<string>>(new Set())
    useEffect(() => {
        if (pendingSelect.size === 0) return
        const newSelected = new Set(selectedIds)
        const stillPending = new Set(pendingSelect)
        let changed = false
        pendingSelect.forEach((key: string) => {
            if (loadingGroups.has(key)) return        // 로딩 중 → 대기
            const loaded = loadedItems[key]
            if (loaded === undefined) return           // fetch 전 → 대기
            loaded
                .filter((s: any) => s.status === 'AVAILABLE' && !cartItemIds?.has(s.id))
                .forEach((s: any) => newSelected.add(s.id))
            stillPending.delete(key)
            changed = true
        })
        if (changed) {
            onSelectionChange(newSelected)
            setPendingSelect(stillPending)
        }
    }, [loadedItems, loadingGroups, pendingSelect, selectedIds, cartItemIds, onSelectionChange])

    return (
        <>
            {groups.map((group: StockGroup) => {
                const isExpanded = expandedGroups.has(group.key)
                const isLoading = loadingGroups.has(group.key)
                const items = loadedItems[group.key] || []

                // Group Selection Logic
                // If items NOT loaded, we don't know if they are selected.
                // WE MUST LOAD THEM TO SELECT THEM.
                // Exclude items already in cart from "available for selection"
                const availableItems = items.filter((s: any) => s.status === 'AVAILABLE' && !cartItemIds?.has(s.id))

                // Group is selected if ALL available items (not in cart) are selected
                // And there must be at least one available item
                const isGroupSelected = items.length > 0 && availableItems.length > 0 && availableItems.every((s: any) => selectedIds.has(s.id))

                const handleGroupSelect = async (checked: boolean) => {
                    const newSet = new Set(selectedIds)
                    availableItems.forEach((s: any) => {
                        if (checked) {
                            newSet.add(s.id)
                        } else {
                            newSet.delete(s.id)
                        }
                    })
                    onSelectionChange(newSet)
                }

                const onCheckboxClick = async (e: any) => {
                    e.stopPropagation()
                    if (items.length === 0) {
                        // 미로드: 펼치며 로드 시작 + 로드 완료 시 자동 선택 예약 (두 번 클릭 불필요)
                        toggleGroup(group)
                        setPendingSelect(prev => new Set(prev).add(group.key))
                        return
                    }
                    // If loaded, toggle selection
                    handleGroupSelect(!isGroupSelected)
                }

                return (
                    <Fragment key={group.key}>
                        {/* Summary Row */}
                        <TableRow
                            className={`${isExpanded
                                ? 'bg-slate-100 hover:bg-slate-200/70 border-t border-slate-200/80 border-b-0'
                                : 'bg-slate-50 hover:bg-slate-100 border-y border-slate-200/80'} cursor-pointer font-bold text-slate-800`}
                            onClick={() => toggleGroup(group)}
                        >
                            {/* Checkbox Column */}
                            <TableCell className="text-center">
                                {/* If loading, show spinner. Else checkbox. */}
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin mx-auto text-slate-500" />
                                ) : (
                                    <Checkbox
                                        checked={isGroupSelected}
                                        onCheckedChange={() => { }} // Handled by onClick wrapper
                                        onClick={onCheckboxClick}
                                        disabled={availableItems.length === 0 && items.length > 0} // Disabled if loaded but no available items
                                        className="border-slate-400 bg-white"
                                    />
                                )}
                            </TableCell>

                            {/* Year */}
                            <TableCell className="text-center hidden sm:table-cell">
                                <div className="flex items-center justify-center gap-1">
                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    {group.year}
                                </div>
                            </TableCell>

                            {/* Variety */}
                            <TableCell className="text-center truncate">{group.variety}</TableCell>

                            {/* Farmer Count */}
                            <TableCell className="text-center text-slate-600">
                                {group.farmerSetSize}명
                            </TableCell>

                            {/* Cert */}
                            <TableCell className="text-center font-medium hidden md:table-cell">
                                <Badge variant="outline" className="font-normal">
                                    {group.certType}
                                </Badge>
                            </TableCell>

                            <TableCell></TableCell>

                            {/* Bag Count */}
                            <TableCell className="text-right tabular-nums">
                                {group.count}개
                            </TableCell>

                            {/* Total Weight */}
                            <TableCell className="text-right font-semibold tabular-nums text-slate-900">
                                {group.totalWeight.toLocaleString()}
                            </TableCell>

                            <TableCell></TableCell>
                            <TableCell></TableCell>
                        </TableRow>

                        {/* Detailed Rows */}
                        {isExpanded && items.map((stock: any) => (
                            <StockTableRow
                                key={stock.id}
                                inExpandedGroup
                                stock={stock}
                                farmers={farmers}
                                varieties={varieties}
                                selected={selectedIds.has(stock.id)}
                                onSelect={(checked) => onSelectOne(stock.id, checked)}
                                hideCheckbox={isGroupSelected}
                                isInCart={cartItemIds?.has(stock.id)}
                            />
                        ))}
                        {/* Loading State for Expansion */}
                        {isExpanded && isLoading && items.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center">
                                    <div className="flex items-center justify-center gap-2 text-slate-500">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>데이터 불러오는 중...</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </Fragment>
                )
            })}
        </>
    )
}

function GroupedStockMobileCards({
    groups,
    loadedItems,
    loadingGroups,
    fetchGroupItems,
    farmers,
    varieties,
    selectedIds,
    onSelectOne,
    onSelectionChange,
    cartItemIds
}: any) {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

    const toggleGroup = (group: StockGroup) => {
        const newSet = new Set(expandedGroups)
        if (newSet.has(group.key)) {
            newSet.delete(group.key)
        } else {
            newSet.add(group.key)
            if (!loadedItems[group.key]) {
                fetchGroupItems(group)
            }
        }
        setExpandedGroups(newSet)
    }

    // 미로드 그룹 체크 시: 로드 완료되면 자동으로 선택 (두 번 클릭 불필요)
    const [pendingSelect, setPendingSelect] = useState<Set<string>>(new Set())
    useEffect(() => {
        if (pendingSelect.size === 0) return
        const newSelected = new Set(selectedIds)
        const stillPending = new Set(pendingSelect)
        let changed = false
        pendingSelect.forEach((key: string) => {
            if (loadingGroups.has(key)) return        // 로딩 중 → 대기
            const loaded = loadedItems[key]
            if (loaded === undefined) return           // fetch 전 → 대기
            loaded
                .filter((s: any) => s.status === 'AVAILABLE' && !cartItemIds?.has(s.id))
                .forEach((s: any) => newSelected.add(s.id))
            stillPending.delete(key)
            changed = true
        })
        if (changed) {
            onSelectionChange(newSelected)
            setPendingSelect(stillPending)
        }
    }, [loadedItems, loadingGroups, pendingSelect, selectedIds, cartItemIds, onSelectionChange])

    return (
        <>
            {groups.map((group: StockGroup) => {
                const isExpanded = expandedGroups.has(group.key)
                const isLoading = loadingGroups.has(group.key)
                const items = loadedItems[group.key] || []

                const availableItems = items.filter((s: any) => s.status === 'AVAILABLE' && !cartItemIds?.has(s.id))
                const isGroupSelected = items.length > 0 && availableItems.length > 0 && availableItems.every((s: any) => selectedIds.has(s.id))

                const handleGroupSelect = async (checked: boolean) => {
                    const newSet = new Set(selectedIds)
                    availableItems.forEach((s: any) => {
                        if (checked) {
                            newSet.add(s.id)
                        } else {
                            newSet.delete(s.id)
                        }
                    })
                    onSelectionChange(newSet)
                }

                const onCheckboxClick = async (e: any) => {
                    e.stopPropagation()
                    if (items.length === 0) {
                        // 미로드: 펼치며 로드 시작 + 로드 완료 시 자동 선택 예약 (두 번 클릭 불필요)
                        toggleGroup(group)
                        setPendingSelect(prev => new Set(prev).add(group.key))
                        return
                    }
                    handleGroupSelect(!isGroupSelected)
                }

                return (
                    <div key={group.key} className="flex flex-col gap-2">
                        {/* Summary Mobile Card */}
                        <div
                            className={`flex flex-col p-3 rounded-xl border border-slate-200 bg-white ${isExpanded ? 'shadow-md' : 'shadow-sm'} transition-shadow`}
                            onClick={() => toggleGroup(group)}
                        >
                            {/* FIRST ROW */}
                            <div className="flex items-center justify-between mb-1.5 gap-2">
                                <div className="flex items-center gap-2">
                                    <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center w-5 h-5 shrink-0">
                                        {isLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                                        ) : (
                                            <Checkbox
                                                checked={isGroupSelected}
                                                onCheckedChange={() => { }}
                                                onClick={onCheckboxClick}
                                                disabled={availableItems.length === 0 && items.length > 0}
                                                aria-label={`${group.variety} 전체 선택`}
                                                className="w-5 h-5 rounded-md border-slate-300"
                                            />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-[#2a2a2a] text-[15px] leading-none shrink-0">{group.variety}</span>
                                        <span className="text-[11px] text-slate-500 font-medium bg-white border border-slate-200 px-1 py-0.5 rounded shadow-sm leading-none shrink-0 whitespace-nowrap">
                                            {group.year}년
                                        </span>
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-emerald-200 text-emerald-600 bg-emerald-50 shrink-0 whitespace-nowrap leading-none rounded-sm">
                                            {group.certType}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="shrink-0 flex items-center justify-center">
                                    {isExpanded ? <ChevronDown className="text-slate-400 h-5 w-5" /> : <ChevronRight className="text-slate-400 h-5 w-5" />}
                                </div>
                            </div>

                            {/* SECOND ROW */}
                            <div className="flex items-end justify-between mt-1 pl-7">
                                <div className="text-[12px] text-slate-600 font-medium whitespace-nowrap">
                                    생산자 <span className="font-bold text-slate-800">{group.farmerSetSize}명</span>
                                </div>
                                <div className="flex items-baseline gap-2.5 text-right w-full justify-end">
                                    <div className="text-[11px] text-slate-500 whitespace-nowrap">
                                        톤백 <span className="font-bold text-slate-700">{group.count}개</span>
                                    </div>
                                    <div className="text-[17px] font-black text-slate-900 tracking-tight leading-none whitespace-nowrap">
                                        {group.totalWeight.toLocaleString()}<span className="text-[11px] font-bold ml-0.5 opacity-70">kg</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Mobile Cards (Sub-cards) */}
                        {isExpanded && (
                            <div className="flex flex-col gap-1.5 p-2 mx-1 mb-2 rounded-lg bg-slate-50/70">
                                {isLoading && items.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-6 text-slate-400 bg-white rounded-lg border border-slate-100 shadow-sm">
                                        <Loader2 className="h-5 w-5 animate-spin mb-2" />
                                        <span className="text-xs">데이터 로딩 중...</span>
                                    </div>
                                )}
                                {items.map((stock: any) => (
                                    <MobileStockDetailCard
                                        key={stock.id}
                                        stock={stock}
                                        farmers={farmers}
                                        varieties={varieties}
                                        selected={selectedIds.has(stock.id)}
                                        onSelect={(checked: boolean) => onSelectOne(stock.id, checked)}
                                        hideCheckbox={isGroupSelected}
                                        isInCart={cartItemIds?.has(stock.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )
            })}
        </>
    )
}

function MobileStockDetailCard({ stock, farmers, varieties, selected, onSelect, hideCheckbox, isInCart }: any) {
    const isCartBlocked = isInCart
    const isAvailable = stock.status === 'AVAILABLE'
    const [editOpen, setEditOpen] = useState(false)
    const { data: session } = useSession()
    // @ts-ignore
    const canManage = hasPermission(session?.user, 'SUPPLY_MANAGE')

    const handleDelete = async () => {
        if (await confirmDialog({ description: '정말 삭제하시겠습니까? (삭제 후 복구 불가)', destructive: true, confirmText: '삭제' })) {
            const result = await deleteStock(stock.id)
            if (!result.success) {
                toast.error('삭제에 실패했습니다.')
            } else {
                toast.success('삭제되었습니다.')
            }
        }
    }

    const handleCardClick = () => {
        if (!hideCheckbox && isAvailable && !isCartBlocked) {
            onSelect(!selected)
        }
    }

    const isConsumed = stock.status === 'CONSUMED'
    const lotText = stock.farmer.group?.certType === '일반' ? '관행' : (stock.lotNo || '-')

    return (
        <div
            className={`relative flex items-center gap-2 py-2 px-2.5 rounded-lg border ${selected ? 'border-primary bg-blue-50 ring-1 ring-primary/20' : isConsumed ? 'border-slate-200 bg-slate-50' : 'border-slate-200/80 bg-white'} ${!isAvailable || isCartBlocked ? '' : 'cursor-pointer'} shadow-sm transition-all`}
            onClick={handleCardClick}
        >
            <div className={`flex items-center gap-2 w-full ${!isAvailable || isCartBlocked ? 'opacity-60' : ''}`}>

                {/* 1) 체크박스 (시각 16px, hit-area 44px 확장) */}
                {!hideCheckbox && (
                    <div onClick={(e) => e.stopPropagation()} className="relative flex shrink-0 items-center justify-center">
                        <Checkbox
                            checked={selected}
                            onCheckedChange={(checked) => onSelect(checked as boolean)}
                            disabled={!isAvailable || isCartBlocked}
                            aria-label="개별 재고 선택"
                            className="w-4 h-4 rounded-sm border-slate-300"
                        />
                        <span aria-hidden className="absolute -inset-2.5" />
                    </div>
                )}

                {/* 2) 톤백번호 — 고정폭 우측정렬 컬럼 (목록 세로 정렬의 기준 · 시선 앵커) */}
                <span className="w-[34px] shrink-0 text-right font-mono font-black text-[14px] text-slate-900 tabular-nums leading-none">
                    <span className="text-[10px] font-bold text-slate-400">#</span>{stock.bagNo}
                </span>

                {/* 3) 생산자 + LOT (가변폭 2줄, 칩이 없어 폭 여유 확보) */}
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-[12.5px] text-slate-800 leading-tight truncate">
                        {stock.farmer.name}{stock.actualFarmer ? ` (${stock.actualFarmer})` : ''}
                    </div>
                    <div className="font-mono text-[10px] text-slate-400 leading-tight truncate mt-0.5">
                        {lotText}
                    </div>
                </div>

                {/* 4) 무게 — 고정폭 우측정렬 컬럼 (톤백번호와 짝) */}
                <span className="w-[52px] shrink-0 text-right font-mono font-bold text-[13px] text-slate-700 tabular-nums leading-none">
                    {stock.weightKg.toLocaleString()}<span className="text-[9px] font-bold text-slate-400 ml-px">kg</span>
                </span>

                {/* 5) 상태칩 없음 — 보관/소진은 카드 배경(bg-slate-50)+흐림(opacity-60)으로 구분 */}

                {/* 6) 점세개 관리메뉴 — 현행 그대로 (hit-area 44px 확장 유지) */}
                {canManage && (
                    <div onClick={(e) => e.stopPropagation()} className="shrink-0 -mr-1.5">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600 relative">
                                    <span aria-hidden className="absolute -inset-2.5" />
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[120px]">
                                <DropdownMenuItem onClick={() => setEditOpen(true)} className="gap-2 cursor-pointer">
                                    <Edit className="h-4 w-4 text-slate-500" />
                                    <span>수정</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={handleDelete}
                                    disabled={stock.status === 'CONSUMED'}
                                    className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    <span>삭제</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </div>

            <EditStockDialog
                stock={stock}
                open={editOpen}
                onOpenChange={setEditOpen}
                farmers={farmers}
                varieties={varieties}
                trigger={null}
            />
        </div>
    )
}
