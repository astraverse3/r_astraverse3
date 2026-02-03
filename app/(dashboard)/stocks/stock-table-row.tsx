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
import { Stock } from './page' // Import Stock interface from page

interface Props {
    stock: Stock
    farmers: { id: number; name: string; group: { name: string; certType: string; certNo: string } }[]
    varieties: { id: number; name: string }[]
}

export function StockTableRow({ stock, farmers, varieties }: Props) {
    const [editOpen, setEditOpen] = useState(false)

    // Helper to get nested values safely
    const varietyName = stock.variety?.name || 'Unknown'
    const farmerName = stock.farmer?.name || 'Unknown'
    const certType = stock.farmer?.group?.certType || 'None'

    return (
        <>
            <TableRow
                className="group hover:bg-blue-50/50 transition-colors border-b border-slate-100 last:border-0 text-xs"
            >
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
                    <div className="text-xs text-slate-500 font-mono tracking-tighter truncate max-w-[80px] mx-auto cursor-help" title={stock.lotNo || 'Not Generated'}>
                        {stock.lotNo ? stock.lotNo.split('-').slice(1).join('-') : '-'}
                    </div>
                </TableCell>

                {/* 6. Bag No */}
                <TableCell className="py-2 px-1 text-right text-xs font-mono text-slate-400">
                    <span className="text-[10px]">#</span>{stock.bagNo}
                </TableCell>

                {/* 7. Weight */}
                <TableCell className="py-2 px-2 text-right text-xs font-bold text-slate-900">
                    {stock.weightKg.toLocaleString()}
                </TableCell>

                {/* 8. Status */}
                <TableCell className="py-2 px-1 text-center">
                    {stock.status === 'AVAILABLE' ? (
                        <div className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 text-[10px] font-bold text-blue-600 ring-1 ring-blue-200" title="보관중">
                            보
                        </div>
                    ) : (
                        <div className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-400 ring-1 ring-slate-200" title="사용완료">
                            완
                        </div>
                    )}
                </TableCell>

                {/* 9. Management */}
                <TableCell className="py-2 px-1 text-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-6 w-6 p-0 hover:bg-slate-200 rounded-full">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4 text-slate-500" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[120px]">
                            <DropdownMenuItem
                                className="text-xs cursor-pointer"
                                onClick={() => setEditOpen(true)}
                            >
                                <Edit className="mr-2 h-3 w-3" />
                                수정
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
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
