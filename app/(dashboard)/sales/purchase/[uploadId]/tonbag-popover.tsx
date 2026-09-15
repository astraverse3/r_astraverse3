'use client'

// 톤백 셀 팝오버 본문 (계획서 D2d 결정 F·I·M)
//
// `cell-allocation-popover.tsx`의 `Body`가 `cell.bulk`면 여기로 위임한다. 껍데기(Popover·Head)는 거기 것.
// 결정 M(2026-09-15 리셋): **선택만** 한다. 쪼개기는 제품재고 화면에서.
// 후보는 FIFO 순. 추천 = `suggestBulkWhole`(순수) — 발주 자루중량 ~ +10kg 안의 자루를 남은 발주 수만큼 기본 체크.
// 맞는 자루가 모자라면 안내(제품재고 링크)만 하고 막지 않는다 — 사람이 587+450 같은 걸 골라 확정할 수 있다(결정 F).
// 「요구 vs 실제」 차이는 `bulkDelta`가 계산하고 여기는 색만 바꾼다(§40).
// 확정·취소는 일반 셀과 같은 `confirmCell`·`cancelCell`(서버가 라인으로 톤백을 판정한다).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Check, ExternalLink, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BULK_FIT_KG, bulkDelta, fitsUnit, suggestBulkWhole } from '@/lib/purchase-order-bulk'
import {
    confirmCell,
    getBulkCellOptions,
    type BulkCandidate,
    type BulkCellOptions,
    type CellPatch,
} from '@/app/actions/purchase-order-matrix'
import { CancelButton, type ActiveCell } from './cell-allocation-popover'

const fmtKg = (n: number) => (Math.round(n * 10) / 10).toLocaleString()
const md = (iso: string) => iso.slice(5).replace('-', '.')
const signed = (n: number) => (n > 0 ? `+${fmtKg(n)}` : fmtKg(n))

const LEVEL_TONE = { exact: 'text-emerald-700', over: 'text-orange-700', under: 'text-orange-700' } as const

