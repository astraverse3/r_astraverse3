'use client'

// 셀 FIFO 배분 팝오버 (계획서 D2c C4)
//
// 매트릭스 셀을 누르면 그 자리에 뜬다. 열면 `getCellAllocation`으로 후보(FIFO 순)·추천·기차감을
// 받아 오고, 「차감 확정」은 `confirmCell`, 「차감 취소」는 `cancelCell`을 부른다.
// 결과 반영은 여기서 하지 않는다 — 성공하면 `onPatch(patch)`로 부모에게 넘기고 닫는다.
// 부모(`matrix-client.tsx`)가 `BuildMatrixInput`의 두 값만 갈아끼우고 `buildMatrix`를 다시 돌린다(결정 C).
// 실패하면 `onFail()` — 내 화면이 낡았을 수 있으니 부모가 전체 재조회로 진실에 맞춘다.
//
// 결정 D — 매칭실패는 안내만 한다(D2e). 톤백은 `tonbag-popover.tsx`의 `TonbagBody`로 위임한다(D2d).
// 완료 셀은 내역 + 취소.

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, Minus, Plus, Sparkles, Undo2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import type { Allocation } from '@/lib/purchase-order-allocation'
import type { CellStatus } from '@/lib/purchase-order-matrix'
import {
    cancelCell,
    confirmCell,
    getCellAllocation,
    type CellAllocation,
    type CellPatch,
} from '@/app/actions/purchase-order-matrix'
import { TonbagBody } from './tonbag-popover'

/** 부모가 넘기는 「어느 셀인가」 — 표시용 라벨과 액션에 필요한 itemIds */
export type ActiveCell = {
    key: string
    itemIds: number[]
    status: CellStatus
    bulk: boolean
    /** 팝오버가 붙을 셀 요소 */
    anchor: HTMLElement
    who: string
    /** `백옥찰 · 10kg` */
    what: string
}

const fmt = (n: number) => n.toLocaleString()
const md = (iso: string) => iso.slice(5).replace('-', '.')

export function CellAllocationPopover({
    cell,
    uploadId,
    onPatch,
    onFail,
    onClose,
}: {
    cell: ActiveCell | null
    /** 톤백 쪼개기(재포장) 비고에 적는다 */
    uploadId: number
    onPatch: (patch: CellPatch) => void
    onFail: () => void
    onClose: () => void
}) {
    return (
        <Popover open={cell !== null} onOpenChange={(o) => !o && onClose()}>
            {cell && <PopoverAnchor virtualRef={{ current: cell.anchor }} />}
            <PopoverContent
                align="start"
                side="bottom"
                sideOffset={2}
                collisionPadding={12}
                className="w-[320px] p-0 text-[12px]"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                {cell && (
                    <Body key={cell.key} cell={cell} uploadId={uploadId} onPatch={onPatch} onFail={onFail} onClose={onClose} />
                )}
            </PopoverContent>
        </Popover>
    )
}

// ------------------------------------------------------
// 본문 — 셀 종류로 갈라진다
// ------------------------------------------------------
function Body({
    cell,
    uploadId,
    onPatch,
    onFail,
    onClose,
}: {
    cell: ActiveCell
    uploadId: number
    onPatch: (patch: CellPatch) => void
    onFail: () => void
    onClose: () => void
}) {
    const blocked =
        cell.status === 'UNMATCHED'
            ? '품종 지정이 필요합니다. 매칭실패 셀은 다음 단계(D2e)에서 지정합니다.'
            : null

    return (
        <div className="flex flex-col">
            <Head cell={cell} onClose={onClose} />
            {blocked ? (
                <p className="px-3.5 py-3 leading-relaxed text-slate-500">{blocked}</p>
            ) : cell.bulk ? (
                <TonbagBody cell={cell} uploadId={uploadId} onPatch={onPatch} onFail={onFail} onClose={onClose} />
            ) : (
                <Loaded cell={cell} onPatch={onPatch} onFail={onFail} onClose={onClose} />
            )}
        </div>
    )
}

function Head({ cell, onClose }: { cell: ActiveCell; onClose: () => void }) {
    return (
        <div className="flex items-center gap-1.5 border-b border-slate-100 px-3.5 pt-3 pb-2.5">
            <span className="truncate text-[13px] font-bold text-foreground">{cell.what}</span>
            <span className="text-slate-300">·</span>
            <span className="truncate text-slate-500">{cell.who}</span>
            <button
                type="button"
                onClick={onClose}
                className="ml-auto -mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"
                aria-label="닫기"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    )
}

