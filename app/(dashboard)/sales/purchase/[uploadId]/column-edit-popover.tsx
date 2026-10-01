'use client'

// 매트릭스 머리글 → 포장지·규격 바꾸기 팝오버 (계획서 `docs/plan/plan-매트릭스-포장지규격-수정.md` ②)
//
// 2행 포장지 칸 = 그 묶음 전체의 포장지, 3행 규격 칸 = 그 열의 규격. 고치는 건 엑셀에서 읽은 원본 값이고
// SKU는 서버의 매처가 정한다(`editColumnRaw`). 선택지는 등록된 활성 SKU에 있는 값뿐이다.
//
// 🔴 셀 팝오버와 같은 `PopoverAnchor virtualRef` 방식 — 머리글 th는 sticky라 그 요소에 붙인다.

import { useEffect, useState } from 'react'
import { AlertCircle, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import {
    editColumnRaw,
    getColumnEditOptions,
    type ColumnEditInfo,
} from '@/app/actions/purchase-order-column-edit'
import type { ColumnEditField } from '@/lib/purchase-order-column-edit'
import type { MatchPatch } from '@/lib/purchase-order-matrix'
import { settle } from '@/lib/settle-action'

const fmt = (n: number) => n.toLocaleString()

export type ActiveHeader = {
    /** 같은 머리글을 다시 열면 새로 읽는다 — 본문 `key` */
    key: string
    field: ColumnEditField
    productTypeIds: number[]
    anchor: HTMLElement
}

/** 조사까지 — 「규격를」·「규격가」가 되지 않게 */
const LABEL: Record<ColumnEditField, { name: string; obj: string; subj: string }> = {
    packaging: { name: '포장지', obj: '포장지를', subj: '포장지가' },
    packageType: { name: '규격', obj: '규격을', subj: '규격이' },
}

export function ColumnEditPopover({
    uploadId,
    target,
    onPatches,
    onClose,
}: {
    uploadId: number
    target: ActiveHeader | null
    onPatches: (patches: MatchPatch[]) => void
    onClose: () => void
}) {
    return (
        <Popover open={target !== null} onOpenChange={(o) => !o && onClose()}>
            {target && <PopoverAnchor virtualRef={{ current: target.anchor }} />}
            <PopoverContent
                align="start"
                side="bottom"
                sideOffset={2}
                collisionPadding={12}
                className="w-[300px] p-0 text-[12px]"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                {target && (
                    <Body key={target.key} uploadId={uploadId} target={target} onPatches={onPatches} onClose={onClose} />
                )}
            </PopoverContent>
        </Popover>
    )
}

function Body({
    uploadId,
    target,
    onPatches,
    onClose,
}: {
    uploadId: number
    target: ActiveHeader
    onPatches: (patches: MatchPatch[]) => void
    onClose: () => void
}) {
    const [data, setData] = useState<ColumnEditInfo | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [picked, setPicked] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const label = LABEL[target.field]

    useEffect(() => {
        let alive = true
        settle(
            getColumnEditOptions({ uploadId, field: target.field, productTypeIds: target.productTypeIds }),
        ).then((r) => {
            if (!alive) return
            if (r.success) setData(r.data)
            else setError(r.error)
        })
        return () => {
            alive = false
        }
    }, [uploadId, target.field, target.productTypeIds])

    const submit = async () => {
        if (!picked) return
        setBusy(true)
        const r = await settle(
            editColumnRaw({ uploadId, field: target.field, productTypeIds: target.productTypeIds, value: picked }),
        )
        setBusy(false)
        if (!r.success) {
            toast.error(r.error)
            return
        }
        onPatches(r.patches)
        toast.success(`${fmt(r.lineCount)}품목의 ${label.obj} 바꿨어요. ${data?.current ?? ''} → ${picked}`)
        onClose()
    }

    return (
        <div className="flex flex-col">
            <div className="flex items-center gap-1.5 border-b border-slate-100 px-3.5 pt-3 pb-2.5">
                <span className="truncate text-[13px] font-bold text-foreground">{data?.title ?? ''}</span>
                <span className="shrink-0 text-slate-500">{label.name} 바꾸기</span>
                <button
                    type="button"
                    onClick={onClose}
                    className="-mr-1 ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"
                    aria-label="닫기"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
            {error ? (
                <p className="px-3.5 py-3 text-red-600">{error}</p>
            ) : !data ? (
                <p className="px-3.5 py-3 text-slate-400">불러오는 중…</p>
            ) : (
                <Choices data={data} label={label} picked={picked} onPick={setPicked} busy={busy} onSubmit={submit} />
            )}
        </div>
    )
}

function Choices({
    data,
    label,
    picked,
    onPick,
    busy,
    onSubmit,
}: {
    data: ColumnEditInfo
    label: (typeof LABEL)[ColumnEditField]
    picked: string | null
    onPick: (v: string) => void
    busy: boolean
    onSubmit: () => void
}) {
    const locked = data.deductedLines > 0
    const choosable = data.options.filter((o) => !o.disabled)
    return (
        <>
            {/* 칸 하나가 아니라 이 시트의 그 품목 전부가 바뀐다 — 범위를 먼저 말한다 */}
            <p className="border-b border-slate-100 px-3.5 py-1.5 text-[11px] text-slate-500">
                이 시트{' '}
                <b className="text-foreground">
                    {fmt(data.scope.recipientCount)}수령인 · {fmt(data.scope.lineCount)}품목
                </b>{' '}
                ({fmt(data.scope.orderedQty)}개)이 같이 바뀌어요
            </p>

            {locked && (
                <div className="flex items-start gap-1.5 border-b border-slate-100 bg-red-50/60 px-3.5 py-2 text-[11px]">
                    <AlertCircle className="mt-px h-3 w-3 shrink-0 text-red-500" />
                    <span className="leading-snug text-red-700">
                        차감된 품목이 {fmt(data.deductedLines)}개 있어 바꿀 수 없어요. 그 칸의 차감을 먼저 취소해
                        주세요.
                    </span>
                </div>
            )}

            <div className="flex flex-col gap-1 px-3.5 py-2.5">
                {data.options.map((o) => (
                    <button
                        key={o.value}
                        type="button"
                        disabled={locked || o.disabled || busy}
                        onClick={() => onPick(o.value)}
                        className={cn(
                            'flex items-center justify-between rounded-md border px-2.5 py-1.5 text-left',
                            picked === o.value
                                ? 'border-primary bg-primary/10 font-semibold text-primary'
                                : 'border-slate-200 hover:bg-slate-50',
                            'disabled:cursor-not-allowed disabled:bg-transparent disabled:text-slate-400 disabled:hover:bg-transparent',
                        )}
                    >
                        <span className="truncate">{o.value}</span>
                        {o.current ? (
                            <span className="shrink-0 text-[10.5px] text-slate-400">지금</span>
                        ) : o.reason ? (
                            <span className="shrink-0 text-[10.5px] text-slate-400">{o.reason}</span>
                        ) : null}
                    </button>
                ))}
                {choosable.length === 0 && (
                    <p className="text-[11px] leading-relaxed text-slate-500">
                        바꿀 수 있는 {label.subj} 없어요. <b className="text-slate-700">관리자 메뉴 › 제품유형 관리</b>에서
                        먼저 등록해 주세요.
                    </p>
                )}
                {data.field === 'packageType' && choosable.length > 0 && (
                    <p className="text-[11px] text-slate-500">주문 개수는 그대로예요. (10kg 2개 → 5kg 2개)</p>
                )}
            </div>

            <div className="flex flex-col gap-1.5 border-t border-slate-100 px-3.5 py-2.5">
                <p className="text-[10.5px] text-slate-400">같은 엑셀을 다시 올리면 엑셀 값으로 돌아가요.</p>
                <button
                    type="button"
                    disabled={!picked || locked || busy}
                    onClick={onSubmit}
                    className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-[13px] font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
                >
                    <Check className="h-3.5 w-3.5" />
                    {busy ? '바꾸는 중…' : picked ? `${data.current} → ${picked}` : `바꿀 ${label.obj} 골라 주세요`}
                </button>
            </div>
        </>
    )
}
