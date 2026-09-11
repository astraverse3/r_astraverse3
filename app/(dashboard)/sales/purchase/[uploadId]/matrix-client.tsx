'use client'

// 발주서 매트릭스 — 읽기 전용 (계획서 D2b)
//
// 행=수령처 · 열=제품규격 · 셀=주문수량(색=차감상태).
// 셀 클릭(FIFO 배분 팝오버)은 D2c, 행 일괄선택은 D3에서 붙는다.
//
// 🔴 **밀도가 목적인 화면이라 목록 표준규격(44px 행)을 따르지 않는다.**
// 67행 × 25열을 한눈에 대조하는 게 이 화면의 존재 이유고, 표준을 그대로 대면
// 세로로 3배가 되어 발주서 원본과 눈이 안 맞는다. 기준서 §4.2의 「편집형 행·
// 대시보드 위젯은 헤더만」과 같은 예외로 둔다.
//
// sticky 좌표는 아래 상수 한 곳에서만 만든다 — 칸 폭과 left 값이 어긋나면
// 스크롤할 때 열이 겹쳐 보이는데, 눈으로는 원인을 못 찾는다.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { channelLabel } from '@/lib/purchase-channel'
import { sortMatrixRows, type CellStatus, type Matrix, type MatrixSort } from '@/lib/purchase-order-matrix'
import type { PurchaseChannel } from '@prisma/client'
import type { MatrixHeader } from '@/app/actions/purchase-order-matrix'

// ------------------------------------------------------
// sticky 좌표 — 좌측 고정 3칸
// ------------------------------------------------------
const W_NAME = 184
const W_STATUS = 60
const W_PROGRESS = 92
const L_STATUS = W_NAME
const L_PROGRESS = W_NAME + W_STATUS
const W_LEFT = W_NAME + W_STATUS + W_PROGRESS

// 헤더 4행 높이 (그룹 · 규격 · 소계 · 가용)
//
// 🔴 소계 두 줄은 높이가 다르다. 소계는 「할 일」, 가용은 「조건」이라 주·보조 관계가
// 눈에 보여야 한다 — 같은 크기로 두면 어느 쪽이 주문이고 어느 쪽이 재고인지 안 갈린다.
const H_GROUP = 38
const H_SPEC = 24
const H_SUM_MAIN = 40
const H_SUM_SUB = 28

// ------------------------------------------------------
// 셀 상태 표기
// ------------------------------------------------------
const CELL_TONE: Record<CellStatus, string> = {
    COMPLETED: 'bg-emerald-50 text-emerald-700 font-semibold',
    PARTIAL: 'bg-amber-50 text-amber-700 font-bold',
    PENDING: 'bg-white text-slate-600',
    // 막힘 2종은 채도를 올려 「손대야 하는 칸」으로 읽히게 한다
    SHORTAGE: 'bg-orange-100 text-orange-800 font-bold',
    UNMATCHED: 'bg-red-50 text-red-600 font-bold',
}

const ROW_STATUS: { key: CellStatus; label: string; dot: string; text: string }[] = [
    { key: 'UNMATCHED', label: '매칭실패', dot: 'bg-red-500', text: 'text-red-600' },
    { key: 'SHORTAGE', label: '재고부족', dot: 'bg-orange-500', text: 'text-orange-700' },
    { key: 'PARTIAL', label: '부분', dot: 'bg-amber-500', text: 'text-amber-700' },
    { key: 'PENDING', label: '대기', dot: 'bg-slate-400', text: 'text-slate-500' },
    { key: 'COMPLETED', label: '완료', dot: 'bg-emerald-500', text: 'text-emerald-700' },
]

/** 행 하나를 대표하는 상태 — 가장 손이 많이 가는 것이 이긴다(위 배열 순서). */
function rowStatusOf(statuses: CellStatus[]): CellStatus {
    for (const s of ROW_STATUS) if (statuses.includes(s.key)) return s.key
    return 'COMPLETED'
}

const SORTS: { key: MatrixSort; label: string }[] = [
    { key: 'needsWork', label: '작업필요' },
    { key: 'recipient', label: '가나다' },
    { key: 'latest', label: '최신' },
]

const fmt = (n: number) => n.toLocaleString()
const fmtKg = (n: number) => (Math.round(n * 10) / 10).toLocaleString()

