'use client'

// 매트릭스 머리글 5행(제목 · 포장지 · 규격 · 규격별 소계 · 가용 재고). 본체에서 떼어낸 것이다.

import type { ReactNode } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { isColumnShort, type Matrix, type MatrixColumn } from '@/lib/purchase-order-matrix'
import { isEditableSpec, type ColumnEditField } from '@/lib/purchase-order-column-edit'
import {
    fixedW, fmt, fmtKg, W_CHECK, W_NAME, W_STATUS, W_PROGRESS, W_LEFT,
    L_NAME, L_STATUS, L_PROGRESS, LEFT_COLS, H_TITLE, H_PACK, H_SPEC, H_SUM_MAIN, H_SUM_SUB,
} from './matrix-layout'

/** 제목·포장지·규격 — 좌측 모서리 칸과 오른쪽 소계 칸이 이만큼 세로로 걸친다 */
const HEAD_ROWS = 3

/** 머리글 클릭 → 포장지·규격 수정(plan-매트릭스-포장지규격-수정 ②) */
export type HeaderEditRequest = { field: ColumnEditField; productTypeIds: number[]; el: HTMLElement }

/** 원본 값을 고칠 수 있는 열 — 매칭된 일반 규격만. 톤백(자루중량 축)·매칭실패는 아니다 */
const editableColumn = (c: MatrixColumn | undefined): c is MatrixColumn & { productTypeId: number } =>
    !!c && c.productTypeId !== null && !c.bulk && isEditableSpec(c.packageType)

/** 머리글 안 버튼 — 글자 모양은 그대로 두고, 누를 수 있다는 단서만 호버로 준다 */
function HeadEditButton({ onClick, title, children }: { onClick: (el: HTMLElement) => void; title: string; children: ReactNode }) {
    return (
        <button
            type="button"
            title={title}
            onClick={(e) => onClick(e.currentTarget)}
            className="block w-full truncate rounded px-0.5 underline-offset-2 hover:bg-slate-200/70 hover:text-primary hover:underline"
        >
            {children}
        </button>
    )
}

