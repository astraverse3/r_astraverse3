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
}

export function StockListClient({ stocks, farmers, varieties, filters }: StockListClientProps) {
    const { selectedIds, setSelectedIds, showDeleteDialog, DeleteDialog } = useBulkDeleteStocks()

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(stocks.map(s => s.id)))
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

    return (
        <>
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 px-1">
                    <Button
                        variant={selectedIds.size > 0 ? "destructive" : "outline"}
                        size="sm"
                        onClick={showDeleteDialog}
                        disabled={selectedIds.size === 0}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        선택 삭제 {selectedIds.size > 0 && `(${selectedIds.size})`}
                    </Button>
                </div>
            )}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">\n                <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-slate-50">
                        <TableHead className="w-[40px]">
                            <Checkbox
                                checked={selectedIds.size === stocks.length && stocks.length > 0}
                                onCheckedChange={handleSelectAll}
                            />
                        </TableHead>
                        <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[40px] hidden sm:table-cell">년도</TableHead>
                        <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[70px]">품종</TableHead>
                        <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[60px]">생산자</TableHead>
                        <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[40px] hidden md:table-cell">인증</TableHead>
                        <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[140px]">Lot No</TableHead>
                        <TableHead className="py-2 px-1 text-right text-xs font-bold text-slate-500 w-[40px]">톤백</TableHead>
                        <TableHead className="py-2 px-1 text-right text-xs font-bold text-slate-500 w-[60px]">중량</TableHead>
                        <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[50px]">상태</TableHead>
                        <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[40px]">수정</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {stocks.length > 0 ? (
                        stocks.map((stock: Stock) => (
                            <StockTableRow
                                key={stock.id}
                                stock={stock}
                                farmers={farmers}
                                varieties={varieties}
                                selected={selectedIds.has(stock.id)}
                                onSelect={(checked) => handleSelectOne(stock.id, checked)}
                            />
                        ))
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
            <DeleteDialog />
        </>
    )
}
