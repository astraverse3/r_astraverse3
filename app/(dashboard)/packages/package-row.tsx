'use client'

import { ChevronRight, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { PackageGroup, PackageRow as PackageRowData, PackageSingle } from '@/app/actions/packages'

/**
 * 그룹 헤더 + 펼침 서브행 / 낱개 행.
 * 같은 그리드를 공유해 그룹·낱개 정렬이 어긋나지 않게 함.
 */

// 컬럼 비율: 품종 / 도정구분 / 생산자 / 로트번호 / 규격 / 개수 / 총량 / 포장일자 / 액션
//  - 사용자 결정 순서 (핸드오프 §4.2.3 대비 순서·라벨 재정의)
//  - 도정구분은 재포장 도입(결정 #43)과 함께 추가. 잡곡·sentinel은 '—'
//  - 액션 셀(36px 고정): 콜백 prop이 있을 때만 메뉴 노출 (벼 탭은 콜백 미전달 → 빈 셀)
export const PKG_GRID =
    'grid grid-cols-[0.65fr_0.5fr_0.75fr_1.4fr_0.5fr_0.55fr_0.8fr_0.8fr_36px]'

// 재포장 선택 모드 — 맨 앞에 체크박스 열을 덧댄다 (결정 #43 R2).
// 평소엔 쓰지 않아 기존 레이아웃은 그대로다.
export const PKG_GRID_SELECT =
    'grid grid-cols-[28px_0.65fr_0.5fr_0.75fr_1.4fr_0.5fr_0.55fr_0.8fr_0.8fr_36px]'

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
// 콜백 없으면 메뉴 안 보임 (벼 탭).
// MILLED는 잡곡 포장 수정/삭제 다이얼로그(#7c), PURCHASED는 잡곡 매입 수정/삭제 다이얼로그(#8c)로 분기.
export interface PackageRowActions {
    onEdit?: (row: PackageRowData) => void
    onDelete?: (row: PackageRowData) => void
}

// -- 컬럼 헤더 (정렬은 데이터 셀과 동일) --
export function PackageColumnHeader({ selectMode = false }: { selectMode?: boolean }) {
    return (
        <div className={`${selectMode ? PKG_GRID_SELECT : PKG_GRID} text-[10.5px] uppercase tracking-wider text-slate-400 font-bold px-4 py-2.5 bg-slate-50/60 border-b border-slate-200`}>
            {selectMode && <span />}
            <span>품종</span>
            <span>도정구분</span>
            <span>생산자</span>
            <span className="text-center">로트번호</span>
            <span className="text-right pr-2">규격</span>
            <span className="text-right pr-12">개수</span>
            <span className="text-right">총량</span>
            <span className="text-right">포장일자</span>
            <span></span>
        </div>
    )
}

// 행 액션 메뉴 — 콜백 있으면 활성. MILLED/PURCHASED 모두 패널에서 source로 분기 처리.
function RowActionMenu({ row, actions }: { row: PackageRowData; actions?: PackageRowActions }) {
    if (!actions || (!actions.onEdit && !actions.onDelete)) {
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
                </DropdownMenuContent>
            </DropdownMenu>
        </span>
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
}: {
    item: PackageSingle
    actions?: PackageRowActions
    selection?: PackageSelection
}) {
    // PackageSingle은 PackageRow + { type: 'single' } 형태 — 액션 메뉴엔 row 형식만 필요
    const row: PackageRowData = item
    const selected = selection?.selectedIds.has(item.id)
    return (
        <div
            className={`${selection ? PKG_GRID_SELECT : PKG_GRID} text-[13px] text-slate-700 px-4 py-3 items-center ${selected ? 'bg-primary/5' : 'hover:bg-slate-50/70'}`}
        >
            {selection && <RowCheckbox row={row} selection={selection} />}
            <span className="font-semibold text-slate-900 flex items-center gap-2 truncate">
                <span className="w-3.5 inline-block shrink-0" />
                <span className="truncate">{item.variety}</span>
            </span>
            <MillingTypeCell label={item.millingTypeLabel} />
            <span className="text-slate-600 truncate">{item.producer}</span>
            <span className="flex items-center justify-center">
                {item.lot ? (
                    <LotChip lot={item.lot} />
                ) : item.source === 'PURCHASED' ? (
                    <PurchasedChip />
                ) : (
                    <span className="text-slate-300">—</span>
                )}
            </span>
            <span className="text-right pr-2">{item.spec}</span>
            <span className="tabular-nums text-right pr-12">{item.qty.toLocaleString()}개</span>
            <span className="tabular-nums font-semibold text-right">
                {item.sub.toLocaleString()}kg
            </span>
            <span className="text-slate-500 tabular-nums text-right">{item.date}</span>
            <RowActionMenu row={row} actions={actions} />
        </div>
    )
}

// -- 서브행 (group 펼침 시) --
function PackageSubRow({
    row,
    actions,
    selection,
}: {
    row: PackageRowData
    actions?: PackageRowActions
    selection?: PackageSelection
}) {
    const selected = selection?.selectedIds.has(row.id)
    return (
        <div
            className={`${selection ? PKG_GRID_SELECT : PKG_GRID} text-[13px] text-slate-600 px-4 py-2.5 items-center border-t border-slate-200/60 ${selected ? 'bg-primary/5' : ''}`}
        >
            {selection && <RowCheckbox row={row} selection={selection} />}
            <span className="flex items-center pl-5">
                <span className="w-2 h-px bg-slate-300 shrink-0" />
            </span>
            <MillingTypeCell label={row.millingTypeLabel} />
            <span className="text-slate-600 truncate">{row.producer}</span>
            <span className="flex items-center justify-center">
                {row.lot ? (
                    <LotChip lot={row.lot} />
                ) : row.source === 'PURCHASED' ? (
                    <PurchasedChip />
                ) : (
                    <span className="text-slate-300">—</span>
                )}
            </span>
            <span className="font-medium text-slate-700 text-right pr-2">{row.spec}</span>
            <span className="tabular-nums text-right pr-12">{row.qty.toLocaleString()}개</span>
            <span className="tabular-nums font-semibold text-slate-700 text-right">
                {row.sub.toLocaleString()}kg
            </span>
            <span className="text-slate-500 tabular-nums text-right">{row.date}</span>
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
}: {
    item: PackageGroup
    isOpen: boolean
    onToggle: () => void
    actions?: PackageRowActions
    selection?: PackageSelection
}) {
    const totalQty = item.rows.reduce((a, r) => a + r.qty, 0)

    return (
        <div className={isOpen ? 'bg-slate-50/60 ring-1 ring-inset ring-slate-200/70' : ''}>
            <button
                type="button"
                onClick={onToggle}
                className={`w-full ${selection ? PKG_GRID_SELECT : PKG_GRID} text-[13px] px-4 py-3 items-center text-left transition-colors hover:bg-slate-50/70`}
            >
                {/* 그룹은 품종 묶음이라 그 자체를 재포장할 수 없다 — 안의 행만 고른다 */}
                {selection && <span />}
                <span className="font-bold text-slate-900 flex items-center gap-2 truncate">
                    <ChevronRight
                        className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-90 text-slate-700' : 'text-slate-400'}`}
                    />
                    <span className="truncate">{item.variety}</span>
                </span>
                {/* 그룹은 도정구분·생산자·로트가 섞일 수 있어 비운다 */}
                <span className="text-slate-300">—</span>
                <span className="text-slate-300">—</span>
                <span className="text-slate-300 text-center">—</span>
                <span className="text-slate-400 text-[12px] text-right pr-2">{item.rows.length}종 규격</span>
                <span className="tabular-nums text-slate-400 text-[12px] text-right pr-12">{totalQty.toLocaleString()}개</span>
                <span className="tabular-nums font-bold text-slate-900 text-right">
                    {item.total.toLocaleString()}kg
                </span>
                <span className="text-slate-300 text-right">—</span>
                <span></span>
            </button>

            {isOpen &&
                item.rows.map(row => (
                    <PackageSubRow key={row.id} row={row} actions={actions} selection={selection} />
                ))}
        </div>
    )
}