// ------------------------------------------------------
// 머리글 5행
// ------------------------------------------------------
export function MatrixHead({
    matrix,
    availKg,
    nameLabel,
    allChecked,
    someChecked,
    onToggleAll,
    onEditHeader,
}: {
    matrix: Matrix
    availKg: number
    nameLabel: string
    allChecked: boolean
    someChecked: boolean
    /** 없으면(읽기 전용, §60) 전체선택 칸을 비운다 */
    onToggleAll?: (v: boolean | 'indeterminate') => void
    /** 없으면(읽기 전용) 머리글을 눌러도 아무 일 없다 */
    onEditHeader?: (req: HeaderEditRequest) => void
}) {
    const colByKey = new Map(matrix.columns.map((c) => [c.key, c]))
    return (
        <thead>
            {/* 1행 — 제목(품종·도정). 포장지만 다른 이웃 그룹은 한 칸으로 합친다(`matrix.titles`) */}
            <tr>
                <HeadCorner left={0} width={W_CHECK}>
                    {/* 전체선택 — 부분선택은 가운데 막대로(Radix `indeterminate`) */}
                    {onToggleAll && (
                        <Checkbox
                            checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                            onCheckedChange={onToggleAll}
                            aria-label="전체 선택"
                            className="bg-card"
                        />
                    )}
                </HeadCorner>
                <HeadCorner left={L_NAME} width={W_NAME} label={nameLabel} align="left" />
                <HeadCorner left={L_STATUS} width={W_STATUS} label="상태" />
                <HeadCorner left={L_PROGRESS} width={W_PROGRESS} label="진행" shadow />
                {matrix.titles.map((t) => (
                    <th
                        key={t.key}
                        colSpan={t.colSpan}
                        title={t.title}
                        className={cn(
                            'sticky top-0 z-30 border-b border-r border-slate-200 bg-slate-100 px-1.5 text-center align-middle font-bold',
                            t.unmatched ? 'text-red-600' : 'text-slate-600',
                        )}
                        style={{ height: H_TITLE }}
                    >
                        <span className="block truncate">{t.title}</span>
                    </th>
                ))}
                <th
                    rowSpan={HEAD_ROWS}
                    className="sticky right-0 top-0 z-40 border-b border-l border-slate-200 bg-slate-100 px-1.5 text-center font-bold text-slate-600"
                    style={{ width: 72, minWidth: 72 }}
                >
                    소계
                    <span className="-mt-0.5 block text-[9px] font-medium text-slate-400">kg</span>
                </th>
            </tr>

            {/* 2행 — 포장지(그룹). 좁은 열에선 잘리므로 올리면 전체가 보이게 `title` */}
            <tr>
                {matrix.groups.map((g) => {
                    const cols = g.columnKeys.map((k) => colByKey.get(k))
                    const editable = !!onEditHeader && !g.unmatched && cols.every(editableColumn)
                    return (
                    <th
                        key={g.key}
                        colSpan={g.columnKeys.length}
                        title={g.packagingName}
                        className={cn(
                            'sticky z-30 border-b border-r border-slate-200 bg-slate-100 px-1.5 text-center align-middle text-[10px] font-medium',
                            g.unmatched ? 'text-red-500' : 'text-slate-500',
                        )}
                        style={{ top: H_TITLE, height: H_PACK }}
                    >
                        {editable ? (
                            <HeadEditButton
                                title={`${g.packagingName} — 눌러서 포장지 바꾸기`}
                                onClick={(el) =>
                                    onEditHeader({
                                        field: 'packaging',
                                        productTypeIds: cols.filter(editableColumn).map((c) => c.productTypeId),
                                        el,
                                    })
                                }
                            >
                                {g.packagingName}
                            </HeadEditButton>
                        ) : (
                            <span className="block truncate">{g.packagingName}</span>
                        )}
                    </th>
                    )
                })}
            </tr>

            {/* 3행 — 규격 */}
            <tr>
                {matrix.columns.map((c) => (
                    <th
                        key={c.key}
                        className="sticky z-30 border-b border-r border-slate-200 bg-slate-100 px-1.5 text-center text-[10.5px] font-semibold text-slate-500"
                        style={{ top: H_TITLE + H_PACK, height: H_SPEC, minWidth: 46 }}
                    >
                        {/* 톤백은 자루중량만 적는다 — 「톤백」은 2행 포장지에 이미 있고,
                            중량이 없으면 1,000kg 열과 200kg 열이 안 갈린다 */}
                        {onEditHeader && editableColumn(c) ? (
                            <HeadEditButton
                                title={`${c.packageType} — 눌러서 규격 바꾸기`}
                                onClick={(el) => onEditHeader({ field: 'packageType', productTypeIds: [c.productTypeId], el })}
                            >
                                {c.packageType}
                            </HeadEditButton>
                        ) : c.bulk ? (
                            `${fmtKg(c.unitWeightKg ?? 0)}kg`
                        ) : (
                            c.packageType
                        )}
                    </th>
                ))}
            </tr>

            {/* 4행 — 규격별 소계(개) */}
            <SumRow
                top={H_TITLE + H_PACK + H_SPEC}
                label="규격별 소계"
                unit="(개)"
                columns={matrix.columns}
                valueOf={(c) => c.orderedQty}
                kg={matrix.totals.orderedKg}
                strong
                colByKey={colByKey}
            />

            {/* 5행 — 가용 재고(개) */}
            <SumRow
                top={H_TITLE + H_PACK + H_SPEC + H_SUM_MAIN}
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

/** 좌측 고정 + 상단 고정이 겹치는 모서리 칸 (제목·포장지·규격 3행에 걸침) */
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
            rowSpan={HEAD_ROWS}
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
