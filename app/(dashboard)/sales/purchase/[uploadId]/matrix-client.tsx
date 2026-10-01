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

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { CHANNEL_DECL, groupAxisOf, nameTiersOf } from '@/lib/purchase-channel'
import type { GateOrder } from '@/lib/purchase-order-gate'
import {
    applyMatchPatches,
    buildMatrix,
    buildOrderLines,
    sortMatrixRows,
    type BuildMatrixInput,
    type CellStatus,
    type MatchPatch,
    type MatrixColumn,
    type MatrixRow,
    type MatrixSort,
    type OrderLine,
} from '@/lib/purchase-order-matrix'
import type { PurchaseChannel } from '@prisma/client'
import type { CellPatch, MatrixHeader } from '@/app/actions/purchase-order-matrix'
import { rematchUpload } from '@/app/actions/purchase-order-assign'
import { deletePurchaseOrder, updateOrderItemQty } from '@/app/actions/purchase-order'
import { settle } from '@/lib/settle-action'
import type { OrderEditHandlers } from './order-edit-list'
import { addOrderItem, addPurchaseOrder } from '@/app/actions/purchase-order-add'
import { AddOrderDialog, type NewOrderDraft } from './add-order-dialog'
import type { BatchPatch } from '@/app/actions/purchase-order-batch'
import { CellAllocationPopover, type ActiveCell } from './cell-allocation-popover'
import { OrderListMobile } from './order-list-mobile'
import { OrderDetailPanel } from './order-detail-panel'
import { ReviewGateDialog } from './review-gate-dialog'
import { fixedW, cellSelector, fmt, fmtKg, W_CHECK, W_NAME, W_STATUS, W_PROGRESS, L_NAME, L_STATUS, L_PROGRESS } from './matrix-layout'
import { MatrixHead } from './matrix-head'
import { ColumnEditPopover, type ActiveHeader } from './column-edit-popover'
import { Header } from './matrix-header'
import { NameCell, Th, StatusDot, Progress, Legend } from './matrix-bits'

// 폭 · sticky 좌표 · 숫자 표기는 `matrix-layout.ts` 한 곳에서만 만든다.

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

