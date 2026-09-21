'use client'

// 건 목록 (모바일) — 핸드오프 `모바일-건별리스트-핸드오프.md` §3
//
// 폰에서는 매트릭스를 쓰지 않는다. 실측 밀도가 그 이유다 — 택배는 67건이지만 규격이 안 겹쳐
// 94.4%가 빈 칸이고, 급식·이마트·시아스는 밀도가 높아도 건이 1~3개라 나란히 볼 상대가 없다.
// 매트릭스의 가치(건끼리 나란히 보기)가 실데이터에 없어서 건별 리스트로 되돌렸다(2026-09-18).
//
// 🔴 **서버를 부르지 않는다.** 행은 매트릭스와 **같은 `buildMatrix().rows`**이고 정렬도 같은
//    `sortMatrixRows`다. 목록 전용 액션을 만들면 정렬·상태가 두 벌이 된다(`listPurchaseOrders`는
//    그래서 만들지 않았다 — 핸드오프 §2.0).
// 🔴 상태 색·라벨은 `status-meta.ts` 한 곳. 판정은 lib `cellStatusOf` 한 곳.

import { useMemo, useState } from 'react'
import { ChevronRight, RefreshCw, ArrowUpDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { channelLabel, isSpareRow, nameTiersOf, type ChannelDecl } from '@/lib/purchase-channel'
import { ROW_STATUS_ORDER, type Matrix, type MatrixRow, type MatrixSort } from '@/lib/purchase-order-matrix'
import type { PurchaseChannel } from '@prisma/client'
import type { MatrixHeader } from '@/app/actions/purchase-order-matrix'
import { STATUS_META, QTY_TONE } from './status-meta'

const fmt = (n: number) => n.toLocaleString()

/** 정렬 라벨 — 매트릭스 헤더와 같은 3종(lib `MatrixSort`) */
const SORTS: { key: MatrixSort; label: string }[] = [
    { key: 'vendor', label: '발주처별' },
    { key: 'recipient', label: '수령인 가나다' },
    { key: 'needsWork', label: '작업 필요 먼저' },
]

/** 그 건의 라인 수 — 셀에 담긴 itemId를 센다 */
function lineCountOf(row: MatrixRow): number {
    return Object.values(row.cells).reduce((s, c) => s + c.itemIds.length, 0)
}

/**
 * 묶음 안에서 **반복되는 쪽**의 이름 — 그룹 헤더가 쓴다.
 *
 * 🔴 `row.vendor`로 묶으면 안 된다. 채널마다 무엇이 반복되는지가 다르다 —
 * 서울급식은 `vendor`가 은평구·서대문구로 **매 건 달라서**(상수는 수령인 쪽이다)
 * vendor로 묶으면 「그룹 3개 × 1건」이 되어 헤더가 행 수만큼 생긴다.
 * `nameTiersOf`가 이미 채널별로 [주 이름, 보조 이름]을 갈라 두었으므로 **보조 이름**을 쓴다:
 *   택배   → 주=수령인, 보조=발주처(땅끝황토친환경 9건…) → 그룹이 선다
 *   서울급식 → 주=발주처(은평구), 보조=수령인(행복플러스 상수) → 그룹 1개 → 헤더 없음
 *   기업별  → 보조 없음 → 그룹 없음
 */
function groupNameOf(decl: ChannelDecl, row: MatrixRow): string | null {
    return nameTiersOf(decl, row)[1]
}

export function OrderListMobile({
    header,
    matrix,
    rows,
    decl,
    sort,
    onSort,
    unmatchedLines,
    rematching,
    onRematch,
    onOpenDetail,
    onOpenGate,
}: {
    header: MatrixHeader
    matrix: Matrix
    /** 이미 `sortMatrixRows`를 통과한 행 — 매트릭스와 같은 배열이다 */
    rows: MatrixRow[]
    decl: ChannelDecl
    sort: MatrixSort
    onSort: (s: MatrixSort) => void
    unmatchedLines: number
    rematching: boolean
    onRematch: () => void
    /**
     * 건 상세 열기. 🔴 두 번째 인자로 **지금 화면에 보이는 순서**를 같이 넘긴다 —
     * 건상세의 「다음 건 ›」이 따라갈 형제 목록이다. 필터(`onlyWork`)가 여기 로컬 상태라
     * 부모의 `rows`와 다르고, 부모가 대신 만들 수 없다(§4.2).
     */
    onOpenDetail: (row: MatrixRow, siblings: number[]) => void
    onOpenGate: (orderIds: number[]) => void
}) {
    /** 기본은 「작업 필요」 — 다 끝난 건을 먼저 보여 줄 이유가 없다(§3.2) */
    const [onlyWork, setOnlyWork] = useState(true)

    const shown = useMemo(() => (onlyWork ? rows.filter((r) => r.needsWork) : rows), [rows, onlyWork])

    /**
     * 발주처 그룹. **정렬된 순서를 흐트러뜨리지 않는다** — 먼저 나온 그룹이 먼저 선다.
     * 핸드오프 §3.1은 「건수 많은 발주처 먼저」지만, 그건 정렬이 발주처별일 때의 이야기다.
     * 사용자가 「작업 필요 먼저」를 고른 상태에서 그룹을 건수순으로 다시 세우면 고른 정렬이 사라진다.
     */
    const groups = useMemo(() => {
        const m = new Map<string, MatrixRow[]>()
        for (const r of shown) {
            const k = groupNameOf(decl, r) ?? ''
            const list = m.get(k)
            if (list) list.push(r)
            else m.set(k, [r])
        }
        const entries = [...m.entries()]
        // 발주처별 정렬일 때만 큰 덩어리를 위로 — 작업 덩어리가 먼저 온다
        if (sort === 'vendor') entries.sort((a, b) => b[1].length - a[1].length)
        return entries
    }, [shown, decl, sort])

    /** 헤더를 그릴 가치가 있는가 — 그룹이 하나뿐이면 행 수만큼 같은 이름이 반복될 뿐이다 */
    const showGroupHeader = groups.length > 1

    /**
     * 건상세 「다음 건 ›」이 따라갈 순서 — **그룹으로 묶은 뒤의 순서**다.
     * 🔴 `shown`을 그대로 쓰면 안 된다. 발주처별 정렬일 때 그룹을 건수순으로 다시 세우므로
     * 화면에 보이는 차례와 어긋난다 — 사용자는 위에서 아래로 넘긴다고 믿는다.
     */
    const shownIds = useMemo(() => groups.flatMap(([, list]) => list.map((r) => r.orderId)), [groups])

    const workRows = useMemo(() => rows.filter((r) => r.needsWork), [rows])
    const workIds = useMemo(() => workRows.map((r) => r.orderId), [workRows])

    /** 상태별 건수 — 0인 상태는 칩을 만들지 않는다(§8-2와 같은 원칙) */
    const counts = useMemo(() => {
        const c = new Map<string, number>()
        for (const r of rows) c.set(r.status, (c.get(r.status) ?? 0) + 1)
        return c
    }, [rows])

    return (
        <div className="flex flex-col">
            {/* 헤더 — 채널 · 파일명 · 업로드 · 건수 */}
            <div className="flex flex-col gap-2.5 px-3 pt-1 pb-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                        {channelLabel(header.channel as PurchaseChannel)}
                    </span>
                    <h1 className="text-[15px] font-bold text-foreground">{header.sheetName}</h1>
                    <span className="text-[11.5px] text-slate-400">
                        {header.orderCount}건 · {matrix.columns.length}규격
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                    {ROW_STATUS_ORDER.map((k) => {
                        const n = counts.get(k) ?? 0
                        if (n === 0) return null
                        const meta = STATUS_META[k]
                        return (
                            <span
                                key={k}
                                className={cn(
                                    'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold',
                                    meta.badge,
                                )}
                            >
                                <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                                {meta.label} {fmt(n)}
                            </span>
                        )
                    })}
                    {unmatchedLines > 0 && (
                        // 업로드 뒤에 등록한 SKU·별칭을 다시 적용한다(결정 R)
                        <button
                            type="button"
                            onClick={onRematch}
                            disabled={rematching}
                            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                        >
                            <RefreshCw className={cn('h-3 w-3', rematching && 'animate-spin')} />
                            {rematching ? '재매칭 중…' : '재매칭'}
                        </button>
                    )}
                </div>
            </div>

            {/* 필터 · 정렬 */}
            <div className="flex items-center gap-1.5 border-y border-slate-200 bg-slate-50 px-3 py-2">
                <FilterChip active={onlyWork} onClick={() => setOnlyWork(true)}>
                    작업 필요 {fmt(workRows.length)}
                </FilterChip>
                <FilterChip active={!onlyWork} onClick={() => setOnlyWork(false)}>
                    전체 {fmt(rows.length)}
                </FilterChip>

                <DropdownMenu>
                    <DropdownMenuTrigger className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-semibold text-slate-500">
                        <ArrowUpDown className="h-3 w-3" />
                        {SORTS.find((s) => s.key === sort)?.label}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {SORTS.map((s) => (
                            <DropdownMenuItem key={s.key} onClick={() => onSort(s.key)} className="text-[13px]">
                                <Check className={cn('h-3.5 w-3.5', sort === s.key ? 'opacity-100' : 'opacity-0')} />
                                {s.label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* 목록 — 검토 버튼이 뜨면 마지막 행이 그 아래 깔리지 않게 자리를 비운다 */}
            <div className={cn('flex flex-col', workRows.length >= 5 && 'pb-16')}>
                {shown.length === 0 && (
                    <p className="px-4 py-10 text-center text-[12.5px] text-slate-400">
                        {onlyWork ? '전부 차감됐습니다.' : '건이 없습니다.'}
                    </p>
                )}
                {groups.map(([name, list]) => (
                    <div key={name || '_'}>
                        {showGroupHeader && (
                            <div className="flex items-center gap-1.5 bg-slate-50 px-4 pt-3 pb-1.5">
                                <span className="text-[10.5px] font-bold tracking-wider text-slate-400">
                                    {name || '미지정'}
                                </span>
                                <span className="rounded bg-slate-200/70 px-1.5 text-[10px] font-bold text-slate-500">
                                    {fmt(list.length)}
                                </span>
                            </div>
                        )}
                        {list.map((row) => (
                            <OrderRow
                                key={row.orderId}
                                row={row}
                                decl={decl}
                                onOpen={() => onOpenDetail(row, shownIds)}
                            />
                        ))}
                    </div>
                ))}
            </div>

            {/*
             * 검토 게이트 — 건이 5개 이상일 때만(§7). 급식·이마트·시아스는 건상세 일괄차감으로 충분하고,
             * 건 3개짜리 묶음에 「검토」 단계를 끼우면 탭이 늘 뿐이다.
             */}
            {/*
             * 🔴 **하단 탭바 위에 띄운다.** `sticky bottom-0`은 뷰포트 바닥에 붙는데, 거기엔 이미
             * `MobileNav`가 `fixed`(z-40 · h-60 · mb-4)로 떠 있어 버튼이 그 뒤로 숨는다.
             * 올릴 높이는 레이아웃이 본문에 주는 하단 여백과 **같은 식**을 쓴다
             * (`app/(dashboard)/layout.tsx:33`) — 한쪽만 바뀌면 다시 겹친다.
             */}
            {workRows.length >= 5 && (
                <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom)+1.5rem)] z-30 px-4">
                    <button
                        type="button"
                        onClick={() => onOpenGate(workIds)}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[14px] font-semibold text-primary-foreground shadow-lg shadow-primary/25"
                    >
                        작업 필요 {fmt(workRows.length)}건 검토
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            )}
        </div>
    )
}

function FilterChip({
    active,
    onClick,
    children,
}: {
    active: boolean
    onClick: () => void
    children: React.ReactNode
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'h-7 shrink-0 rounded-md px-2.5 text-[11.5px] font-semibold transition-colors',
                active ? 'bg-slate-900 text-white' : 'text-slate-500',
            )}
        >
            {children}
        </button>
    )
}

