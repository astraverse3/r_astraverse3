'use client'

// 발주서 매트릭스 (계획서 D2b · D2c)
//
// 행=수령인 · 열=제품규격 · 셀=주문수량(색=차감상태).
// 이름칸은 채널 선언(`CHANNEL_DECL`)대로 `굵은 값 ｜ 세로선 ｜ 연한 값` 2단이다(C0-c).
// 셀 클릭 → FIFO 배분 팝오버(`cell-allocation-popover.tsx`), 이름 클릭 → 주문 상세 패널
// (`order-detail-panel.tsx`). 행 일괄선택 → 검토 게이트는 `review-gate-dialog.tsx`(D3).
//
// 🔴 **피벗은 여기서 돌린다**(D2c 결정 C). 서버는 `BuildMatrixInput`만 주고, 셀 차감이 끝나면
// 액션이 돌려준 「바뀐 두 값」(라인 allocatedQty · SKU 가용)만 input에 갈아끼운 뒤 `buildMatrix`를
// 다시 돌린다(15ms). 셀 상태·행 진행률·같은 SKU를 쓰는 다른 행의 재고부족이 전부 거기서 파생되므로
// 여기서 상태를 손으로 고치지 않는다 — 고치는 순간 판정 규칙이 두 곳이 된다.
// 확정이 실패하면(다른 세션이 먼저 차감했다 등) `router.refresh()`로 서버 진실에 맞춘다.
//
// 🔴 **밀도가 목적인 화면이라 목록 표준규격(44px 행)을 따르지 않는다.**
// 67행 × 25열을 한눈에 대조하는 게 이 화면의 존재 이유고, 표준을 그대로 대면
// 세로로 3배가 되어 발주서 원본과 눈이 안 맞는다. 기준서 §4.2의 「편집형 행·
// 대시보드 위젯은 헤더만」과 같은 예외로 둔다.
//
// sticky 좌표는 아래 상수 한 곳에서만 만든다 — 칸 폭과 left 값이 어긋나면
// 스크롤할 때 열이 겹쳐 보이는데, 눈으로는 원인을 못 찾는다.

import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpDown, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { CHANNEL_DECL, channelLabel, nameTiersOf, type ChannelDecl } from '@/lib/purchase-channel'
import {
    ROW_STATUS_ORDER,
    applyMatchPatches,
    buildMatrix,
    buildOrderLines,
    isColumnShort,
    sortMatrixRows,
    type BuildMatrixInput,
    type CellStatus,
    type Matrix,
    type MatchPatch,
    type MatrixColumn,
    type MatrixRow,
    type MatrixSort,
} from '@/lib/purchase-order-matrix'
import type { PurchaseChannel } from '@prisma/client'
import type { CellPatch, MatrixHeader } from '@/app/actions/purchase-order-matrix'
import { rematchUpload } from '@/app/actions/purchase-order-assign'
import type { BatchPatch } from '@/app/actions/purchase-order-batch'
import { CellAllocationPopover, type ActiveCell } from './cell-allocation-popover'
import { OrderListMobile } from './order-list-mobile'
import { STATUS_META } from './status-meta'
import { OrderDetailPanel } from './order-detail-panel'
import { ReviewGateDialog } from './review-gate-dialog'

// ------------------------------------------------------
// sticky 좌표 — 좌측 고정 4칸 (선택 · 이름 · 상태 · 진행)
// ------------------------------------------------------
/**
 * 좌측 고정 칸의 폭 — **width·min·max를 한꺼번에** 준다.
 *
 * 🔴 `width`만 주면 지켜지지 않는다. 테이블 auto 레이아웃은 내용(`whitespace-nowrap`)에 맞춰
 * 칸을 늘리는데, sticky `left`는 아래 상수로 **고정**돼 있어 실제 위치와 어긋난다. 그러면
 * 가로 스크롤할 때 상태·진행 칸이 왼쪽으로 당겨져 이름 칸을 덮고, 소계·가용 줄의 라벨
 * (`colSpan`이라 실제 열 합 폭을 갖는다)만 튀어나와 보인다.
 * 실측(2026-09-16): 이름칸 184 지정 → **201로 렌더**, 좌측 합 387 vs sticky 영역 370.
 */