export function MatrixClient({
    header,
    input: serverInput,
    canManage,
}: {
    header: MatrixHeader
    input: BuildMatrixInput
    /**
     * 가공·판매 권한. 없으면 **읽기 전용**(백로그 §60) — 차감으로 가는 콜백을 자식에게 안 넘긴다.
     * 자식은 콜백이 없으면 그 버튼을 안 그린다. 차감·게이트 로직 자체는 그대로다.
     */
    canManage: boolean
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
    /** 머리글 포장지·규격 수정 팝오버(plan-매트릭스-포장지규격-수정 ②) */
    const [editHeader, setEditHeader] = useState<ActiveHeader | null>(null)
    /** 「+ 주문 추가」 창(plan-발주서-건상세-수정추가 2단계) */
    const [addOrderOpen, setAddOrderOpen] = useState(false)
    /**
     * 열린 건 상세. `siblings`는 **열 때 찍은 스냅샷**이다 — 「다음 건 ›」이 따라갈 순서.
     *
     * 🔴 살아 있는 목록(`rows`·모바일 `shown`)을 매번 다시 읽으면 안 된다. 모바일 목록의 기본
     * 필터가 「작업필요」라 이 건을 차감하는 순간 목록에서 빠지고 뒤 건이 한 칸 당겨진다 —
     * 그 상태로 다음을 고르면 **바로 다음 건을 건너뛴다**.
     */
    const [detail, setDetail] = useState<{
        orderId: number
        head: string
        tail: string | null
        siblings: number[]
        /** 열자마자 고치기 모드(폰 택배 「고치기」) */
        edit?: boolean
    } | null>(null)

    // 행 일괄선택(D3) — 키는 orderId라 정렬이 바뀌어도 선택이 유지된다
    const [selected, setSelected] = useState<Set<number>>(new Set())
    const [gateOpen, setGateOpen] = useState(false)
    /**
     * 게이트 안에서 건을 고르게 할지(M1-6). **폰 목록 진입일 때만** 켠다 — 데스크탑은 매트릭스
     * 체크박스로 이미 골라 왔고, 건상세 일괄차감은 건이 하나다. 여는 곳마다 반드시 같이 정한다.
     */
    const [gatePick, setGatePick] = useState(false)
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

    /**
     * 게이트 선택 목록에 줄 건들(M1-6) — `selectedIds`와 같은 순서. 라인은 `buildOrderLines` 파생이라
     * 서버 왕복 0이다. 이름·그룹 축은 폰 목록과 **같은 함수**(`nameTiersOf`·`groupAxisOf`)로 푼다.
     */
    const gateOrders = useMemo((): GateOrder[] | undefined => {
        if (!gateOpen || !gatePick) return undefined
        const byId = new Map(matrix.rows.map((r) => [r.orderId, r]))
        return selectedIds.flatMap((id) => {
            const row = byId.get(id)
            if (!row) return []
            return [
                {
                    orderId: id,
                    group: groupAxisOf(decl, row),
                    name: nameTiersOf(decl, row)[0],
                    lines: buildOrderLines(input, id),
                },
            ]
        })
    }, [gateOpen, gatePick, selectedIds, matrix.rows, decl, input])

    // 업로드 시점 매칭이 굳어 있어, 마스터를 보완해도 화면은 실패인 채다 — 다시 돌린다(결정 R)
    const [rematching, startRematch] = useTransition()
    const runRematch = () =>
        startRematch(async () => {
            const r = await rematchUpload(header.uploadId)
            if (!r.success) {
                toast.error(r.error)
                return
            }
            // 차감이 없는 줄 전부를 다시 본다 — 새로 붙은 것과 다른 SKU로 옮긴 것을 따로 알린다
            const left = r.stillUnmatched > 0 ? ` · 매칭실패 ${r.stillUnmatched}품목 남음` : ''
            if (r.newlyMatched + r.moved === 0) {
                toast.info(`바뀐 품목이 없어요.${left}`)
            } else {
                applyMatches(r.patches)
                const parts = [
                    r.newlyMatched > 0 && `${r.newlyMatched}품목 새로 매칭`,
                    r.moved > 0 && `${r.moved}품목 다른 SKU로 옮김`,
                ].filter(Boolean)
                toast.success(`${parts.join(' · ')}${left}`)
            }
            if (r.blockedByDeduction > 0) {
                toast.warning(
                    `차감된 ${r.blockedByDeduction}품목은 옮기지 않았어요. 바꾸려면 그 칸의 차감을 먼저 취소하세요.`,
                )
            }
            if (r.needsReview > 0) {
                toast.warning(
                    `${r.needsReview}품목은 지금 기준으로 매칭이 안 돼요(SKU 비활성 등). 그대로 두었으니 확인해 주세요.`,
                )
            }
        })

    /**
     * 라인(itemId) → 그 라인이 앉은 셀과 사람 말 이름.
     * 셀 팝오버와 검토 게이트가 **같은 표기**를 써야 해서 한 곳에서 만든다 — 서버는 이름을 주지 않는다.
     */
    const lineIndex = useMemo(() => {
        const groupByKey = new Map(matrix.groups.map((g) => [g.key, g]))
        const index = new Map<number, { cellKey: string; orderId: number; who: string; what: string }>()
        for (const row of matrix.rows) {
            const who = nameTiersOf(decl, row)[0]
            for (const col of matrix.columns) {
                const cell = row.cells[col.key]
                if (!cell) continue
                const spec = col.bulk ? `${fmtKg(col.unitWeightKg ?? 0)}kg` : col.packageType
                const what = `${groupByKey.get(col.groupKey)?.title ?? ''} · ${spec}`
                const cellKey = `${row.orderId}|${col.key}`
                // 🔴 `orderId`를 같이 담는다 — 폰에는 갈 셀이 없어 **건**으로 데려가야 한다.
                //    `cellKey`를 쪼개 쓰지 않는다(표시·이동용 키를 식별자로 겸용하지 말 것).
                for (const itemId of cell.itemIds)
                    index.set(itemId, { cellKey, orderId: row.orderId, who, what })
            }
        }
        return index
    }, [matrix, decl])

    // 게이트에서 넘어온 셀로 데려간다. 강조는 스스로 꺼진다.
    //
    // 🔴 **한 프레임 미룬다.** 이 effect가 도는 시점은 게이트 다이얼로그가 언마운트되는 커밋이고,
    //    Radix가 그 뒤에 포커스를 원래 자리(선택 바 버튼)로 되돌린다 — 바로 스크롤하면 그 복원이
    //    스크롤을 원위치시킨다.
    useEffect(() => {
        if (!highlight) return
        const selector = cellSelector(highlight)
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

    /**
     * 주문 상세 열기 — 매트릭스 이름칸과 모바일 건목록이 **같은 함수**를 쓴다(표기가 갈리지 않게).
     * `siblings`는 부른 쪽이 「그 화면에 실제로 보이는 순서」를 넘긴다 — 모바일 목록은 필터가
     * 걸려 있어 `rows`와 다르다(§4.2). 안 넘기면 정렬된 전체 행이 형제다.
     */
    const openDetail = (row: MatrixRow, siblings?: number[], opts?: { edit?: boolean }) => {
        const [head, tail] = nameTiersOf(decl, row)
        setDetail({
            orderId: row.orderId,
            head,
            tail: tail || null,
            siblings: siblings ?? rows.map((r) => r.orderId),
            edit: opts?.edit,
        })
    }

    /**
     * 건 상세 「고치기」(plan-발주서-건상세-수정추가 1단계). 서버가 판정·쓰기, 성공하면 `router.refresh()`로
     * 서버 진실을 다시 받는다 — 드문 작업이라 패치 경로를 따로 짓지 않는다(위 prop 변화 감지 패턴이 받는다).
     */
    const editOrder: OrderEditHandlers | undefined = canManage
        ? {
              onQty: async (line, qty) => {
                  const r = await settle(updateOrderItemQty(line.itemId, qty))
                  if (!r.success) {
                      toast.error(r.error)
                      return false
                  }
                  toast.success(r.message)
                  if (r.orderRemoved && detail) forgetOrder(detail.orderId)
                  router.refresh()
                  return true
              },
              onCancelOrder: async () => {
                  if (!detail) return false
                  const r = await settle(deletePurchaseOrder(detail.orderId))
                  if (!r.success) {
                      toast.error(r.error)
                      return false
                  }
                  toast.success(r.message)
                  forgetOrder(detail.orderId)
                  router.refresh()
                  return true
              },
              onAddItem: async (productTypeId, qty) => {
                  if (!detail) return false
                  const r = await settle(addOrderItem(detail.orderId, productTypeId, qty))
                  if (!r.success) {
                      toast.error(r.error)
                      return false
                  }
                  toast.success(r.message)
                  router.refresh()
                  return true
              },
          }
        : undefined

    /** 「+ 주문 추가」 — 성공하면 창을 닫고 새로 받는다. 새 건은 이름순 정렬 자리에 나타난다 */
    const addOrder = async (draft: NewOrderDraft) => {
        const r = await settle(addPurchaseOrder({ uploadId: header.uploadId, ...draft }))
        if (!r.success) {
            toast.error(r.error)
            return false
        }
        toast.success(r.message)
        setAddOrderOpen(false)
        router.refresh()
        return true
    }

    /** 취소된 건을 행 선택에서도 뺀다 — 남아 있으면 검토 게이트가 사라진 건을 집는다 */
    const forgetOrder = (orderId: number) => {
        setDetail(null)
        setSelected((prev) => {
            if (!prev.has(orderId)) return prev
            const next = new Set(prev)
            next.delete(orderId)
            return next
        })
    }

    /**
     * 건 하나로 이동 — 「다음 건 ›」과 게이트의 「이 줄」이 같이 쓴다.
     * 형제 순서는 **이미 열려 있으면 그대로 물려준다**(다음 건을 누르다 순서가 바뀌면 안 된다).
     */
    const goDetail = (orderId: number) => {
        const row = matrix.rows.find((r) => r.orderId === orderId)
        if (!row) return
        const [head, tail] = nameTiersOf(decl, row)
        setDetail((prev) => ({
            orderId,
            head,
            tail: tail || null,
            siblings: prev?.siblings ?? rows.map((r) => r.orderId),
        }))
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

    /**
     * 라인 카드 탭 → 그 라인 하나로 배분 **시트**를 연다(M1-5). `anchor: null`이 시트라는 뜻이다.
     * 🔴 셀(`cell.itemIds`)이 아니라 **라인 하나**다 — 같은 규격 라인이 둘인 건에서 셀을 열면
     *    카드가 말한 숫자(라인)와 시트 숫자(합계)가 달라진다. 서버 액션은 원래 `itemIds[]`라 길이만 1이다.
     */
    const openLine = (line: OrderLine) => {
        const at = lineIndex.get(line.itemId)
        setActive({
            key: `item|${line.itemId}`,
            itemIds: [line.itemId],
            status: line.status,
            bulk: line.bulk,
            anchor: null,
            who: at?.who ?? '',
            what: at?.what ?? '',
        })
    }

    /*
     * 🔴 **닫기는 이 클릭이 끝난 뒤다**(`setTimeout 0`) — 게이트 `onJump`와 같은 이유.
     * 시트는 건상세 패널 **위**에 뜨고, 그동안 패널은 `blockOutsideClose`로 막혀 있다.
     * 시트의 X를 누르는 순간 `active`를 지우면 가드가 그 자리에서 풀리고, 터치일 때 Radix가
     * click까지 미뤄 둔 바깥 판정이 **같은 click**으로 패널에 닿아 패널까지 닫힌다.
     * 🔴 미룬 동안 **다른 셀이 열렸으면 건드리지 않는다**(key 비교). 팝오버가 열린 채 옆 셀을 탭하면
     *    바깥 판정(닫기)과 그 셀의 onClick(열기)이 같은 click에서 나고, 미룬 닫기가 새 팝오버를 닫는다.
     */
    const closeCell = () => {
        const key = active?.key
        setTimeout(() => setActive((cur) => (cur?.key === key ? null : cur)), 0)
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
                    rematching={rematching}
                    onRematch={canManage ? runRematch : undefined}
                    onAddOrder={canManage ? () => setAddOrderOpen(true) : undefined}
                    onOpenDetail={openDetail}
                    onOpenLine={canManage ? openLine : undefined}
                    onEditOrder={canManage ? (row, siblings) => openDetail(row, siblings, { edit: true }) : undefined}
                    input={input}
                    onOpenGate={
                        canManage
                            ? (ids) => {
                                  setSelected(new Set(ids))
                                  // 목록 푸터(`작업필요 n건 검토`)는 여러 건, 택배 펼침의 일괄차감은 건 하나다
                                  setGatePick(ids.length > 1)
                                  setGateOpen(true)
                              }
                            : undefined
                    }
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
                onRematch={canManage ? runRematch : undefined}
                onAddOrder={canManage ? () => setAddOrderOpen(true) : undefined}
            />

            <div className="overflow-auto rounded-xl border border-slate-200 bg-card max-h-[calc(100dvh-230px)]">
                <table className="border-separate border-spacing-0 text-[11.5px]">
                    <MatrixHead
                        matrix={matrix}
                        availKg={availKg}
                        nameLabel={decl.columnLabel}
                        allChecked={allChecked}
                        someChecked={someChecked}
                        onToggleAll={canManage ? toggleAll : undefined}
                        onEditHeader={
                            canManage
                                ? ({ field, productTypeIds, el }) =>
                                      setEditHeader({
                                          key: `${field}|${productTypeIds.join(',')}|${Date.now()}`,
                                          field,
                                          productTypeIds,
                                          anchor: el,
                                      })
                                : undefined
                        }
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
                                        {/* 🔴 터치영역은 label/패딩으로 — absolute 오버레이는 클릭을 삼킨다.
                                            읽기 전용이면 칸은 **폭 그대로 비운다** — sticky `left` 상수와 한 쌍이다 */}
                                        {canManage && (
                                            <label className="flex cursor-pointer items-center justify-center py-1">
                                                <Checkbox
                                                    checked={checked}
                                                    onCheckedChange={() => toggleRow(row.orderId)}
                                                    aria-label={`${nameTiersOf(decl, row)[0]} 선택`}
                                                />
                                            </label>
                                        )}
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
                                                    'text-right tabular-nums',
                                                    canManage &&
                                                        'cursor-pointer hover:ring-2 hover:ring-inset hover:ring-primary/50',
                                                    CELL_TONE[cell.status],
                                                    active?.key === cellKey && 'ring-2 ring-inset ring-primary',
                                                    // 게이트에서 「이 줄」을 눌러 찾아온 셀 — 잠깐만 튄다
                                                    highlight === cellKey &&
                                                        'ring-2 ring-inset ring-primary ring-offset-0 animate-pulse',
                                                )}
                                                title={`주문 ${cell.orderedQty} · 차감 ${cell.allocatedQty}`}
                                                onClick={canManage ? (e) => openCell(row, col, e.currentTarget) : undefined}
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

            <Legend canManage={canManage} />
            </div>

            {/*
             * 선택 바 — 표 바깥에 떠 있어야 가로 스크롤을 따라다니지 않는다.
             *
             * 🔴 **폰에는 띄우지 않는다**(`hidden sm:flex`). 선택은 매트릭스 행 체크박스로만
             * 하는데 매트릭스가 `hidden sm:contents`라 **폰에는 켜고 끌 수단이 아예 없다.**
             * 그런데도 떴던 이유는 목록 푸터 「작업필요 n건 검토」가 `onOpenGate`에서
             * `setSelected`를 채우기 때문 — 게이트를 닫으면 선택만 남아 **정체불명의 바**가
             * 목록 위에 눌러앉았다(닫는 X조차 깨진 박스 안에 있었다).
             *
             * 🔴 **`left-1/2 -translate-x-1/2`를 걷어냈다.** `translate`는 레이아웃이 끝난 뒤의
             * 시각 이동이라 **폭 계산에 반영되지 않는다** — shrink-to-fit 폭의 상한이
             * `100vw - left`, 즉 **화면의 절반**으로 잘린다. 390px 폰에서 195px이 되어
             * 「54수령처 선택」이 한 글자씩 세로로 쪼개졌다. 데스크탑은 절반이 넉넉해 안 드러났을 뿐
             * **창을 좁히면 똑같이 깨진다.** 가운데 정렬은 `inset-x-0` + `justify-center`로 한다.
             */}
            {selected.size > 0 && (
                <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 hidden justify-center px-4 sm:flex">
                    <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-primary/30 bg-card px-4 py-2.5 shadow-lg">
                        <span className="text-[13px] text-slate-600">
                            <b className="font-bold text-foreground">{fmt(selected.size)}수령처</b> 선택
                        </span>
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                                setGatePick(false)
                                setGateOpen(true)
                            }}
                        >
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
                </div>
            )}

            {/* 🔴 조건부 마운트 — 열 때마다 새로 계산한다(낡은 검토 화면으로 확정하지 않게) */}
            {gateOpen && (
            <ReviewGateDialog
                orderIds={selectedIds}
                orders={gateOrders}
                sheetName={header.sheetName}
                lookup={(itemId) => lineIndex.get(itemId) ?? null}
                onClose={() => setGateOpen(false)}
                onDone={(patch, summary) => {
                    applyBatchPatch(patch)
                    setGateOpen(false)
                    setSelected(new Set())
                    toast.success(`${fmt(summary.lines)}품목 · ${fmt(summary.units)}개를 차감했어요`)
                }}
                onJump={(itemId) => {
                    const at = lineIndex.get(itemId)
                    if (!at) return
                    /*
                     * 🔴 **폰에는 갈 셀이 없다.** 매트릭스는 `hidden sm:contents`(= `display:none`)라
                     * DOM에는 있지만 스크롤해도 아무 일이 일어나지 않는다 — 눌렀는데 무반응이다
                     * (D3의 `data-cell` 사고와 같은 증상). 브레이크포인트를 JS에 복제하는 대신
                     * **그 셀이 실제로 그려져 있는지**를 DOM에 묻고, 아니면 그 건의 상세로 데려간다.
                     */
                    const el = document.querySelector(cellSelector(at.cellKey))
                    if (el instanceof HTMLElement && el.offsetParent !== null) {
                        // 건상세에서 게이트를 연 뒤 셀로 가는 길 — 패널이 열린 채면 오른쪽
                        // 468px을 덮어 정작 그 셀이 패널 뒤에 숨는다
                        setDetail(null)
                        setHighlight(at.cellKey)
                    } else {
                        goDetail(at.orderId)
                    }
                    /*
                     * 🔴 **게이트 닫기는 이 클릭이 끝난 뒤다**(`setTimeout 0`). 여기서 바로 닫으면
                     * 건상세의 `blockOutsideClose`가 **그 자리에서 풀리고**, 곧이어 document로
                     * 올라오는 **같은 click**이 건상세의 「바깥 클릭」으로 처리돼 패널이 닫힌다.
                     *
                     * Radix는 **터치 입력일 때 바깥 판정을 `pointerdown`이 아니라 `click`으로 미룬다**
                     * (`usePointerDownOutside`). 그래서 순서가 **React 핸들러 → outside 처리**가 되고,
                     * 가드를 먼저 푼 쪽이 자기 발을 밟는다. 2026-09-23 계측 로그가 그 순서를 그대로 보여 줬다:
                     * `onJump 진입 → 셀 판정 → goDetail → 건상세 onClose`.
                     *
                     * 📌 **막을 곳을 찾는 문제가 아니라 순서 문제였다** — 가드는 멀쩡했고 그때 이미 꺼져 있었다.
                     */
                    setTimeout(() => setGateOpen(false), 0)
                }}
            />
            )}

            {canManage && (
                <AddOrderDialog
                    open={addOrderOpen}
                    onOpenChange={setAddOrderOpen}
                    decl={decl}
                    orders={input.orders}
                    onSubmit={addOrder}
                />
            )}
            <ColumnEditPopover
                uploadId={header.uploadId}
                target={editHeader}
                onPatches={applyMatches}
                onClose={() => setEditHeader(null)}
            />
            <CellAllocationPopover
                cell={active}
                onPatch={applyPatch}
                onFail={() => router.refresh()}
                onClose={closeCell}
            />
            <OrderDetailPanel
                orderId={detail?.orderId ?? null}
                /*
                 * 🔴 게이트가 열려 있는 동안엔 바깥 클릭으로 닫히면 안 된다 — 게이트가 **이 패널 위**에
                 * 열리는데(M1-3), 그 안의 「이 줄」을 누르면 그 pointerdown이 패널의 **바깥**으로 잡혀
                 * 패널이 스스로 닫혔다. 자세한 내용은 `order-detail-panel.tsx`의 `blockOutsideClose`.
                 * 라인 탭으로 연 배분 시트(M1-5)도 이 패널 위에 뜬다 — 같은 이유로 막는다.
                 */
                blockOutsideClose={gateOpen || active !== null}
                lines={detailLines}
                title={detail?.head ?? ''}
                subtitle={detail?.tail ?? null}
                siblings={detail?.siblings ?? []}
                onNavigate={goDetail}
                /*
                 * 건 단위 일괄차감 = **검토 게이트를 건 하나로 여는 것**이다(M1-3).
                 * 게이트는 이미 `orderIds[]`를 받고 4갈래 구성·실패 배너를 갖고 있다 —
                 * 건상세용 확정 경로를 따로 지으면 그 판정이 두 벌이 된다.
                 * 🔴 패널은 **열어 둔 채**다. 확정 결과가 패널 숫자에 바로 반영되고,
                 *    이어서 「다음 건 ›」으로 넘어가는 것이 이 화면의 흐름이다.
                 */
                onBatch={
                    canManage
                        ? () => {
                              if (!detail) return
                              setSelected(new Set([detail.orderId]))
                              setGatePick(false)
                              setGateOpen(true)
                          }
                        : undefined
                }
                onOpenLine={canManage ? openLine : undefined}
                edit={editOrder}
                initialEdit={detail?.edit ?? false}
                onClose={() => setDetail(null)}
            />
        </div>
    )
}
