'use client'

import { ChevronRight, History, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { PackageGroup, PackageRow as PackageRowData, PackageSingle } from '@/app/actions/packages'
import { MOVEMENT_TYPE_LABEL } from '@/lib/movement-label'

/**
 * 그룹 헤더 + 펼침 서브행 / 낱개 행.
 * 같은 그리드를 공유해 그룹·낱개 정렬이 어긋나지 않게 함.
 */

// 컬럼 비율: 품종 / 도정구분 / 생산자 / 로트번호 / 포장지 / 규격 / 개수 / 총량 / 포장일자 / 액션
//  - 사용자 결정 순서 (핸드오프 §4.2.3 대비 순서·라벨 재정의)
//  - 도정구분은 재포장 도입(결정 #43)과 함께 추가. 잡곡·sentinel은 '—'
//  - 포장지는 2026-10-01 사용자 요청으로 규격 왼쪽에 추가(plan-제품재고-포장지열). SKU 없는 행(잔량)은 '—'
//  - 액션 셀(36px 고정): 콜백 prop이 있을 때만 메뉴 노출 (벼 탭은 콜백 미전달 → 빈 셀)
//  - 잡곡 탭은 도정구분 열을 뺀다(백로그 §94) — 잡곡 포장은 batchId가 없어 늘 「—」였다
//  - 재포장·차감 선택 모드는 맨 앞에 체크박스 열(28px)을 덧댄다 (결정 #43 R2)
// 🔴 Tailwind는 소스에 통째로 적힌 클래스만 만든다 — 조각을 이어 붙이지 말고 네 벌을 다 적는다
const PKG_GRIDS = {
    base: 'grid grid-cols-[0.65fr_0.5fr_0.75fr_1.4fr_0.7fr_0.5fr_0.55fr_0.8fr_0.8fr_36px]',
    select: 'grid grid-cols-[28px_0.65fr_0.5fr_0.75fr_1.4fr_0.7fr_0.5fr_0.55fr_0.8fr_0.8fr_36px]',
    noMilling: 'grid grid-cols-[0.65fr_0.75fr_1.4fr_0.7fr_0.5fr_0.55fr_0.8fr_0.8fr_36px]',
    selectNoMilling: 'grid grid-cols-[28px_0.65fr_0.75fr_1.4fr_0.7fr_0.5fr_0.55fr_0.8fr_0.8fr_36px]',
}

function pkgGrid(select: boolean, showMilling: boolean): string {
    if (showMilling) return select ? PKG_GRIDS.select : PKG_GRIDS.base
    return select ? PKG_GRIDS.selectNoMilling : PKG_GRIDS.noMilling
}

/**
 * 재포장 선택 상태 — list-client 한 곳에서만 관리하고 하위는 prop으로 받는다.
 * `selectable`이 없으면 선택 모드가 아니다(평소 화면).
 */
export interface PackageSelection {
    selectedIds: Set<number>
    onToggleRow: (row: PackageRowData) => void
    /** 이미 고른 것과 품종·도정유형·출처가 달라 함께 재포장할 수 없는 행 */
    isDisabled: (row: PackageRowData) => boolean
    disabledReason: string
}

// 행 체크박스 — 선택 모드일 때만 렌더된다.
function RowCheckbox({
    row,
    selection,
}: {
    row: PackageRowData
    selection: PackageSelection
}) {
    const disabled = selection.isDisabled(row)
    return (
        <span className="flex items-center justify-center">
            <input
                type="checkbox"
                checked={selection.selectedIds.has(row.id)}
                disabled={disabled}
                onChange={() => selection.onToggleRow(row)}
                onClick={e => e.stopPropagation()}
                title={disabled ? selection.disabledReason : undefined}
                aria-label={`${row.variety} ${row.spec} 선택`}
                className="h-3.5 w-3.5 accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
            />
        </span>
    )
}

// 행 액션 콜백 — 콜백 흐름: panel → list-client → row.
// 콜백 없으면 메뉴 안 보임. 벼 탭은 onHistory만 전달해 「차감 이력」 1항목 메뉴가 된다 (D6).
// MILLED는 잡곡 포장 수정/삭제 다이얼로그(#7c), PURCHASED는 잡곡 매입 수정/삭제 다이얼로그(#8c)로 분기.
export interface PackageRowActions {
    onEdit?: (row: PackageRowData) => void
    onDelete?: (row: PackageRowData) => void
    /** 차감 이력 다이얼로그 — 차감 이력이 있는 행(qty > available)에만 항목이 붙는다 */
    onHistory?: (row: PackageRowData) => void
}

/** 차감 이력이 있는가 — includeDeducted 조회가 아니어도 qty·available만으로 판정된다. */
export const hasDeductionHistory = (row: PackageRowData): boolean => row.qty > row.available

/** 전량 차감된 행인가 (별도 플래그 없음 — D3) */
export const isDeducted = (row: PackageRowData): boolean => row.available <= 0

/** 「03-14 판매」 — 차감된 행의 포장일자 자리에 들어가는 요약 (미결 A: 대체 확정) */
export function deductionSummary(row: PackageRowData): string {
    const date = row.deductedAt ? row.deductedAt.slice(5) : ''
    const first = row.deductedTypes[0] as keyof typeof MOVEMENT_TYPE_LABEL | undefined
    const label = first ? (MOVEMENT_TYPE_LABEL[first] ?? first) : ''
    return [date, label].filter(Boolean).join(' ') || '차감됨'
}

// -- 컬럼 헤더 (정렬은 데이터 셀과 동일) --
export function PackageColumnHeader({
    selectMode = false,
    showMilling = true,
}: {
    selectMode?: boolean
    showMilling?: boolean
}) {
    return (
        <div className={`${pkgGrid(selectMode, showMilling)} h-10 items-center px-3 text-sm font-medium text-muted-foreground bg-white border-b border-slate-200`}>
            {selectMode && <span />}
            <span>품종</span>
            {showMilling && <span>도정구분</span>}
            <span>생산자</span>
            <span className="text-center">로트번호</span>
            <span>포장지</span>
            <span className="text-right pr-2">규격</span>
            <span className="text-right pr-12">개수</span>
            <span className="text-right">총량</span>
            <span className="text-right">포장일자</span>
            <span></span>
        </div>
    )
}

/** 포장지 칸 — 이름이 길 수 있어 자르고 전체는 title로. SKU 없는 행(잔량)은 「—」 */
function PackagingCell({ name }: { name: string | null }) {
    return name ? (
        <span className="truncate" title={name}>
            {name}
        </span>
    ) : (
        <span className="text-slate-300">—</span>
    )
}

// 행 액션 메뉴 — 콜백 있으면 활성. MILLED/PURCHASED 모두 패널에서 source로 분기 처리.
// 「차감 이력」은 이력이 있는 행에만 붙는다 — 벼 탭은 이것 하나짜리 메뉴가 된다 (D6).
function RowActionMenu({ row, actions }: { row: PackageRowData; actions?: PackageRowActions }) {
    const showHistory = Boolean(actions?.onHistory) && hasDeductionHistory(row)
    const showEditDelete = Boolean(actions?.onEdit || actions?.onDelete)
    if (!actions || (!showEditDelete && !showHistory)) {
        return <span />
    }
    return (
        <span className="flex items-center justify-center">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-slate-600"
                    >
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[120px]">
                    {showEditDelete && (
                        <>
                            <DropdownMenuItem
                                onClick={() => actions.onEdit?.(row)}
                                disabled={!actions.onEdit}
                                className="gap-2 cursor-pointer"
                            >
                                <Pencil className="h-4 w-4 text-slate-500" />
                                <span>수정</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => actions.onDelete?.(row)}
                                disabled={!actions.onDelete}
                                className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                            >
                                <Trash2 className="h-4 w-4" />
                                <span>삭제</span>
                            </DropdownMenuItem>
                        </>
                    )}
                    {showHistory && (
                        <DropdownMenuItem
                            onClick={() => actions.onHistory?.(row)}
                            className="gap-2 cursor-pointer"
                        >
                            <History className="h-4 w-4 text-slate-500" />
                            <span>차감 이력</span>
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </span>
    )
}

// -- 매입 칩 (PURCHASED 행에만) --
function PurchasedChip() {
    return (
        <span className="inline-flex items-center font-medium text-[11.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-[1px]">
            매입
        </span>
    )
}

// -- LOT 칩 (MILLED & lot 있을 때) --
function LotChip({ lot }: { lot: string }) {
    return (
        <span className="inline-flex items-center font-mono text-[12.5px] text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-[1px]">
            {lot}
        </span>
    )
}

// -- 「차감됨」 배지 — 매입(amber)·LOT(mono)와 톤이 겹치지 않게 회색 (D6) --
export function DeductedBadge() {
    return (
        <span className="inline-flex shrink-0 items-center font-medium text-[11.5px] text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-[1px]">
            차감됨
        </span>
    )
}

// -- 도정구분 셀 — 잡곡·sentinel은 '—' (표시 변환은 서버에서 끝냈다) --
function MillingTypeCell({ label }: { label: string }) {
    return label === '—' ? (
        <span className="text-slate-300">—</span>
    ) : (
        <span className="text-slate-600 truncate">{label}</span>
    )
}

// -- 낱개 행 --
// 셀 순서: 품종 / 생산자 / 로트 / 규격 / 개수 / 총량 / 포장일자 / 액션
export function PackageSingleRow({
    item,
    actions,
    selection,
    showMilling = true,
}: {
    item: PackageSingle
    actions?: PackageRowActions
    selection?: PackageSelection
    showMilling?: boolean
}) {
    // PackageSingle은 PackageRow + { type: 'single' } 형태 — 액션 메뉴엔 row 형식만 필요
    const row: PackageRowData = item
    const selected = selection?.selectedIds.has(item.id)
    const deducted = isDeducted(row)
    return (
        <div
            className={`${pkgGrid(Boolean(selection), showMilling)} text-sm px-3 h-11 items-center ${
                deducted
                    ? 'bg-slate-50/70 text-slate-400'
                    : `text-slate-700 ${selected ? 'bg-primary/5' : 'hover:bg-slate-50'}`
            }`}
        >
            {selection && <RowCheckbox row={row} selection={selection} />}
            <span className={`font-semibold flex items-center gap-1.5 truncate ${deducted ? 'text-slate-500' : 'text-slate-900'}`}>
                <span className="w-3.5 inline-block shrink-0" />
                <span className="truncate">{item.variety}</span>
                {deducted && <DeductedBadge />}
            </span>
            {showMilling && <MillingTypeCell label={item.millingTypeLabel} />}
            <span className={`truncate ${deducted ? '' : 'text-slate-600'}`}>{item.producer}</span>
            <span className={`flex items-center justify-center ${deducted ? 'opacity-60' : ''}`}>
                {item.lot ? (
                    <LotChip lot={item.lot} />
                ) : item.source === 'PURCHASED' ? (
                    <PurchasedChip />
                ) : (
                    <span className="text-slate-300">—</span>
                )}
            </span>
            <PackagingCell name={item.packaging} />
            <span className="text-right pr-2">{item.spec}</span>
            <span className="tabular-nums text-right pr-12">
                {item.available.toLocaleString()}개
            </span>
            <span className="tabular-nums font-semibold text-right">
                {item.availableKg.toLocaleString()}kg
            </span>
            {/* 차감된 행은 포장일자 대신 「03-14 판매」 — 소진된 재고에선 언제·왜가 더 궁금한 값 (미결 A) */}
            {deducted ? (
                <span className="text-[12.5px] text-slate-500 tabular-nums text-right">
                    {deductionSummary(row)}
                </span>
            ) : (
                <span className="text-slate-500 tabular-nums text-right">{item.date}</span>
            )}
            <RowActionMenu row={row} actions={actions} />
        </div>
    )
}

// -- 서브행 (group 펼침 시) --
function PackageSubRow({
    row,
    actions,
    selection,
    showMilling,
}: {
    row: PackageRowData
    actions?: PackageRowActions
    selection?: PackageSelection
    showMilling: boolean
}) {
    const selected = selection?.selectedIds.has(row.id)
    const deducted = isDeducted(row)
    return (
        <div
            // 2026-09-29 밝은 톤 개정: 서브행만 옅은 톤(bg-slate-50/40) + 흰 톤 위 기본 선 slate-100
            // (docs/handoff/list-standard/밝은톤-개정-2026-09-29.md). 묶음 끝선은 여기가 아니라 그룹 래퍼가 맡는다 — 아래 PackageGroupRow
            className={`${pkgGrid(Boolean(selection), showMilling)} text-sm px-3 h-11 items-center border-t border-slate-100 ${
                deducted
                    ? 'bg-slate-50/70 text-slate-400'
                    : `text-slate-600 ${selected ? 'bg-primary/5' : 'bg-slate-50/40 hover:bg-slate-50'}`
            }`}
        >
            {selection && <RowCheckbox row={row} selection={selection} />}
            <span className="flex items-center gap-1.5 pl-5">
                <span className="w-2 h-px bg-slate-300 shrink-0" />
                {deducted && <DeductedBadge />}
            </span>
            {showMilling && <MillingTypeCell label={row.millingTypeLabel} />}
            <span className={`truncate ${deducted ? '' : 'text-slate-600'}`}>{row.producer}</span>
            <span className={`flex items-center justify-center ${deducted ? 'opacity-60' : ''}`}>
                {row.lot ? (
                    <LotChip lot={row.lot} />
                ) : row.source === 'PURCHASED' ? (
                    <PurchasedChip />
                ) : (
                    <span className="text-slate-300">—</span>
                )}
            </span>
            <PackagingCell name={row.packaging} />
            <span className={`font-medium text-right pr-2 ${deducted ? '' : 'text-slate-700'}`}>{row.spec}</span>
            <span className="tabular-nums text-right pr-12">
                {row.available.toLocaleString()}개
            </span>
            <span className={`tabular-nums font-semibold text-right ${deducted ? '' : 'text-slate-700'}`}>
                {row.availableKg.toLocaleString()}kg
            </span>
            {deducted ? (
                <span className="text-[12.5px] text-slate-500 tabular-nums text-right">
                    {deductionSummary(row)}
                </span>
            ) : (
                <span className="text-slate-500 tabular-nums text-right">{row.date}</span>
            )}
            <RowActionMenu row={row} actions={actions} />
        </div>
    )
}

// -- 그룹 헤더 + 펼침 (§4.2.5, §4.2.6) --
export function PackageGroupRow({
    item,
    isOpen,
    onToggle,
    actions,
    selection,
    showMilling = true,
}: {
    item: PackageGroup
    isOpen: boolean
    onToggle: () => void
    actions?: PackageRowActions
    selection?: PackageSelection
    showMilling?: boolean
}) {
    // 남은 개수의 합 — 일부 차감 줄은 남은 만큼, 차감 완료 줄은 0 (줄 표시·kg 합계와 같은 기준)
    const totalQty = item.rows.reduce((a, r) => a + Math.max(0, r.available), 0)
    // 생산자는 섞일 수 있어 값 대신 인원수 — 원물재고 그룹 헤더(`farmerSetSize`)와 같은 표기
    const producerCount = new Set(item.rows.map(r => r.producer)).size
    // 🔴 「N종 규격」은 행 수가 아니라 **규격 종류 수**다. 재포장을 반복하면 같은 규격이
    // 여러 행으로 갈라지므로(작업 단위로 행을 나누는 게 원칙) rows.length를 쓰면 어긋난다.
    const specCount = new Set(item.rows.map(r => r.spec)).size

    return (
        // 2026-09-29 밝은 톤 개정: 그룹은 접힘·펼침 모두 흰 바탕, 묶음은 서브행 톤 + 끝선이 만든다
        // (docs/handoff/list-standard/밝은톤-개정-2026-09-29.md — 「접힌 그룹 흰 배경 금지」·「펼친 묶음 bg-slate-100」 폐기)
        // 🔴 선은 부모의 divide-y 하나만 쓴다. Tailwind v4의 divide-y는 v3와 반대로 **각 행의 아래**에 선을 긋는다 —
        //    여기서 border-t를 또 주면 행 사이가 2px, 서브행에 끝선까지 주면 묶음 끝이 3px이 됐다(2026-09-29 실화면).
        //    묶음 끝선 = 펼쳤을 때 이 래퍼의 아래 선(divide)을 slate-200으로. 목록 맨 끝이면 카드 테두리가 대신한다
        <div className={`bg-white ${isOpen ? 'border-b-slate-200' : ''}`}>
            <button
                type="button"
                onClick={onToggle}
                // 호버가 바탕보다 밝으면 얼룩이 된다 — 바탕 위로 한 단 어둡게
                className={`w-full ${pkgGrid(Boolean(selection), showMilling)} text-sm px-3 h-11 items-center text-left transition-colors hover:bg-slate-50`}
            >
                {/* 그룹은 품종 묶음이라 그 자체를 재포장할 수 없다 — 안의 행만 고른다 */}
                {selection && <span />}
                <span className="font-bold text-slate-900 flex items-center gap-2 truncate">
                    <ChevronRight
                        className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-90 text-slate-900' : 'text-slate-400'}`}
                    />
                    <span className="truncate">{item.variety}</span>
                </span>
                {/* 그룹은 도정구분·로트·포장지가 섞일 수 있어 비운다. 생산자만 인원수로 요약 */}
                {showMilling && <span className="text-slate-300">—</span>}
                <span className="text-slate-400 text-[12.5px] tabular-nums truncate">{producerCount}명</span>
                <span className="text-slate-300 text-center">—</span>
                <span className="text-slate-300">—</span>
                <span className="text-slate-400 text-[12.5px] text-right pr-2">{specCount}종 규격</span>
                <span className="tabular-nums text-slate-400 text-[12.5px] text-right pr-12">{totalQty.toLocaleString()}개</span>
                <span className="tabular-nums font-bold text-slate-900 text-right">
                    {item.total.toLocaleString()}kg
                </span>
                <span className="text-slate-300 text-right">—</span>
                <span></span>
            </button>

            {isOpen &&
                item.rows.map(row => (
                    <PackageSubRow
                        key={row.id}
                        row={row}
                        actions={actions}
                        selection={selection}
                        showMilling={showMilling}
                    />
                ))}
        </div>
    )
}
