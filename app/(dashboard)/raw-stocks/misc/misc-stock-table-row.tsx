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
    remainingKg?: number
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
    canMill?: boolean
    inExpandedGroup?: boolean
    onEdit?: () => void
    onDelete?: () => void
    onPackage?: () => void
}

export function MiscStockTableRow({ stock, canManage = false, canMill = false, inExpandedGroup = false, onEdit, onDelete, onPackage }: Props) {
    const isConsumed = stock.status === 'CONSUMED'
    const sourceConf = stock.sourceType ? SOURCE_BADGE[stock.sourceType] : null
    const isAvailable = stock.status === 'AVAILABLE'
    const showRaw = stock.sourceType === 'CONSIGNMENT' || stock.sourceType === 'GERMINATION'
    // 수율은 도정위탁만 의미 있음 (발아위탁은 사용자 결정으로 미관리)
    const showYield = stock.sourceType === 'CONSIGNMENT'
    const yieldText = showYield ? calcYield(stock.rawWeightKg, stock.weightKg) : null

    const remainingKg = stock.remainingKg ?? stock.weightKg
    const isDepleted = remainingKg <= 0.001
    const canPackage = isAvailable && !isDepleted

    const certType = stock.farmer.group?.certType

    // §4.2.6 펼친 그룹 일체감: 헤더 + 서브행 모두 bg-slate-50/60 (같은 톤 묶음).
    // 단일 건(낱개 행, §4.2.4)은 흰 배경.
    return (
        <TableRow className={inExpandedGroup ? 'bg-slate-100 hover:bg-slate-200/70 border-b-0' : 'bg-white hover:bg-slate-50'}>
            <TableCell className="px-1 text-center text-slate-400">—</TableCell>
            {/* 다중 그룹 서브행은 년도·품종 셀 비워 그룹 시각 구분 강화 (그리드 정렬은 유지) */}
            <TableCell className="text-center tabular-nums text-slate-400 hidden sm:table-cell">
                {inExpandedGroup ? null : stock.productionYear}
            </TableCell>
            <TableCell className="text-center truncate">
                {inExpandedGroup ? null : stock.variety.name}
            </TableCell>
            <TableCell className="truncate">
                <div className="inline-flex items-center gap-1.5">
                    <span className="font-medium text-slate-700">{stock.farmer.name}</span>
                    {stock.actualFarmer && (
                        <span className="text-slate-400">({stock.actualFarmer})</span>
                    )}
                    {certType && (
                        <span className={`inline-flex items-center font-semibold px-1.5 py-0 rounded-md border text-[11.5px] ${CERT_BADGE_CLASS[certType] ?? CERT_BADGE_CLASS['일반']}`}>
                            {certType}
                        </span>
                    )}
                </div>
            </TableCell>
            <TableCell className="text-center text-slate-500 tabular-nums hidden md:table-cell">
                {formatYMD(stock.incomingDate)}
            </TableCell>
            <TableCell className="text-center px-2">
                {stock.lotNo ? (
                    <span className="inline-flex items-center font-mono text-[12.5px] text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-[1px] tabular-nums">
                        {stock.lotNo}
                    </span>
                ) : (
                    <span className="text-[11px] text-slate-400">-</span>
                )}
            </TableCell>
            <TableCell className="text-center">
                {sourceConf && (
                    <span className={`inline-flex items-center font-semibold px-1.5 py-0.5 rounded-md border text-[11.5px] ${sourceConf.className}`}>
                        {sourceConf.label}
                    </span>
                )}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums text-slate-400">{stock.bagNo}</TableCell>
            <TableCell
                className={`text-right text-slate-500 tabular-nums ${showRaw && yieldText ? 'underline decoration-dotted decoration-slate-300 underline-offset-2 cursor-help' : ''}`}
                title={showRaw && yieldText ? `수율 ${yieldText}` : undefined}
            >
                {showRaw ? stock.rawWeightKg?.toLocaleString() : '-'}
            </TableCell>
            <TableCell className="text-right text-slate-500 tabular-nums">
                {stock.weightKg.toLocaleString()}
            </TableCell>
            <TableCell className={`text-right tabular-nums ${isDepleted ? 'text-slate-400' : 'text-primary font-semibold'}`}>
                {Math.round(remainingKg).toLocaleString()}
            </TableCell>
            <TableCell className="text-center text-xs">
                {canMill && canPackage ? (
                    <button
                        type="button"
                        onClick={onPackage}
                        title="포장하기"
                        className="inline-flex items-center font-semibold px-2 py-0 rounded-sm border border-primary/40 text-primary bg-primary/10 hover:bg-primary/20 hover:border-primary/60 text-[10px] h-5 transition-colors cursor-pointer"
                    >
                        포장
                    </button>
                ) : (
                    <Badge
                        variant={isAvailable ? 'outline' : 'secondary'}
                        className={`text-[10px] h-5 px-1.5 rounded-sm ${isAvailable ? 'border-primary/30 text-primary bg-primary/10' : ''}`}
                    >
                        {isAvailable ? '보관중' : isConsumed ? '소진됨' : stock.status}
                    </Badge>
                )}
            </TableCell>
            <TableCell className="px-1 text-center">
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
    canMill?: boolean
    /** 그룹 펼침의 서브 카드 여부. true면 품종/년도/인증을 그룹 헤더에 양도하고 카드는 생산자부터 시작. */
    inExpandedGroup?: boolean
    onEdit?: () => void
    onDelete?: () => void
    onPackage?: () => void
}

export function MiscStockMobileCard({
    stock,
    canManage = false,
    canMill = false,
    inExpandedGroup = false,
    onEdit,
    onDelete,
    onPackage,
}: MobileCardProps) {
    const isAvailable = stock.status === 'AVAILABLE'
    const isConsumed = stock.status === 'CONSUMED'
    const remainingKg = stock.remainingKg ?? stock.weightKg
    const isDepleted = remainingKg <= 0.001
    const canPackage = isAvailable && !isDepleted
    const certType = stock.farmer.group?.certType

    const actionCluster = (
        <div className="flex items-center gap-0.5 shrink-0">
            {canMill && canPackage ? (
                <button
                    type="button"
                    onClick={onPackage}
                    className="inline-flex items-center font-semibold px-2 py-0 rounded-sm border border-primary/40 text-primary bg-primary/10 active:bg-primary/20 text-[10px] h-5 transition-colors"
                >
                    포장
                </button>
            ) : (
                <Badge
                    variant={isAvailable ? 'outline' : 'secondary'}
                    className={`text-[10px] h-5 px-1.5 rounded-sm ${isAvailable ? 'border-primary/30 text-primary bg-primary/10' : ''}`}
                >
                    {isAvailable ? '보관중' : isConsumed ? '소진됨' : stock.status}
                </Badge>
            )}
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
    )

    // 재고만 강조 (입고량은 모바일 실무 화면에서 제거)
    const remainingCluster = (
        <div className="flex items-baseline gap-0.5 shrink-0">
            <span className={`font-black text-[14px] tracking-tight leading-none tabular-nums ${isDepleted ? 'text-slate-400' : 'text-slate-800'}`}>
                {Math.round(remainingKg).toLocaleString()}
            </span>
            <span className="text-[10px] font-bold opacity-60">kg</span>
        </div>
    )

    // 생산자 옆 메타: LOT(풀) · 입고일 — 단일건/서브 공통
    const producerMeta = (
        <>
            <span className="font-bold text-[13px] text-slate-700 leading-tight shrink-0">
                {stock.farmer.name}
                {stock.actualFarmer && <span className="text-slate-400 text-[11px] font-normal"> ({stock.actualFarmer})</span>}
            </span>
            {stock.lotNo && (
                <span className="inline-flex items-center font-mono text-[10px] text-slate-600 bg-slate-100 border border-slate-200 rounded px-1.5 py-[1px] tabular-nums shrink-0">
                    {stock.lotNo}
                </span>
            )}
            <span className="text-[10px] text-slate-500 tabular-nums shrink-0">{formatYMD(stock.incomingDate)}</span>
        </>
    )

    return (
        <div className="relative py-2 px-2.5 rounded-lg border border-slate-200/80 bg-white shadow-sm">
            {!inExpandedGroup ? (
                <>
                    {/* 단일건 1행: [품종 + 년도 + 인증]  ─  [포장 ⋮] */}
                    <div className="flex justify-between items-center gap-1 mb-1">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="font-bold text-[14px] text-slate-800 leading-tight truncate min-w-0">
                                {stock.variety.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium bg-white border border-slate-200 px-1 py-0 rounded shrink-0 leading-none whitespace-nowrap">
                                {stock.productionYear}년
                            </span>
                            {certType && (
                                <span className={`inline-flex items-center font-medium px-1 py-0 rounded text-[9px] border shrink-0 ${CERT_BADGE_CLASS[certType] ?? CERT_BADGE_CLASS['일반']}`}>
                                    {certType}
                                </span>
                            )}
                        </div>
                        {actionCluster}
                    </div>
                    {/* 단일건 2행: [생산자 LOT 입고일]  ─  [재고] */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            {producerMeta}
                        </div>
                        {remainingCluster}
                    </div>
                </>
            ) : (
                <>
                    {/* 그룹 서브 1행: [생산자 #번호 LOT 입고일]  ─  [포장 ⋮] */}
                    <div className="flex justify-between items-center gap-1 mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                            <span className="font-bold text-[13px] text-slate-700 leading-tight shrink-0">
                                {stock.farmer.name}
                                {stock.actualFarmer && <span className="text-slate-400 text-[11px] font-normal"> ({stock.actualFarmer})</span>}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono tabular-nums shrink-0">
                                #{stock.bagNo}
                            </span>
                            {stock.lotNo && (
                                <span className="inline-flex items-center font-mono text-[10px] text-slate-600 bg-slate-100 border border-slate-200 rounded px-1.5 py-[1px] tabular-nums shrink-0">
                                    {stock.lotNo}
                                </span>
                            )}
                            <span className="text-[10px] text-slate-500 tabular-nums shrink-0">{formatYMD(stock.incomingDate)}</span>
                        </div>
                        {actionCluster}
                    </div>
                    {/* 그룹 서브 2행: 우측 [재고] */}
                    <div className="flex items-center justify-end gap-2">
                        {remainingCluster}
                    </div>
                </>
            )}
        </div>
    )
}
