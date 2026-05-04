'use client'

import { ChevronRight } from 'lucide-react'
import type { PackageGroup, PackageRow as PackageRowData, PackageSingle } from '@/app/actions/packages'

/**
 * 그룹 헤더 + 펼침 서브행 / 낱개 행 — 핸드오프 §4.2.3~§4.2.6 스펙.
 * 같은 7열 그리드를 공유해 그룹·낱개 정렬이 어긋나지 않게 함.
 */

export const PKG_GRID =
    'grid grid-cols-[1.1fr_0.7fr_0.7fr_1fr_1.2fr_0.9fr_0.9fr]'

// -- 컬럼 헤더 (§4.2.3) --
export function PackageColumnHeader() {
    return (
        <div className={`${PKG_GRID} text-[10.5px] uppercase tracking-wider text-slate-400 font-bold px-4 py-2 bg-slate-50/60 border-b border-slate-200`}>
            <span>품종</span>
            <span>규격</span>
            <span>개수</span>
            <span>생산자</span>
            <span>로트</span>
            <span>날짜</span>
            <span className="text-right">합계</span>
        </div>
    )
}

// -- 매입 칩 (PURCHASED 행에만) --
function PurchasedChip() {
    return (
        <span className="inline-flex items-center font-medium text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-[1px]">
            매입
        </span>
    )
}

// -- LOT 칩 (MILLED & lot 있을 때) --
function LotChip({ lot }: { lot: string }) {
    return (
        <span className="inline-flex items-center font-mono text-[11px] text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-[1px]">
            {lot}
        </span>
    )
}

// -- 낱개 행 (§4.2.4) --
export function PackageSingleRow({ item }: { item: PackageSingle }) {
    return (
        <div className={`${PKG_GRID} text-[12.5px] text-slate-700 px-4 py-2.5 items-center hover:bg-slate-50/70`}>
            <span className="font-semibold text-slate-900 flex items-center gap-2 truncate">
                <span className="w-3.5 inline-block shrink-0" />
                <span className="truncate">{item.variety}</span>
            </span>
            <span>{item.spec}</span>
            <span className="tabular-nums">{item.qty.toLocaleString()}포</span>
            <span className="text-slate-600 truncate">{item.producer}</span>
            <span className="flex items-center">
                {item.lot ? (
                    <LotChip lot={item.lot} />
                ) : item.source === 'PURCHASED' ? (
                    <PurchasedChip />
                ) : (
                    <span className="text-slate-300">—</span>
                )}
            </span>
            <span className="text-slate-500 tabular-nums">{item.date}</span>
            <span className="tabular-nums font-semibold text-right">
                {item.sub.toLocaleString()}kg
            </span>
        </div>
    )
}

// -- 서브행 (§4.2.6, group 펼침 시) --
function PackageSubRow({ row }: { row: PackageRowData }) {
    return (
        <div className={`${PKG_GRID} text-[12.5px] text-slate-600 px-4 py-2 items-center border-t border-slate-200/60`}>
            <span className="flex items-center pl-5">
                <span className="w-2 h-px bg-slate-300 shrink-0" />
            </span>
            <span className="font-medium text-slate-700">{row.spec}</span>
            <span className="tabular-nums">{row.qty.toLocaleString()}포</span>
            <span className="text-slate-600 truncate">{row.producer}</span>
            <span className="flex items-center">
                {row.lot ? (
                    <LotChip lot={row.lot} />
                ) : row.source === 'PURCHASED' ? (
                    <PurchasedChip />
                ) : (
                    <span className="text-slate-300">—</span>
                )}
            </span>
            <span className="text-slate-500 tabular-nums">{row.date}</span>
            <span className="tabular-nums font-semibold text-slate-700 text-right">
                {row.sub.toLocaleString()}kg
            </span>
        </div>
    )
}

// -- 그룹 헤더 + 펼침 (§4.2.5, §4.2.6) --
export function PackageGroupRow({
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
        <div className={isOpen ? 'bg-slate-50/60 ring-1 ring-inset ring-slate-200/70' : ''}>
            <button
                type="button"
                onClick={onToggle}
                className={`w-full ${PKG_GRID} text-[12.5px] px-4 py-2.5 items-center text-left transition-colors hover:bg-slate-50/70`}
            >
                <span className="font-bold text-slate-900 flex items-center gap-2 truncate">
                    <ChevronRight
                        className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-90 text-slate-700' : 'text-slate-400'}`}
                    />
                    <span className="truncate">{item.variety}</span>
                </span>
                <span className="text-slate-400 text-[11.5px]">{item.rows.length}종 규격</span>
                <span className="tabular-nums text-slate-400 text-[11.5px]">{totalQty.toLocaleString()}포</span>
                <span className="text-slate-300">—</span>
                <span className="text-slate-300">—</span>
                <span className="text-slate-300">—</span>
                <span className="tabular-nums font-bold text-slate-900 text-right">
                    {item.total.toLocaleString()}kg
                </span>
            </button>

            {isOpen &&
                item.rows.map(row => <PackageSubRow key={row.id} row={row} />)}
        </div>
    )
}
