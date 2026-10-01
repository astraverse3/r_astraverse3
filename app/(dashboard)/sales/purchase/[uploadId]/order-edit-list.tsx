'use client'

// 건 상세 「고치기」 모드 — 주문 수량 수정 · 품목 취소 · 건 취소 (계획서 `plan-발주서-건상세-수정추가.md` 1단계)
// 모양은 디자이너 작업지시 ⑦(`docs/handoff/점검-2026-09/작업지시-7-건상세-고치기.md`, 계획서 `plan-건상세-고치기-디자인.md`):
// 카드 한 장 안에 줄을 나열하고, 줄마다 [−][수량][+] · 바꾼 줄만 「저장」 · 그 밖엔 휴지통.
// 맨 아래 줄은 「+ 품목 추가」(작업지시 ⑧ P3 — `plan-품목고르기-디자인.md`).
//
// 평소 줄 카드는 누르면 배분 시트가 열린다(M1-5). 그 동작과 섞이지 않게, 고칠 때만 이 목록으로 바꿔 그린다.
// 판정(차감보다 적게 못 줄임 · 마지막 품목 = 건 취소)은 서버가 `lib/purchase-order-edit.ts`로 한 번 더 한다 —
// 여기서 막는 건 뻔한 것만이다(− 버튼 하한 · 빨간 안내 · 차감된 줄 휴지통 비활성).
//
// 🔴 입력칸 기본값은 줄의 지금 주문 수량이다. 저장 뒤 `router.refresh()`로 줄이 새로 오면 `key`가 바뀌어
//    칸이 새 값으로 다시 마운트된다 — effect로 값을 맞추지 않는다.
// 🔴 0으로 「저장」도 휴지통과 같은 확인창을 거친다 — − 버튼이 생겨 0이 되기 쉬워졌다.

import { useEffect, useRef, useState } from 'react'
import { Lock, Plus, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ConfirmOptions } from '@/components/ui/confirm-dialog'
import { MAX_ORDER_QTY } from '@/lib/purchase-order-edit'
import type { OrderLine } from '@/lib/purchase-order-matrix'
import { specOf } from './order-line-card'
import { SkuPicker } from './sku-picker'
import { QtyStepper } from './qty-stepper'
import type { AddableSku } from '@/app/actions/purchase-order-add'

const fmt = (n: number) => n.toLocaleString()

/** 부모(매트릭스)가 서버를 부르고 토스트·새로고침까지 한다. 성공하면 true */
export type OrderEditHandlers = {
    onQty: (line: OrderLine, qty: number) => Promise<boolean>
    onCancelOrder: () => Promise<boolean>
    /** 「+ 품목 추가」(2단계) — 같은 SKU 줄이 이미 있으면 서버가 거부한다 */
    onAddItem: (productTypeId: number, qty: number) => Promise<boolean>
}

type Confirm = (opts: ConfirmOptions) => Promise<boolean>

export function OrderEditList({
    lines,
    edit,
    confirm,
}: {
    lines: OrderLine[]
    edit: OrderEditHandlers
    /** 건 상세(Sheet) 위에 띄우는 확인창 — 패널이 같이 닫히지 않게 패널이 가드를 건다 */
    confirm: Confirm
}) {
    const [busy, setBusy] = useState(false)
    const run = async (fn: () => Promise<boolean>) => {
        setBusy(true)
        try {
            return await fn()
        } finally {
            setBusy(false)
        }
    }

    const cancelLine = async (line: OrderLine) => {
        const last = lines.length === 1
        const ok = await confirm({
            title: last ? '이 건을 취소할까요?' : '이 품목을 취소할까요?',
            description: last
                ? `마지막 품목이라 건이 통째로 취소돼요.\n${line.title} ${specOf(line)} ${fmt(line.orderedQty)}개`
                : `${line.title} ${specOf(line)} ${fmt(line.orderedQty)}개`,
            confirmText: last ? '건 취소' : '품목 취소',
            cancelText: '돌아가기',
            destructive: true,
        })
        if (ok) await run(() => edit.onQty(line, 0))
    }

    return (
        <div className="flex flex-col gap-2">
            <p className="px-1 text-[12px] text-slate-500">
                바꾼 줄만 <b className="text-slate-700">저장</b>이 떠요 · 0이면 품목 취소
            </p>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-card">
                {lines.map((l) => (
                    <EditRow
                        key={`${l.itemId}:${l.orderedQty}`}
                        line={l}
                        busy={busy}
                        onSave={(qty) => (qty === 0 ? cancelLine(l) : run(() => edit.onQty(l, qty)))}
                        onCancel={() => cancelLine(l)}
                    />
                ))}
                {/* 품목 추가 = 이 카드의 마지막 줄(작업지시 ⑧ P3) */}
                <AddItemRow
                    busy={busy}
                    taken={lines.flatMap((l) => (l.productTypeId === null ? [] : [l.productTypeId]))}
                    onAdd={(id, qty) => run(() => edit.onAddItem(id, qty))}
                />
            </div>
        </div>
    )
}

