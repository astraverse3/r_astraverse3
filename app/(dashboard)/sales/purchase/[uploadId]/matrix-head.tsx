'use client'

// 매트릭스 머리글 4행(그룹 · 규격 · 규격별 소계 · 가용 재고). 본체에서 떼어낸 것이다.

import type { ReactNode } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { isColumnShort, type Matrix } from '@/lib/purchase-order-matrix'
import {
    fixedW, fmt, fmtKg, W_CHECK, W_NAME, W_STATUS, W_PROGRESS, W_LEFT,
    L_NAME, L_STATUS, L_PROGRESS, LEFT_COLS, H_GROUP, H_SPEC, H_SUM_MAIN, H_SUM_SUB,
} from './matrix-layout'

// ------------------------------------------------------
// 머리글 4행
// ------------------------------------------------------
export function MatrixHead({
    matrix,
    availKg,
    nameLabel,
    allChecked,
    someChecked,
    onToggleAll,
}: {
    matrix: Matrix
    availKg: number
    nameLabel: string
    allChecked: boolean
    someChecked: boolean
    onToggleAll: (v: boolean | 'indeterminate') => void
}) {
    const colByKey = new Map(matrix.columns.map((c) => [c.key, c]))
    return (
        <thead>
            {/* 1행 — 품목(그룹). 발주서 원본 순서 그대로 */}
            <tr>
                <HeadCorner left={0} width={W_CHECK}>
                    {/* 전체선택 — 부분선택은 가운데 막대로(Radix `indeterminate`) */}
                    <Checkbox
                        checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                        onCheckedChange={onToggleAll}
                        aria-label="전체 선택"
                        className="bg-card"
                    />
                </HeadCorner>
                <HeadCorner left={L_NAME} width={W_NAME} label={nameLabel} align="left" />
                <HeadCorner left={L_STATUS} width={W_STATUS} label="상태" />
                <HeadCorner left={L_PROGRESS} width={W_PROGRESS} label="진행" shadow />
                {matrix.groups.map((g) => (
                    <th
                        key={g.key}
                        colSpan={g.columnKeys.length}
                        className={cn(
                            'sticky top-0 z-30 border-b border-r border-slate-200 bg-slate-100 px-1.5 text-center align-middle font-bold',
                            g.unmatched ? 'text-red-600' : 'text-slate-600',
                        )}
                        style={{ height: H_GROUP }}
                    >
                        <span className="block truncate">{g.title}</span>
                        <span
                            className={cn(
                                '-mt-0.5 block truncate text-[9.5px] font-medium',
                                g.unmatched ? 'text-red-500' : 'text-slate-400',
                            )}
                        >
                            {g.packagingName}
                        </span>
                    </th>
                ))}
                <th
                    rowSpan={2}
                    className="sticky right-0 top-0 z-40 border-b border-l border-slate-200 bg-slate-100 px-1.5 text-center font-bold text-slate-600"
                    style={{ width: 72, minWidth: 72 }}
                >
                    소계
                    <span className="-mt-0.5 block text-[9px] font-medium text-slate-400">kg</span>
                </th>
            </tr>

            {/* 2행 — 규격 */}
            <tr>
                {matrix.columns.map((c) => (
                    <th
                        key={c.key}
                        className="sticky z-30 border-b border-r border-slate-200 bg-slate-100 px-1.5 text-center text-[10.5px] font-semibold text-slate-500"
                        style={{ top: H_GROUP, height: H_SPEC, minWidth: 46 }}
                    >
                        {/* 톤백은 자루중량만 적는다 — 「톤백」은 1행 그룹에 이미 있고,
                            중량이 없으면 1,000kg 열과 200kg 열이 안 갈린다 */}
                        {c.bulk ? `${fmtKg(c.unitWeightKg ?? 0)}kg` : c.packageType}
                    </th>
                ))}
            </tr>

            {/* 3행 — 규격별 소계(개) */}
            <SumRow
                top={H_GROUP + H_SPEC}
                label="규격별 소계"
                unit="(개)"
                columns={matrix.columns}
                valueOf={(c) => c.orderedQty}
                kg={matrix.totals.orderedKg}
                strong
                colByKey={colByKey}
            />

            {/* 4행 — 가용 재고(개) */}
            <SumRow
                top={H_GROUP + H_SPEC + H_SUM_MAIN}
                label="가용 재고"
                unit="(현재 SKU · 개 · 톤백은 kg)"
                columns={matrix.columns}
                valueOf={(c) => c.availableQty}
                kgOf={(c) => (c.bulk ? c.availableKg : null)}
                kg={availKg}
                colByKey={colByKey}
            />
        </thead>
    )
}

