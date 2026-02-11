'use client'

import { useState, useMemo, Fragment } from 'react'
import { ChevronRight, ChevronDown, Loader2 } from 'lucide-react'
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
import { getStocksByGroup, StockGroup } from '@/app/actions/stock'
import { Badge } from '@/components/ui/badge'

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
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">


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
                            className="bg-slate-200 hover:bg-slate-300 cursor-pointer border-y border-slate-300 font-bold text-slate-900 shadow-sm h-12"
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
                                        className="border-slate-400 bg-white data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
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
                            <TableCell className="text-right text-sm text-blue-700">
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
