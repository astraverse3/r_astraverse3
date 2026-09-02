'use client'

// 재고차감 다이얼로그 (계획서 D5 · 시안 docs/handoff/재고차감/재고차감-시안.html #1)
//
// repack-dialog의 껍데기 관습 그대로: 720px · p-0 · 헤더/설정/본문(스크롤)/푸터.
// 확인 단계(N5)는 별도 confirm 창 없이 **다이얼로그 안에서** 해결한다 —
// 재포장 「손실 인정하고 진행」과 같은 패턴. 버튼은 primary(미결 B 결정).

import { useMemo, useState } from 'react'
import { AlertTriangle, History, Loader2, PackageMinus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { triggerDataUpdate } from '@/components/last-updated'
import { createBulkMovements } from '@/app/actions/package-movement'
import type { PackageRow } from '@/app/actions/packages'
import {
    MANUAL_MOVEMENT_TYPES,
    MOVEMENT_TYPE_LABEL,
    type ManualMovementType,
} from '@/lib/movement-label'

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** 목록에서 고른 행들 — 품종·규격·로트·가용을 다시 조회하지 않는다 */
    rows: PackageRow[]
    onDone: () => void
}

const toDateInput = (d: Date): string => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

/**
 * 로트 앞말줄임 — 실 로트(`251119-11-15103885-4118`)는 **앞부분이 전부 같고 뒷자리가
 * 유일한 구분자**라 뒤를 자르면 서로 다른 로트가 같아 보인다(R1-1 실측).
 * CSS `direction:rtl`은 숫자·하이픈 bidi 재배치 위험이 있어 문자열로 자른다. title에 전체.
 */
export const shortLot = (lot: string): string =>
    lot.length > 16 ? `…${lot.slice(-14)}` : lot