/** 좌측 고정 + 상단 고정이 겹치는 모서리 칸 (rowSpan 2) */
function HeadCorner({
    left,
    width,
    label,
    align = 'center',
    shadow,
    children,
}: {
    left: number
    width: number
    label?: string
    align?: 'left' | 'center'
    shadow?: boolean
    /** 라벨 대신 넣을 것 — 전체선택 체크박스 */
    children?: ReactNode
}) {
    return (
        <th
            rowSpan={2}
            className={cn(
                'sticky top-0 z-40 border-b border-r border-slate-200 bg-slate-200 px-2 font-bold text-slate-600',
                align === 'left' ? 'text-left' : 'text-center',
                children && 'px-0',
                shadow && 'shadow-[6px_0_8px_-6px_rgba(15,23,42,0.18)]',
            )}
            style={{ left, ...fixedW(width) }}
        >
            {children ? <span className="flex items-center justify-center">{children}</span> : label}
        </th>
    )
}

/** 소계·가용 띠 — 머리글 아래에 붙어 함께 고정된다 */
function SumRow({
    top,
    label,
    unit,
    columns,
    valueOf,
    kgOf,
    kg,
    strong,
    colByKey,
}: {
    top: number
    label: string
    unit: string
    columns: Matrix['columns']
    valueOf: (c: Matrix['columns'][number]) => number | null
    /** 값을 kg으로 적을 열 — 톤백 가용 칸. null이면 `valueOf`의 개수를 쓴다 */
    kgOf?: (c: Matrix['columns'][number]) => number | null
    kg: number
    strong?: boolean
    colByKey: Map<string, Matrix['columns'][number]>
}) {
    const height = strong ? H_SUM_MAIN : H_SUM_SUB
    return (
        <tr>
            <th
                colSpan={LEFT_COLS}
                className={cn(
                    'sticky left-0 z-40 border-b border-r border-slate-200 px-3 text-left shadow-[6px_0_8px_-6px_rgba(15,23,42,0.18)]',
                    strong
                        ? 'bg-slate-100 text-[12.5px] font-bold text-slate-600'
                        : 'bg-slate-50 text-[11.5px] font-semibold text-slate-500',
                )}
                style={{ top, height, ...fixedW(W_LEFT) }}
            >
                {label} <span className="text-[12px] font-medium text-slate-500">{unit}</span>
            </th>
            {columns.map((c) => {
                const v = valueOf(c)
                const colKg = kgOf?.(c) ?? null
                const col = colByKey.get(c.key)
                // 🔴 주문이 가용을 넘으면 양쪽 띠 모두 주황으로 — 어느 규격이 모자란지 한 줄로 보인다.
                //    판정은 lib의 `isColumnShort` 하나(톤백은 kg끼리 비교).
                const short = col !== undefined && isColumnShort(col)
                return (
                    <th
                        key={c.key}
                        className={cn(
                            'sticky z-[18] border-b border-r border-slate-200 px-1.5 text-right tabular-nums',
                            strong ? 'bg-slate-100 text-[15px]' : 'bg-slate-50 text-[11.5px]',
                            // 🔴 `short`를 `strong`보다 먼저 본다 — 순서를 바꾸면 소계 줄의
                            // 강조가 재고부족 앰버를 덮어 경고가 사라진다.
                            v === null
                                ? 'text-slate-300'
                                : short
                                  ? 'font-extrabold text-orange-700'
                                  : strong
                                    ? 'font-extrabold text-foreground'
                                    : 'text-slate-500',
                        )}
                        style={{ top, height }}
                    >
                        {colKg !== null ? (
                            <>
                                {fmtKg(colKg)}
                                <span className="ml-0.5 text-[8.5px] font-medium text-slate-400">kg</span>
                            </>
                        ) : v === null ? (
                            '·'
                        ) : (
                            fmt(v)
                        )}
                    </th>
                )
            })}
            <th
                className={cn(
                    'sticky right-0 z-40 border-b border-l border-slate-200 px-1.5 text-right tabular-nums',
                    strong
                        ? 'bg-slate-100 text-[15px] font-extrabold text-foreground'
                        : 'bg-slate-50 text-[11.5px] font-semibold text-slate-500',
                )}
                style={{ top, height }}
            >
                {fmtKg(kg)}
                <span className="ml-0.5 text-[8.5px] font-medium text-slate-400">kg</span>
            </th>
        </tr>
    )
}

// ------------------------------------------------------
// 상단 요약 · 정렬
