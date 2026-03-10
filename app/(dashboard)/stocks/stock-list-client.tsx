'use client'

import { useState, useMemo, Fragment } from 'react'
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
        <section className={`overflow-hidden md:bg-white md:rounded-xl md:shadow-sm md:border md:border-slate-200 \${Object.keys(filters).length === 0 ? 'bg-transparent' : 'bg-white'}`}>
            {/* --- DESKTOP VIEW --- */}
            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b border-slate-200">
                            <TableHead className="w-[40px] py-2 px-1 text-center">
                                {/* Global Select All Removed */}
                            </TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[40px] hidden sm:table-cell">년도</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[90px]">품종</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[60px]">생산자</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[40px] hidden md:table-cell">인증</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[110px]">Lot No</TableHead>
                            <TableHead className="py-2 px-1 text-right text-xs font-bold text-slate-500 w-[50px]">톤백</TableHead>
                            <TableHead className="py-2 px-1 text-right text-xs font-bold text-slate-500 w-[80px]">중량(kg)</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[50px]">상태</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[40px]">수정</TableHead>
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
                                <TableHead colSpan={10} className="h-32 text-center text-xs text-slate-400 font-medium">
                                    {Object.keys(filters).length > 0 ? '검색 결과가 없습니다.' : '등록된 재고가 없습니다.'}
                                </TableHead>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* --- MOBILE VIEW (Search First Strategy) --- */}
            <div className={`md:hidden flex flex-col min-h-[50vh] \${Object.keys(filters).length === 0 ? 'bg-transparent' : 'py-3 gap-3 bg-transparent'}`}>
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
                    <div className="text-center text-sm text-slate-400 py-10 bg-white rounded-xl border border-slate-200">
                        검색 결과가 없습니다.
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

                // IMPROVED Selection Logic to handle "Not Loaded"
                // If not loaded, we can't select.
                // Let's auto-expand when clicking checkbox if not loaded?
                const onCheckboxClick = async (e: any) => {
                    e.stopPropagation()
                    if (items.length === 0) {
                        // Trigger load
                        toggleGroup(group)
                        // This expands and loads. 
                        // User has to click again to select.
                        return
                    }
                    // If loaded, toggle selection
                    handleGroupSelect(!isGroupSelected)
                }

                return (
                    <Fragment key={group.key}>
                        {/* Summary Row */}
                        <TableRow
                            className="bg-[#00a2e8]/[0.04] hover:bg-[#00a2e8]/[0.08] cursor-pointer border-y border-[#00a2e8]/20 font-bold text-slate-800 shadow-sm h-12"
                            onClick={() => toggleGroup(group)}
                        >
                            {/* Checkbox Column */}
                            <TableCell className="w-[40px] text-center">
                                {/* If loading, show spinner. Else checkbox. */}
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin mx-auto text-slate-500" />
                                ) : (
                                    <Checkbox
                                        checked={isGroupSelected}
                                        onCheckedChange={() => { }} // Handled by onClick wrapper
                                        onClick={onCheckboxClick}
                                        disabled={availableItems.length === 0 && items.length > 0} // Disabled if loaded but no available items
                                        className="border-slate-400 bg-white data-[state=checked]:bg-[#00a2e8] data-[state=checked]:border-[#00a2e8]"
                                    />
                                )}
                            </TableCell>

                            {/* Year */}
                            <TableCell className="text-center text-sm hidden sm:table-cell">
                                <div className="flex items-center justify-center gap-1">
                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    {group.year}
                                </div>
                            </TableCell>

                            {/* Variety */}
                            <TableCell className="text-center text-sm">{group.variety}</TableCell>

                            {/* Farmer Count */}
                            <TableCell className="text-center text-sm text-slate-600">
                                {group.farmerSetSize}명
                            </TableCell>

                            {/* Cert */}
                            <TableCell className="text-center text-sm font-medium hidden md:table-cell">
                                <Badge variant="outline" className="font-normal">
                                    {group.certType}
                                </Badge>
                            </TableCell>

                            <TableCell></TableCell>

                            {/* Bag Count */}
                            <TableCell className="text-right text-sm">
                                {group.count}개
                            </TableCell>

                            {/* Total Weight */}
                            <TableCell className="text-right text-sm text-[#008cc9]">
                                {group.totalWeight.toLocaleString()}
                            </TableCell>

                            <TableCell></TableCell>
                            <TableCell></TableCell>
                        </TableRow>

                        {/* Detailed Rows */}
                        {isExpanded && items.map((stock: any) => (
                            <StockTableRow
                                key={stock.id}
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
                        toggleGroup(group)
                        return
                    }
                    handleGroupSelect(!isGroupSelected)
                }

                return (
                    <div key={group.key} className="flex flex-col gap-2">
                        {/* Summary Mobile Card */}
                        <div
                            className={`flex flex-col p-3 rounded-xl border ${isExpanded ? 'border-blue-300 bg-[#00a2e8]/[0.08] shadow-md' : 'border-slate-200 bg-[#00a2e8]/[0.04] shadow-sm'} transition-colors`}
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
                                                className="w-5 h-5 rounded-md border-slate-300 data-[state=checked]:bg-[#00a2e8] data-[state=checked]:border-[#00a2e8]"
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
                                    <div className="text-[17px] font-black text-[#008cc9] tracking-tight leading-none whitespace-nowrap">
                                        {group.totalWeight.toLocaleString()}<span className="text-[11px] font-bold ml-0.5 opacity-70">kg</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Mobile Cards (Sub-cards) */}
                        {isExpanded && (
                            <div className="flex flex-col gap-1.5 pl-3 border-l-4 border-blue-200 ml-4 mr-1 mb-2 relative">
                                {/* Ensure the line container itself has no background that bleeds */}
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
    const canManage = hasPermission(session?.user, 'STOCK_MANAGE')

    const handleDelete = async () => {
        if (confirm('정말 삭제하시겠습니까? (삭제 후 복구 불가)')) {
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

    return (
        <div
            className={`relative py-2 px-2.5 rounded-lg border ${selected ? 'border-[#00a2e8] bg-[#f0f9ff] ring-1 ring-[#00a2e8]/20' : isConsumed ? 'border-slate-200 bg-slate-50' : 'border-slate-200/80 bg-white'} ${!isAvailable || isCartBlocked ? '' : 'cursor-pointer'} shadow-sm transition-all`}
            onClick={handleCardClick}
        >
            <div className={`${!isAvailable || isCartBlocked ? 'opacity-60' : ''}`}>
                <div className="flex justify-between items-center mb-0.5 gap-1">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {!hideCheckbox && (
                            <div onClick={(e) => e.stopPropagation()} className="flex shrink-0 items-center justify-center">
                                <Checkbox
                                    checked={selected}
                                    onCheckedChange={(checked) => onSelect(checked as boolean)}
                                    disabled={!isAvailable || isCartBlocked}
                                    aria-label="개별 재고 선택"
                                    className="w-4 h-4 rounded-sm border-slate-300 data-[state=checked]:bg-[#00a2e8] data-[state=checked]:border-[#00a2e8]"
                                />
                            </div>
                        )}
                        <span className="font-bold text-[13px] text-slate-800 leading-tight shrink-0">
                            {stock.farmer.name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 leading-tight truncate min-w-0">
                            ({stock.lotNo || '-'})
                        </span>
                    </div>

                    <div className="flex gap-1.5 items-center shrink-0">
                        <Badge variant={stock.status === 'AVAILABLE' ? 'outline' : 'secondary'} className={`text-[10px] h-5 px-1.5 rounded-sm whitespace-nowrap ${stock.status === 'AVAILABLE' ? 'border-[#00a2e8]/40 text-[#008cc9] bg-[#00a2e8]/10' : ''}`}>
                            {stock.status === 'AVAILABLE' ? '보관중' : stock.status === 'IN_PRODUCTION' ? '투입됨' : '소진됨'}
                        </Badge>
                        {canManage && (
                            <div onClick={(e) => e.stopPropagation()} className="shrink-0 -mr-1.5">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600">
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
                </div>

                <div className="flex justify-between items-center pl-6">
                    <div className="text-[11px] text-slate-400 font-medium">
                        #<span className="font-mono text-slate-600">{stock.bagNo}</span>
                    </div>
                    <div className="font-black text-[14px] text-slate-800 tracking-tight leading-none">
                        {stock.weightKg.toLocaleString()}<span className="text-[10px] font-bold ml-0.5 opacity-60">kg</span>
                    </div>
                </div>
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