export function TonbagBody({
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
    const [data, setData] = useState<BulkCellOptions | null>(null)
    const [error, setError] = useState<string | null>(null)
    /** packageId → 통째로 쓰는 자루 수 */
    const [picked, setPicked] = useState<Record<number, number>>({})
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        let alive = true
        getBulkCellOptions(cell.itemIds).then((r) => {
            if (!alive) return
            if (!r.success) {
                setError(r.error)
                return
            }
            setData(r.data)
            // 셀의 라인은 열 분리(C0-a)로 자루중량이 같다
            const s = suggestBulkWhole(r.data.lines[0]?.unitWeightKg ?? 0, r.data.remainingQty, r.data.candidates)
            setPicked(Object.fromEntries(s.whole.map((w) => [w.packageId, w.count])))
        })
        return () => {
            alive = false
        }
    }, [cell.itemIds])

    if (error) return <p className="px-3.5 py-3 text-red-600">{error}</p>
    if (!data) return <p className="px-3.5 py-3 text-slate-400">불러오는 중…</p>

    const unitKg = data.lines[0]?.unitWeightKg ?? 0
    const bags = data.candidates.reduce((s, c) => s + (picked[c.packageId] ?? 0), 0)
    const pickedKg = data.candidates.reduce((s, c) => s + (picked[c.packageId] ?? 0) * c.weightPerUnit, 0)
    const done = data.remainingQty === 0
    // 초록 폭 = 발주 자루 수 × 10kg (추천과 같은 기준)
    const delta = bulkDelta(data.requiredKg, data.allocatedKg + pickedKg, (unitKg > 0 ? data.requiredKg / unitKg : 0) * BULK_FIT_KG)
    const fitCount = data.candidates.reduce((s, c) => s + (fitsUnit(c.weightPerUnit, unitKg) ? c.available : 0), 0)
    const shortUnits = Math.max(0, data.remainingQty - fitCount)

    const setPick = (c: BulkCandidate, n: number) =>
        setPicked((p) => ({ ...p, [c.packageId]: Math.max(0, Math.min(c.available, n)) }))

    const submit = async () => {
        const allocations = data.candidates
            .filter((c) => (picked[c.packageId] ?? 0) > 0)
            .map((c) => ({ packageId: c.packageId, count: picked[c.packageId] }))
        setBusy(true)
        try {
            const r = await confirmCell(cell.itemIds, allocations)
            if (!r.success) {
                toast.error(r.error)
                onFail()
                onClose()
                return
            }
            toast.success(`${cell.who} · ${cell.what} ${bags}자루 ${fmtKg(pickedKg)}kg 차감`)
            onPatch(r.patch)
            onClose()
        } finally {
            setBusy(false)
        }
    }

    return (
        <>
            {/* 요약 — 요구 · 실제(기차감+고른) · 차이 */}
            <div className="flex items-center gap-1.5 border-b border-slate-100 px-3.5 py-2 text-[11px]">
                <span className="font-semibold text-slate-500">
                    요구 <b className="tabular-nums text-foreground">{fmtKg(data.requiredKg)}</b>kg
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">
                    실제 <b className="tabular-nums text-foreground">{fmtKg(data.allocatedKg + pickedKg)}</b>kg
                </span>
                <span className={cn('ml-auto font-bold tabular-nums', LEVEL_TONE[delta.level])}>
                    {signed(delta.deltaKg)}
                    {delta.deltaPct !== null && (
                        <span className="ml-0.5 font-medium">({signed(Math.round(delta.deltaPct * 1000) / 10)}%)</span>
                    )}
                </span>
            </div>

            {data.allocated.length > 0 && (
                <div className="flex flex-col gap-1 border-b border-slate-100 px-3.5 py-2">
                    <div className="text-[10px] font-semibold text-slate-400">{done ? '차감 완료' : '이미 차감'}</div>
                    {data.allocated.map((a) => (
                        <div key={a.packageId} className="flex items-center justify-between text-[11px]">
                            <span className="truncate font-mono text-slate-500">
                                {a.lotNo ?? '로트 없음'} · {fmtKg(a.weightPerUnit)}kg × {a.count}
                            </span>
                            <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-emerald-700">
                                <Check className="h-3 w-3" />
                                {fmtKg(a.kg)}kg
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {!done && (
                <div className="flex max-h-[280px] flex-col gap-1.5 overflow-y-auto px-3.5 py-2.5">
                    <div className="text-[10px] font-semibold text-slate-400">
                        남은 발주 {data.remainingQty}자루 × {fmtKg(unitKg)}kg · 오래된 자루부터 · {fmtKg(unitKg)}~{fmtKg(unitKg + BULK_FIT_KG)}kg면 맞음
                    </div>
                    {data.candidates.length === 0 && <p className="py-1 text-slate-400">가용 톤백이 없습니다.</p>}
                    {data.candidates.map((c) => (
                        <CandidateRow
                            key={c.packageId}
                            c={c}
                            n={picked[c.packageId] ?? 0}
                            fits={fitsUnit(c.weightPerUnit, unitKg)}
                            onPick={(n) => setPick(c, n)}
                        />
                    ))}
                </div>
            )}

            <div className="flex flex-col gap-1.5 border-t border-slate-100 px-3.5 py-2.5">
                {!done && shortUnits > 0 && (
                    <p className="text-[11px] font-semibold text-orange-700">
                        맞는 자루가 {shortUnits}자루 부족합니다.{' '}
                        <Link href="/packages" target="_blank" className="inline-flex items-center gap-0.5 underline underline-offset-2">
                            제품재고에서 쪼개서 맞춘 뒤 <ExternalLink className="h-3 w-3" />
                        </Link>{' '}
                        다시 여세요. 다른 자루를 골라 확정해도 됩니다(차이는 주황으로 남습니다).
                    </p>
                )}
                {!done && (
                    <button
                        type="button"
                        disabled={bags === 0 || busy}
                        onClick={submit}
                        className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-[13px] font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
                    >
                        <Check className="h-3.5 w-3.5" />
                        {busy ? '처리 중…' : `이 셀 차감 확정 · ${bags}자루 · ${fmtKg(pickedKg)}kg`}
                    </button>
                )}
                {data.allocated.length > 0 && (
                    <CancelButton cell={cell} count={data.allocated.reduce((s, a) => s + a.count, 0)} onPatch={onPatch} onFail={onFail} onClose={onClose} />
                )}
            </div>
        </>
    )
}

function CandidateRow({
    c,
    n,
    fits,
    onPick,
}: {
    c: BulkCandidate
    n: number
    /** 발주 자루 하나를 그대로 만족하는 자루(`fitsUnit`) */
    fits: boolean
    onPick: (n: number) => void
}) {
    return (
        <div className={cn('rounded-lg border px-2.5 py-1.5', n > 0 ? 'border-primary/40 bg-primary/5' : 'border-slate-200')}>
            <div className="flex items-center gap-2">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <input
                        type="checkbox"
                        checked={n > 0}
                        onChange={(e) => onPick(e.target.checked ? 1 : 0)}
                        className="h-3.5 w-3.5 shrink-0 accent-primary"
                    />
                    <span className="min-w-0 flex-1">
                        {/* 날짜는 윗줄, 아랫줄은 로트 · 생산자 — 잘라내지 않고 줄바꿈한다(잘리면 로트를 못 읽는다) */}
                        <span className="flex items-baseline gap-1.5">
                            <b className="text-[13px] tabular-nums text-foreground">{fmtKg(c.weightPerUnit)}</b>
                            <span className="text-[10px] text-slate-400">kg</span>
                            {c.available > 1 && <span className="text-[10px] text-slate-400">× {c.available}자루</span>}
                            {fits && <span className="rounded bg-emerald-50 px-1 text-[9.5px] font-semibold text-emerald-700">맞음</span>}
                            <span className="ml-auto text-[10.5px] text-slate-500">
                                {c.source === 'PURCHASED' ? '입고' : '도정'} {md(c.date)}
                            </span>
                        </span>
                        <span className="block break-all text-[10.5px] leading-snug text-slate-500">
                            <span className="font-mono">{c.lotNo ?? '로트 없음'}</span> · {c.producer}
                        </span>
                    </span>
                </label>
                {c.available > 1 && n > 0 && (
                    <span className="flex shrink-0 items-center gap-1">
                        <Step onClick={() => onPick(n - 1)} disabled={n <= 1}><Minus className="h-3 w-3" /></Step>
                        <span className="w-5 text-center text-[12px] font-bold tabular-nums">{n}</span>
                        <Step onClick={() => onPick(n + 1)} disabled={n >= c.available}><Plus className="h-3 w-3" /></Step>
                    </span>
                )}
            </div>
        </div>
    )
}

function Step({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
        >
            {children}
        </button>
    )
}
