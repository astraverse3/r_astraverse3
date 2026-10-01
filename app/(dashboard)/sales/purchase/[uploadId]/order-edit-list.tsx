'use client'

// 건 상세 「고치기」 모드 — 주문 수량 수정 · 품목 취소 · 건 취소 (계획서 `plan-발주서-건상세-수정추가.md` 1단계)
// 모양은 디자이너 작업지시 ⑦(`docs/handoff/점검-2026-09/작업지시-7-건상세-고치기.md`, 계획서 `plan-건상세-고치기-디자인.md`):
// 카드 한 장 안에 줄을 나열하고, 줄마다 [−][수량][+] · 바꾼 줄만 「저장」 · 그 밖엔 휴지통.
//
// 평소 줄 카드는 누르면 배분 시트가 열린다(M1-5). 그 동작과 섞이지 않게, 고칠 때만 이 목록으로 바꿔 그린다.
// 판정(차감보다 적게 못 줄임 · 마지막 품목 = 건 취소)은 서버가 `lib/purchase-order-edit.ts`로 한 번 더 한다 —
// 여기서 막는 건 뻔한 것만이다(− 버튼 하한 · 빨간 안내 · 차감된 줄 휴지통 비활성).
//
// 🔴 입력칸 기본값은 줄의 지금 주문 수량이다. 저장 뒤 `router.refresh()`로 줄이 새로 오면 `key`가 바뀌어
//    칸이 새 값으로 다시 마운트된다 — effect로 값을 맞추지 않는다.
// 🔴 0으로 「저장」도 휴지통과 같은 확인창을 거친다 — − 버튼이 생겨 0이 되기 쉬워졌다.

import { useState, type ReactNode } from 'react'
import { Lock, Minus, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ConfirmOptions } from '@/components/ui/confirm-dialog'
import { MAX_ORDER_QTY } from '@/lib/purchase-order-edit'
import type { OrderLine } from '@/lib/purchase-order-matrix'
import { specOf } from './order-line-card'
import { SkuPicker } from './sku-picker'
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
            </div>
            <AddItemForm busy={busy} onAdd={(id, qty) => run(() => edit.onAddItem(id, qty))} />
        </div>
    )
}

/**
 * 「+ 품목 추가」 — 접어 두었다가 펼치면 제품 검색 목록 + 수량. 처음 보는 규격이면 매트릭스에 열이 저절로 생긴다
 * (매트릭스는 줄 목록으로 다시 그려진다). 성공하면 접고 비운다.
 */
function AddItemForm({ busy, onAdd }: { busy: boolean; onAdd: (productTypeId: number, qty: number) => Promise<boolean> }) {
    const [open, setOpen] = useState(false)
    const [sku, setSku] = useState<AddableSku | null>(null)
    const [qtyText, setQtyText] = useState('1')
    const qty = Number(qtyText)
    const valid = sku !== null && Number.isInteger(qty) && qty >= 1 && qty <= MAX_ORDER_QTY

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 text-[13px] font-semibold text-slate-600 hover:bg-card sm:h-10"
            >
                <Plus className="h-4 w-4 text-primary" />
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
        if (!sku || !valid) return
        // 거부되면(같은 품목이 이미 있음 등) 입력을 남긴다 — 토스트가 이유를 말한다
        if (await onAdd(sku.id, qty)) close()
    }
    return (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-card p-3">
            <p className="text-[12px] font-semibold text-slate-700">품목 추가</p>
            <SkuPicker value={sku?.id ?? null} onChange={setSku} disabled={busy} />
            <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[12px] text-slate-500">
                    {sku ? `${sku.name} ${sku.spec} · ${sku.packaging}` : '위에서 제품을 골라 주세요'}
                </span>
                <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_ORDER_QTY}
                    value={qtyText}
                    onChange={(e) => setQtyText(e.target.value)}
                    disabled={busy}
                    aria-label="추가할 수량"
                    className="h-10 w-16 text-center font-mono text-[14px] font-semibold sm:h-8"
                />
                <span className="text-[12px] text-slate-500">개</span>
            </div>
            <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" className="h-10 sm:h-8" onClick={close} disabled={busy}>
                    닫기
                </Button>
                <Button type="button" className="h-10 sm:h-8" onClick={submit} disabled={!valid || busy}>
                    추가
                </Button>
            </div>
        </div>
    )
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
    const current = isInt ? qty : line.orderedQty
    const step = (d: number) =>
        setValue(String(Math.min(MAX_ORDER_QTY, Math.max(line.allocatedQty, current + d))))

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

            <QtyStepper
                line={line}
                value={value}
                onValue={setValue}
                busy={busy}
                changed={changed}
                valid={valid}
                current={current}
                onStep={step}
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

/** [−][수량][+] 한 덩어리 — 바뀌면 파랑, 잘못된 값이면 빨강 테두리. − 는 차감 수 아래로 못 내려간다 */
function QtyStepper({
    line,
    value,
    onValue,
    busy,
    changed,
    valid,
    current,
    onStep,
}: {
    line: OrderLine
    value: string
    onValue: (v: string) => void
    busy: boolean
    changed: boolean
    valid: boolean
    current: number
    onStep: (d: number) => void
}) {
    const sep = changed ? 'border-blue-200' : 'border-slate-200'
    return (
        <div
            className={cn(
                'inline-flex shrink-0 items-center overflow-hidden rounded-md border bg-card',
                changed ? 'border-blue-500 ring-2 ring-blue-100' : !valid ? 'border-red-300' : 'border-slate-300',
            )}
        >
            <StepButton
                label="하나 줄이기"
                disabled={busy || current <= line.allocatedQty}
                onClick={() => onStep(-1)}
                className={cn('border-r', sep)}
            >
                <Minus className="h-3.5 w-3.5" />
            </StepButton>
            <Input
                type="number"
                inputMode="numeric"
                min={line.allocatedQty}
                max={MAX_ORDER_QTY}
                value={value}
                disabled={busy}
                onChange={(e) => onValue(e.target.value)}
                aria-label={`${line.title} ${specOf(line)} 주문 수량`}
                // 14px는 작업지시 ④를 따른다 — layout이 확대를 막고 있어(maximumScale 1) iOS 확대가 안 일어난다
                className={cn(
                    'h-10 w-11 rounded-none border-0 bg-transparent px-0 text-center font-mono text-[14px] font-semibold shadow-none focus-visible:ring-0 sm:h-8',
                    '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                    changed ? 'text-blue-700' : 'text-slate-800',
                )}
            />
            <StepButton
                label="하나 늘리기"
                disabled={busy || current >= MAX_ORDER_QTY}
                onClick={() => onStep(1)}
                className={cn('border-l', sep)}
            >
                <Plus className="h-3.5 w-3.5" />
            </StepButton>
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

function StepButton({
    label,
    disabled,
    onClick,
    className,
    children,
}: {
    label: string
    disabled: boolean
    onClick: () => void
    className: string
    children: ReactNode
}) {
    return (
        <button
            type="button"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className={cn(
                'flex h-10 w-10 items-center justify-center text-slate-500 hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-transparent sm:h-8 sm:w-8',
                className,
            )}
        >
            {children}
        </button>
    )
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