const fixedW = (w: number) => ({ width: w, minWidth: w, maxWidth: w })

// 행 일괄선택 체크박스 칸 (D3). 맨 왼쪽이라 뒤 칸들의 left가 전부 이만큼 밀린다.
const W_CHECK = 34
// 204 = 실측이 원한 폭(201)에 여유 3px. 좁히면 잘림만 늘고, 넓히면 표가 그만큼 밀린다.
const W_NAME = 204
// 이름칸 앞 값 고정 폭 — 구분선이 모든 행에서 같은 x에 서야 한다(핸드오프 §4).
// ⚠️ 104px는 재검토 대상: `이마트본사 김보훈`·`울림생협 북가좌점`·`롯데백화점 평촌점`은 잘린다.
const W_NAME_HEAD = 104
const W_STATUS = 60
const W_PROGRESS = 92
const L_NAME = W_CHECK
const L_STATUS = W_CHECK + W_NAME
const L_PROGRESS = W_CHECK + W_NAME + W_STATUS
const W_LEFT = W_CHECK + W_NAME + W_STATUS + W_PROGRESS
/** 좌측 고정 칸 수 — 소계 줄이 이만큼 합쳐 라벨을 적는다 */
const LEFT_COLS = 4

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

// 행 상태 라벨·색은 `status-meta.ts` 한 곳 — 매트릭스 행·건상세 줄·건목록 행이 같은 표를 쓴다.
// 순서(심각도)는 lib `ROW_STATUS_ORDER`가 갖는다.

// 순서·라벨은 핸드오프 §7(단, 「최신」은 뺐다 — 시트 안 행은 createdAt이 전부 같아 의미가 없다).
// 발주처별이 기본 — 택배 시트는 같은 발주처가 흩어져 있어 원본 순서로는 블록이 안 잡힌다.
// 발주처가 상수인 채널(이마트·해남급식)은 자연히 수령인 순.
const SORTS: { key: MatrixSort; label: string }[] = [
    { key: 'vendor', label: '발주처별' },
    { key: 'recipient', label: '수령인 가나다' },
    { key: 'needsWork', label: '작업필요' },
]

const fmt = (n: number) => n.toLocaleString()
const fmtKg = (n: number) => (Math.round(n * 10) / 10).toLocaleString()

