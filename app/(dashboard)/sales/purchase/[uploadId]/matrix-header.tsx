'use client'

// 매트릭스 화면 상단 — 시트 요약 · 정렬 · 매칭실패 배지와 재매칭.

import { ArrowUpDown, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { channelLabel } from '@/lib/purchase-channel'
import type { Matrix, MatrixSort } from '@/lib/purchase-order-matrix'
import type { PurchaseChannel } from '@prisma/client'
import type { MatrixHeader } from '@/app/actions/purchase-order-matrix'
import { fmt, fmtKg } from './matrix-layout'
import { MATRIX_SORTS } from './status-meta'

// 행 상태 라벨·색은 `status-meta.ts` 한 곳 — 매트릭스 행·건상세 줄·건목록 행이 같은 표를 쓴다.
// 순서(심각도)는 lib `ROW_STATUS_ORDER`가 갖는다.

export function Header({
    header,
    matrix,
    sort,
    onSort,
    unmatchedLines,
    rematching,
    onRematch,
}: {
    header: MatrixHeader
    matrix: Matrix
    sort: MatrixSort
    onSort: (s: MatrixSort) => void
    unmatchedLines: number
    rematching: boolean
    onRematch: () => void
}) {
    return (
        <div className="flex flex-col gap-2.5">
            {/* 뒤로가기 링크는 브레드크럼 「판매관리 / 제품판매」가 맡는다(2026-09-15) */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11.5px] font-bold text-primary">
                    {channelLabel(header.channel as PurchaseChannel)}
                </span>
                <h1 className="text-[17px] font-bold text-foreground">{header.sheetName}</h1>
                <span className="text-[12.5px] text-slate-500">
                    {header.orderCount}건 · {matrix.rows.length}수령인 · {matrix.columns.length}규격
                </span>
                {header.orderDate && (
                    <span className="text-[12.5px] text-slate-400">발주 {header.orderDate}</span>
                )}
                <span className="text-[12.5px] text-slate-400">{header.loading.label}</span>

                <div className="ml-auto flex items-center gap-1.5">
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                    {MATRIX_SORTS.map((s) => (
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

            {(matrix.totals.needsWorkRows > 0 || unmatchedLines > 0) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    {matrix.totals.needsWorkRows > 0 && (
                        <p className="text-[12.5px] text-slate-500">
                            주문 <b className="text-foreground">{fmt(matrix.totals.orderedQty)}개</b> ·{' '}
                            <b className="text-foreground">{fmtKg(matrix.totals.orderedKg)}kg</b> 중{' '}
                            <b className="text-amber-700">{matrix.totals.needsWorkRows}수령인</b>이 작업필요
                        </p>
                    )}
                    {unmatchedLines > 0 && (
                        <>
                            <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11.5px] font-bold text-red-600">
                                매칭실패 {fmt(unmatchedLines)}품목
                            </span>
                            {/* 업로드 뒤에 등록한 SKU·별칭을 다시 적용한다(결정 R) */}
                            <button
                                type="button"
                                onClick={onRematch}
                                disabled={rematching}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                            >
                                <RefreshCw className={cn('h-3 w-3', rematching && 'animate-spin')} />
                                {rematching ? '재매칭 중…' : '재매칭'}
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
