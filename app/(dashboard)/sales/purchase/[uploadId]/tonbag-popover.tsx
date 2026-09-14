'use client'

// 톤백 셀 팝오버 본문 (계획서 D2d 결정 E·H·I)
//
// `cell-allocation-popover.tsx`의 `Body`가 `cell.bulk`면 여기로 위임한다. 껍데기(Popover·Head)는 거기 것.
// 자동 FIFO가 없다(#34) — 자루 목록을 요구 중량 근접순으로 보여주고 사람이 체크한다.
// 「요구 vs 실제」 차이는 `lib/purchase-order-bulk.ts`가 계산하고 여기는 색만 바꾼다(§40, 막지 않는다).
// 쪼개기는 `createRepack` 그대로(결정 H) — 되돌리기가 없으니 `confirmDialog`를 먼저 띄운다.
// 확정·취소는 일반 셀과 같은 `confirmCell`·`cancelCell`(서버가 라인으로 톤백을 판정한다).

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, Minus, Plus, Scissors } from 'lucide-react'
import { cn } from '@/lib/utils'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { bulkDelta } from '@/lib/purchase-order-bulk'
import { PACKAGE_TYPE_TONBAG } from '@/lib/repack'
import { createRepack } from '@/app/actions/repack'
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
    const [data, setData] = useState<BulkCellOptions | null>(null)
    const [error, setError] = useState<string | null>(null)
    /** packageId → 고른 자루 수 */
    const [picked, setPicked] = useState<Record<number, number>>({})
    const [busy, setBusy] = useState(false)
    const [splitting, setSplitting] = useState<number | null>(null)
    const [reloadKey, setReloadKey] = useState(0)
    /** 쪼갠 뒤 자동으로 체크할 자루(중량·repack 최신). 재조회가 끝나면 쓰고 비운다 */
    const [autoPick, setAutoPick] = useState<number | null>(null)

    useEffect(() => {
        let alive = true
        getBulkCellOptions(cell.itemIds).then((r) => {
            if (!alive) return
            if (!r.success) {
                setError(r.error)
                return
            }
            setData(r.data)
            if (autoPick !== null) {
                // 결과 행 id는 안 돌아오므로 「그 중량·재포장 결과·가장 최근」으로 찾는다
                const hit = r.data.candidates
                    .filter((c) => c.repackId !== null && Math.abs(c.weightPerUnit - autoPick) < 0.001)
                    .sort((a, b) => (b.repackId ?? 0) - (a.repackId ?? 0))[0]
                if (hit) setPicked((p) => ({ ...p, [hit.packageId]: 1 }))
                setAutoPick(null)
            }
        })
        return () => {
            alive = false
        }
        // autoPick은 reloadKey와 함께 바뀐다 — 재조회 트리거는 reloadKey 하나
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cell.itemIds, reloadKey])

    if (error) return <p className="px-3.5 py-3 text-red-600">{error}</p>
    if (!data) return <p className="px-3.5 py-3 text-slate-400">불러오는 중…</p>

    const pickedBags = data.candidates.reduce((s, c) => s + (picked[c.packageId] ?? 0), 0)
    const pickedKg = data.candidates.reduce((s, c) => s + (picked[c.packageId] ?? 0) * c.weightPerUnit, 0)
    const done = data.remainingQty === 0
    const delta = bulkDelta(data.requiredKg, data.allocatedKg + pickedKg)
    const remainingKg = Math.max(0, data.requiredKg - data.allocatedKg)

    const setPick = (c: BulkCandidate, n: number) =>
        setPicked((p) => ({ ...p, [c.packageId]: Math.max(0, Math.min(c.available, n)) }))

    const submit = async () => {
        const allocations = data.candidates
            .filter((c) => (picked[c.packageId] ?? 0) > 0)
            .map((c) => ({ packageId: c.packageId, count: picked[c.packageId] }))
        setBusy(true)
        const r = await confirmCell(cell.itemIds, allocations)
        setBusy(false)
        if (!r.success) {
            toast.error(r.error)
            onFail()
            onClose()
            return
        }
        toast.success(`${cell.who} · ${cell.what} ${pickedBags}자루 ${fmtKg(pickedKg)}kg 차감`)
        onPatch(r.patch)
        onClose()
    }

    /** 자루 하나를 X kg + (w−X) kg 둘로 (결정 H). 되돌리기 없음 — 확인 먼저 */
    const split = async (c: BulkCandidate, kg: number) => {
        const rest = Math.round((c.weightPerUnit - kg) * 1000) / 1000
        const ok = await confirmDialog({
            title: '자루 쪼개기',
            description:
                `${c.lotNo ?? '로트 없음'} · ${fmtKg(c.weightPerUnit)}kg 자루 1개를\n` +
                `${fmtKg(kg)}kg + ${fmtKg(rest)}kg 두 자루로 나눕니다.\n\n` +
                '되돌리기는 없습니다. 잘못 나누면 제품재고 화면에서 역방향 재포장으로 합칩니다.',
            confirmText: '쪼개기',
        })
        if (!ok) return
        setBusy(true)
        const r = await createRepack({
            sources: [{ packageId: c.packageId, takeCount: 1 }],
            results: [
                { packageType: PACKAGE_TYPE_TONBAG, weightPerUnit: kg, count: 1, packagingId: null, inheritFromPackageId: c.packageId },
                { packageType: PACKAGE_TYPE_TONBAG, weightPerUnit: rest, count: 1, packagingId: null, inheritFromPackageId: c.packageId },
            ],
            note: `발주서 톤백 분할 (묶음 #${uploadId})`,
        })
        setBusy(false)
        if (!r.success) {
            toast.error('needsLossConfirm' in r ? '중량 계산이 맞지 않습니다. 다시 시도해 주세요.' : r.error)
            return
        }
        toast.success(`${fmtKg(kg)}kg + ${fmtKg(rest)}kg으로 나눴습니다`)
        setSplitting(null)
        setPicked((p) => ({ ...p, [c.packageId]: 0 }))
        setAutoPick(kg)
        setReloadKey((k) => k + 1)
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
                    실제{' '}
                    <b className="tabular-nums text-foreground">{fmtKg(data.allocatedKg + pickedKg)}</b>kg
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
                        자루를 고르세요 · 남은 요구 {fmtKg(remainingKg)}kg 기준 근접순
                    </div>
                    {data.candidates.length === 0 && <p className="py-1 text-slate-400">가용 톤백이 없습니다.</p>}
                    {data.candidates.map((c) => (
                        <CandidateRow
                            key={c.packageId}
                            c={c}
                            n={picked[c.packageId] ?? 0}
                            targetKg={remainingKg}
                            busy={busy}
                            splitting={splitting === c.packageId}
                            onPick={(n) => setPick(c, n)}
                            onSplitToggle={() => setSplitting((s) => (s === c.packageId ? null : c.packageId))}
                            onSplit={(kg) => split(c, kg)}
                        />
                    ))}
                </div>
            )}

            <div className="flex flex-col gap-1.5 border-t border-slate-100 px-3.5 py-2.5">
                {!done && (
                    <button
                        type="button"
                        disabled={pickedBags === 0 || busy}
                        onClick={submit}
                        className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-[13px] font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
                    >
                        <Check className="h-3.5 w-3.5" />
                        {busy ? '처리 중…' : `이 셀 차감 확정 · ${pickedBags}자루 · ${fmtKg(pickedKg)}kg`}
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
    targetKg,
    busy,
    splitting,
    onPick,
    onSplitToggle,
    onSplit,
}: {
    c: BulkCandidate
    n: number
    targetKg: number
    busy: boolean
    splitting: boolean
    onPick: (n: number) => void
    onSplitToggle: () => void
    onSplit: (kg: number) => void
}) {
    const d = bulkDelta(targetKg, c.weightPerUnit)
    // 분할 기본값 = 남은 요구 kg(자루보다 크면 자루 − 1kg)
    const [kg, setKg] = useState(() => Math.min(targetKg, Math.max(1, c.weightPerUnit - 1)))
    const rest = Math.round((c.weightPerUnit - kg) * 1000) / 1000
    const splitOk = kg > 0 && kg < c.weightPerUnit
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
                        <span className="flex items-baseline gap-1.5">
                            <b className="text-[13px] tabular-nums text-foreground">{fmtKg(c.weightPerUnit)}</b>
                            <span className="text-[10px] text-slate-400">kg</span>
                            <span className={cn('text-[10.5px] font-semibold tabular-nums', LEVEL_TONE[d.level])}>
                                {signed(d.deltaKg)}
                            </span>
                            {c.available > 1 && (
                                <span className="text-[10px] text-slate-400">× {c.available}자루</span>
                            )}
                        </span>
                        <span className="block truncate text-[10px] text-slate-400">
                            {c.lotNo ?? '로트 없음'} · {c.source === 'PURCHASED' ? '입고' : '도정'} {md(c.date)} · {c.producer}
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
                <button
                    type="button"
                    onClick={onSplitToggle}
                    disabled={busy}
                    title="이 자루를 둘로 나눕니다"
                    className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-slate-500 hover:bg-slate-50',
                        splitting ? 'border-primary text-primary' : 'border-slate-200',
                    )}
                >
                    <Scissors className="h-3 w-3" />
                </button>
            </div>
            {splitting && (
                <div className="mt-1.5 flex items-center gap-1.5 border-t border-slate-100 pt-1.5 text-[11px]">
                    <input
                        type="number"
                        inputMode="decimal"
                        min={1}
                        max={c.weightPerUnit - 1}
                        step={1}
                        value={kg}
                        onChange={(e) => setKg(Number(e.target.value) || 0)}
                        className="h-6 w-16 rounded-md border border-slate-200 bg-card px-1 text-right text-[12px] font-bold tabular-nums outline-none focus:border-primary"
                    />
                    <span className="text-slate-500">kg + {splitOk ? fmtKg(rest) : '—'}kg</span>
                    <button
                        type="button"
                        disabled={!splitOk || busy}
                        onClick={() => onSplit(kg)}
                        className="ml-auto h-6 rounded-md bg-primary px-2.5 text-[11px] font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
                    >
                        나누기
                    </button>
                </div>
            )}
        </div>
    )
}

function Step({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="flex h-5 w-5 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
        >
            {children}
        </button>
    )
}