/**
 * 「+ 품목 추가」 — 목록 카드 맨 아래 한 줄로 접혀 있다가, 같은 자리에서 펼친다(작업지시 ⑧ P3).
 * 처음 보는 규격이면 매트릭스에 열이 저절로 생긴다(매트릭스는 줄 목록으로 다시 그려진다).
 * 성공하면 접고 비운다. 거부되면(같은 품목이 이미 있음 등) 입력을 남긴다 — 토스트가 이유를 말한다.
 */
function AddItemRow({
    busy,
    taken,
    onAdd,
}: {
    busy: boolean
    taken: number[]
    onAdd: (productTypeId: number, qty: number) => Promise<boolean>
}) {
    const [open, setOpen] = useState(false)
    const [sku, setSku] = useState<AddableSku | null>(null)
    const [qtyText, setQtyText] = useState('1')
    const boxRef = useRef<HTMLDivElement>(null)
    const qty = Number(qtyText)
    const valid = sku !== null && Number.isInteger(qty) && qty >= 1 && qty <= MAX_ORDER_QTY

    // 펼치면 패널 본문을 내려 이 영역이 보이게 — 결과 목록이 포커스로 펼쳐진 뒤(2프레임 뒤)에 잰다
    useEffect(() => {
        if (!open) return
        let id = requestAnimationFrame(() => {
            id = requestAnimationFrame(() => revealInPanel(boxRef.current))
        })
        return () => cancelAnimationFrame(id)
    }, [open])

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex h-12 w-full items-center gap-1.5 pl-4 text-[13px] font-semibold text-blue-700 hover:bg-blue-50"
            >
                <Plus className="h-[15px] w-[15px]" />
                품목 추가
            </button>
        )
    }
    const close = () => {
        setOpen(false)
        setSku(null)
        setQtyText('1')
    }
    const submit = async () => {
        if (sku && valid && (await onAdd(sku.id, qty))) close()
    }
    return (
        <div ref={boxRef} className="bg-slate-50 px-4 pt-3 pb-4">
            <div className="mb-2 flex items-center">
                <span className="text-[12px] font-semibold text-slate-700">품목 추가</span>
                <button
                    type="button"
                    onClick={close}
                    disabled={busy}
                    aria-label="품목 추가 닫기"
                    className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200/60"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
            <SkuPicker
                autoFocus
                value={sku}
                onChange={setSku}
                taken={taken}
                qty={qtyText}
                onQty={setQtyText}
                disabled={busy}
                action={
                    <Button type="button" className="h-10 shrink-0 sm:h-8" onClick={submit} disabled={!valid || busy}>
                        추가
                    </Button>
                }
            />
        </div>
    )
}

/**
 * 건 상세 본문(`data-panel-scroll`)을 내려 이 요소 아래끝이 보이게. `scrollIntoView`는 쓰지 않는다 —
 * 시트·페이지까지 같이 움직인다(작업지시 ⑧ P3).
 */
function revealInPanel(el: HTMLElement | null) {
    const panel = el?.closest<HTMLElement>('[data-panel-scroll]')
    if (!el || !panel) return
    const over = el.getBoundingClientRect().bottom - panel.getBoundingClientRect().bottom
    if (over > 0) panel.scrollTop += over + 12
}