export function MatrixClient({ header, matrix }: { header: MatrixHeader; matrix: Matrix }) {
    const [sort, setSort] = useState<MatrixSort>('needsWork')
    const rows = useMemo(() => sortMatrixRows(matrix.rows, sort), [matrix.rows, sort])

    const availKg = useMemo(
        () =>
            matrix.columns.reduce(
                (t, c) => t + (c.availableQty ?? 0) * (c.unitWeightKg ?? 0),
                0,
            ),
        [matrix.columns],
    )

    return (
        <div className="flex flex-col gap-3">
            <Header header={header} matrix={matrix} sort={sort} onSort={setSort} />

            <div className="overflow-auto rounded-xl border border-slate-200 bg-card max-h-[calc(100dvh-230px)]">
                <table className="border-separate border-spacing-0 text-[11.5px]">
                    <MatrixHead matrix={matrix} availKg={availKg} />
                    <tbody>
                        {rows.map((row) => {
                            const status = rowStatusOf(
                                Object.values(row.cells).map((c) => c.status),
                            )
                            return (
                                <tr key={row.orderId} className="group">
                                    <Th
                                        as="td"
                                        className="sticky z-20 bg-card text-left group-hover:bg-slate-50"
                                        style={{ left: 0, width: W_NAME, minWidth: W_NAME }}
                                    >
                                        <span className="block truncate text-[12.5px] font-bold text-foreground">
                                            {row.recipient && row.vendor !== row.recipient ? (
                                                <>
                                                    {row.recipient}
                                                    <span className="ml-1 font-medium text-slate-400">
                                                        ←{row.vendor}
                                                    </span>
                                                </>
                                            ) : (
                                                row.vendor
                                            )}
                                        </span>
                                    </Th>
                                    <Th
                                        as="td"
                                        className="sticky z-20 bg-card text-center group-hover:bg-slate-50"
                                        style={{ left: L_STATUS, width: W_STATUS, minWidth: W_STATUS }}
                                    >
                                        <StatusDot status={status} />
                                    </Th>
                                    <Th
                                        as="td"
                                        className="sticky z-20 bg-card shadow-[6px_0_8px_-6px_rgba(15,23,42,0.12)] group-hover:bg-slate-50"
                                        style={{ left: L_PROGRESS, width: W_PROGRESS, minWidth: W_PROGRESS }}
                                    >
                                        <Progress done={row.allocatedQty} total={row.orderedQty} />
                                    </Th>

                                    {matrix.columns.map((col) => {
                                        const cell = row.cells[col.key]
                                        if (!cell) {
                                            return (
                                                <Th as="td" key={col.key} className="bg-white text-right text-slate-200">
                                                    ·
                                                </Th>
                                            )
                                        }
                                        return (
                                            <Th
                                                as="td"
                                                key={col.key}
                                                className={cn('text-right tabular-nums', CELL_TONE[cell.status])}
                                                title={`주문 ${cell.orderedQty} · 차감 ${cell.allocatedQty}`}
                                            >
                                                {fmt(cell.orderedQty)}
                                            </Th>
                                        )
                                    })}

                                    <Th
                                        as="td"
                                        className="sticky right-0 z-20 bg-slate-50 text-right font-bold text-slate-600 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.10)]"
                                    >
                                        {fmtKg(row.orderedKg)}
                                        <span className="ml-0.5 text-[8.5px] font-medium text-slate-400">kg</span>
                                    </Th>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            <Legend />
        </div>
    )
}

// ------------------------------------------------------
// 머리글 4행
// ------------------------------------------------------
function MatrixHead({ matrix, availKg }: { matrix: Matrix; availKg: number }) {
    const colByKey = new Map(matrix.columns.map((c) => [c.key, c]))
    return (
        <thead>
            {/* 1행 — 품목(그룹). 발주서 원본 순서 그대로 */}
            <tr>
                <HeadCorner left={0} width={W_NAME} label="수령처" align="left" />
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
                        {c.packageType}
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
                unit="(현재 SKU · 개)"
                columns={matrix.columns}
                valueOf={(c) => c.availableQty}
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
}: {
    left: number
    width: number
    label: string
    align?: 'left' | 'center'
    shadow?: boolean
}) {
    return (
        <th
            rowSpan={2}
            className={cn(
                'sticky top-0 z-40 border-b border-r border-slate-200 bg-slate-200 px-2 font-bold text-slate-600',
                align === 'left' ? 'text-left' : 'text-center',
                shadow && 'shadow-[6px_0_8px_-6px_rgba(15,23,42,0.18)]',
            )}
            style={{ left, width, minWidth: width }}
        >
            {label}
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
    kg,
    strong,
    colByKey,
}: {
    top: number
    label: string
    unit: string
    columns: Matrix['columns']
    valueOf: (c: Matrix['columns'][number]) => number | null
    kg: number
    strong?: boolean
    colByKey: Map<string, Matrix['columns'][number]>
}) {
    const height = strong ? H_SUM_MAIN : H_SUM_SUB
    return (
        <tr>
            <th
                colSpan={3}
                className={cn(
                    'sticky left-0 z-40 border-b border-r border-slate-200 px-3 text-left shadow-[6px_0_8px_-6px_rgba(15,23,42,0.18)]',
                    strong
                        ? 'bg-slate-100 text-[12.5px] font-bold text-slate-600'
                        : 'bg-slate-50 text-[11.5px] font-semibold text-slate-500',
                )}
                style={{ top, height, width: W_LEFT, minWidth: W_LEFT }}
            >
                {label} <span className="text-[12px] font-medium text-slate-500">{unit}</span>
            </th>
            {columns.map((c) => {
                const v = valueOf(c)
                const col = colByKey.get(c.key)
                // 🔴 주문이 가용을 넘으면 양쪽 띠 모두 주황으로 — 어느 규격이 모자란지 한 줄로 보인다
                const short =
                    col !== undefined &&
                    col.availableQty !== null &&
                    col.orderedQty > col.availableQty
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
                        {v === null ? '·' : fmt(v)}
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
// ------------------------------------------------------
function Header({
    header,
    matrix,
    sort,
    onSort,
}: {
    header: MatrixHeader
    matrix: Matrix
    sort: MatrixSort
    onSort: (s: MatrixSort) => void
}) {
    return (
        <div className="flex flex-col gap-2.5">
            <Link
                href="/sales?tab=product"
                className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
            >
                <ArrowLeft className="h-4 w-4" />
                제품판매
            </Link>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11.5px] font-bold text-primary">
                    {channelLabel(header.channel as PurchaseChannel)}
                </span>
                <h1 className="text-[17px] font-bold text-foreground">{header.sheetName}</h1>
                <span className="text-[12.5px] text-slate-500">
                    {header.orderCount}건 · {matrix.rows.length}수령처 · {matrix.columns.length}규격
                </span>
                {header.orderDate && (
                    <span className="text-[12.5px] text-slate-400">발주 {header.orderDate}</span>
                )}
                <span className="text-[12.5px] text-slate-400">{header.loading.label}</span>

                <div className="ml-auto flex items-center gap-1.5">
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                    {SORTS.map((s) => (
                        <button
                            key={s.key}
                            type="button"
                            onClick={() => onSort(s.key)}
                            className={cn(
                                'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                                sort === s.key
                                    ? 'bg-primary/15 text-primary'
                                    : 'text-slate-500 hover:bg-slate-100',
                            )}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {matrix.totals.needsWorkRows > 0 && (
                <p className="text-[12.5px] text-slate-500">
                    주문 <b className="text-foreground">{fmt(matrix.totals.orderedQty)}개</b> ·{' '}
                    <b className="text-foreground">{fmtKg(matrix.totals.orderedKg)}kg</b> 중{' '}
                    <b className="text-amber-700">{matrix.totals.needsWorkRows}수령처</b>가 작업 필요
                </p>
            )}
        </div>
    )
}

// ------------------------------------------------------
// 작은 조각들
// ------------------------------------------------------
function Th({
    as: Tag = 'td',
    className,
    style,
    title,
    children,
}: {
    as?: 'td' | 'th'
    className?: string
    style?: React.CSSProperties
    title?: string
    children: React.ReactNode
}) {
    return (
        <Tag
            className={cn('h-9 border-b border-r border-slate-100 px-1.5 whitespace-nowrap', className)}
            style={style}
            title={title}
        >
            {children}
        </Tag>
    )
}

function StatusDot({ status }: { status: CellStatus }) {
    const s = ROW_STATUS.find((x) => x.key === status) ?? ROW_STATUS[4]
    return (
        <span className={cn('inline-flex items-center gap-1 text-[10.5px] font-bold', s.text)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
            {s.label}
        </span>
    )
}

function Progress({ done, total }: { done: number; total: number }) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return (
        <div className="flex items-center gap-1.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                    className={cn('h-full', pct >= 100 ? 'bg-emerald-400' : 'bg-amber-400')}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="shrink-0 text-[10px] tabular-nums text-slate-500">
                {done}/{total}
            </span>
        </div>
    )
}

function Legend() {
    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[11.5px]">
            {ROW_STATUS.map((s) => (
                <span key={s.key} className={cn('inline-flex items-center gap-1.5 font-medium', s.text)}>
                    <span className={cn('h-2 w-2 rounded-sm', s.dot)} />
                    {s.label}
                </span>
            ))}
            <span className="text-slate-400">셀 = 주문 수량 · 소계 = 주문 중량</span>
        </div>
    )
}
