'use client'

import { TableCell, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MoreVertical, Edit, Trash2 } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface MiscStock {
    id: number
    productionYear: number
    bagNo: number
    weightKg: number
    rawWeightKg: number | null
    sourceType: 'CONSIGNMENT' | 'FARMER_MILLED' | 'GERMINATION' | null
    millingVendor: string | null
    status: string
    incomingDate: Date | string
    lotNo: string | null
    actualFarmer: string | null
    variety: { name: string }
    farmer: { name: string; group: { certType: string } | null }
}

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
    CONSIGNMENT: { label: '도정위탁', className: 'border-primary/30 text-primary bg-primary/10' },
    FARMER_MILLED: { label: '농가도정', className: 'border-emerald-200 text-emerald-700 bg-emerald-50' },
    GERMINATION: { label: '발아위탁', className: 'border-violet-200 text-violet-700 bg-violet-50' },
}

function calcYield(raw: number | null, weight: number): string {
    if (!raw || raw <= 0) return '-'
    return `${((weight / raw) * 100).toFixed(1)}%`
}

function formatYMD(d: Date | string): string {
    const date = typeof d === 'string' ? new Date(d) : d
    const yy = String(date.getFullYear()).slice(-2)
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yy}.${mm}.${dd}`
}

export const CERT_BADGE_CLASS: Record<string, string> = {
    유기농: 'border-emerald-200 text-emerald-700 bg-emerald-50',
    무농약: 'border-sky-200 text-sky-700 bg-sky-50',
    일반: 'border-slate-200 text-slate-600 bg-slate-50',
}

interface Props {
    stock: MiscStock
    canManage?: boolean
    inExpandedGroup?: boolean
    onEdit?: () => void
    onDelete?: () => void
}

export function MiscStockTableRow({ stock, canManage = false, inExpandedGroup = false, onEdit, onDelete }: Props) {
    const isConsumed = stock.status === 'CONSUMED'
    const sourceConf = stock.sourceType ? SOURCE_BADGE[stock.sourceType] : null
    const isAvailable = stock.status === 'AVAILABLE'
    const showRaw = stock.sourceType === 'CONSIGNMENT' || stock.sourceType === 'GERMINATION'
    // 수율은 도정위탁만 의미 있음 (발아위탁은 사용자 결정으로 미관리)
    const showYield = stock.sourceType === 'CONSIGNMENT'

    const certType = stock.farmer.group?.certType

    // §4.2.6 펼친 그룹 일체감: 헤더 + 서브행 모두 bg-slate-50/60 (같은 톤 묶음).
    // 단일 건(낱개 행, §4.2.4)은 흰 배경.
    return (
        <TableRow className={inExpandedGroup ? 'bg-slate-50/60 hover:bg-slate-100/60' : 'bg-white hover:bg-slate-50'}>
            <TableCell className="text-center text-xs text-slate-400">—</TableCell>
            <TableCell className="text-center text-xs tabular-nums hidden sm:table-cell">{stock.productionYear}</TableCell>
            <TableCell className="text-center text-xs">{stock.variety.name}</TableCell>
            <TableCell className="text-xs">
                <div className="inline-flex items-center gap-1.5">
                    <span className="font-medium text-slate-700">{stock.farmer.name}</span>
                    {stock.actualFarmer && (
                        <span className="text-slate-400">({stock.actualFarmer})</span>
                    )}
                    {certType && (
                        <span className={`inline-flex items-center font-medium px-1.5 py-0 rounded-md border text-[10px] ${CERT_BADGE_CLASS[certType] ?? CERT_BADGE_CLASS['일반']}`}>
                            {certType}
                        </span>
                    )}
                </div>
            </TableCell>
            <TableCell className="text-center text-xs text-slate-500 tabular-nums hidden md:table-cell">
                {formatYMD(stock.incomingDate)}
            </TableCell>
            <TableCell className="text-center text-[11px] font-mono text-slate-500">
                {stock.lotNo || '-'}
            </TableCell>
            <TableCell className="text-center text-xs">
                {sourceConf && (
                    <span className={`inline-flex items-center font-medium px-1.5 py-0.5 rounded-md border text-[10px] ${sourceConf.className}`}>
                        {sourceConf.label}
                    </span>
                )}
            </TableCell>
            <TableCell className="text-right text-xs font-mono tabular-nums">{stock.bagNo}</TableCell>
            <TableCell className="text-right text-xs text-slate-500 tabular-nums">
                {showRaw ? stock.rawWeightKg?.toLocaleString() : '-'}
            </TableCell>
            <TableCell className="text-right text-xs font-medium text-primary tabular-nums">
                {stock.weightKg.toLocaleString()}
            </TableCell>
            <TableCell className="text-right text-xs text-slate-500 tabular-nums">
                {showYield ? calcYield(stock.rawWeightKg, stock.weightKg) : '-'}
            </TableCell>
            <TableCell className="text-center text-xs">
                <Badge
                    variant={isAvailable ? 'outline' : 'secondary'}
                    className={`text-[10px] h-5 px-1.5 rounded-sm ${isAvailable ? 'border-primary/30 text-primary bg-primary/10' : ''}`}
                >
                    {isAvailable ? '보관중' : isConsumed ? '소진됨' : stock.status}
                </Badge>
            </TableCell>
            <TableCell className="text-center w-[40px]">
                {canManage && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[120px]">
                            <DropdownMenuItem onClick={onEdit} disabled={isConsumed} className="gap-2 cursor-pointer">
                                <Edit className="h-4 w-4 text-slate-500" />
                                <span>수정</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={onDelete}
                                disabled={isConsumed}
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
    )
}

interface MobileCardProps {
    stock: MiscStock
    canManage?: boolean
    onEdit?: () => void
    onDelete?: () => void
}

export function MiscStockMobileCard({ stock, canManage = false, onEdit, onDelete }: MobileCardProps) {
    const sourceConf = stock.sourceType ? SOURCE_BADGE[stock.sourceType] : null
    const isAvailable = stock.status === 'AVAILABLE'
    const isConsumed = stock.status === 'CONSUMED'
    const showRaw = stock.sourceType === 'CONSIGNMENT' || stock.sourceType === 'GERMINATION'
    const showYield = stock.sourceType === 'CONSIGNMENT'
    const certType = stock.farmer.group?.certType

    return (
        <div className="relative py-2 px-2.5 rounded-lg border border-slate-200/80 bg-white shadow-sm">
            <div className="flex justify-between items-center mb-1 gap-1">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="font-bold text-[13px] text-slate-800 leading-tight truncate min-w-0">
                        {stock.farmer.name}
                        {stock.actualFarmer && <span className="text-slate-400 text-[11px]"> ({stock.actualFarmer})</span>}
                    </span>
                    {certType && (
                        <span className={`inline-flex items-center font-medium px-1 py-0 rounded text-[9px] border shrink-0 ${CERT_BADGE_CLASS[certType] ?? CERT_BADGE_CLASS['일반']}`}>
                            {certType}
                        </span>
                    )}
                    {sourceConf && (
                        <span className={`inline-flex items-center font-medium px-1 py-0 rounded text-[9px] border shrink-0 ${sourceConf.className}`}>
                            {sourceConf.label}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                    <Badge
                        variant={isAvailable ? 'outline' : 'secondary'}
                        className={`text-[10px] h-5 px-1.5 rounded-sm ${isAvailable ? 'border-primary/30 text-primary bg-primary/10' : ''}`}
                    >
                        {isAvailable ? '보관중' : isConsumed ? '소진됨' : stock.status}
                    </Badge>
                    {canManage && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600">
                                    <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[120px]">
                                <DropdownMenuItem onClick={onEdit} disabled={isConsumed} className="gap-2 cursor-pointer">
                                    <Edit className="h-4 w-4 text-slate-500" />
                                    <span>수정</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={onDelete}
                                    disabled={isConsumed}
                                    className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    <span>삭제</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono tabular-nums shrink-0">#{stock.bagNo}</span>
                    {stock.lotNo ? (
                        <span className="inline-flex items-center font-mono text-[10px] text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-[1px] truncate">
                            {stock.lotNo}
                        </span>
                    ) : (
                        <span className="text-[10px] text-slate-400">로트없음</span>
                    )}
                    <span className="text-[10px] tabular-nums shrink-0">· {formatYMD(stock.incomingDate)}</span>
                </div>
                <span className="font-black text-[14px] text-slate-800 tracking-tight leading-none tabular-nums shrink-0">
                    {stock.weightKg.toLocaleString()}
                    <span className="text-[10px] font-bold ml-0.5 opacity-60">kg</span>
                </span>
            </div>
            {(showRaw || showYield) && (
                <div className="flex items-center justify-end gap-3 mt-0.5 text-[10px] text-slate-500">
                    {showRaw && stock.rawWeightKg && (
                        <span>
                            {stock.sourceType === 'GERMINATION' ? '현미' : '원물'}{' '}
                            <span className="font-medium text-slate-700 tabular-nums">{stock.rawWeightKg.toLocaleString()}kg</span>
                        </span>
                    )}
                    {showYield && (
                        <span>수율 <span className="font-medium text-slate-700 tabular-nums">{calcYield(stock.rawWeightKg, stock.weightKg)}</span></span>
                    )}
                </div>
            )}
        </div>
    )
}
