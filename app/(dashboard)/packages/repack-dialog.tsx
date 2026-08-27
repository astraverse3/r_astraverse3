'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronDown, Loader2, PackageOpen } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { REPACK_SPECS, PACKAGE_TYPE_REMAINDER, PACKAGE_TYPE_TONBAG } from '@/lib/repack'
import {
    getRepackSources,
    createRepack,
    type RepackSourceInfo,
    type RepackLotOption,
} from '@/app/actions/repack'
import { listPackagings, suggestProductType } from '@/app/actions/product-type'
import { triggerDataUpdate } from '@/components/last-updated'
import {
    RepackResultRow,
    makeResultDraft,
    type ResultDraft,
    type ResultFieldKey,
} from './repack-result-row'

/** 줄 단위 검증 실패 — 어느 줄 어느 필드인지까지 들고 다닌다 */
type RowError = { index: number; field: ResultFieldKey; message: string }

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    packageIds: number[]
    onDone: () => void
}

type Packaging = { id: number; name: string; active: boolean }

const round3 = (n: number) => Math.round(n * 1000) / 1000

/**
 * 재포장 다이얼로그 (결정 #43 R2 · UI 개편 #44~#48).
 *   위 = 쓸 재고 요약(접힘) · 가운데 = 규격 버튼과 만들 줄 · 아래 = 잔여 계기판
 *   잔여(소스 − 결과)가 0이 되면 딱 맞는다. 음수면 저장이 막힌다.
 */
