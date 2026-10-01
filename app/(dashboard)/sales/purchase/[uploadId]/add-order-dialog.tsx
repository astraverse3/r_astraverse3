'use client'

// 「+ 주문 추가」 창 — 작업 중인 시트에 수령인(주문 한 건)을 첫 품목과 함께 추가한다
// (계획서 `plan-발주서-건상세-수정추가.md` 2단계). 빈 건이 생기지 않게 첫 품목까지 한 번에 받는다.
//
// 입력칸은 채널 선언(`CHANNEL_DECL`)을 따른다 — 이름 열 표기와 같은 규칙이다.
//   · 행마다 바뀌는 쪽(primary)은 필수
//   · 시트 안에서 고정인 쪽(constantSide — 이마트·해남급식=발주처, 서울급식=수령인)은 시트의 기존 값으로 미리 채운다
//   · 기업별(single)은 한 칸 — 수령인 = 발주처
//   · 비워 둔 쪽은 다른 쪽과 같게 넣는다(파서가 수령인 빈칸에 발주처를 복사하는 것과 같은 방향)

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { MAX_ORDER_QTY } from '@/lib/purchase-order-edit'
import type { ChannelDecl } from '@/lib/purchase-channel'
import type { AddableSku } from '@/app/actions/purchase-order-add'
import { SkuPicker } from './sku-picker'

export type NewOrderDraft = { vendor: string; recipient: string; productTypeId: number; qty: number }

/** 시트에서 가장 많이 나온 값 — 고정 쪽 기본값 */
function mostCommon(values: string[]): string {
    const count = new Map<string, number>()
    for (const v of values) if (v) count.set(v, (count.get(v) ?? 0) + 1)
    let best = ''
    let n = 0
    for (const [v, c] of count) if (c > n) [best, n] = [v, c]
    return best
}

export function AddOrderDialog({
    open,
    onOpenChange,
    decl,
    orders,
    onSubmit,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    decl: ChannelDecl
    /** 고정 쪽 기본값을 고를 시트의 기존 건들 */
    orders: { vendor: string; recipient: string }[]
    /** 성공하면 true — 창을 닫는 건 부모 몫 */
    onSubmit: (draft: NewOrderDraft) => Promise<boolean>
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90svh] flex-col gap-3 sm:max-w-[440px]">
                <DialogHeader>
                    <DialogTitle>주문 추가</DialogTitle>
                    <DialogDescription>이 시트에 주문 한 건을 첫 품목과 함께 넣어요. 품목은 건 상세에서 더 추가할 수 있어요.</DialogDescription>
                </DialogHeader>
                {/* 열 때마다 새로 마운트 — 지난번 입력이 남지 않게 */}
                {open && <Form decl={decl} orders={orders} onSubmit={onSubmit} onCancel={() => onOpenChange(false)} />}
            </DialogContent>
        </Dialog>
    )
}

function Form({
    decl,
    orders,
    onSubmit,
    onCancel,
}: {
    decl: ChannelDecl
    orders: { vendor: string; recipient: string }[]
    onSubmit: (draft: NewOrderDraft) => Promise<boolean>
    onCancel: () => void
}) {
    const [vendor, setVendor] = useState(() =>
        decl.constantSide === 'vendor' && decl.primary !== 'single' ? mostCommon(orders.map((o) => o.vendor)) : '',
    )
    const [recipient, setRecipient] = useState(() =>
        decl.constantSide === 'recipient' ? mostCommon(orders.map((o) => o.recipient)) : '',
    )
    const [sku, setSku] = useState<AddableSku | null>(null)
    const [qtyText, setQtyText] = useState('1')
    const [busy, setBusy] = useState(false)

    const qty = Number(qtyText)
    // 필수 = 행마다 바뀌는 쪽. 기업별은 거래처(발주처) 한 칸
    const primaryValue = decl.primary === 'vendor' || decl.primary === 'single' ? vendor : recipient
    const valid = primaryValue.trim() !== '' && sku !== null && Number.isInteger(qty) && qty >= 1 && qty <= MAX_ORDER_QTY

    const submit = async () => {
        if (!valid || !sku) return
        // 비워 둔 쪽은 다른 쪽과 같게 — 서버는 수령인 빈칸만 발주처로 채우므로 발주처 빈칸은 여기서 채운다
        const v = vendor.trim() || recipient.trim()
        setBusy(true)
        try {
            await onSubmit({ vendor: v, recipient: recipient.trim(), productTypeId: sku.id, qty })
        } finally {
            setBusy(false)
        }
    }

    return (
        <>
            <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
                <NameFields
                    decl={decl}
                    vendor={vendor}
                    recipient={recipient}
                    onVendor={setVendor}
                    onRecipient={setRecipient}
                    disabled={busy}
                />
                <div className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-slate-700">첫 품목</span>
                    <SkuPicker value={sku?.id ?? null} onChange={setSku} disabled={busy} />
                </div>
                <QtyRow sku={sku} qtyText={qtyText} onQty={setQtyText} disabled={busy} />
            </div>
            <DialogFooter className="gap-2">
                <Button type="button" variant="outline" className="h-10" onClick={onCancel} disabled={busy}>
                    취소
                </Button>
                <Button type="button" className="h-10" onClick={submit} disabled={!valid || busy}>
                    {busy ? '추가하는 중…' : '주문 추가'}
                </Button>
            </DialogFooter>
        </>
    )
}

/** 채널 선언대로 이름 칸 — 행마다 바뀌는 쪽(필수)을 위에, 고정 쪽(미리 채움)을 아래에 */
function NameFields({
    decl,
    vendor,
    recipient,
    onVendor,
    onRecipient,
    disabled,
}: {
    decl: ChannelDecl
    vendor: string
    recipient: string
    onVendor: (v: string) => void
    onRecipient: (v: string) => void
    disabled: boolean
}) {
    if (decl.primary === 'single') {
        return <NameField label="거래처" value={vendor} onChange={onVendor} disabled={disabled} required />
    }
    const v = (
        <NameField label="발주처" value={vendor} onChange={onVendor} disabled={disabled} required={decl.primary === 'vendor'} />
    )
    const r = (
        <NameField label="수령인" value={recipient} onChange={onRecipient} disabled={disabled} required={decl.primary === 'recipient'} />
    )
    return decl.primary === 'vendor' ? (
        <>
            {v}
            {r}
        </>
    ) : (
        <>
            {r}
            {v}
        </>
    )
}

function QtyRow({
    sku,
    qtyText,
    onQty,
    disabled,
}: {
    sku: AddableSku | null
    qtyText: string
    onQty: (v: string) => void
    disabled: boolean
}) {
    return (
        <label className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[12px] text-slate-500">
                {sku ? `${sku.name} ${sku.spec} · ${sku.packaging}` : '위에서 제품을 골라 주세요'}
            </span>
            <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_ORDER_QTY}
                value={qtyText}
                onChange={(e) => onQty(e.target.value)}
                disabled={disabled}
                aria-label="수량"
                className="h-10 w-16 text-center font-mono text-[14px] font-semibold sm:h-9"
            />
            <span className="text-[12px] text-slate-500">개</span>
        </label>
    )
}

function NameField({
    label,
    value,
    onChange,
    disabled,
    required,
}: {
    label: string
    value: string
    onChange: (v: string) => void
    disabled: boolean
    required: boolean
}) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-slate-700">
                {label}
                {!required && <span className="ml-1 font-normal text-slate-500">(비우면 위와 같게)</span>}
            </span>
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                maxLength={100}
                className="h-10 text-[14px] sm:h-9"
            />
        </label>
    )
}
