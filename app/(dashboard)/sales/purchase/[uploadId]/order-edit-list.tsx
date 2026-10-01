'use client'

// 건 상세 「고치기」 모드 — 주문 수량 수정 · 품목 취소 · 건 취소 (계획서 `plan-발주서-건상세-수정추가.md` 1단계)
//
// 평소 줄 카드는 누르면 배분 시트가 열린다(M1-5). 그 동작과 섞이지 않게, 고칠 때만 이 목록으로 바꿔 그린다.
// 판정(차감보다 적게 못 줄임 · 마지막 품목 = 건 취소)은 서버가 `lib/purchase-order-edit.ts`로 한 번 더 한다 —
// 여기서 막는 건 뻔한 것만이다(버튼 비활성·안내).
//
// 🔴 입력칸 기본값은 줄의 지금 주문 수량이다. 저장 뒤 `router.refresh()`로 줄이 새로 오면 `key`가 바뀌어
//    칸이 새 값으로 다시 마운트된다 — effect로 값을 맞추지 않는다.

import { useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ConfirmOptions } from '@/components/ui/confirm-dialog'
import { MAX_ORDER_QTY } from '@/lib/purchase-order-edit'
import type { OrderLine } from '@/lib/purchase-order-matrix'
import { specOf } from './order-line-card'

const fmt = (n: number) => n.toLocaleString()

/** 부모(매트릭스)가 서버를 부르고 토스트·새로고침까지 한다. 성공하면 true */
export type OrderEditHandlers = {
    onQty: (line: OrderLine, qty: number) => Promise<boolean>
    onCancelOrder: () => Promise<boolean>
}

export function OrderEditList({
    lines,
    edit,
    confirm,
}: {
    lines: OrderLine[]
    edit: OrderEditHandlers
    /** 건 상세(Sheet) 위에 띄우는 확인창 — 패널이 같이 닫히지 않게 패널이 가드를 건다 */
    confirm: (opts: ConfirmOptions) => Promise<boolean>
}) {
    const [busy, setBusy] = useState(false)
    const run = async (fn: () => Promise<boolean>) => {
        setBusy(true)
        try {
            await fn()
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
            <p className="px-1 text-[11.5px] leading-relaxed text-slate-500">
                수량을 고치고 <b className="text-slate-700">저장</b>을 누르세요. 0이면 품목이 취소돼요. 차감된 수보다
                적게는 못 줄여요.
            </p>
            {lines.map((l) => (
                <EditRow
                    key={`${l.itemId}:${l.orderedQty}`}
                    line={l}
                    busy={busy}
                    onSave={(qty) => run(() => edit.onQty(l, qty))}
                    onCancel={() => cancelLine(l)}
                />
            ))}
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
    const valid = value !== '' && Number.isInteger(qty) && qty >= line.allocatedQty && qty <= MAX_ORDER_QTY
    const changed = valid && qty !== line.orderedQty
    const locked = line.allocatedQty > 0

    return (
        <div className="rounded-xl border border-slate-200 bg-card px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13px] font-bold text-foreground">
                    {line.title} {specOf(line)}
                </span>
                {line.packagingName && <span className="text-[11px] text-slate-400">{line.packagingName}</span>}
                {locked && (
                    <span className="ml-auto text-[11px] font-semibold text-emerald-700">{fmt(line.allocatedQty)}개 차감됨</span>
                )}
            </div>
            <div className="mt-2 flex items-center gap-2">
                <span className="text-[12px] text-slate-500">주문</span>
                <Input
                    type="number"
                    inputMode="numeric"
                    min={line.allocatedQty}
                    max={MAX_ORDER_QTY}
                    value={value}
                    disabled={busy}
                    onChange={(e) => setValue(e.target.value)}
                    className={cn('h-10 w-24 text-right tabular-nums sm:h-8', !valid && 'border-red-300')}
                    aria-label={`${line.title} ${specOf(line)} 주문 수량`}
                />
                <span className="text-[12px] text-slate-500">개</span>
                <Button
                    type="button"
                    size="sm"
                    className="ml-auto h-10 gap-1 sm:h-8"
                    disabled={!changed || busy}
                    onClick={() => onSave(qty)}
                >
                    <Check className="h-3.5 w-3.5" />
                    저장
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-10 gap-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 sm:h-8"
                    disabled={locked || busy}
                    title={locked ? '차감된 품목은 차감을 먼저 취소해야 해요' : undefined}
                    onClick={onCancel}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                    취소
                </Button>
            </div>
            {!valid && value !== '' && qty < line.allocatedQty && (
                <p className="mt-1.5 text-[11px] text-red-600">
                    {fmt(line.allocatedQty)}개가 이미 차감돼 그보다 적게 줄일 수 없어요.
                </p>
            )}
        </div>
    )
}

/** 고치기 모드 푸터 — 건 취소 + 완료 */
export function OrderEditFooter({
    lines,
    edit,
    confirm,
    title,
    onDone,
}: {
    lines: OrderLine[]
    edit: OrderEditHandlers
    confirm: (opts: ConfirmOptions) => Promise<boolean>
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
                <p className="mb-2 px-0.5 text-[11.5px] text-slate-500">
                    차감된 품목이 있어 건 취소는 막혀 있어요({fmt(allocated)}개). 차감을 먼저 취소하세요.
                </p>
            )}
            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    className="h-11 gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={allocated > 0 || busy}
                    onClick={cancelOrder}
                >
                    <Trash2 className="h-4 w-4" />이 건 취소
                </Button>
                <Button type="button" className="ml-auto h-11 px-5" onClick={onDone}>
                    완료
                </Button>
            </div>
        </footer>
    )
}
