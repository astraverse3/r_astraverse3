'use client'

// 톤백 셀 팝오버 본문 (계획서 D2d 결정 E'·H·I·K)
//
// `cell-allocation-popover.tsx`의 `Body`가 `cell.bulk`면 여기로 위임한다. 껍데기(Popover·Head)는 거기 것.
// **kg FIFO** — 오래된 자루부터 kg을 채우고, 요구량을 넘기는 자루 하나만 쪼갠다(사용자 결정 2026-09-14,
// 「자루가 여러 개 쓰여도 원칙대로 오래된 것부터」). 추천은 `suggestBulkAllocation`(순수)이 내고 기본 체크로 띄운다.
// 추천 목표는 **요구 + 3kg(고정)**이다(결정 K, 2026-09-15 — 포장 때 발주량 +3~5로 맞추므로 1톤 주문은 1,003으로).
// 사람이 바꿀 수 있다 — 통째 자루 체크 해제/추가, 쪼갤 몫 끄기, **쪼갤 kg ±1 조절**(직접 입력도).
// 「요구 vs 실제」 차이는 `bulkDelta`가 계산하고 여기는 색만 바꾼다(§40, 막지 않는다).
// 확정 한 번에 끝난다: 쪼갤 몫이 켜져 있으면 `createRepack`(되돌리기 없음 confirm) → 재조회로 새 자루를 찾아 → `confirmCell`.
// 확정·취소는 일반 셀과 같은 `confirmCell`·`cancelCell`(서버가 라인으로 톤백을 판정한다).

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, Minus, Plus, Scissors } from 'lucide-react'
import { cn } from '@/lib/utils'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { BULK_TARE_KG, bulkDelta, bulkTargetKg, suggestBulkAllocation } from '@/lib/purchase-order-bulk'
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

/** 쪼개 쓸 몫 — 추천이 정한 자루와 kg. `on`을 끄면 그 자루는 안 쓴다(통째로 바꾸려면 체크). `kg`는 사람이 조절한다(결정 K) */
type SplitPlan = { packageId: number; kg: number; on: boolean }

