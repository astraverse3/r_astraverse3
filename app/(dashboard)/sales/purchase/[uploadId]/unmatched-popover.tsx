'use client'

// 매칭실패 셀 수동지정 팝오버 (계획서 D2e E3)
//
// `cell-allocation-popover.tsx`의 `Body`가 매칭실패 셀일 때 이걸 띄운다(D2c가 안내만 하던 자리).
// 열면 `getUnmatchedCellOptions`로 품종·SKU 후보와 매처 부분해석을 받고,
// 「지정 저장」은 `assignUnmatchedColumn`을 부른다.
//
// 🔴 **지정은 셀이 아니라 열 전체에 닿는다**(결정 N) — 서버가 돌려준 `scope.itemIds`를 그대로 보낸다.
//    클릭한 셀의 itemIds가 아니다. 머리에 「N수령인 · M라인」으로 범위를 적어 둔다.
// 🔴 후보는 **기존 활성 SKU뿐**(결정 O). 없으면 어느 메뉴에서 등록하면 되는지 **일러 주기만** 한다 —
//    여기서 SKU도 품종도 만들지 않고, 링크로 새 탭을 열지도 않는다(사용자 결정 2026-09-15).
//
// 결과 반영은 부모가 한다(결정 C) — `onMatch(patch)`로 넘기고 닫는다.

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MatchPatch } from '@/lib/purchase-order-matrix'
import {
    assignUnmatchedColumn,
    getUnmatchedCellOptions,
    type UnmatchedCellOptions,
} from '@/app/actions/purchase-order-assign'
import type { ActiveCell } from './cell-allocation-popover'

const fmt = (n: number) => n.toLocaleString()

/** 매처가 어디서 멈췄는지 — 사람 말로 한 줄. */
function failLabel(d: UnmatchedCellOptions): string {
    if (d.fail.reason === 'variety_unresolved') {
        return `「${d.fail.varietyToken}」이 어느 품종인지 몰라요.`
    }
    if (d.fail.reason === 'packaging_unresolved') {
        return `포장지 「${d.rawPackaging ?? ''}」에 맞는 ${d.packageType} 제품유형이 없어요.`
    }
    return `${d.packageType} 제품유형이 등록돼 있지 않아요.`
}

