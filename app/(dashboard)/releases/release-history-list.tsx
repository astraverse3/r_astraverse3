'use client'

import { useState, useMemo } from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronRight, ChevronDown, Trash2, Edit, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { deleteStockReleases, removeStockFromRelease } from '@/app/actions/release'
import { EditReleaseDialog } from './edit-release-dialog'
import { triggerDataUpdate } from '@/components/last-updated'
import { toast } from 'sonner'

interface Stock {
    id: number
    productionYear: number
    bagNo: number
    weightKg: number
    variety: { name: string }
    farmer: { name: string; group?: { name: string } | null }
}

interface ReleaseLog {
    id: number
    date: Date
    destination: string
    purpose: string | null
    stocks: Stock[]
}

export function ReleaseHistoryList({ initialLogs, filtersSlot }: { initialLogs: any[], filtersSlot?: React.ReactNode }) {
    const logs = initialLogs as ReleaseLog[]
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [editRelease, setEditRelease] = useState<ReleaseLog | null>(null)

    const toggleExpand = (id: number) => {
        const newSet = new Set(expandedIds)
        if (newSet.has(id)) {
            newSet.delete(id)
        } else {
            newSet.add(id)
        }
        setExpandedIds(newSet)
    }

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(logs.map(log => log.id)))
        } else {
            setSelectedIds(new Set())
        }
    }

    const handleSelectOne = (id: number, checked: boolean) => {
        const newSet = new Set(selectedIds)
        if (checked) {
            newSet.add(id)
        } else {
            newSet.delete(id)
        }
        setSelectedIds(newSet)
    }

    const handleBulkCancel = async () => {
        if (selectedIds.size === 0) return
        if (!confirm(`선택한 ${selectedIds.size}건의 출고를 취소하시겠습니까? (포함된 재고는 다시 입고됩니다)`)) return

        try {
            const result = await deleteStockReleases(Array.from(selectedIds))
            if (result.success) {
                toast.success('출고가 취소되었습니다.')
                triggerDataUpdate()
                setSelectedIds(new Set())
            } else {
                toast.error(result.error || '출고 취소 실패')
            }
        } catch (error) {
            toast.error('오류가 발생했습니다.')
        }
    }

    const handleIndividualCancel = async (id: number) => {
        if (!confirm('이 출고 내역을 취소하시겠습니까? (포함된 재고는 다시 입고됩니다)')) return
        try {
            const result = await deleteStockReleases([id])
            if (result.success) {
                toast.success('출고가 취소되었습니다.')
                triggerDataUpdate()
            } else {
                toast.error(result.error || '출고 취소 실패')
            }
        } catch (error) {
            toast.error('오류가 발생했습니다.')
        }
    }

    const handleRemoveStock = async (stockId: number) => {
        if (!confirm('이 항목(톤백)을 출고 내역에서 제외하시겠습니까? (해당 재고만 다시 입고됩니다)')) return
        try {
            const result = await removeStockFromRelease(stockId)
            if (result.success) {
                toast.success('항목이 제외되었습니다.')
                triggerDataUpdate()
            } else {
                toast.error(result.error || '항목 제외 실패')
            }
        } catch (error) {
            toast.error('오류가 발생했습니다.')
        }
    }

    return (
        <div className="grid grid-cols-1 gap-1">
            {/* Action Bar (Top Section matching StockPageClient) */}
            <section className="flex flex-col gap-2 pt-2 px-1">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        {selectedIds.size > 0 ? (
                            <Button
                                variant="destructive"
                                size="sm"
                                className="bg-red-600 hover:bg-red-700"
                                onClick={handleBulkCancel}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                출고취소 ({selectedIds.size})
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="text-slate-400"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                출고취소
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {filtersSlot}
                    </div>
                </div>
            </section>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b border-slate-200">
                            <TableHead className="w-[40px] text-center">
                                <Checkbox
                                    checked={selectedIds.size === logs.length && logs.length > 0}
                                    onCheckedChange={handleSelectAll}
                                />
                            </TableHead>
                            <TableHead className="w-[40px] text-center"></TableHead>
                            <TableHead className="py-2 text-xs font-bold text-slate-500 w-[110px] text-center">출고일자</TableHead>
                            <TableHead className="py-2 text-xs font-bold text-slate-500">출고처</TableHead>
                            <TableHead className="py-2 text-xs font-bold text-slate-500">비고</TableHead>
                            <TableHead className="py-2 text-xs font-bold text-slate-500 w-[80px] text-right">수량</TableHead>
                            <TableHead className="py-2 text-xs font-bold text-slate-500 w-[110px] text-right">총 중량</TableHead>
                            <TableHead className="py-2 text-xs font-bold text-slate-500 w-[60px] text-center">수정</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-40 text-center text-slate-400 font-medium italic">
                                    출고 내역이 없습니다.
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => {
                                const isExpanded = expandedIds.has(log.id)
                                const totalWeight = log.stocks.reduce((sum, s) => sum + s.weightKg, 0)
                                const isSelected = selectedIds.has(log.id)

                                return (
                                    <Fragment key={log.id}>
                                        <TableRow
                                            className={cn(
                                                "cursor-pointer group transition-colors",
                                                isSelected ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-slate-50",
                                                isExpanded && "border-b-0"
                                            )}
                                        >
                                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={(checked) => handleSelectOne(log.id, !!checked)}
                                                />
                                            </TableCell>
                                            <TableCell className="text-center" onClick={() => toggleExpand(log.id)}>
                                                {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                                            </TableCell>
                                            <TableCell className="text-center font-medium text-sm text-slate-700" onClick={() => toggleExpand(log.id)}>
                                                {format(new Date(log.date), 'yyyy-MM-dd')}
                                            </TableCell>
                                            <TableCell className="font-bold text-sm text-slate-900" onClick={() => toggleExpand(log.id)}>
                                                {log.destination}
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-500 truncate max-w-[200px]" onClick={() => toggleExpand(log.id)}>
                                                {log.purpose || '-'}
                                            </TableCell>
                                            <TableCell className="text-right" onClick={() => toggleExpand(log.id)}>
                                                <Badge variant="outline" className="font-medium bg-slate-50 text-slate-600 border-slate-200">
                                                    {log.stocks.length}개
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-sm font-bold text-blue-600" onClick={() => toggleExpand(log.id)}>
                                                {totalWeight.toLocaleString()} kg
                                            </TableCell>
                                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                    onClick={() => setEditRelease(log)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <TableRow className={cn(
                                                "transition-colors",
                                                isSelected ? "bg-blue-50/50 hover:bg-blue-100/50" : "bg-slate-50 hover:bg-slate-100/50"
                                            )}>
                                                <TableCell colSpan={8} className="p-0 border-t border-slate-100">
                                                    <div className="p-4 pl-16 pb-6">
                                                        <div className="flex items-center justify-between mb-3 px-1">
                                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">상세 톤백 내역</p>
                                                        </div>
                                                        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow className="bg-slate-50 h-9">
                                                                        <TableHead className="text-[11px] font-bold text-slate-500 w-[60px] text-center">년도</TableHead>
                                                                        <TableHead className="text-[11px] font-bold text-slate-500 w-[100px]">품종</TableHead>
                                                                        <TableHead className="text-[11px] font-bold text-slate-500">생산자 (작목반)</TableHead>
                                                                        <TableHead className="text-[11px] font-bold text-slate-500 w-[80px] text-center">톤백번호</TableHead>
                                                                        <TableHead className="text-[11px] font-bold text-slate-500 w-[100px] text-right">중량(kg)</TableHead>
                                                                        <TableHead className="text-[11px] font-bold text-slate-500 w-[60px] text-center">취소</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {log.stocks.map((stock) => (
                                                                        <TableRow key={stock.id} className="hover:bg-slate-50 group/row h-10 border-slate-100">
                                                                            <TableCell className="py-1 text-xs text-center text-slate-500 font-mono">{stock.productionYear}</TableCell>
                                                                            <TableCell className="py-1 text-xs font-bold text-slate-800">{stock.variety.name}</TableCell>
                                                                            <TableCell className="py-1 text-xs text-slate-700">
                                                                                <span className="font-medium">{stock.farmer.name}</span>
                                                                                <span className="text-slate-400 ml-1.5 text-[10px]">
                                                                                    {stock.farmer.group?.name || '작목반 없음'}
                                                                                </span>
                                                                            </TableCell>
                                                                            <TableCell className="py-1 text-xs text-center font-bold text-slate-700">{stock.bagNo}번</TableCell>
                                                                            <TableCell className="py-1 text-xs text-right font-mono font-bold text-slate-600">{stock.weightKg.toLocaleString()}</TableCell>
                                                                            <TableCell className="py-1 text-center">
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-7 w-7 text-slate-300 hover:text-red-500 hover:bg-red-50"
                                                                                    onClick={() => handleRemoveStock(stock.id)}
                                                                                >
                                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </Fragment>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            <EditReleaseDialog
                release={editRelease}
                open={!!editRelease}
                onOpenChange={(open) => !open && setEditRelease(null)}
            />
        </div>
    )
}

import { Fragment } from 'react'
import { cn } from '@/lib/utils'