/** 쪼갤 kg 범위 — 최소 1, 최대 자루중량 − 1(통째는 체크박스로) */
const clampSplitKg = (kg: number, weightPerUnit: number) => Math.max(1, Math.min(weightPerUnit - 1, kg))

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
    /** packageId → 통째로 쓰는 자루 수 */
    const [picked, setPicked] = useState<Record<number, number>>({})
    const [split, setSplit] = useState<SplitPlan | null>(null)
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
            // 목표 = 남은 요구 + 3kg 고정 (결정 K)
            const remainingKg = Math.max(0, r.data.requiredKg - r.data.allocatedKg)
            const s = suggestBulkAllocation(bulkTargetKg(remainingKg), r.data.candidates)
            setPicked(Object.fromEntries(s.whole.map((w) => [w.packageId, w.count])))
            setSplit(s.split ? { ...s.split, on: true } : null)
        })
        return () => {
            alive = false
        }
    }, [cell.itemIds])

    if (error) return <p className="px-3.5 py-3 text-red-600">{error}</p>
    if (!data) return <p className="px-3.5 py-3 text-slate-400">불러오는 중…</p>

    const byId = new Map(data.candidates.map((c) => [c.packageId, c]))
    const wholeBags = data.candidates.reduce((s, c) => s + (picked[c.packageId] ?? 0), 0)
    const wholeKg = data.candidates.reduce((s, c) => s + (picked[c.packageId] ?? 0) * c.weightPerUnit, 0)
    const splitKg = split?.on ? split.kg : 0
    const pickedKg = wholeKg + splitKg
    const bags = wholeBags + (split?.on ? 1 : 0)
    const done = data.remainingQty === 0
    const delta = bulkDelta(data.requiredKg, data.allocatedKg + pickedKg)
    const remainingKg = Math.max(0, data.requiredKg - data.allocatedKg)
    const shortage = data.candidates.reduce((s, c) => s + c.available * c.weightPerUnit, 0) < remainingKg

    const setPick = (c: BulkCandidate, n: number) =>
        setPicked((p) => ({ ...p, [c.packageId]: Math.max(0, Math.min(c.available, n)) }))

    const setSplitKg = (c: BulkCandidate, kg: number) =>
        setSplit((s) => (s ? { ...s, kg: clampSplitKg(kg, c.weightPerUnit) } : s))

    /** 자루 하나를 kg + (w−kg)로. 성공하면 새 자루의 packageId(재조회로 찾음) */
    const doSplit = async (c: BulkCandidate, kg: number): Promise<BulkCandidate | null> => {
        const rest = Math.round((c.weightPerUnit - kg) * 1000) / 1000
        const r = await createRepack({
            sources: [{ packageId: c.packageId, takeCount: 1 }],
            results: [
                { packageType: PACKAGE_TYPE_TONBAG, weightPerUnit: kg, count: 1, packagingId: null, inheritFromPackageId: c.packageId },
                { packageType: PACKAGE_TYPE_TONBAG, weightPerUnit: rest, count: 1, packagingId: null, inheritFromPackageId: c.packageId },
            ],
            note: `발주서 톤백 분할 (묶음 #${uploadId})`,
        })
        if (!r.success) {
            toast.error('needsLossConfirm' in r ? '중량 계산이 맞지 않습니다. 다시 시도해 주세요.' : r.error)
            return null
        }
        // 결과 행 id는 안 돌아온다 — 재조회해서 「그 중량·재포장 결과·가장 최근」으로 찾는다
        const fresh = await getBulkCellOptions(cell.itemIds)
        if (!fresh.success) {
            toast.error(fresh.error)
            return null
        }
        const hit = fresh.data.candidates
            .filter((x) => x.repackId !== null && Math.abs(x.weightPerUnit - kg) < 0.001)
            .sort((a, b) => (b.repackId ?? 0) - (a.repackId ?? 0))[0]
        if (!hit) {
            toast.error(`${fmtKg(kg)}kg 자루를 만들었지만 목록에서 찾지 못했습니다. 직접 골라 주세요.`)
            setData(fresh.data)
            return null
        }
        return hit
    }

    const confirmSplitDialog = (c: BulkCandidate, kg: number) =>
        confirmDialog({
            title: '자루 쪼개기',
            description:
                `${c.lotNo ?? '로트 없음'} · ${fmtKg(c.weightPerUnit)}kg 자루 1개를\n` +
                `${fmtKg(kg)}kg + ${fmtKg(c.weightPerUnit - kg)}kg 두 자루로 나눕니다.\n\n` +
                '되돌리기는 없습니다. 잘못 나누면 제품재고 화면에서 역방향 재포장으로 합칩니다.',
            confirmText: '쪼개기',
        })

    /** 확정 한 번 — 쪼갤 몫이 켜져 있으면 먼저 쪼개고, 새 자루를 합쳐 차감 */
    const submit = async () => {
        const allocations = data.candidates
            .filter((c) => (picked[c.packageId] ?? 0) > 0)
            .map((c) => ({ packageId: c.packageId, count: picked[c.packageId] }))
        setBusy(true)
        try {
            if (split?.on) {
                const c = byId.get(split.packageId)
                if (!c) {
                    toast.error('쪼갤 자루를 찾을 수 없습니다.')
                    return
                }
                if (!(await confirmSplitDialog(c, split.kg))) return
                const hit = await doSplit(c, split.kg)
                if (!hit) {
                    setSplit(null)
                    return
                }
                allocations.push({ packageId: hit.packageId, count: 1 })
            }
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
                        오래된 자루부터(FIFO) · 남은 요구 {fmtKg(remainingKg)}kg · 추천은 +{BULK_TARE_KG}kg 여유
                    </div>
                    {data.candidates.length === 0 && <p className="py-1 text-slate-400">가용 톤백이 없습니다.</p>}
                    {data.candidates.map((c) => (
                        <CandidateRow
                            key={c.packageId}
                            c={c}
                            n={picked[c.packageId] ?? 0}
                            split={split?.packageId === c.packageId ? split : null}
                            onPick={(n) => setPick(c, n)}
                            onSplitToggle={(on) => setSplit((s) => (s ? { ...s, on } : s))}
                            onSplitKg={(kg) => setSplitKg(c, kg)}
                        />
                    ))}
                </div>
            )}

            <div className="flex flex-col gap-1.5 border-t border-slate-100 px-3.5 py-2.5">
                {!done && shortage && (
                    <p className="text-[11px] font-semibold text-orange-700">
                        가용 톤백을 다 써도 요구량에 못 미칩니다. 가능한 만큼만 차감하면 부분으로 남습니다.
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
                        {busy
                            ? '처리 중…'
                            : `${split?.on ? '쪼개서 ' : ''}이 셀 차감 확정 · ${bags}자루 · ${fmtKg(pickedKg)}kg`}
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
    split,
    onPick,
    onSplitToggle,
    onSplitKg,
}: {
    c: BulkCandidate
    n: number
    /** 추천이 이 자루를 쪼개 쓰기로 했으면 그 계획 */
    split: SplitPlan | null
    onPick: (n: number) => void
    onSplitToggle: (on: boolean) => void
    onSplitKg: (kg: number) => void
}) {
    const active = n > 0 || (split?.on ?? false)
    return (
        <div className={cn('rounded-lg border px-2.5 py-1.5', active ? 'border-primary/40 bg-primary/5' : 'border-slate-200')}>
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

            {/* 추천이 쪼개 쓰기로 한 자루 — 확정 때 나뉜다. kg는 ±1로 조절(결정 K). 끄면 이 자루는 안 쓴다(통째로 쓰려면 위 체크) */}
            {split && (
                <div className="mt-1.5 flex items-center gap-1.5 border-t border-slate-100 pt-1.5 text-[11px]">
                    <input
                        type="checkbox"
                        checked={split.on}
                        onChange={(e) => onSplitToggle(e.target.checked)}
                        className="h-3.5 w-3.5 shrink-0 accent-primary"
                    />
                    <Scissors className="h-3 w-3 shrink-0 text-primary" />
                    <span className="shrink-0 text-slate-600">확정 때</span>
                    <Step onClick={() => onSplitKg(split.kg - 1)} disabled={!split.on || split.kg <= 1}>
                        <Minus className="h-3 w-3" />
                    </Step>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={c.weightPerUnit - 1}
                        step={1}
                        value={split.kg}
                        disabled={!split.on}
                        onChange={(e) => onSplitKg(Number(e.target.value) || 1)}
                        className="h-6 w-14 rounded-md border border-slate-200 bg-card px-1 text-right text-[12px] font-bold tabular-nums outline-none focus:border-primary disabled:text-slate-400"
                    />
                    <Step onClick={() => onSplitKg(split.kg + 1)} disabled={!split.on || split.kg >= c.weightPerUnit - 1}>
                        <Plus className="h-3 w-3" />
                    </Step>
                    <span className="min-w-0 truncate text-slate-600">
                        kg만 쪼개 씀 · {fmtKg(c.weightPerUnit - split.kg)}kg 남김
                    </span>
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
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
        >
            {children}
        </button>
    )
}
