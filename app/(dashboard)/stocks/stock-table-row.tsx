'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { MoreHorizontal, Edit, Trash2, AlertCircle } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { EditStockDialog } from './edit-stock-dialog'
import { deleteStock } from '@/app/actions/stock'
import { TableCell, TableRow } from '@/components/ui/table'

interface Stock {
    id: number
    productionYear: number
    bagNo: number
    farmerName: string
    variety: string
    certType: string
    weightKg: number
    status: string
    createdAt: Date
    updatedAt: Date
}

interface Props {
    stock: Stock
}

export function StockTableRow({ stock }: Props) {
    const [editOpen, setEditOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation() // Prevent row click

        // Confirmation Logic
        let message = `[${stock.farmerName}/${stock.variety}] 정보를 삭제하시겠습니까?`
        if (stock.status === 'CONSUMED') {
            message = `[${stock.farmerName}/${stock.variety}]는 이미 도정 작업에 사용되었습니다. 삭제 시 데이터 불일치가 발생할 수 있습니다. 그래도 삭제하시겠습니까?`
        }

        if (!confirm(message)) return

        setIsDeleting(true)
        const result = await deleteStock(stock.id)
        setIsDeleting(false)

        if (!result.success) {
            alert('삭제 실패: ' + result.error)
        }
    }

    return (
        <>
            <TableRow
                className="group hover:bg-blue-50/50 cursor-pointer transition-colors border-b border-slate-100 last:border-0"
                onClick={() => setEditOpen(true)}
            >
                {/* 1. Year */}
                <TableCell className="py-2 px-2 text-center text-xs font-medium text-slate-500 w-[60px]">
                    {stock.productionYear.toString().slice(-2)}년
                </TableCell>

                {/* 2. Variety */}
                <TableCell className="py-2 px-2 text-xs font-bold text-slate-800">
                    {stock.variety}
                </TableCell>

                {/* 3. Farmer */}
                <TableCell className="py-2 px-2 text-xs text-slate-600">
                    {stock.farmerName}
                </TableCell>

                {/* 4. Cert */}
                <TableCell className="py-2 px-2 text-center">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${stock.certType === '유기농' ? 'text-green-600 border-green-200 bg-green-50' :
                            stock.certType === '무농약' ? 'text-blue-600 border-blue-200 bg-blue-50' :
                                'text-slate-500 border-slate-200 bg-slate-50'
                        }`}>
                        {stock.certType}
                    </span>
                </TableCell>

                {/* 5. Bag No */}
                <TableCell className="py-2 px-2 text-right text-xs font-mono text-slate-400">
                    #{stock.bagNo}
                </TableCell>

                {/* 6. Weight */}
                <TableCell className="py-2 px-2 text-right text-xs font-bold text-slate-900">
                    {stock.weightKg.toLocaleString()}
                </TableCell>

                {/* 7. Status */}
                <TableCell className="py-2 px-2 text-center">
                    {stock.status === 'AVAILABLE' ? (
                        <div className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-blue-500 ring-2 ring-blue-100" title="보관중" />
                    ) : (
                        <div className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-slate-200" title="사용완료" />
                    )}
                </TableCell>

                {/* 8. Actions (Hidden by default, shown on hover or menu click) */}
                <TableCell className="py-2 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300 hover:text-slate-600">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel className="text-xs">관리 메뉴</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setEditOpen(true)} className="gap-2 text-xs">
                                <Edit className="h-3.5 w-3.5" />
                                정보 수정
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={handleDelete}
                                className="gap-2 text-xs text-red-600 focus:text-red-700 focus:bg-red-50"
                                disabled={isDeleting}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                삭제
                            </DropdownMenuItem>
                            {stock.status === 'CONSUMED' && (
                                <div className="p-2 text-[10px] text-slate-400 bg-slate-50 border-t border-slate-100">
                                    <div className="flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        이미 도정에 사용됨
                                    </div>
                                </div>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
            </TableRow>

            {/* Controlled Edit Dialog (Hidden Trigger) */}
            <EditStockDialog
                stock={stock}
                open={editOpen}
                onOpenChange={setEditOpen}
                trigger={<></>}
            />
        </>
    )
}
