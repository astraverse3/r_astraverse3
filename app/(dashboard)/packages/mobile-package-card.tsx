'use client'

import { ChevronRight } from 'lucide-react'
import type { PackageGroup, PackageRow as PackageRowData, PackageSingle } from '@/app/actions/packages'

/**
 * 모바일 품종 카드 — 핸드오프 §4.3 + §4.2.7.
 * 그룹 헤더 + 펼침 상세 카드 / 낱개 카드 두 케이스.
 *
 * 컬럼 정렬을 위해 모든 행을 동일 3-col grid로 통일:
 *   [좌: 규격·LOT 등 short label] [중: 1fr 생산자/공백] [우: 합계kg·날짜]
 */

const ROW_GRID = 'grid grid-cols-[auto_1fr_auto] gap-2 items-center'

function LotChip({ lot }: { lot: string }) {
    return (
        <span className="inline-flex items-center font-mono text-[10px] text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-[1px]">
            {lot}
        </span>
    )
}

function PurchasedChip() {
    return (
        <span className="inline-flex items-center font-medium text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-[1px]">
            매입
        </span>
    )
}

function LotOrSourceCell({ lot, source }: { lot: string | null; source: PackageRowData['source'] }) {
    if (lot) return <LotChip lot={lot} />
    if (source === 'PURCHASED') return <PurchasedChip />
    return <span className="text-[10px] text-slate-300">—</span>
}

// 펼친 그룹의 한 서브 카드 (§4.2.7) — 2줄, 3-col grid
function RowDetail({ row }: { row: PackageRowData }) {
    return (
        <div className="flex flex-col gap-1 px-3 py-2 bg-white border border-slate-200/80 rounded-md">
            <div className={`${ROW_GRID} text-[12.5px]`}>
                <span className="font-bold text-slate-900 shrink-0">
                    {row.spec} × <span className="tabular-nums">{row.qty}</span>포
                </span>
                <span className="text-slate-600 truncate min-w-0">{row.producer}</span>
                <span className="font-bold text-slate-900 tabular-nums">
                    {row.sub.toLocaleString()}kg
                </span>
            </div>
            <div className={ROW_GRID}>
                <LotOrSourceCell lot={row.lot} source={row.source} />
                <span />
                <span className="text-[11px] text-slate-500 tabular-nums">{row.date}</span>
            </div>
        </div>
    )
}

// 낱개 카드 (§4.2.4) — 헤더(품종+합계) 1줄 + 본문 2줄을 모두 같은 3-col grid로 정렬
export function MobilePackageSingleCard({ item }: { item: PackageSingle }) {
    return (
        <div className="flex flex-col gap-1 px-3 py-2.5 bg-white border border-slate-200 rounded-lg">
            {/* 헤더: 품종 + 합계 (좌/중/우 grid에서 좌·우만 사용) */}
            <div className={ROW_GRID}>
                <span className="text-[13px] font-bold text-slate-900 truncate">
                    {item.variety}
                </span>
                <span />
                <span className="text-[12.5px] font-bold text-slate-900 tabular-nums">
                    {item.sub.toLocaleString()}kg
                </span>
            </div>
            {/* 본문 1: 규격×수량 / 생산자 / (빈) */}
            <div className={`${ROW_GRID} text-[12px] text-slate-700`}>
                <span className="shrink-0">
                    {item.spec} × <span className="tabular-nums">{item.qty}</span>포
                </span>
                <span className="text-slate-600 truncate min-w-0">{item.producer}</span>
                <span />
            </div>
            {/* 본문 2: LOT/매입칩 / (빈) / 날짜 */}
            <div className={ROW_GRID}>
                <LotOrSourceCell lot={item.lot} source={item.source} />
                <span />
                <span className="text-[11px] text-slate-500 tabular-nums">{item.date}</span>
            </div>
        </div>
    )
}

// 그룹 카드 (헤더 + 펼침)
export function MobilePackageGroupCard({
    item,
    isOpen,
    onToggle,
}: {
    item: PackageGroup
    isOpen: boolean
    onToggle: () => void
}) {
    const totalQty = item.rows.reduce((a, r) => a + r.qty, 0)

    return (
        <div
            className={`rounded-lg ${
                isOpen ? 'bg-slate-50/70 border border-slate-200' : 'bg-white border border-slate-200'
            }`}
        >
            <button
                type="button"
                onClick={onToggle}
                className={`w-full ${ROW_GRID} px-3 py-2.5 text-left`}
            >
                <span className="flex items-center gap-2 min-w-0">
                    <ChevronRight
                        className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-90 text-slate-700' : 'text-slate-400'}`}
                    />
                    <span className="text-[13px] font-bold text-slate-900 truncate">
                        {item.variety}
                    </span>
                </span>
                <span className="text-[11.5px] text-slate-500 tabular-nums truncate text-right min-w-0">
                    {item.rows.length}종 · {totalQty.toLocaleString()}포
                </span>
                <span className="text-[12.5px] font-bold text-slate-900 tabular-nums">
                    {item.total.toLocaleString()}kg
                </span>
            </button>

            {isOpen && (
                <div className="flex flex-col gap-1.5 px-2 pb-2">
                    {item.rows.map(row => (
                        <RowDetail key={row.id} row={row} />
                    ))}
                </div>
            )}
        </div>
    )
}
