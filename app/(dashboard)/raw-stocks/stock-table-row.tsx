'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { MoreVertical, Edit, Trash2 } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { EditStockDialog, type StockFarmerOption, type StockVarietyOption } from './edit-stock-dialog'
import type { Stock } from './page'
import { deleteStock } from '@/app/actions/stock'
import { TableCell, TableRow } from '@/components/ui/table'
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'
import { confirmDialog } from '@/components/ui/confirm-dialog'

interface Props {
    stock: Stock
    farmers: StockFarmerOption[]
    varieties: StockVarietyOption[]
    selected: boolean
    onSelect: (checked: boolean) => void

    hideCheckbox?: boolean
    isInCart?: boolean
    /** 펼친 그룹 안의 행인가 — 서브행 옅은 톤을 입히고 그룹 헤더가 이미 보여주는 컬럼을 비운다 */
    inExpandedGroup?: boolean
    /** 묶음의 마지막 서브행인가 — 여기에 묶음 끝선(slate-200)을 준다 (2026-09-29 밝은 톤 개정) */
    isLast?: boolean
}

export function StockTableRow({ stock, farmers, varieties, selected, onSelect, hideCheckbox, isInCart, inExpandedGroup = false, isLast = false }: Props) {
    const [editOpen, setEditOpen] = useState(false)
    const isAvailable = stock.status === 'AVAILABLE' && !isInCart
    const { data: session } = useSession()
    const canManage = hasPermission(session?.user, 'SUPPLY_MANAGE')

    // Helper to get nested values safely
    const varietyName = stock.variety?.name || 'Unknown'
    const farmerName = stock.farmer?.name || 'Unknown'
    const actualFarmer = stock.actualFarmer as string | null | undefined
    const farmerDisplay = actualFarmer ? `${farmerName}(${actualFarmer})` : farmerName
    const certType = stock.farmer?.group?.certType || '일반'

    const handleDelete = async () => {
        if (await confirmDialog({ description: '정말 삭제하시겠습니까? (삭제 후 복구 불가)', destructive: true, confirmText: '삭제' })) {
            const result = await deleteStock(stock.id)
            if (!result.success) {
                toast.error('삭제에 실패했습니다.')
            }
        }
    }

    return (
        <>
            <TableRow
                // 선 색은 여기 한 곳에서만 고른다 — 두 색 클래스가 겹치면 어느 쪽이 이길지 보장이 없다
                className={`group transition-all duration-300 ease-in-out border-b ${inExpandedGroup && isLast ? 'border-slate-200' : 'border-slate-100'} last:border-0
                    ${isAvailable ? `cursor-pointer ${selected ? '' : `hover:bg-primary/10 ${inExpandedGroup ? 'bg-slate-50/40' : ''}`}` : 'opacity-60 bg-slate-50'}
                    ${selected ? 'bg-primary/20 hover:bg-primary/25 border-primary/30 shadow-sm' : ''}
                    ${isInCart ? 'bg-slate-50 opacity-50 cursor-not-allowed' : ''}
                `}
                onClick={() => isAvailable && onSelect(!selected)}
            >
                {/* Checkbox */}
                <TableCell className="px-1 text-center">
                    {!hideCheckbox && (
                        <Checkbox
                            checked={selected}
                            onCheckedChange={onSelect}
                            disabled={!isAvailable}
                        />
                    )}
                </TableCell>

                {/* 1. Year */}
                <TableCell className="text-center text-slate-400 hidden sm:table-cell">
                    {inExpandedGroup ? null : stock.productionYear.toString().slice(-2)}
                </TableCell>

                {/* 2. Variety */}
                <TableCell className="text-center font-semibold text-slate-900">
                    {inExpandedGroup ? null : (
                        <div className="truncate" title={varietyName}>{varietyName}</div>
                    )}
                </TableCell>

                {/* 3. Farmer */}
                <TableCell className="text-center text-slate-600">
                    <div className="truncate" title={farmerDisplay}>{farmerDisplay}</div>
                </TableCell>

                {/* 4. Cert */}
                <TableCell className="text-center hidden md:table-cell">
                    <span className={`text-[10px] font-bold px-1 py-0.5 rounded-md border ${certType === '유기농' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' :
                        certType === '무농약' ? 'text-sky-700 border-sky-200 bg-sky-50' :
                            'text-slate-600 border-slate-200 bg-slate-50'
                        }`}>
                        {certType === '유기농' ? '유기' : certType === '무농약' ? '무농' : '일반'}
                    </span>
                </TableCell>

                {/* 5. Lot No */}
                <TableCell className="text-center">
                    {certType === '일반' ? (
                        <div className="text-[12.5px] text-slate-400 font-mono">관행</div>
                    ) : (
                        <div className="text-[12.5px] text-slate-500 font-mono" title={stock.lotNo || 'Not Generated'}>
                            {stock.lotNo || '-'}
                        </div>
                    )}
                </TableCell>

                {/* 6. Bag No */}
                <TableCell className="text-right font-mono tabular-nums text-slate-400">
                    <span className="text-[10px]">#</span>{stock.bagNo}
                    {isInCart && <span className="ml-1 text-[10px] text-primary font-bold">(담김)</span>}
                </TableCell>

                {/* 7. Weight */}
                <TableCell className="text-right font-mono tabular-nums font-semibold text-slate-900">
                    {stock.weightKg.toLocaleString()}
                </TableCell>

                {/* 8. Status */}
                <TableCell className="text-center">
                    {stock.status === 'AVAILABLE' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11.5px] font-semibold bg-primary/10 text-primary">
                            보유
                        </span>
                    ) : stock.status === 'RELEASED' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11.5px] font-semibold bg-amber-100 text-amber-800">
                            출고
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11.5px] font-semibold bg-slate-100 text-slate-500">
                            소진
                        </span>
                    )}
                </TableCell>

                {/* 9. Management */}
                <TableCell className="text-center">
                    {canManage && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-slate-400 hover:text-slate-600"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[120px]">
                                <DropdownMenuItem
                                    onClick={(e) => { e.stopPropagation(); setEditOpen(true) }}
                                    className="gap-2 cursor-pointer"
                                >
                                    <Edit className="h-4 w-4 text-slate-500" />
                                    <span>수정</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={(e) => { e.stopPropagation(); handleDelete() }}
                                    disabled={stock.status === 'CONSUMED'}
                                    className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    <span>삭제</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
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