export function RepackDialog({ open, onOpenChange, packageIds, onDone }: Props) {
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)

    const [sources, setSources] = useState<RepackSourceInfo[]>([])
    const [lotOptions, setLotOptions] = useState<RepackLotOption[]>([])
    const [packagings, setPackagings] = useState<Packaging[]>([])
    /** packageId → 이번에 쓸 개수(입력 중이라 문자열) */
    const [takeCounts, setTakeCounts] = useState<Record<number, string>>({})
    /** 쓸 재고 펼침 — 기본은 전량 소진이라 접어둔다 (결정 #44) */
    const [sourcesOpen, setSourcesOpen] = useState(false)
    const [results, setResults] = useState<ResultDraft[]>([])
    const [note, setNote] = useState('')
    /** 포장지 추천을 기다리는 중인 줄 key — 아직 미지정이어도 꾸짖지 않는다 (결정 #48·#52) */
    const [pkgPending, setPkgPending] = useState<Set<string>>(new Set())
    /** 손실 경고를 확인했는지 — 서버가 needsLossConfirm을 돌려주면 켜진다 */
    const [lossConfirmed, setLossConfirmed] = useState(false)
    const [lossPrompt, setLossPrompt] = useState<{ lossKg: number; sourceKg: number } | null>(null)

    /** 줄 key는 카운터로 만든다 — Date.now()는 같은 밀리초에 두 번 누르면 겹친다 */
    const nextKey = useRef(0)
    /** 규격 버튼 클릭 후 방금 추가·증가한 줄의 입력칸으로 포커스 (결정 #45) */
    const pendingFocus = useRef<{ index: number; field: 'count' | 'weight' } | null>(null)

    // 부모가 매 렌더마다 새 배열을 넘기므로(`selectedRows.map`) 배열 자체를 의존성에 두면
    // effect → setState → 리렌더 → effect 가 끝없이 돈다. 내용으로 만든 키를 의존성에 쓴다.
    const idsKey = packageIds.join(',')

    // -- 열릴 때 소스·포장지 조회 --
    useEffect(() => {
        if (!open || !idsKey) return
        const ids = idsKey.split(',').map(Number)
        let alive = true
        setLoading(true)
        setLoadError(null)
        setLossConfirmed(false)
        setLossPrompt(null)
        setNote('')
        setSourcesOpen(false)
        // 줄은 규격 버튼으로 만든다 — 빈 줄로 시작하지 않는다 (결정 #45)
        setResults([])
        setPkgPending(new Set())
        nextKey.current = 0

        Promise.all([getRepackSources(ids), listPackagings()])
            .then(([srcRes, pkgRes]) => {
                if (!alive) return
                if (!srcRes.success) {
                    setLoadError(srcRes.error)
                    return
                }
                setSources(srcRes.sources)
                setLotOptions(srcRes.lotOptions)
                // 기본은 전량 소진 — 덜 쓰려면 사람이 줄인다
                setTakeCounts(
                    Object.fromEntries(srcRes.sources.map(s => [s.packageId, String(s.available)])),
                )
                setPackagings(pkgRes.success && pkgRes.data ? (pkgRes.data as Packaging[]) : [])
            })
            .catch((e: unknown) => {
                // 권한 가드는 액션 try 밖에서 throw된다 — 여기서 잡지 않으면
                // 로딩만 끝나고 빈 화면이 남아 원인을 알 수 없다.
                if (!alive) return
                console.error('[RepackDialog] load failed:', e)
                setLoadError(
                    e instanceof Error && e.message.includes('Forbidden')
                        ? '재포장 권한이 없어요. (가공·판매 관리 권한 필요)'
                        : '재고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
                )
            })
            .finally(() => {
                if (alive) setLoading(false)
            })

        return () => {
            alive = false
        }
    }, [open, idsKey])

    // 손실 경고는 그때의 수치에 대한 판정이다. 입력이 바뀌면 그 판정은 무효다.
    //   · 딱 맞게 고쳤는데 경고가 남으면 뭘 더 해야 하는지 알 수 없고
    //   · 「손실 인정」을 누른 뒤 양을 바꿨는데 인정이 유지되면 확인 없이 손실이 기록된다
    useEffect(() => {
        setLossPrompt(null)
        setLossConfirmed(false)
    }, [results, takeCounts])

    // 방금 만든 줄의 입력칸으로 포커스 — 맨 아래로 스크롤만 하면 어디를 고칠지 모른다
    useEffect(() => {
        const p = pendingFocus.current
        if (!p) return
        pendingFocus.current = null
        const attr = p.field === 'count' ? 'data-count-index' : 'data-weight-index'
        const el = document.querySelector<HTMLInputElement>(`[${attr}="${p.index}"]`)
        el?.focus()
        el?.select()
    }, [results])

    const head = sources[0]

    // -- 중량 집계 --
    const sourceKg = useMemo(
        () =>
            round3(
                sources.reduce(
                    (s, src) => s + src.weightPerUnit * (Number(takeCounts[src.packageId]) || 0),
                    0,
                ),
            ),
        [sources, takeCounts],
    )
    const resultKg = useMemo(
        () =>
            round3(
                results.reduce(
                    (s, r) => s + (Number(r.weightPerUnit) || 0) * (Number(r.count) || 0),
                    0,
                ),
            ),
        [results],
    )
    const remainKg = round3(sourceKg - resultKg)

    const allFull = sources.every(s => Number(takeCounts[s.packageId]) === s.available)

    /**
     * 규격 버튼 = 줄 추가 (결정 #45 · #50).
     *
     * 로트가 1종이면 줄이 갈릴 이유가 없으므로 같은 규격은 개수만 올린다.
     * 여러 종이면 **항상 새 줄**을 만든다 — 같은 20kg이라도 자루마다 승계할 로트가
     * 다를 수 있고, 병합해 버리면 「로트 B짜리 20kg」을 만들 진입점이 사라진다.
     * 새 줄의 로트는 직전 줄에서 물려받으므로(결정 #47) 대개 바꿀 것만 바꾸면 된다.
     */
    const addSpec = (spec: { label: string; weight: number | null }) => {
        const multiLot = lotOptions.length > 1
        const lot = multiLot
            ? (results[results.length - 1]?.inheritFromPackageId ?? 0)
            : (lotOptions[0]?.packageId ?? 0)

        if (!multiLot) {
            const existing = results.findIndex(r => r.packageType === spec.label)
            if (existing !== -1) {
                pendingFocus.current = { index: existing, field: 'count' }
                setResults(prev =>
                    prev.map((r, i) =>
                        i === existing ? { ...r, count: String((Number(r.count) || 0) + 1) } : r,
                    ),
                )
                return
            }
        }

        const key = `r${nextKey.current++}`
        // 톤백·잔량은 자루당 kg이 비어 있으므로 그 칸으로 보낸다
        pendingFocus.current = {
            index: results.length,
            field: spec.weight === null ? 'weight' : 'count',
        }
        setResults(prev => [...prev, makeResultDraft(key, spec, lot)])

        // 포장지 기본값은 낙관적으로 (결정 #48) — 줄은 이미 그려졌고, 응답이 오면
        // 아직 비어 있는 줄만 채운다. 사람이 먼저 골랐으면 그 선택이 이긴다.
        if (spec.weight === null || !head) return
        // 답이 오기 전까지는 「포장지를 골라주세요」를 띄우지 않는다 — 곧 채워질 수도 있는데
        // 붉은 경고가 번쩍였다 사라지면 사용자가 뭘 잘못한 것처럼 보인다
        setPkgPending(prev => new Set(prev).add(key))
        void suggestProductType(head.varietyId, head.millingType, spec.label)
            .then(res => {
                const pid = res.success && res.data ? (res.data.default?.packagingId ?? null) : null
                if (pid == null) return
                setResults(prev =>
                    prev.map(r =>
                        r.key === key && r.packagingId == null ? { ...r, packagingId: pid } : r,
                    ),
                )
            })
            .finally(() =>
                setPkgPending(prev => {
                    const next = new Set(prev)
                    next.delete(key)
                    return next
                }),
            )
    }

    // -- 저장 가능 판정 (서버가 최종 판정하지만, 뻔한 건 여기서 막는다) --
    //    줄 단위 오류는 인덱스·필드까지 함께 돌려줘 해당 줄에 인라인으로 표시한다 —
    //    푸터에만 「1번째 줄: …」이라고 적어두면 정작 그 줄에는 아무 표시가 없다.
    //    quiet = 막긴 하지만 붉게 알리지는 않는다. 아직 아무것도 안 한 상태를
    //    실수처럼 꾸짖으면 안 된다 — 열자마자 결과 줄은 원래 0개다.
    const { blockingReason, rowError, quiet } = useMemo<{
        blockingReason: string | null
        rowError: RowError | null
        quiet?: boolean
    }>(() => {
        const err = (index: number, field: ResultFieldKey, message: string) => ({
            blockingReason: `${index + 1}번째 줄: ${message}`,
            rowError: { index, field, message },
        })

        if (sources.length === 0) return { blockingReason: '쓸 재고가 없어요.', rowError: null }
        for (const s of sources) {
            const n = Number(takeCounts[s.packageId])
            if (!Number.isInteger(n) || n <= 0)
                return { blockingReason: '쓸 개수를 1개 이상 넣어주세요.', rowError: null }
            if (n > s.available)
                return {
                    blockingReason: `가용 재고(${s.available}개)보다 많이 쓸 수 없어요.`,
                    rowError: null,
                }
        }
        if (results.length === 0)
            return {
                blockingReason: '위 규격 버튼으로 만들 규격을 골라주세요.',
                rowError: null,
                quiet: true,
            }
        for (const [i, r] of results.entries()) {
            if (!r.packageType) return err(i, 'spec', '규격을 골라주세요.')
            if (!(Number(r.weightPerUnit) > 0)) return err(i, 'weight', '자루당 kg을 넣어주세요.')
            const c = Number(r.count)
            if (!Number.isInteger(c) || c <= 0) return err(i, 'count', '개수를 1개 이상 넣어주세요.')
            if (!r.inheritFromPackageId) return err(i, 'lot', '로트를 골라주세요.')
            // 포장지가 없으면 SKU(productTypeId)가 안 붙고, 발주서 판매처리는 SKU로만
            // 재고를 찾는다(purchase-order.ts:53) — 실물은 있는데 못 파는 재고가 된다.
            // 잔량은 자체 판매를 안 해 원래 SKU가 없고, 톤백은 서버가 '톤백'을 강제한다.
            const skuless =
                r.packageType !== PACKAGE_TYPE_REMAINDER &&
                r.packageType !== PACKAGE_TYPE_TONBAG &&
                r.packagingId === null
            if (skuless) {
                // 추천 응답을 기다리는 중이면 저장은 막되 조용히 — 곧 채워질 수 있다
                if (pkgPending.has(r.key))
                    return {
                        blockingReason: '포장지를 확인하는 중…',
                        rowError: null,
                        quiet: true,
                    }
                return err(i, 'packaging', '포장지를 골라주세요. (없으면 팔 수 없어요)')
            }
        }
        if (remainKg < 0)
            return {
                blockingReason: `만들 양이 쓸 양보다 ${Math.abs(remainKg).toLocaleString()}kg 많아요.`,
                rowError: null,
            }
        return { blockingReason: null, rowError: null }
    }, [sources, takeCounts, results, remainKg, pkgPending])

    const submit = async (confirmLoss: boolean) => {
        setSaving(true)
        try {
            const res = await createRepack({
                sources: sources.map(s => ({
                    packageId: s.packageId,
                    takeCount: Number(takeCounts[s.packageId]),
                })),
                results: results.map(r => ({
                    packageType: r.packageType,
                    weightPerUnit: Number(r.weightPerUnit),
                    count: Number(r.count),
                    packagingId: r.packagingId,
                    inheritFromPackageId: r.inheritFromPackageId,
                })),
                note: note.trim() || null,
                confirmLoss,
            })

            if (res.success) {
                toast.success(
                    res.lossKg > 0
                        ? `재포장했어요. (손실 ${res.lossKg.toLocaleString()}kg)`
                        : '재포장했어요.',
                )
                triggerDataUpdate()
                onDone()
                return
            }

            if ('needsLossConfirm' in res) {
                setLossPrompt({ lossKg: res.lossKg, sourceKg: res.sourceKg })
                return
            }
            toast.error(res.error)
        } finally {
            setSaving(false)
        }
    }

    // 잔여 상태를 한 곳에서 정하고 푸터가 그대로 쓴다
    const balance =
        remainKg === 0
            ? { tone: 'ok' as const, label: '딱 맞음', value: '0kg' }
            : remainKg > 0
              ? {
                    tone: 'warn' as const,
                    label: '남는 양은 손실로 기록돼요',
                    value: `${remainKg.toLocaleString()}kg`,
                }
              : {
                    tone: 'bad' as const,
                    label: '만들 양이 더 많아요',
                    value: `${Math.abs(remainKg).toLocaleString()}kg`,
                }

    const balanceCls = {
        ok: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        warn: 'border-slate-200 bg-slate-50 text-slate-600',
        bad: 'border-red-200 bg-red-50 text-red-700',
    }[balance.tone]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* p-0 + 헤더/요약/본문/푸터. 스크롤은 본문 한 군데만 (이중 스크롤 회피) */}
            <DialogContent className="sm:max-w-[720px] max-h-[92dvh] gap-0 overflow-hidden p-0 [&>button]:text-slate-400">
                {/* 헤더 */}
                <DialogHeader className="shrink-0 flex-row items-start gap-2.5 space-y-0 border-b border-slate-100 px-4 py-3.5 sm:px-5 sm:py-4">
                    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <PackageOpen className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                        <DialogTitle className="text-[15px] font-bold text-slate-900">
                            재포장
                        </DialogTitle>
                        <DialogDescription className="mt-0.5 text-[12px]">
                            {head
                                ? `${head.varietyName} · ${head.millingType} · ${sources.length}건 ${sourceKg.toLocaleString()}kg을 다시 나눠 담습니다`
                                : '쓸 재고와 만들 규격을 정해주세요.'}
                        </DialogDescription>
                    </div>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-[12.5px]">재고를 확인하는 중…</span>
                    </div>
                ) : loadError ? (
                    <div className="flex flex-col items-center gap-2 py-14 text-center">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        <p className="text-[12.5px] text-slate-600">{loadError}</p>
                    </div>
                ) : (
                    <>
                        {/* 쓸 재고 — 개수를 줄이는 건 예외 동선이라 접어둔다 (결정 #44) */}
                        <div className="shrink-0 border-b border-slate-100 bg-slate-50/60 px-4 py-2 sm:px-5">
                            <div className="flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate text-[12px] text-slate-600">
                                    쓸 재고{' '}
                                    <b className="text-slate-800">{sources.length}건</b>{' '}
                                    <b className="tabular-nums text-slate-800">
                                        {sourceKg.toLocaleString()}kg
                                    </b>
                                    <span className="ml-1.5 text-slate-400">
                                        · {allFull ? '전량 사용' : '일부 사용'}
                                    </span>
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 shrink-0 gap-1 text-[11.5px] text-slate-500"
                                    onClick={() => setSourcesOpen(v => !v)}
                                >
                                    {sourcesOpen ? '접기' : '고치기'}
                                    <ChevronDown
                                        className={`h-3.5 w-3.5 transition-transform ${sourcesOpen ? 'rotate-180' : ''}`}
                                    />
                                </Button>
                            </div>

                            {sourcesOpen && (
                                <div className="mt-2 grid max-h-[176px] gap-1.5 overflow-y-auto sm:grid-cols-2">
                                    {sources.map(s => (
                                        <div
                                            key={s.packageId}
                                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                                        >
                                            <div className="flex min-w-0 flex-col">
                                                <span className="truncate text-[12px] font-semibold text-slate-800">
                                                    {s.packageType} ·{' '}
                                                    {s.weightPerUnit.toLocaleString()}kg
                                                    <span className="ml-1.5 font-normal text-slate-500">
                                                        {s.producer}
                                                    </span>
                                                </span>
                                                <span className="truncate font-mono text-[10px] text-slate-400">
                                                    {s.lotNo ?? '매입(로트 없음)'}
                                                </span>
                                            </div>
                                            {/* 가용이 1개면 고를 게 없다 — 입력을 없애고 값만 보여준다 */}
                                            {s.available === 1 ? (
                                                <span className="shrink-0 text-[11px] font-semibold text-slate-500">
                                                    1개 전부
                                                </span>
                                            ) : (
                                                <div className="flex shrink-0 items-center gap-1">
                                                    <Input
                                                        type="number"
                                                        inputMode="numeric"
                                                        min="1"
                                                        max={s.available}
                                                        value={takeCounts[s.packageId] ?? ''}
                                                        onChange={e =>
                                                            setTakeCounts(prev => ({
                                                                ...prev,
                                                                [s.packageId]: e.target.value,
                                                            }))
                                                        }
                                                        className="h-8 w-14 text-right text-[12px] tabular-nums sm:h-7"
                                                    />
                                                    <span className="text-[11px] text-slate-400">
                                                        /{s.available}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 본문 — 만들 규격 */}
                        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4 sm:px-5">
                            {/* 규격 버튼이 곧 줄 추가다 (결정 #45) */}
                            <div>
                                <h3 className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                                    만들 규격 —{' '}
                                    {lotOptions.length > 1
                                        ? '누를 때마다 줄이 하나씩 생겨요 (줄마다 로트를 고르세요)'
                                        : '버튼을 누르면 아래에 줄이 생겨요'}
                                </h3>
                                <div className="grid grid-cols-5 gap-1 sm:grid-cols-9">
                                    {REPACK_SPECS.map(s => (
                                        <Button
                                            key={s.label}
                                            type="button"
                                            variant="secondary"
                                            className="h-8 w-full px-0 text-[11.5px] hover:bg-slate-200 sm:h-7"
                                            onClick={() => addSpec(s)}
                                        >
                                            {s.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {results.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-[12px] text-slate-400">
                                    위 규격 버튼을 눌러 만들 규격을 정해주세요.
                                </p>
                            ) : (
                                <div className="flex flex-col gap-1.5">
                                    {results.map((r, i) => (
                                        <RepackResultRow
                                            key={r.key}
                                            draft={r}
                                            index={i}
                                            packagings={packagings}
                                            lotOptions={lotOptions}
                                            error={rowError?.index === i ? rowError : null}
                                            onChange={next =>
                                                setResults(prev =>
                                                    prev.map(x => (x.key === r.key ? next : x)),
                                                )
                                            }
                                            onRemove={() =>
                                                setResults(prev =>
                                                    prev.filter(x => x.key !== r.key),
                                                )
                                            }
                                        />
                                    ))}
                                </div>
                            )}

                            <label className="mt-1 flex items-center gap-2">
                                <span className="shrink-0 text-[10.5px] font-bold text-slate-400">
                                    비고
                                </span>
                                <Input
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    maxLength={500}
                                    placeholder="예) 톤백 열어 소분"
                                    className="h-9 text-[12.5px] sm:h-7"
                                />
                            </label>

                            {lossPrompt && (
                                <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                                    <p className="flex items-start gap-2 text-[12.5px] text-amber-900">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                        <span>
                                            만들 양이 쓸 양보다{' '}
                                            <b className="tabular-nums">
                                                {lossPrompt.lossKg.toLocaleString()}kg
                                            </b>{' '}
                                            적어요. 이 차이는 손실로 기록돼요. 그대로 진행할까요?
                                        </span>
                                    </p>
                                    <div className="flex justify-end">
                                        <Button
                                            type="button"
                                            size="sm"
                                            className="h-8"
                                            disabled={saving}
                                            onClick={() => {
                                                setLossConfirmed(true)
                                                void submit(true)
                                            }}
                                        >
                                            손실 인정하고 진행
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 푸터 — 계기판 + 액션. 규격을 넣는 내내 잔여 kg이 보여야 한다 */}
                        <div className={`shrink-0 border-t px-4 py-3 sm:px-5 ${balanceCls}`}>
                            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-baseline justify-between gap-4 sm:justify-start">
                                    <div>
                                        <div className="text-[11px] font-bold">{balance.label}</div>
                                        <div className="mt-0.5 text-[11.5px] tabular-nums opacity-80">
                                            쓸 양 {sourceKg.toLocaleString()}kg − 만들 양{' '}
                                            {resultKg.toLocaleString()}kg
                                        </div>
                                    </div>
                                    <span className="text-[22px] font-extrabold leading-none tabular-nums">
                                        {balance.value}
                                    </span>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-11 flex-none bg-white sm:h-8"
                                        onClick={() => onOpenChange(false)}
                                        disabled={saving}
                                    >
                                        취소
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="h-11 flex-1 gap-1.5 sm:h-8 sm:flex-none"
                                        disabled={!!blockingReason || saving}
                                        onClick={() => void submit(lossConfirmed)}
                                    >
                                        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                        재포장하기
                                    </Button>
                                </div>
                            </div>
                            {blockingReason && !quiet && (
                                <p className="mt-2 text-[11.5px] font-semibold text-red-600">
                                    {blockingReason}
                                </p>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
