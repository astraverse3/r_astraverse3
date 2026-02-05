'use client'

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { StockTableRow } from './stock-table-row'
import { useBulkDeleteStocks } from './use-bulk-delete-stocks'
import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
    TableCell,
} from '@/components/ui/table'

interface Stock {
    id: number
    productionYear: number
    bagNo: number
    weightKg: number
    status: string
    incomingDate: Date
    createdAt: Date
    updatedAt: Date
    lotNo: string | null
    variety: {
        name: string
    }
    farmer: {
        name: string
        group: {
            certType: string
            name: string
        }
    }
}

interface StockListClientProps {
    stocks: Stock[]
    farmers: any[]
    varieties: any[]
    filters: any
    selectedIds: Set<number>
    onSelectionChange: (ids: Set<number>) => void
}

export function StockListClient({ stocks, farmers, varieties, filters, selectedIds, onSelectionChange }: StockListClientProps) {

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            onSelectionChange(new Set(stocks.map(s => s.id)))
        } else {
            onSelectionChange(new Set())
        }
    }

    const handleSelectOne = (id: number, checked: boolean) => {
        const newSet = new Set(selectedIds)
        if (checked) {
            newSet.add(id)
        } else {
            newSet.delete(id)
        }
        onSelectionChange(newSet)
    }

    return (
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50 border-b border-slate-200">
                        <TableHead className="w-[40px] py-2 px-1 text-center">
                            <Checkbox
                                checked={selectedIds.size === stocks.length && stocks.length > 0}
                                onCheckedChange={handleSelectAll}
                            />
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
                    {stocks.length > 0 ? (
                        <GroupedStockRows
                            stocks={stocks}
                            farmers={farmers}
                            varieties={varieties}
                            selectedIds={selectedIds}
                            onSelectOne={handleSelectOne}
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

import { ChevronRight, ChevronDown } from 'lucide-react'
import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'

function GroupedStockRows({ stocks, farmers, varieties, selectedIds, onSelectOne }: any) {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

    const toggleGroup = (key: string) => {
        const newSet = new Set(expandedGroups)
        if (newSet.has(key)) {
            newSet.delete(key)
        } else {
            newSet.add(key)
        }
        setExpandedGroups(newSet)
    }

    // Grouping Logic
    const groups = useMemo(() => {
        const grouped: Record<string, {
            key: string,
            year: number,
            variety: string,
            totalWeight: number,
            count: number,
            farmerSet: Set<number>,
            items: any[]
        }> = {}

        stocks.forEach((stock: any) => {
            const key = `${stock.productionYear}-${stock.variety.name}`
            if (!grouped[key]) {
                grouped[key] = {
                    key,
                    year: stock.productionYear,
                    variety: stock.variety.name,
                    totalWeight: 0,
                    count: 0,
                    farmerSet: new Set(),
                    items: []
                }
            }
            grouped[key].items.push(stock)
            grouped[key].totalWeight += stock.weightKg
            grouped[key].count += 1
            grouped[key].farmerSet.add(stock.farmer.id)
        })

        // Sort groups (Year Desc, Variety Asc)
        return Object.values(grouped).sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year
            return a.variety.localeCompare(b.variety, 'ko')
        })
    }, [stocks])

    return (
        <>
            {groups.map(group => {
                const isExpanded = expandedGroups.has(group.key)

                return (
                    <div key={group.key} style={{ display: 'contents' }}>
                        {/* Summary Row (Aligned with columns) */}
                        <TableRow
                            className="bg-slate-200 hover:bg-slate-300 cursor-pointer border-y border-slate-300 font-bold text-slate-900 shadow-sm h-12"
                            onClick={() => toggleGroup(group.key)}
                        >
                            {/* Checkbox Column - Empty for Group */}
                            <TableCell className="w-[40px] text-center"></TableCell>

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
                                {group.farmerSet.size}명
                            </TableCell>

                            {/* Cert - Empty */}
                            <TableCell className="hidden md:table-cell"></TableCell>

                            {/* Lot No - Empty */}
                            <TableCell></TableCell>

                            {/* Bag Count (Tonbag) */}
                            <TableCell className="text-right text-sm">
                                {group.count}개
                            </TableCell>

                            {/* Total Weight */}
                            <TableCell className="text-right text-sm text-blue-700">
                                {group.totalWeight.toLocaleString()}
                            </TableCell>

                            {/* Status - Empty */}
                            <TableCell></TableCell>

                            {/* Edit (Chevron for Mobile maybe? or Empty) */}
                            <TableCell></TableCell>
                        </TableRow>

                        {/* Detailed Rows (Collapsible) */}
                        {isExpanded && group.items.map((stock: any) => (
                            <StockTableRow
                                key={stock.id}
                                stock={stock}
                                farmers={farmers}
                                varieties={varieties}
                                selected={selectedIds.has(stock.id)}
                                onSelect={(checked) => onSelectOne(stock.id, checked)}
                            />
                        ))}
                    </div>
                )
            })}
        </>
    )
}