export function DeductDialog({ open, onOpenChange, rows, onDone }: Props) {
    const [type, setType] = useState<ManualMovementType>('SALE')
    const [customer, setCustomer] = useState('')
    const [occurredAt, setOccurredAt] = useState(() => toDateInput(new Date()))
    const [note, setNote] = useState('')
    // 행별 차감 개수(문자열 그대로 두고 파싱은 검증에서) — 기본 전량(미결 D)
    const [counts, setCounts] = useState<Record<number, string>>({})
    const [confirming, setConfirming] = useState(false)
    const [saving, setSaving] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)

    // 열릴 때마다 초기화 — 렌더 중 setState 패턴(list-client와 같은 이유로 effect 안 씀)
    const [lastOpen, setLastOpen] = useState(open)
    if (lastOpen !== open) {
        setLastOpen(open)
        if (open) {
            setType('SALE')
            setCustomer('')
            setOccurredAt(toDateInput(new Date()))
            setNote('')
            setCounts(Object.fromEntries(rows.map(r => [r.id, String(r.available)])))
            setConfirming(false)
            setSubmitError(null)
        }
    }

    // 어떤 입력이든 바뀌면 확인 대기는 무효 — 확인한 내용과 실행 내용이 어긋나면 안 된다
    const touch = () => {
        setConfirming(false)
        setSubmitError(null)
    }

    const resetToFull = () => {
        touch()
        setCounts(Object.fromEntries(rows.map(r => [r.id, String(r.available)])))
    }

    // 행별 파싱: 0·빈칸 = 제외. 초과·비정수는 그 행의 오류
    const parsed = useMemo(() => {
        const items: { row: PackageRow; count: number }[] = []
        const rowErrors = new Map<number, string>()
        for (const r of rows) {
            const raw = (counts[r.id] ?? '').trim()
            if (raw === '' || raw === '0') continue
            const n = Number(raw)
            if (!Number.isInteger(n) || n < 0) {
                rowErrors.set(r.id, '개수가 올바르지 않아요')
                continue
            }
            if (n > r.available) {
                rowErrors.set(r.id, `가용 ${r.available}개를 넘었어요`)
                continue
            }
            items.push({ row: r, count: n })
        }
        return { items, rowErrors }
    }, [rows, counts])

    const totalCount = parsed.items.reduce((s, it) => s + it.count, 0)

    const blockingReason = useMemo(() => {
        if (parsed.rowErrors.size > 0) return '개수를 넘거나 잘못된 줄이 있어요.'
        if (parsed.items.length === 0) return '차감할 개수를 넣어주세요.'
        if (type === 'OTHER' && !note.trim()) return '기타 사유는 메모를 남겨주세요.'
        return null
    }, [parsed, type, note])

    const todayStr = toDateInput(new Date())
    const isBackdated = occurredAt !== '' && occurredAt !== todayStr

    const submit = async () => {
        setSaving(true)
        try {
            const res = await createBulkMovements({
                items: parsed.items.map(it => ({ packageId: it.row.id, count: it.count })),
                type,
                customer: type === 'SALE' ? customer.trim() || undefined : undefined,
                note: note.trim() || undefined,
                occurredAt: occurredAt ? new Date(`${occurredAt}T00:00:00`) : undefined,
            })
            if (res.success) {
                toast.success(`${res.rows}행 ${res.totalCount.toLocaleString()}개를 차감했어요.`)
                triggerDataUpdate()
                onDone()
                return
            }
            setConfirming(false)
            setSubmitError(res.error)
        } finally {
            setSaving(false)
        }
    }

    const lockCls = confirming ? 'opacity-50 pointer-events-none' : ''

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* 🔴 기본 grid를 flex로 — grid는 행이 92dvh에 맞춰 줄지 않아 행이 많으면
                푸터가 overflow-hidden에 잘려나간다(브라우저 검증에서 발견). */}
            <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[720px] [&>button]:text-slate-400">
                {/* 헤더 */}
                <DialogHeader className="shrink-0 flex-row items-start gap-2.5 space-y-0 border-b border-slate-100 px-4 py-3.5 sm:px-6 sm:py-4">
                    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <PackageMinus className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                        <DialogTitle className="text-[15px] font-bold text-slate-900">
                            재고차감
                        </DialogTitle>
                        <DialogDescription className="mt-0.5 text-[12px]">
                            고른{' '}
                            <b className="tabular-nums text-slate-700">
                                {rows.length}건{' '}
                                {rows.reduce((s, r) => s + r.available, 0).toLocaleString()}개
                            </b>
                            를 재고에서 빼고 이력에 남깁니다
                        </DialogDescription>
                    </div>
                </DialogHeader>

                {/* 설정 — 사유·발생일·거래처·메모.
                    회색 바탕은 「입력 구역」 표시다. /60 투명도로는 흰 배경 위에서 거의 사라져
                    구역 구분이 안 보였다 — 불투명 slate-50 + slate-200 경계로 또렷하게. */}
                <div className={cn('shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-3.5 sm:px-6', lockCls)}>
                    <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                        사유
                    </div>
                    <div className="mt-1.5 grid grid-cols-5 gap-1.5 sm:flex">
                        {MANUAL_MOVEMENT_TYPES.map(t => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => {
                                    touch()
                                    setType(t)
                                }}
                                className={cn(
                                    'flex h-[34px] items-center justify-center rounded-lg border px-0 text-[12.5px] font-semibold sm:h-[30px] sm:px-3',
                                    type === t
                                        ? 'border-primary/35 bg-primary/10 font-bold text-primary'
                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                                )}
                            >
                                {MOVEMENT_TYPE_LABEL[t]}
                            </button>
                        ))}
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-[190px_1fr]">
                        <label className="flex flex-col gap-1">
                            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                                발생일
                            </span>
                            <Input
                                type="date"
                                value={occurredAt}
                                max={todayStr}
                                onChange={e => {
                                    touch()
                                    setOccurredAt(e.target.value)
                                }}
                                className="h-9 text-[12.5px] tabular-nums sm:h-8"
                            />
                        </label>
                        {type === 'SALE' && (
                            <label className="flex flex-col gap-1">
                                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                                    거래처{' '}
                                    <span className="normal-case tracking-normal text-primary">
                                        · 판매일 때만
                                    </span>
                                </span>
                                <Input
                                    value={customer}
                                    maxLength={100}
                                    onChange={e => {
                                        touch()
                                        setCustomer(e.target.value)
                                    }}
                                    placeholder="예) 한살림 서울"
                                    className="h-9 text-[12.5px] sm:h-8"
                                />
                            </label>
                        )}
                    </div>
                    {isBackdated && (
                        <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-amber-700">
                            <History className="h-3.5 w-3.5 shrink-0" />
                            <span>
                                오늘({todayStr})이 아닌 <b>과거 날짜</b>로 기록됩니다. 묶음 하나에
                                날짜 하나예요 — 시기가 다르면 나눠서 실행하세요.
                            </span>
                        </p>
                    )}

                    <label className="mt-3 flex flex-col gap-1">
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                            메모
                            {type === 'OTHER' && (
                                <span className="ml-1.5 normal-case tracking-normal text-slate-500">
                                    기타는 메모를 남겨주세요
                                </span>
                            )}
                        </span>
                        <Input
                            value={note}
                            maxLength={500}
                            onChange={e => {
                                touch()
                                setNote(e.target.value)
                            }}
                            placeholder="예) 2~3월 출고분 소급 정리"
                            className="h-9 text-[12.5px] sm:h-8"
                        />
                    </label>
                </div>

                {/* 본문 — 선택 행 목록 (스크롤은 여기 한 군데).
                    pt는 첫 줄이 갖는다 — sticky 헤더가 top-0에 딱 붙게 (R1-1 ①) */}
                <div className={cn('min-h-0 flex-1 overflow-y-auto px-4 pb-3 sm:px-6', lockCls)}>
                    <div className="flex items-center justify-between pt-3">
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                            차감할 재고{' '}
                            <span className="tabular-nums normal-case text-slate-700">
                                {rows.length}건
                            </span>
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11.5px] text-slate-600"
                            onClick={resetToFull}
                        >
                            전량으로 초기화
                        </Button>
                    </div>
                    {/* 컬럼 헤더 — 스크롤에 고정. 같은 품종·규격이 9행씩 오는 게 기본이라
                        헤더가 사라지면 가용 숫자가 무엇인지 알 수 없다 (R1-1).
                        컬럼 어휘는 목록 테이블을 따른다 — 행은 한 줄이다 (R2-1) */}
                    <div className="sticky top-0 z-10 mt-1.5 hidden gap-x-4 border-b border-slate-200 bg-white pb-1.5 pt-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 sm:grid sm:grid-cols-[1fr_.5fr_74px_158px_42px_96px]">
                        <span>품종 · 규격</span>
                        <span>생산자</span>
                        <span className="text-right">포장일</span>
                        <span>로트</span>
                        <span className="text-right">가용</span>
                        <span className="pr-0.5 text-right">차감 개수</span>
                    </div>
                    <div className="sm:mt-0 mt-1">
                        {rows.map(r => {
                            const raw = (counts[r.id] ?? '').trim()
                            const excluded = raw === '' || raw === '0'
                            const rowError = parsed.rowErrors.get(r.id)
                            return (
                                <div
                                    key={r.id}
                                    className={cn(
                                        // 구분선은 목록 서브행과 같은 톤(slate-200/60) — slate-100은
                                        // 흰 배경에서 사실상 보이지 않아 행이 뭉쳐 보였다.
                                        'grid grid-cols-[1fr_auto] items-center gap-x-4 border-t border-slate-200/60 py-[9px] text-[13px] first:border-t-0 hover:bg-slate-50/70 sm:grid-cols-[1fr_.5fr_74px_158px_42px_96px]',
                                        excluded && 'opacity-55',
                                    )}
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate">
                                            <b className="text-slate-900">{r.variety}</b> · {r.spec}
                                            {r.millingTypeLabel !== '—' && (
                                                <span className="ml-1.5 hidden text-slate-400 sm:inline">
                                                    {r.millingTypeLabel}
                                                </span>
                                            )}
                                            {/* 모바일은 컬럼이 없어 생산자를 품종 줄에 붙인다 */}
                                            <span className="ml-1.5 font-medium text-slate-400 sm:hidden">
                                                {r.producer}
                                            </span>
                                        </span>
                                        {/* 모바일 보조줄 — 로트 · 가용 · 포장일 묶음 */}
                                        <span className="mt-0.5 flex items-center gap-1.5 sm:hidden">
                                            <LotOrBuyChip lot={r.lot} source={r.source} mobile />
                                            <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                                                가용 {r.available} · {r.date.slice(5)}
                                            </span>
                                        </span>
                                    </span>
                                    <span className="hidden min-w-0 truncate text-slate-600 sm:block">
                                        {r.producer}
                                    </span>
                                    <span className="hidden text-right text-[12px] tabular-nums text-slate-400 sm:block">
                                        {r.date.slice(5)}
                                    </span>
                                    <span className="hidden min-w-0 sm:block">
                                        <LotOrBuyChip lot={r.lot} source={r.source} />
                                    </span>
                                    <span className="hidden text-right text-[12px] tabular-nums text-slate-500 sm:block">
                                        {r.available}
                                    </span>
                                    <span className="flex items-center justify-end gap-1.5">
                                        {r.available === 1 ? (
                                            <span className="text-[11.5px] font-semibold text-slate-500">
                                                1개 전부
                                            </span>
                                        ) : (
                                            <>
                                                <Input
                                                    type="number"
                                                    inputMode="numeric"
                                                    min="0"
                                                    max={r.available}
                                                    value={counts[r.id] ?? ''}
                                                    onChange={e => {
                                                        touch()
                                                        setCounts(prev => ({
                                                            ...prev,
                                                            [r.id]: e.target.value,
                                                        }))
                                                    }}
                                                    className={cn(
                                                        'h-9 w-16 text-right text-[12.5px] tabular-nums sm:h-7 sm:w-14',
                                                        rowError && 'border-red-400',
                                                    )}
                                                />
                                                <span className="text-[11px] text-slate-400">개</span>
                                            </>
                                        )}
                                        {excluded && (
                                            <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-[1px] text-[10px] text-slate-500">
                                                제외
                                            </span>
                                        )}
                                    </span>
                                    {rowError && (
                                        <span className="col-span-full text-right text-[11px] font-semibold text-red-600">
                                            {rowError}
                                        </span>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* 인라인 확인 — 별도 confirm 창 없이 여기서 해결 (N5) */}
                {confirming && (
                    <div className="shrink-0 px-4 pb-3 sm:px-6">
                        <div className="flex flex-col gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                            <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-amber-900">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>
                                    <b className="tabular-nums">
                                        {parsed.items.length}행 {totalCount.toLocaleString()}개
                                    </b>
                                    를 <b>{MOVEMENT_TYPE_LABEL[type]}</b>로 차감합니다. 발생일{' '}
                                    <b className="tabular-nums">{occurredAt}</b>
                                    {type === 'SALE' && customer.trim()
                                        ? ` · 거래처 ${customer.trim()}`
                                        : ''}
                                    .<br />
                                    차감한 재고는 목록에서 사라지고, 「차감된 재고 보기」를 켜야
                                    다시 보입니다.
                                </span>
                            </p>
                            <div className="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 bg-white"
                                    disabled={saving}
                                    onClick={() => setConfirming(false)}
                                >
                                    다시 고치기
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    className="h-8 gap-1.5"
                                    disabled={saving}
                                    onClick={() => void submit()}
                                >
                                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    확인하고 차감
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 푸터 — 계기판 자리에 차감 요약 */}
                <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-baseline justify-between gap-5 sm:justify-start">
                            <div>
                                <div className="text-[11px] font-bold text-slate-600">
                                    {confirming
                                        ? '확인을 기다리는 중'
                                        : `${MOVEMENT_TYPE_LABEL[type]}로 차감`}
                                </div>
                                <div className="mt-0.5 text-[11.5px] tabular-nums text-slate-500">
                                    {parsed.items.length}행 · {occurredAt || '날짜 미정'}
                                    {type === 'SALE' && customer.trim()
                                        ? ` · ${customer.trim()}`
                                        : ''}
                                </div>
                            </div>
                            <span className="text-[22px] font-extrabold leading-none tabular-nums text-slate-900">
                                {totalCount.toLocaleString()}개
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
                                disabled={!!blockingReason || confirming || saving}
                                onClick={() => setConfirming(true)}
                            >
                                차감하기
                            </Button>
                        </div>
                    </div>
                    {blockingReason && !confirming && (
                        <p className="mt-2 text-[11.5px] font-semibold text-red-600">
                            {blockingReason}
                        </p>
                    )}
                    {submitError && (
                        <p className="mt-2 whitespace-pre-line text-[11.5px] font-semibold text-red-600">
                            {submitError}
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

// 로트 칩 / 매입 칩 — 목록 행과 같은 문법 (package-row.tsx의 것과 동일한 모양)
//  · 데스크탑(158px 열): 10.5px mono면 전체가 들어가므로 **자르지 않는다** (R2-2)
//  · 모바일(`mobile`): 폭이 없어 앞말줄임 — 뒷자리가 유일한 구분자다 (R1-1 ③)
// 어느 쪽이든 title에 전체 로트를 남긴다(비용 0).
function LotOrBuyChip({
    lot,
    source,
    mobile = false,
}: {
    lot: string | null
    source: PackageRow['source']
    mobile?: boolean
}) {
    if (lot) {
        return (
            <span
                title={lot}
                className={cn(
                    'inline-block max-w-full rounded border border-slate-200 bg-slate-100 px-1.5 font-mono leading-4 text-slate-500',
                    mobile ? 'truncate py-[1px] text-[10px]' : 'whitespace-nowrap py-[2px] text-[10.5px]',
                )}
            >
                {mobile ? shortLot(lot) : lot}
            </span>
        )
    }
    if (source === 'PURCHASED') {
        return (
            <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-[1px] text-[10px] font-medium text-amber-700">
                매입
            </span>
        )
    }
    return <span className="text-[10px] text-slate-300">—</span>
}