export function MatrixClient({
    header,
    input: serverInput,
}: {
    header: MatrixHeader
    input: BuildMatrixInput
}) {
    const router = useRouter()
    // 서버가 준 input을 로컬 상태로 든다. 차감 성공은 여기만 고치고, 실패는 router.refresh()로
    // 서버가 새 input을 내려보낸다 — 그때 로컬을 서버 값으로 되돌린다(prop 변화 감지 패턴).
    const [input, setInput] = useState(serverInput)
    const [seen, setSeen] = useState(serverInput)
    if (serverInput !== seen) {
        setSeen(serverInput)
        setInput(serverInput)
    }
    const matrix = useMemo(() => buildMatrix(input), [input])

    const [sort, setSort] = useState<MatrixSort>('vendor')
    const rows = useMemo(() => sortMatrixRows(matrix.rows, sort), [matrix.rows, sort])
    const decl = CHANNEL_DECL[header.channel as PurchaseChannel]

    const [active, setActive] = useState<ActiveCell | null>(null)
    const [detail, setDetail] = useState<{ orderId: number; head: string; tail: string | null } | null>(null)

    // 행 일괄선택(D3) — 키는 orderId라 정렬이 바뀌어도 선택이 유지된다
    const [selected, setSelected] = useState<Set<number>>(new Set())
    const [gateOpen, setGateOpen] = useState(false)
    /** 게이트에서 「이 줄」을 눌러 찾아온 셀 — 잠깐 강조했다가 스스로 꺼진다 */
    const [highlight, setHighlight] = useState<string | null>(null)

    const toggleRow = (orderId: number) =>
        setSelected((prev) => {
            const next = new Set(prev)
            if (!next.delete(orderId)) next.add(orderId)
            return next
        })
    // 게이트가 의존성으로 받는다 — 매 렌더 새 배열이면 열자마자 다시 계산한다
    const selectedIds = useMemo(() => [...selected], [selected])
    const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.orderId))
    const someChecked = selected.size > 0 && !allChecked
    const toggleAll = () =>
        setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.orderId)))

    /** 액션이 돌려준 「바뀐 두 값」만 갈아끼운다. 나머지 파생은 buildMatrix 재실행이 맞춘다 */
    const applyPatch = (patch: CellPatch) =>
        setInput((prev) => ({
            ...prev,
            items: prev.items.map((it) =>
                it.id in patch.allocatedQty ? { ...it, allocatedQty: patch.allocatedQty[it.id] } : it,
            ),
            availability: { ...prev.availability, [patch.productTypeId]: patch.availability },
            availabilityKg: { ...prev.availabilityKg, [patch.productTypeId]: patch.availabilityKg },
        }))

    /** 일괄차감 결과 — 바뀐 라인·SKU가 여럿이다(결정 H). 파생은 buildMatrix가 낸다 */
    const applyBatchPatch = (patch: BatchPatch) =>
        setInput((prev) => ({
            ...prev,
            items: prev.items.map((it) =>
                it.id in patch.allocatedQty ? { ...it, allocatedQty: patch.allocatedQty[it.id] } : it,
            ),
            availability: { ...prev.availability, ...patch.availability },
            availabilityKg: { ...prev.availabilityKg, ...patch.availabilityKg },
        }))

    /** 재매칭 결과 — 라인의 SKU가 바뀌므로 열이 옮겨간다. 파생은 buildMatrix가 낸다 */
    const applyMatches = (patches: MatchPatch[]) =>
        setInput((prev) => applyMatchPatches(prev, patches))

    const unmatchedLines = useMemo(
        () => input.items.filter((it) => it.productTypeId === null).length,
        [input.items],
    )

    /**
     * 주문 상세 패널이 쓸 라인 — **서버를 부르지 않고 파생한다**(M1-1).
     * 차감하면 `input`이 바뀌므로 패널 숫자가 저절로 맞는다. 예전엔 열 때마다 다시 읽어 그 낡음을 막았다.
     */
    const detailLines = useMemo(
        () => (detail ? buildOrderLines(input, detail.orderId) : []),
        [input, detail],
    )

    // 업로드 시점 매칭이 굳어 있어, 마스터를 보완해도 화면은 실패인 채다 — 다시 돌린다(결정 R)
    const [rematching, startRematch] = useTransition()
    const runRematch = () =>
        startRematch(async () => {
            const r = await rematchUpload(header.uploadId)
            if (!r.success) {
                toast.error(r.error)
                return
            }
            if (r.matchedLines === 0) {
                toast.info(`새로 붙은 라인이 없어요. ${r.stillUnmatched}라인이 그대로 실패입니다.`)
                return
            }
            applyMatches(r.patches)
            toast.success(
                `${r.matchedLines}라인이 매칭됐어요` +
                    (r.stillUnmatched > 0 ? ` · ${r.stillUnmatched}라인 남음` : ''),
            )
        })

    /**
     * 라인(itemId) → 그 라인이 앉은 셀과 사람 말 이름.
     * 셀 팝오버와 검토 게이트가 **같은 표기**를 써야 해서 한 곳에서 만든다 — 서버는 이름을 주지 않는다.
     */
    const lineIndex = useMemo(() => {
        const groupByKey = new Map(matrix.groups.map((g) => [g.key, g]))
        const index = new Map<number, { cellKey: string; who: string; what: string }>()
        for (const row of matrix.rows) {
            const who = nameTiersOf(decl, row)[0]
            for (const col of matrix.columns) {
                const cell = row.cells[col.key]
                if (!cell) continue
                const spec = col.bulk ? `${fmtKg(col.unitWeightKg ?? 0)}kg` : col.packageType
                const what = `${groupByKey.get(col.groupKey)?.title ?? ''} · ${spec}`
                const cellKey = `${row.orderId}|${col.key}`
                for (const itemId of cell.itemIds) index.set(itemId, { cellKey, who, what })
            }
        }
        return index
    }, [matrix, decl])

    // 게이트에서 넘어온 셀로 데려간다. 강조는 스스로 꺼진다.
    //
    // 🔴 **한 프레임 미룬다.** 이 effect가 도는 시점은 게이트 다이얼로그가 언마운트되는 커밋이고,
    //    Radix가 그 뒤에 포커스를 원래 자리(선택 바 버튼)로 되돌린다 — 바로 스크롤하면 그 복원이
    //    스크롤을 원위치시킨다.
    // 🔴 매칭실패 열 키는 **엑셀 원본 문자열**(`raw:품목명|규격|포장지`)이라 따옴표·역슬래시가
    //    들어올 수 있다. 속성 선택자 값에서 그 둘만 이스케이프하면 된다.
    useEffect(() => {
        if (!highlight) return
        const selector = `[data-cell="${highlight.replace(/["\\]/g, '\\$&')}"]`
        const frame = requestAnimationFrame(() => {
            document
                .querySelector(selector)
                ?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
        })
        const timer = setTimeout(() => setHighlight(null), 2500)
        return () => {
            cancelAnimationFrame(frame)
            clearTimeout(timer)
        }
    }, [highlight])

    /** 주문 상세 열기 — 매트릭스 이름칸과 모바일 건목록이 **같은 함수**를 쓴다(표기가 갈리지 않게) */
    const openDetail = (row: MatrixRow) => {
        const [head, tail] = nameTiersOf(decl, row)
        setDetail({ orderId: row.orderId, head, tail: tail || null })
    }

    const openCell = (row: MatrixRow, col: MatrixColumn, el: HTMLElement) => {
        const cell = row.cells[col.key]
        const at = lineIndex.get(cell.itemIds[0])
        setActive({
            key: `${row.orderId}|${col.key}`,
            itemIds: cell.itemIds,
            status: cell.status,
            bulk: col.bulk,
            anchor: el,
            who: at?.who ?? '',
            what: at?.what ?? '',
        })
    }

    // 톤백 열은 서버가 행마다 곱해 온 kg 합을 그대로 쓴다 — 개수 × 열 중량은 틀린다(C0-a)
    const availKg = useMemo(
        () =>
            matrix.columns.reduce(
                (t, c) =>
                    t + (c.bulk ? (c.availableKg ?? 0) : (c.availableQty ?? 0) * (c.unitWeightKg ?? 0)),
                0,
            ),
        [matrix.columns],
    )

    return (
        <div className="flex flex-col gap-3">
            {/*
             * 🔴 **폰은 매트릭스를 쓰지 않는다**(2026-09-18). 실측 밀도가 이유다 — 택배는 67건이지만
             * 규격이 안 겹쳐 94.4%가 빈 칸이고, 급식·이마트·시아스는 건이 1~3개라 나란히 볼 상대가 없다.
             * 데이터·정렬·상태는 **둘이 같은 것을 쓴다**(`matrix`·`rows`) — 화면 모양만 다르다.
             */}
            <div className="sm:hidden">
                <OrderListMobile
                    header={header}
                    matrix={matrix}
                    rows={rows}
                    decl={decl}
                    sort={sort}
                    onSort={setSort}
                    unmatchedLines={unmatchedLines}
                    rematching={rematching}
                    onRematch={runRematch}
                    onOpenDetail={openDetail}
                    onOpenGate={(ids) => {
                        setSelected(new Set(ids))
                        setGateOpen(true)
                    }}
                />
            </div>

            <div className="hidden sm:contents">
            <Header
                header={header}
                matrix={matrix}
                sort={sort}
                onSort={setSort}
                unmatchedLines={unmatchedLines}
                rematching={rematching}
                onRematch={runRematch}
            />

            <div className="overflow-auto rounded-xl border border-slate-200 bg-card max-h-[calc(100dvh-230px)]">
                <table className="border-separate border-spacing-0 text-[11.5px]">
                    <MatrixHead
                        matrix={matrix}
                        availKg={availKg}
                        nameLabel={decl.columnLabel}
                        allChecked={allChecked}
                        someChecked={someChecked}
                        onToggleAll={toggleAll}
                    />
                    <tbody>
                        {rows.map((row) => {
                            const status = row.status
                            const checked = selected.has(row.orderId)
                            return (
                                <tr key={row.orderId} className={cn('group', checked && 'bg-primary/5')}>
                                    <Th
                                        as="td"
                                        className={cn(
                                            'sticky z-20 px-0 text-center group-hover:bg-slate-50',
                                            checked ? 'bg-primary/5' : 'bg-card',
                                        )}
                                        style={{ left: 0, ...fixedW(W_CHECK) }}
                                    >
                                        {/* 🔴 터치영역은 label/패딩으로 — absolute 오버레이는 클릭을 삼킨다 */}
                                        <label className="flex cursor-pointer items-center justify-center py-1">
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={() => toggleRow(row.orderId)}
                                                aria-label={`${nameTiersOf(decl, row)[0]} 선택`}
                                            />
                                        </label>
                                    </Th>
                                    <Th
                                        as="td"
                                        className={cn(
                                            'sticky z-20 text-left group-hover:bg-slate-50',
                                            checked ? 'bg-primary/5' : 'bg-card',
                                        )}
                                        style={{ left: L_NAME, ...fixedW(W_NAME) }}
                                    >
                                        <button
                                            type="button"
                                            className="block w-full text-left"
                                            onClick={() => openDetail(row)}
                                        >
                                            <NameCell decl={decl} row={row} />
                                        </button>
                                    </Th>
                                    <Th
                                        as="td"
                                        className={cn(
                                            'sticky z-20 text-center group-hover:bg-slate-50',
                                            checked ? 'bg-primary/5' : 'bg-card',
                                        )}
                                        style={{ left: L_STATUS, ...fixedW(W_STATUS) }}
                                    >
                                        <StatusDot status={status} />
                                    </Th>
                                    <Th
                                        as="td"
                                        className={cn(
                                            'sticky z-20 shadow-[6px_0_8px_-6px_rgba(15,23,42,0.12)] group-hover:bg-slate-50',
                                            checked ? 'bg-primary/5' : 'bg-card',
                                        )}
                                        style={{ left: L_PROGRESS, ...fixedW(W_PROGRESS) }}
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
                                        const cellKey = `${row.orderId}|${col.key}`
                                        return (
                                            <Th
                                                as="td"
                                                key={col.key}
                                                data-cell={cellKey}
                                                className={cn(
                                                    'cursor-pointer text-right tabular-nums hover:ring-2 hover:ring-inset hover:ring-primary/50',
                                                    CELL_TONE[cell.status],
                                                    active?.key === cellKey && 'ring-2 ring-inset ring-primary',
                                                    // 게이트에서 「이 줄」을 눌러 찾아온 셀 — 잠깐만 튄다
                                                    highlight === cellKey &&
                                                        'ring-2 ring-inset ring-primary ring-offset-0 animate-pulse',
                                                )}
                                                title={`주문 ${cell.orderedQty} · 차감 ${cell.allocatedQty}`}
                                                onClick={(e) => openCell(row, col, e.currentTarget)}
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

            {/* 선택 바 — 표 바깥에 떠 있어야 가로 스크롤을 따라다니지 않는다 */}
            {selected.size > 0 && (
                <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-primary/30 bg-card px-4 py-2.5 shadow-lg">
                    <span className="text-[13px] text-slate-600">
                        <b className="font-bold text-foreground">{fmt(selected.size)}수령처</b> 선택
                    </span>
                    <Button type="button" size="sm" onClick={() => setGateOpen(true)}>
                        차감 예정 확인
                    </Button>
                    <button
                        type="button"
                        onClick={() => setSelected(new Set())}
                        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        aria-label="선택 해제"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* 🔴 조건부 마운트 — 열 때마다 새로 계산한다(낡은 검토 화면으로 확정하지 않게) */}
            {gateOpen && (
            <ReviewGateDialog
                orderIds={selectedIds}
                sheetName={header.sheetName}
                lookup={(itemId) => lineIndex.get(itemId) ?? null}
                onClose={() => setGateOpen(false)}
                onDone={(patch, summary) => {
                    applyBatchPatch(patch)
                    setGateOpen(false)
                    setSelected(new Set())
                    toast.success(`${fmt(summary.lines)}라인 · ${fmt(summary.units)}개를 차감했어요`)
                }}
                onJump={(itemId) => {
                    const at = lineIndex.get(itemId)
                    if (!at) return
                    setGateOpen(false)
                    setHighlight(at.cellKey)
                }}
            />
            )}

            <CellAllocationPopover
                cell={active}
                onPatch={applyPatch}
                onFail={() => router.refresh()}
                onClose={() => setActive(null)}
            />
            <OrderDetailPanel
                orderId={detail?.orderId ?? null}
                lines={detailLines}
                title={detail?.head ?? ''}
                subtitle={detail?.tail ?? null}
                onClose={() => setDetail(null)}
            />
        </div>
    )
}

// ------------------------------------------------------
// 머리글 4행
// ------------------------------------------------------
function MatrixHead({
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
// ------------------------------------------------------
function Header({
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

            {(matrix.totals.needsWorkRows > 0 || unmatchedLines > 0) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    {matrix.totals.needsWorkRows > 0 && (
                        <p className="text-[12.5px] text-slate-500">
                            주문 <b className="text-foreground">{fmt(matrix.totals.orderedQty)}개</b> ·{' '}
                            <b className="text-foreground">{fmtKg(matrix.totals.orderedKg)}kg</b> 중{' '}
                            <b className="text-amber-700">{matrix.totals.needsWorkRows}수령인</b>이 작업 필요
                        </p>
                    )}
                    {unmatchedLines > 0 && (
                        <>
                            <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11.5px] font-bold text-red-600">
                                매칭실패 {fmt(unmatchedLines)}라인
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

// ------------------------------------------------------
// 이름칸 — `굵은 값 ｜ 세로선 ｜ 연한 값` (C0-c)
// ------------------------------------------------------
/**
 * 앞 값은 고정 폭 + truncate라 구분선이 행마다 같은 자리에 선다. 뒤 값은 남는 폭에서 잘린다.
 * `←` 화살표·색 스트라이프·조건부 2단은 핸드오프에서 기각됐다 — 되살리지 말 것.
 */
function NameCell({ decl, row }: { decl: ChannelDecl; row: MatrixRow }) {
    const [head, tail] = nameTiersOf(decl, row)
    const full = tail ? `${head} ｜ ${tail}` : head
    if (!tail) {
        return (
            <span className="block truncate text-[12.5px] font-bold text-foreground" title={full}>
                {head}
            </span>
        )
    }
    return (
        <span className="flex items-center" title={full}>
            <span
                className="flex-none truncate text-[12.5px] font-bold text-foreground"
                style={{ width: W_NAME_HEAD }}
            >
                {head}
            </span>
            <span className="min-w-0 truncate border-l border-slate-300 pl-2.5 text-[10.5px] font-medium text-slate-500">
                {tail}
            </span>
        </span>
    )
}

// ------------------------------------------------------
// 작은 조각들
// ------------------------------------------------------
/**
 * 🔴 props를 **명시적으로만** 받는다. 여기 없는 것은 DOM까지 가지 못한다 —
 * `data-*`는 JSX에서 임의 허용이라 **타입이 잡아주지 않고 조용히 사라진다**(D3에서 한 번 당했다:
 * 게이트의 「셀로 이동」이 `data-cell`을 못 찾아 아무 반응이 없었다). 새 속성을 쓰려면 여기 추가할 것.
 */
function Th({
    as: Tag = 'td',
    className,
    style,
    title,
    onClick,
    children,
    'data-cell': dataCell,
}: {
    as?: 'td' | 'th'
    className?: string
    style?: React.CSSProperties
    title?: string
    onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void
    children: React.ReactNode
    /** 검토 게이트가 이 셀을 찾아오는 앵커 — `${orderId}|${col.key}` */
    'data-cell'?: string
}) {
    return (
        <Tag
            className={cn('h-9 border-b border-r border-slate-100 px-1.5 whitespace-nowrap', className)}
            style={style}
            title={title}
            onClick={onClick}
            data-cell={dataCell}
        >
            {children}
        </Tag>
    )
}

function StatusDot({ status }: { status: CellStatus }) {
    const s = STATUS_META[status]
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
            {ROW_STATUS_ORDER.map((key) => {
                const s = STATUS_META[key]
                return (
                    <span key={key} className={cn('inline-flex items-center gap-1.5 font-medium', s.text)}>
                        <span className={cn('h-2 w-2 rounded-sm', s.dot)} />
                        {s.label}
                    </span>
                )
            })}
            <span className="text-slate-400">셀 = 주문 수량 · 소계 = 주문 중량 · 셀 클릭 = 차감 · 이름 클릭 = 주문 상세</span>
        </div>
    )
}
