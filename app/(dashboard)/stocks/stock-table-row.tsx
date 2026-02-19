'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
import { toast } from 'sonner'
import { EditStockDialog } from './edit-stock-dialog'
import { deleteStock } from '@/app/actions/stock'
import { TableCell, TableRow } from '@/components/ui/table'
import { Stock } from './page' // Import Stock interface from page

interface Props {
    stock: any
    farmers: any[]
    varieties: any[]
    selected: boolean
    onSelect: (checked: boolean) => void

    hideCheckbox?: boolean
    isInCart?: boolean
}

export function StockTableRow({ stock, farmers, varieties, selected, onSelect, hideCheckbox, isInCart }: Props) {
    const [editOpen, setEditOpen] = useState(false)
    const isAvailable = stock.status === 'AVAILABLE' && !isInCart

    // Helper to get nested values safely
    const varietyName = stock.variety?.name || 'Unknown'
    const farmerName = stock.farmer?.name || 'Unknown'
    const certType = stock.farmer?.group?.certType || '일반'

    const handleDelete = async () => {
        if (confirm('정말 삭제하시겠습니까? (삭제 후 복구 불가)')) {
            const result = await deleteStock(stock.id)
            if (!result.success) {
                toast.error('삭제에 실패했습니다.')
            }
        }
    }

    return (
        <>
            <TableRow
                className={`group transition-all duration-300 ease-in-out border-b border-slate-100 last:border-0 text-xs 
                    ${isAvailable ? 'cursor-pointer hover:bg-blue-50' : 'opacity-60 bg-slate-50'}
                    ${selected ? 'bg-gradient-to-r from-blue-50 via-blue-50/50 to-white border-blue-100 shadow-sm' : ''}
                    ${isInCart ? 'bg-slate-50 opacity-50 cursor-not-allowed' : ''}
                `}
                onClick={() => isAvailable && onSelect(!selected)}
            >
                {/* Checkbox */}
                <TableCell className="py-2 px-1 w-[40px] text-center">
                    {!hideCheckbox && (
                        <Checkbox
                            checked={selected}
                            onCheckedChange={onSelect}
                            disabled={!isAvailable}
                        />
                    )}
                </TableCell>

                {/* 1. Year */}
                <TableCell className="py-2 px-1 text-center text-xs font-medium text-slate-500 hidden sm:table-cell">
                    {stock.productionYear.toString().slice(-2)}
                </TableCell>

                {/* 2. Variety */}
                <TableCell className="py-2 px-1 text-center text-xs font-bold text-slate-800">
                    <div className="truncate max-w-[70px] mx-auto" title={varietyName}>
                        {varietyName}
                    </div>
                </TableCell>

                {/* 3. Farmer */}
                <TableCell className="py-2 px-1 text-center text-xs text-slate-600">
                    <div className="truncate max-w-[60px] mx-auto" title={farmerName}>
                        {farmerName}
                    </div>
                </TableCell>

                {/* 4. Cert */}
                <TableCell className="py-2 px-1 text-center hidden md:table-cell">
                    <span className={`text-[10px] font-bold px-1 py-0.5 rounded-md border ${certType === '유기농' ? 'text-green-600 border-green-200 bg-green-50' :
                        certType === '무농약' ? 'text-blue-600 border-blue-200 bg-blue-50' :
                            'text-slate-500 border-slate-200 bg-slate-50'
                        }`}>
                        {certType === '유기농' ? '유기' : certType === '무농약' ? '무농' : '일반'}
                    </span>
                </TableCell>

                {/* 5. Lot No */}
                <TableCell className="py-2 px-1 text-center">
                    {(certType === '유기농' || certType === '무농약') && (
                        <div className="text-xs text-slate-500 font-mono tracking-tighter mx-auto" title={stock.lotNo || 'Not Generated'}>
                            {stock.lotNo || '-'}
                        </div>
                    )}
                </TableCell>

                {/* 6. Bag No */}
                <TableCell className="py-2 px-1 text-right text-xs font-mono text-slate-400">
                    <span className="text-[10px]">#</span>{stock.bagNo}
                    {isInCart && <span className="ml-1 text-[10px] text-blue-500 font-bold">(담김)</span>}
                </TableCell>

                {/* 7. Weight */}
                <TableCell className="py-2 px-2 text-right text-xs font-bold text-slate-900">
                    {stock.weightKg.toLocaleString()}
                </TableCell>

                {/* 8. Status */}
                <TableCell className="py-2 px-1 text-center">
                    {stock.status === 'AVAILABLE' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            보유
                        </span>
                    ) : stock.status === 'RELEASED' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            출고
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                            소진
                        </span>
                    )}
                </TableCell>

                {/* 9. Management */}
                <TableCell className="py-2 px-1 text-center">
                    <div className="flex items-center justify-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                                e.stopPropagation()
                                setEditOpen(true)
                            }}
                            title="수정"
                        >
                            <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={(e) => {
                                e.stopPropagation()
                                handleDelete()
                            }}
                            disabled={stock.status === 'CONSUMED'}
                            title={stock.status === 'CONSUMED' ? '도정 완료된 재고는 삭제할 수 없습니다' : '삭제'}
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                </TableCell>
            </TableRow>

            {/* Controlled Edit Dialog (Hidden Trigger by default) */}
            <EditStockDialog
                stock={stock}
                open={editOpen}
                onOpenChange={setEditOpen}
                farmers={farmers}
                varieties={varieties}
                trigger={null}
            />
        </>
    )
}