/**
 * 건 한 줄. 평균 1.4라인이라 카드가 아니라 한 줄이면 충분하다(핸드오프 §3.1).
 * 🔴 터치 영역은 버튼 자체의 패딩으로 만든다 — absolute 오버레이는 클릭을 삼킨다.
 */
function OrderRow({
    row,
    decl,
    onOpen,
}: {
    row: MatrixRow
    decl: ChannelDecl
    onOpen: () => void
}) {
    const meta = STATUS_META[row.status]
    const [head] = nameTiersOf(decl, row)
    const lines = lineCountOf(row)
    return (
        <button
            type="button"
            onClick={onOpen}
            className="flex w-full items-center gap-2.5 border-b border-slate-100 px-4 py-2.5 text-left active:bg-slate-50"
        >
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-bold text-foreground">{head}</span>
                    {/* 여유분은 주문이 아니라 여분으로 더 보내는 물량이다(§8-4) */}
                    {isSpareRow(row) && (
                        <span className="shrink-0 rounded bg-slate-100 px-1 text-[9.5px] font-bold text-slate-500">
                            여유분
                        </span>
                    )}
                </span>
                <span className="mt-0.5 block text-[10.5px] text-slate-400">{lines}라인</span>
            </span>
            <span className={cn('shrink-0 text-[12px] font-bold tabular-nums', QTY_TONE[row.status])}>
                {fmt(row.allocatedQty)}/{fmt(row.orderedQty)}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
        </button>
    )
}
