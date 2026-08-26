'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, Plus, PackageOpen } from 'lucide-react'
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
import {
    getRepackSources,
    createRepack,
    type RepackSourceInfo,
    type RepackLotOption,
} from '@/app/actions/repack'
import { listPackagings } from '@/app/actions/product-type'
import { triggerDataUpdate } from '@/components/last-updated'
import {
    RepackResultRow,
    emptyResultDraft,
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
 * 재포장 다이얼로그 (결정 #43 R2).
 *   왼쪽(위) = 쓸 재고와 개수 · 오른쪽(아래) = 만들 규격 줄
 *   가운데 잔여(소스 − 결과)가 0이 되면 딱 맞는다. 음수면 저장이 막힌다.
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
    const [results, setResults] = useState<ResultDraft[]>([])
    const [note, setNote] = useState('')
    /** 손실 경고를 확인했는지 — 서버가 needsLossConfirm을 돌려주면 켜진다 */
    const [lossConfirmed, setLossConfirmed] = useState(false)
    const [lossPrompt, setLossPrompt] = useState<{ lossKg: number; sourceKg: number } | null>(null)

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
                // 로트가 하나뿐이면 결과 줄이 자동으로 그 로트를 승계한다
                const defaultLot = srcRes.lotOptions.length === 1 ? srcRes.lotOptions[0].packageId : 0
                setResults([emptyResultDraft('r0', defaultLot)])
                setPackagings(
                    pkgRes.success && pkgRes.data ? (pkgRes.data as Packaging[]) : [],
                )
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

    // -- 저장 가능 판정 (서버가 최종 판정하지만, 뻔한 건 여기서 막는다) --
    //    줄 단위 오류는 인덱스·필드까지 함께 돌려줘 해당 줄에 인라인으로 표시한다 —
    //    푸터에만 「1번째 줄: …」이라고 적어두면 정작 그 줄에는 아무 표시가 없다.
    const { blockingReason, rowError } = useMemo<{
        blockingReason: string | null
        rowError: RowError | null
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
            return { blockingReason: '만들 규격을 한 줄 이상 넣어주세요.', rowError: null }
        for (const [i, r] of results.entries()) {
            if (!r.packageType) return err(i, 'spec', '규격을 골라주세요.')
            if (!(Number(r.weightPerUnit) > 0)) return err(i, 'weight', '자루당 kg을 넣어주세요.')
            const c = Number(r.count)
            if (!Number.isInteger(c) || c <= 0) return err(i, 'count', '개수를 1개 이상 넣어주세요.')
            if (!r.inheritFromPackageId) return err(i, 'lot', '로트를 골라주세요.')
        }
        if (remainKg < 0)
            return {
                blockingReason: `만들 양이 쓸 양보다 ${Math.abs(remainKg).toLocaleString()}kg 많아요.`,
                rowError: null,
            }
        return { blockingReason: null, rowError: null }
    }, [sources, takeCounts, results, remainKg])

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


    const head = sources[0]

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
            {/* p-0 + 헤더/본문/푸터 3단. 스크롤은 본문 한 군데만 (이중 스크롤 회피) */}
            <DialogContent className="sm:max-w-[940px] max-h-[92dvh] gap-0 overflow-hidden p-0 [&>button]:text-slate-400">
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
                        {/* 본문 — 좌 쓸 재고 / 우 만들 규격 */}
                        <div className="grid min-h-0 flex-1 overflow-y-auto sm:grid-cols-[340px_minmax(0,1fr)] sm:overflow-hidden">
                            {/* 좌 · 쓸 재고 */}
                            <section className="flex flex-col gap-1.5 border-b border-slate-100 bg-slate-50/50 p-4 sm:overflow-y-auto sm:border-b-0 sm:border-r">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                                        쓸 재고 {sources.length}건
                                    </h3>
                                    <span className="text-[11px] text-slate-400">
                                        {sources.every(
                                            s => Number(takeCounts[s.packageId]) === s.available,
                                        )
                                            ? '전량 사용 중'
                                            : '일부 사용'}
                                    </span>
                                </div>
                                {sources.map(s => (
                                    <div
                                        key={s.packageId}
                                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2"
                                    >
                                        <div className="flex min-w-0 flex-col">
                                            <span className="truncate text-[12.5px] font-semibold text-slate-800">
                                                {s.packageType} · {s.weightPerUnit.toLocaleString()}kg
                                                <span className="ml-1.5 font-normal text-slate-500">
                                                    {s.producer}
                                                </span>
                                            </span>
                                            <span className="truncate font-mono text-[10.5px] text-slate-400">
                                                {s.lotNo ?? '매입(로트 없음)'}
                                            </span>
                                        </div>
                                        {/* 가용이 1개면 고를 게 없다 — 입력을 없애고 값만 보여준다 */}
                                        {s.available === 1 ? (
                                            <span className="shrink-0 text-[11.5px] font-semibold text-slate-500">
                                                1개 전부
                                            </span>
                                        ) : (
                                            <div className="flex shrink-0 items-center gap-1.5">
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
                                                    className="h-10 w-16 text-right text-[12.5px] tabular-nums sm:h-8"
                                                />
                                                <span className="text-[11.5px] text-slate-400">
                                                    / {s.available}개
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </section>

                            {/* 우 · 만들 규격 */}
                            <section className="flex flex-col gap-2 p-4 sm:overflow-y-auto">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                                        만들 규격
                                    </h3>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 gap-1 text-[11.5px] text-primary"
                                        onClick={() =>
                                            setResults(prev => [
                                                ...prev,
                                                emptyResultDraft(
                                                    `r${Date.now()}`,
                                                    lotOptions.length === 1
                                                        ? lotOptions[0].packageId
                                                        : 0,
                                                ),
                                            ])
                                        }
                                    >
                                        <Plus className="h-3.5 w-3.5" />줄 추가
                                    </Button>
                                </div>
                                {results.map((r, i) => (
                                    <RepackResultRow
                                        key={r.key}
                                        draft={r}
                                        index={i}
                                        packagings={packagings}
                                        lotOptions={lotOptions}
                                        canRemove={results.length > 1}
                                        error={rowError?.index === i ? rowError : null}
                                        onChange={next =>
                                            setResults(prev =>
                                                prev.map(x => (x.key === r.key ? next : x)),
                                            )
                                        }
                                        onRemove={() =>
                                            setResults(prev => prev.filter(x => x.key !== r.key))
                                        }
                                    />
                                ))}

                                <label className="mt-1 flex flex-col gap-1">
                                    <span className="text-[10.5px] font-bold text-slate-400">
                                        비고 (선택)
                                    </span>
                                    <Input
                                        value={note}
                                        onChange={e => setNote(e.target.value)}
                                        maxLength={500}
                                        placeholder="예) 톤백 열어 소분"
                                        className="h-10 text-[12.5px] sm:h-8"
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
                            </section>
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
                            {blockingReason && (
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
