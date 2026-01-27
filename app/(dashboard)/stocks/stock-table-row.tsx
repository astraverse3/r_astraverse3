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

    return (
        <>
            <TableRow
                className="group hover:bg-blue-50/50 cursor-pointer transition-colors border-b border-slate-100 last:border-0"
                onClick={() => setEditOpen(true)}
            >
                {/* 1. Year */}
                <TableCell className="py-2 px-1 text-center text-xs font-medium text-slate-500 w-[60px]">
                    {stock.productionYear.toString().slice(-2)}년
                </TableCell>

                {/* 2. Variety */}
                <TableCell className="py-2 px-1 text-xs font-bold text-slate-800">
                    <div className="truncate max-w-[80px] sm:max-w-none" title={stock.variety}>
                        {stock.variety}
                    </div>
                </TableCell>

                {/* 3. Farmer */}
                <TableCell className="py-2 px-1 text-xs text-slate-600">
                    <div className="truncate max-w-[60px] sm:max-w-none" title={stock.farmerName}>
                        {stock.farmerName}
                    </div>
                </TableCell>

                {/* 4. Cert */}
                <TableCell className="py-2 px-1 text-center">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${stock.certType === '유기농' ? 'text-green-600 border-green-200 bg-green-50' :
                        stock.certType === '무농약' ? 'text-blue-600 border-blue-200 bg-blue-50' :
                            'text-slate-500 border-slate-200 bg-slate-50'
                        }`}>
                        {stock.certType}
                    </span>
                </TableCell>

                {/* 5. Bag No */}
                <TableCell className="py-2 px-1 text-right text-xs font-mono text-slate-400">
                    #{stock.bagNo}
                </TableCell>

                {/* 6. Weight */}
                <TableCell className="py-2 px-1 text-right text-xs font-bold text-slate-900">
                    {stock.weightKg.toLocaleString()}
                </TableCell>

                {/* 7. Status */}
                <TableCell className="py-2 px-1 text-center">
                    {stock.status === 'AVAILABLE' ? (
                        <div className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-blue-500 ring-2 ring-blue-100" title="보관중" />
                    ) : (
                        <div className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-slate-200" title="사용완료" />
                    )}
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