/** 서버에서 후보·추천을 받아 오는 부분. 로딩·오류·편집·완료 네 상태 */
function Loaded({
    cell,
    onPatch,
    onFail,
    onClose,
}: {
    cell: ActiveCell
    onPatch: (patch: CellPatch) => void
    onFail: () => void
    onClose: () => void
}) {
    const [data, setData] = useState<CellAllocation | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let alive = true
        getCellAllocation(cell.itemIds).then((r) => {
            if (!alive) return
            if (r.success) setData(r.data)
            else setError(r.error)
        })
        return () => {
            alive = false
        }
    }, [cell.itemIds])

    if (error) return <p className="px-3.5 py-3 text-red-600">{error}</p>
    if (!data) return <p className="px-3.5 py-3 text-slate-400">불러오는 중…</p>
    if (data.remainingQty === 0) {
        return <Completed cell={cell} data={data} onPatch={onPatch} onFail={onFail} onClose={onClose} />
    }
    return <Editor cell={cell} data={data} onPatch={onPatch} onFail={onFail} onClose={onClose} />
}

// ------------------------------------------------------
// 대기·부분·재고부족 — FIFO 추천을 손볼 수 있는 편집기
// ------------------------------------------------------
function Editor({
    cell,
    data,
    onPatch,
    onFail,
    onClose,
}: {
    cell: ActiveCell
    data: CellAllocation
    onPatch: (patch: CellPatch) => void
    onFail: () => void
    onClose: () => void
}) {
    const [counts, setCounts] = useState<Record<number, number>>(() =>
        Object.fromEntries(data.candidates.map((c) => [c.packageId, c.suggested])),
    )
    const [busy, setBusy] = useState(false)

    const sum = data.candidates.reduce((s, c) => s + (counts[c.packageId] ?? 0), 0)
    const over = sum > data.remainingQty
    const canConfirm = sum > 0 && !over && !busy

    const setCount = (packageId: number, next: number, max: number) =>
        setCounts((prev) => ({ ...prev, [packageId]: Math.max(0, Math.min(max, next)) }))

    const submit = async () => {
        const allocations: Allocation[] = data.candidates
            .filter((c) => (counts[c.packageId] ?? 0) > 0)
            .map((c) => ({ packageId: c.packageId, count: counts[c.packageId] }))
        setBusy(true)
        const r = await confirmCell(cell.itemIds, allocations)
        setBusy(false)
        if (!r.success) {
            toast.error(r.error)
            onFail()
            onClose()
            return
        }
        toast.success(`${cell.who} · ${cell.what} ${fmt(sum)}개 차감`)
        onPatch(r.patch)
        onClose()
    }

    return (
        <>
            <div className="flex items-center gap-1.5 border-b border-slate-100 px-3.5 py-2 text-[11px]">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="font-semibold text-slate-500">FIFO 추천 · 오래된 로트부터</span>
                <span className="ml-auto text-slate-500">
                    합계{' '}
                    <b className={cn('tabular-nums', over ? 'text-red-600' : 'text-foreground')}>{fmt(sum)}</b>
                    <span className="text-slate-400"> / {fmt(data.remainingQty)}</span>
                </span>
            </div>

            {data.allocated.length > 0 && <AllocatedList items={data.allocated} compact />}

            <div className="flex max-h-[260px] flex-col gap-1.5 overflow-y-auto px-3.5 py-2.5">
                {data.candidates.length === 0 && (
                    <p className="py-1 text-slate-400">이 규격의 가용 재고가 없습니다.</p>
                )}
                {data.candidates.map((c) => {
                    const n = counts[c.packageId] ?? 0
                    return (
                        <div
                            key={c.packageId}
                            className={cn(
                                'flex items-center gap-2 rounded-lg border px-2.5 py-1.5',
                                n > 0 ? 'border-primary/40 bg-primary/5' : 'border-slate-200',
                            )}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="truncate font-mono text-[11.5px] text-slate-700">
                                    {c.lotNo ?? '로트 없음'}
                                </div>
                                <div className="truncate text-[10px] text-slate-400">
                                    {c.source === 'PURCHASED' ? '입고' : '도정'} {md(c.date)} · {c.producer} · 가용{' '}
                                    {fmt(c.available)}
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                                <Step onClick={() => setCount(c.packageId, n - 1, c.available)} disabled={n <= 0}>
                                    <Minus className="h-3 w-3" />
                                </Step>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    max={c.available}
                                    value={n}
                                    onChange={(e) => setCount(c.packageId, Number(e.target.value) || 0, c.available)}
                                    className="h-6 w-11 rounded-md border border-slate-200 bg-card text-center text-[13px] font-bold tabular-nums text-foreground outline-none focus:border-primary"
                                />
                                <Step
                                    onClick={() => setCount(c.packageId, n + 1, c.available)}
                                    disabled={n >= c.available}
                                >
                                    <Plus className="h-3 w-3" />
                                </Step>
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="flex flex-col gap-1.5 border-t border-slate-100 px-3.5 py-2.5">
                {data.shortage > 0 && (
                    <p className="text-[11px] font-semibold text-orange-700">
                        재고가 {fmt(data.shortage)}개 부족합니다. 가능한 만큼만 차감하면 부분으로 남습니다.
                    </p>
                )}
                {over && (
                    <p className="text-[11px] font-semibold text-red-600">남은 수량보다 많습니다.</p>
                )}
                <button
                    type="button"
                    disabled={!canConfirm}
                    onClick={submit}
                    className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-[13px] font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
                >
                    <Check className="h-3.5 w-3.5" />
                    {busy ? '차감 중…' : `이 셀 차감 확정 · ${fmt(sum)}개`}
                </button>
                {data.allocatedQty > 0 && (
                    <CancelButton cell={cell} count={data.allocatedQty} onPatch={onPatch} onFail={onFail} onClose={onClose} />
                )}
            </div>
        </>
    )
}

// ------------------------------------------------------
// 완료 — 배분 내역 + 차감 취소
// ------------------------------------------------------
function Completed({
    cell,
    data,
    onPatch,
    onFail,
    onClose,
}: {
    cell: ActiveCell
    data: CellAllocation
    onPatch: (patch: CellPatch) => void
    onFail: () => void
    onClose: () => void
}) {
    return (
        <>
            <div className="flex items-center gap-1.5 border-b border-slate-100 px-3.5 py-2 text-[11px]">
                <Check className="h-3 w-3 text-emerald-600" />
                <span className="font-semibold text-emerald-700">차감 완료</span>
                <span className="ml-auto text-slate-500">
                    <b className="tabular-nums text-foreground">{fmt(data.allocatedQty)}</b>
                    <span className="text-slate-400"> / {fmt(data.orderedQty)}</span>
                </span>
            </div>
            <AllocatedList items={data.allocated} />
            <div className="border-t border-slate-100 px-3.5 py-2.5">
                <CancelButton cell={cell} count={data.allocatedQty} onPatch={onPatch} onFail={onFail} onClose={onClose} />
            </div>
        </>
    )
}

function AllocatedList({
    items,
    compact,
}: {
    items: CellAllocation['allocated']
    compact?: boolean
}) {
    return (
        <div className={cn('flex flex-col gap-1 px-3.5', compact ? 'border-b border-slate-100 py-2' : 'py-2.5')}>
            {compact && <div className="text-[10px] font-semibold text-slate-400">이미 차감</div>}
            {items.map((a) => (
                <div key={a.packageId} className="flex items-center justify-between text-[11px]">
                    <span className="truncate font-mono text-slate-500">
                        {a.lotNo ?? '로트 없음'} · {md(a.date)}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-emerald-700">
                        <Check className="h-3 w-3" />
                        {fmt(a.count)}개
                    </span>
                </div>
            ))}
        </div>
    )
}

export function CancelButton({
    cell,
    count,
    onPatch,
    onFail,
    onClose,
}: {
    cell: ActiveCell
    count: number
    onPatch: (patch: CellPatch) => void
    onFail: () => void
    onClose: () => void
}) {
    const [busy, setBusy] = useState(false)
    const run = async () => {
        const ok = await confirmDialog({
            title: '차감 취소',
            description: `${cell.who} · ${cell.what}\n차감 ${fmt(count)}개를 되돌려 재고를 복원합니다.`,
            confirmText: '차감 취소',
            destructive: true,
        })
        if (!ok) return
        setBusy(true)
        const r = await cancelCell(cell.itemIds)
        setBusy(false)
        if (!r.success) {
            toast.error(r.error)
            onFail()
            onClose()
            return
        }
        toast.success(`${cell.who} · ${cell.what} 차감 취소 (${fmt(count)}개 복원)`)
        onPatch(r.patch)
        onClose()
    }
    return (
        <button
            type="button"
            disabled={busy}
            onClick={run}
            className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 text-[12px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
            <Undo2 className="h-3.5 w-3.5" />
            {busy ? '취소 중…' : '차감 취소'}
        </button>
    )
}

function Step({
    onClick,
    disabled,
    children,
}: {
    onClick: () => void
    disabled?: boolean
    children: React.ReactNode
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
        >
            {children}
        </button>
    )
}