function EditRow({
    line,
    busy,
    onSave,
    onCancel,
}: {
    line: OrderLine
    busy: boolean
    onSave: (qty: number) => void
    onCancel: () => void
}) {
    const [value, setValue] = useState(String(line.orderedQty))
    const qty = Number(value)
    const isInt = value !== '' && Number.isInteger(qty)
    const tooLow = isInt && qty < line.allocatedQty
    const valid = isInt && !tooLow && qty <= MAX_ORDER_QTY
    const changed = valid && qty !== line.orderedQty
    const locked = line.allocatedQty > 0

    return (
        <div
            className={cn(
                'flex min-h-[60px] items-center gap-3 py-2 pr-2 pl-4 sm:h-14 sm:min-h-0 sm:py-0',
                changed && 'bg-blue-50/60',
            )}
        >
            <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[13px] font-semibold text-slate-800 sm:line-clamp-none sm:truncate">
                    {line.title} {specOf(line)}
                </p>
                <p className="truncate text-[12px]">
                    <RowNote line={line} qty={qty} tooLow={tooLow} changed={changed} locked={locked} />
                </p>
            </div>

            {/* − 는 차감 수 아래로 못 내려간다 */}
            <QtyStepper
                value={value}
                onValue={setValue}
                min={line.allocatedQty}
                max={MAX_ORDER_QTY}
                disabled={busy}
                tone={changed ? 'changed' : valid ? 'normal' : 'invalid'}
                label={`${line.title} ${specOf(line)} 주문 수량`}
            />

            {/* 동작 칸 — 폭을 고정해 줄마다 정렬이 맞게 */}
            <div className="flex w-[60px] shrink-0 justify-end">
                {changed ? (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => onSave(qty)}
                        className="h-10 rounded-md bg-primary px-3 text-[13px] font-semibold text-white disabled:opacity-50 sm:h-8"
                    >
                        저장
                    </button>
                ) : (
                    <button
                        type="button"
                        disabled={locked || busy}
                        title={locked ? '차감을 먼저 취소하세요' : '품목 취소'}
                        aria-label="품목 취소"
                        onClick={onCancel}
                        className="flex h-10 w-10 items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:text-slate-300 disabled:hover:bg-transparent sm:h-8 sm:w-8"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    )
}

/** 줄 2번째 칸 — 잘못된 값 > 바꿈 > 차감됨 > 평소(포장지) 순으로 하나만 */
function RowNote({
    line,
    qty,
    tooLow,
    changed,
    locked,
}: {
    line: OrderLine
    qty: number
    tooLow: boolean
    changed: boolean
    locked: boolean
}) {
    if (tooLow) return <span className="text-red-600">{fmt(line.allocatedQty)}개보다 적게 못 줄여요</span>
    if (changed) {
        return (
            <span className="font-medium text-blue-700">
                <span className="font-mono">{fmt(line.orderedQty)}</span> →{' '}
                <span className="font-mono">{fmt(qty)}</span>개
            </span>
        )
    }
    if (locked) {
        return (
            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                <Lock className="h-[11px] w-[11px]" />
                {fmt(line.allocatedQty)}개 차감됨 · 최소 {fmt(line.allocatedQty)}
            </span>
        )
    }
    return <span className="text-slate-500">{line.packagingName ?? '—'}</span>
}

/** 고치기 모드 푸터 — 「이 건 모두 취소」(글자 버튼) + 완료 */
export function OrderEditFooter({
    lines,
    edit,
    confirm,
    title,
    onDone,
}: {
    lines: OrderLine[]
    edit: OrderEditHandlers
    confirm: Confirm
    title: string
    onDone: () => void
}) {
    const [busy, setBusy] = useState(false)
    const allocated = lines.reduce((s, l) => s + l.allocatedQty, 0)
    const cancelOrder = async () => {
        const ok = await confirm({
            title: '이 건을 취소할까요?',
            description: `${title} · ${fmt(lines.length)}품목이 통째로 취소돼요.\n되돌리려면 다시 추가해야 해요.`,
            confirmText: '건 취소',
            cancelText: '돌아가기',
            destructive: true,
        })
        if (!ok) return
        setBusy(true)
        try {
            await edit.onCancelOrder()
        } finally {
            setBusy(false)
        }
    }
    return (
        <footer className="shrink-0 border-t border-slate-200 px-4 py-3">
            {allocated > 0 && (
                <p className="mb-2 px-0.5 text-[12px] text-slate-500">
                    차감된 품목이 있어 건 취소는 막혀 있어요({fmt(allocated)}개). 차감을 먼저 취소하세요.
                </p>
            )}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    disabled={allocated > 0 || busy}
                    onClick={cancelOrder}
                    className="inline-flex h-11 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold text-red-600 hover:bg-red-50 disabled:text-slate-300 disabled:hover:bg-transparent"
                >
                    <Trash2 className="h-[15px] w-[15px]" />이 건 모두 취소
                </button>
                <Button type="button" className="ml-auto h-11 px-6" onClick={onDone}>
                    완료
                </Button>
            </div>
        </footer>
    )
}
