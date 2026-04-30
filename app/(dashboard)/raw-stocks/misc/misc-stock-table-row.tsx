'use client'

import { TableCell, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

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

const CERT_BADGE_CLASS: Record<string, string> = {
    유기농: 'border-emerald-200 text-emerald-700 bg-emerald-50',
    무농약: 'border-sky-200 text-sky-700 bg-sky-50',
    일반: 'border-slate-200 text-slate-600 bg-slate-50',
}

interface Props {
    stock: MiscStock
}

export function MiscStockTableRow({ stock }: Props) {
    const sourceConf = stock.sourceType ? SOURCE_BADGE[stock.sourceType] : null
    const isAvailable = stock.status === 'AVAILABLE'
    const showRaw = stock.sourceType === 'CONSIGNMENT' || stock.sourceType === 'GERMINATION'
    // 수율은 도정위탁만 의미 있음 (발아위탁은 사용자 결정으로 미관리)
    const showYield = stock.sourceType === 'CONSIGNMENT'

    const certType = stock.farmer.group?.certType

    // §4.2 펼친 상세 행 — 옅은 배경 + 좌측 primary border (그룹 active 강조)
    return (
        <TableRow className="bg-slate-50/60 hover:bg-slate-100/60 border-l-2 border-primary/40">
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
                    {isAvailable ? '보관중' : stock.status === 'CONSUMED' ? '소진됨' : stock.status}
                </Badge>
            </TableCell>
        </TableRow>
    )
}

interface MobileCardProps {
    stock: MiscStock
}

export function MiscStockMobileCard({ stock }: MobileCardProps) {
    const sourceConf = stock.sourceType ? SOURCE_BADGE[stock.sourceType] : null
    const isAvailable = stock.status === 'AVAILABLE'
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
                <Badge
                    variant={isAvailable ? 'outline' : 'secondary'}
                    className={`text-[10px] h-5 px-1.5 rounded-sm shrink-0 ${isAvailable ? 'border-primary/30 text-primary bg-primary/10' : ''}`}
                >
                    {isAvailable ? '보관중' : stock.status === 'CONSUMED' ? '소진됨' : stock.status}
                </Badge>
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