export function UnmatchedBody({
    cell,
    onMatch,
    onFail,
    onClose,
}: {
    cell: ActiveCell
    onMatch: (patch: MatchPatch) => void
    onFail: () => void
    onClose: () => void
}) {
    const [data, setData] = useState<UnmatchedCellOptions | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [varietyId, setVarietyId] = useState<number | null>(null)
    const [skuId, setSkuId] = useState<number | null>(null)
    const [learn, setLearn] = useState(true)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        let alive = true
        getUnmatchedCellOptions(cell.itemIds).then((r) => {
            if (!alive) return
            if (r.success) {
                setData(r.data)
                // 매처가 품종까지는 풀었으면 그걸 기본으로 연다
                setVarietyId(r.data.fail.varietyId)
            } else setError(r.error)
        })
        return () => {
            alive = false
        }
    }, [cell.itemIds])

    const skus = useMemo(
        () => (data && varietyId !== null ? (data.skusByVariety[varietyId] ?? []) : []),
        [data, varietyId],
    )

    if (error) return <p className="px-3.5 py-3 text-red-600">{error}</p>
    if (!data) return <p className="px-3.5 py-3 text-slate-400">불러오는 중…</p>

    const submit = async () => {
        if (skuId === null) return
        setBusy(true)
        const r = await assignUnmatchedColumn(data.scope.itemIds, skuId, {
            learnAlias: data.alias.canLearn && learn,
        })
        setBusy(false)
        if (!r.success) {
            toast.error(r.error)
            onFail()
            onClose()
            return
        }
        const sku = skus.find((s) => s.id === skuId)
        toast.success(
            `${data.scope.lineCount}라인을 ${sku?.millingType ?? ''} ${sku?.packageType ?? ''}로 지정했습니다` +
                (r.learnedAlias ? ` · 별칭 「${r.learnedAlias}」 학습` : ''),
        )
        if (r.aliasSkipped) toast.warning(r.aliasSkipped)
        onMatch(r.patch)
        onClose()
    }

    return (
        <div className="flex flex-col">
            <div className="flex items-start gap-1.5 border-b border-slate-100 bg-red-50/60 px-3.5 py-2 text-[11px]">
                <AlertCircle className="mt-px h-3 w-3 shrink-0 text-red-500" />
                <span className="leading-snug text-red-700">{failLabel(data)}</span>
            </div>

            <p className="border-b border-slate-100 px-3.5 py-1.5 text-[11px] text-slate-500">
                이 품목 열{' '}
                <b className="text-foreground">
                    {fmt(data.scope.recipientCount)}수령인 · {fmt(data.scope.lineCount)}라인
                </b>{' '}
                전부에 적용돼요
            </p>

            <div className="flex flex-col gap-2 px-3.5 py-2.5">
                <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-500">품종</span>
                    <select
                        value={varietyId ?? ''}
                        onChange={(e) => {
                            setVarietyId(e.target.value === '' ? null : Number(e.target.value))
                            setSkuId(null)
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-card px-2 py-1.5 text-[12px] text-foreground"
                    >
                        <option value="">품종을 고르세요</option>
                        {/* SKU 0개도 고를 수 있게 둔다 — 골라야 「제품유형이 없어요」 안내를 볼 수 있다 */}
                        {data.varieties.map((v) => (
                            <option key={v.id} value={v.id}>
                                {v.name}
                                {v.skuCount === 0 ? ' (제품유형 없음)' : ''}
                            </option>
                        ))}
                    </select>
                </label>

                {/* 품종 마스터에 아예 없는 품목이 있다(혼합곡·누룽지·귀리쌀 등) — 여기서 만들지 않는다.
                    🔴 링크로 새 탭을 열지 않는다. 등록하고 와도 「재매칭」을 눌러야 해서 링크가 흐름을
                    완결시키지 못하고, 이 화면을 떠났다 오게 만들 뿐이다(사용자 결정 2026-09-15). */}
                {varietyId === null && (
                    <p className="text-[11px] leading-snug text-slate-400">
                        찾는 품종이 목록에 없으면 <b className="font-semibold text-slate-500">품종 관리</b>에서
                        먼저 등록해 주세요.
                    </p>
                )}

                {varietyId !== null && skus.length === 0 && <NoSku />}

                {skus.length > 0 && (
                    <div className="flex max-h-[200px] flex-col gap-1 overflow-y-auto">
                        {skus.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setSkuId(s.id)}
                                className={cn(
                                    'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left',
                                    skuId === s.id ? 'border-primary/50 bg-primary/5' : 'border-slate-200',
                                )}
                            >
                                <span
                                    className={cn(
                                        'h-3 w-3 shrink-0 rounded-full border',
                                        skuId === s.id ? 'border-4 border-primary' : 'border-slate-300',
                                    )}
                                />
                                <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
                                    {s.millingType} · {s.packageType} · {s.packagingName}
                                </span>
                                {s.sameSpec && (
                                    <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                        같은 규격
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {data.alias.canLearn && (
                    <label className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-600">
                        <input
                            type="checkbox"
                            checked={learn}
                            onChange={(e) => setLearn(e.target.checked)}
                            className="mt-0.5 h-3 w-3 shrink-0"
                        />
                        <span>
                            「{data.alias.token}」을 이 품종의 별칭으로 학습 (다음 업로드부터 자동 매칭)
                        </span>
                    </label>
                )}
                {data.alias.blockedByMilling && (
                    <p className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-500">
                        <Info className="mt-px h-3 w-3 shrink-0 text-slate-400" />
                        <span>도정유형이 섞인 이름이라 별칭으로 학습하지 않아요.</span>
                    </p>
                )}
            </div>

            <div className="border-t border-slate-100 px-3.5 py-2.5">
                <button
                    type="button"
                    onClick={submit}
                    disabled={skuId === null || busy}
                    className="w-full rounded-lg bg-primary py-2 text-[12.5px] font-bold text-primary-foreground disabled:opacity-40"
                >
                    {busy ? '지정하는 중…' : '지정 저장'}
                </button>
            </div>
        </div>
    )
}

/** 고른 품종에 SKU가 없다 — 여기서 만들지 않는다(결정 O). 메뉴 이름만 일러 준다. */
function NoSku() {
    return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-800">
            이 품종에 등록된 제품유형이 없어요.
            <br />
            <b className="font-bold text-amber-900">관리자 메뉴 › 제품유형 관리</b>에서 등록한 뒤, 위의{' '}
            <b className="font-bold text-amber-900">재매칭</b>을 눌러 주세요.
        </div>
    )
}
