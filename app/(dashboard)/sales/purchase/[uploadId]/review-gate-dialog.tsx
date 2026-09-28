'use client'

// 검토 게이트 — 행 일괄차감 직전 확인 (계획서 D3c · 시안 `검토게이트-일괄차감.html` 컴팩트 v2)
//
// 열리면 `previewBatch`로 **쓰지 않고** 계산만 해서 보여주고, 「확정」이 `confirmBatch`를 부른다.
// 두 액션은 같은 순수함수를 쓰므로 여기 적힌 숫자가 곧 결과다(결정 C).
//
// 위계 3단(시안 v2) — ① 차감 예정 kg은 이 행위의 **결과값**이라 단독 최상위,
// ② 구성은 라인을 나눈 **비율**이라 카드가 아니라 스택 바 하나,
// ③ 그중 **매칭실패만 차단 사유**라 배너로 격상. 재고부족은 막지 않는다(결정 E).
//
// 🔴 시안은 구성이 3갈래(정상/부분/제외)였지만 **4갈래로 나눴다** — 실측(묶음 #15)에서 부족
//    18라인이 **전부 가용 0**이었다. 「부분 차감」으로 묶으면 조금이라도 나가는 줄로 읽히는데
//    실제로는 아무 일도 일어나지 않는다. 그래서 「부분(일부만)」과 「재고없음(차감 0)」을 가른다.
//
// 🔴 시안의 「SKU 지정하러 가기」 버튼은 되살리지 않는다 — 수동지정은 2026-09-16에 철회됐다(`c2fc6f3`).
//    매칭실패를 푸는 경로는 「품종 관리·제품유형 관리에서 보완 → 재매칭」뿐이다.
// 🔴 이름(수령인·품목·규격)은 서버가 주지 않는다. 매트릭스가 이미 갖고 있어 `lookup`으로 붙인다 —
//    서버가 또 조립하면 표기 규칙이 두 곳이 된다.
//
// M1-6 — `orders`를 주면 **선택 모드**(폰 목록 `작업필요 n건 검토`로 열었을 때만). 뺄 건의 체크를 푼다.
// 🔴 체크를 바꾸면 **미리보기를 서버에 다시 묻는다.** FIFO라 한 건을 빼면 그 재고가 뒤 건으로 가서
//    부족이던 건이 풀릴 수 있다 — 화면에서 빼기만 하면 kg·부족이 거짓말이 된다. 지문도 건 목록마다 다르다.
// 🔴 확정은 **그 미리보기를 만든 건 목록**과 지문을 한 쌍으로 보낸다(지금 체크 상태가 아니라).

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronRight, PackageX, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { buildGateGroups, gateStateOf, pickableIds, type GateOrder } from '@/lib/purchase-order-gate'
import {
    confirmBatch,
    previewBatch,
    type BatchPatch,
    type BatchPreview,
} from '@/app/actions/purchase-order-batch'
import { GateOrderPicker } from './gate-order-picker'

/** 라인 한 줄을 사람 말로 — 매트릭스가 채운다. 못 찾으면 null */
export type LineLookup = (itemId: number) => { who: string; what: string } | null

const fmt = (n: number) => n.toLocaleString()
const fmtKg = (n: number) => (Math.round(n * 10) / 10).toLocaleString()

/**
 * 🔴 **호출부가 `{open && <ReviewGateDialog …/>}`로 조건부 마운트한다.** 열 때마다 새 마운트라
 * 상태 리셋이 구조적으로 보장되고, 계산도 그때 새로 한다 — 닫았다 다시 연 사이에 재고가
 * 바뀌었을 수 있다(포장 소실 사고의 교훈: 다이얼로그는 열 때 서버를 다시 읽는다).
 */
export function ReviewGateDialog({
    orderIds,
    orders,
    sheetName,
    lookup,
    onClose,
    onDone,
    onJump,
}: {
    orderIds: number[]
    /**
     * 선택 모드(M1-6). **폰 목록 진입일 때만** 넘긴다 — 데스크탑은 매트릭스 체크박스로 이미 골라 왔고,
     * 건상세 일괄차감은 건이 하나라 고를 게 없다. `orderIds`와 같은 건·같은 순서다.
     */
    orders?: GateOrder[]
    sheetName: string
    lookup: LineLookup
    onClose: () => void
    /** 확정 성공 — 바뀐 값만 받아 매트릭스가 다시 그린다(결정 H) */
    onDone: (patch: BatchPatch, summary: { units: number; lines: number }) => void
    /** 이슈 줄 클릭 — 매트릭스의 그 셀로 보낸다 */
    onJump: (itemId: number) => void
}) {
    const pickMode = orders !== undefined
    const groups = useMemo(() => (orders ? buildGateGroups(orders) : []), [orders])
    const pickable = useMemo(() => pickableIds(groups), [groups])
    /** 뺀 건. 기본은 비어 있다 — 전부 체크(빼는 UI) */
    const [excluded, setExcluded] = useState<ReadonlySet<number>>(() => new Set())
    /*
     * 서버에 보낼 건 = 뺀 것만 빼고 전부. 일괄 대상이 없는 건(톤백·매칭실패만)도 **그대로 보낸다** —
     * 그래야 그 매칭실패가 아래 배너·목록에 계속 보인다(서버가 알아서 건너뛴다).
     */
    const activeIds = useMemo(() => orderIds.filter((id) => !excluded.has(id)), [orderIds, excluded])
    const activeKey = activeIds.join(',')
    const pickedCount = pickable.filter((id) => !excluded.has(id)).length
    const nothingPicked = pickMode && pickedCount === 0

    /** 미리보기와 **그것을 만든 건 목록**. 확정은 이 한 쌍으로 보낸다 */
    const [result, setResult] = useState<{
        key: string
        ids: number[]
        data: BatchPreview | null
        error: string | null
        /**
         * 확정을 눌렀는데 재고가 바뀌어 중단된 경우 — 새 계획으로 다시 보고 있다는 표시.
         * 결과에 붙여 둔다: 그 뒤 체크를 바꿔 새로 계산하면 **저절로 꺼진다**(따로 두면 배너가 눌러앉는다)
         */
        stale?: boolean
    } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [confirming, setConfirming] = useState(false)
    const stale = result?.stale ?? false
    const firstRun = useRef(true)

    useEffect(() => {
        if (nothingPicked) return
        let alive = true
        // 처음은 바로, 체크를 바꾼 뒤엔 잠깐 모았다가 — 「그룹 해제」 뒤 몇 개 되살리는 동안 왕복이 쌓이지 않게
        const delay = firstRun.current ? 0 : 400
        firstRun.current = false
        const timer = setTimeout(() => {
            previewBatch(activeIds).then((r) => {
                // 🔴 체크가 또 바뀌었으면 늦게 온 옛 응답은 버린다(cleanup이 alive를 끈다)
                if (!alive) return
                setResult({
                    key: activeKey,
                    ids: activeIds,
                    data: r.success ? r.data : null,
                    error: r.success ? null : r.error,
                })
            })
        }, delay)
        return () => {
            alive = false
            clearTimeout(timer)
        }
    }, [activeIds, activeKey, nothingPicked])

    /** 지금 체크 상태로 계산한 값인가 — 아니면 옛 값을 흐리게 보여 주고 확정을 막는다 */
    const fresh = result !== null && result.key === activeKey
    const preview = nothingPicked ? null : (result?.data ?? null)
    const loading = !nothingPicked && result === null
    const recalculating = !nothingPicked && result !== null && !fresh

    /** 건마다 이번에 어떻게 되나 — 지금 체크 상태로 계산한 미리보기에서만 낸다(아니면 null) */
    const states = useMemo(() => {
        if (!fresh || !result?.data) return null
        const byOrder = new Map<number, { allocated: number }[]>()
        for (const s of result.data.shortages) byOrder.set(s.orderId, [...(byOrder.get(s.orderId) ?? []), s])
        return new Map(
            groups
                .flatMap((g) => g.rows)
                .filter((r) => r.skip === null)
                .map((r) => [r.orderId, gateStateOf(r.batchLines, byOrder.get(r.orderId) ?? [])] as const),
        )
    }, [fresh, result, groups])

    const runConfirm = async () => {
        if (!result?.data || !fresh) return
        setConfirming(true)
        const r = await confirmBatch(result.ids, result.data.fingerprint)
        setConfirming(false)
        if (r.success) {
            onDone(r.patch, { units: r.confirmed, lines: r.lines })
            return
        }
        if (r.mismatch) {
            // 아무것도 쓰이지 않았다 — 새 계획으로 갈아끼우고 다시 확인받는다(결정 G)
            setResult({ ...result, data: r.preview, stale: true })
            setError(r.error)
            return
        }
        setError(r.error)
    }

    const toggle = (orderId: number) =>
        setExcluded((prev) => {
            const next = new Set(prev)
            if (!next.delete(orderId)) next.add(orderId)
            return next
        })
    const toggleGroup = (ids: number[], include: boolean) =>
        setExcluded((prev) =>
            include ? new Set([...prev].filter((id) => !ids.includes(id))) : new Set([...prev, ...ids]),
        )

    const t = preview?.totals
    // 바의 분모 = 이번에 「판정한」 라인. 톤백·이미완료는 판정 대상이 아니라 따로 안내한다.
    const barTotal = t ? t.full + t.partial + t.none + t.unmatched : 0

    return (
        <Dialog open onOpenChange={(v) => !v && onClose()}>
            {/* 🔴 flex flex-col — 기본 grid는 이슈가 많아지면 푸터가 잘린다 */}
            <DialogContent className="flex max-h-[88vh] flex-col sm:max-w-[760px]">
                <DialogHeader>
                    <DialogTitle>차감 전 검토</DialogTitle>
                    <DialogDescription>
                        {sheetName} ·{' '}
                        {pickMode
                            ? `${fmt(pickedCount)}/${fmt(pickable.length)}건 선택`
                            : `${fmt(orderIds.length)}수령처 선택`}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex min-h-0 flex-col gap-4 overflow-y-auto py-1">
                    {/* 선택 목록이 위, 구성·이슈는 아래 그대로(상위 계획 §5 — 선택 UI가 4갈래를 밀어내지 않게) */}
                    {pickMode && (
                        <div className="flex flex-col gap-2">
                            <p className="text-[12.5px] text-slate-500">
                                빼야 할 건의 체크를 해제하세요. 한 건을 빼면 그 재고가 다른 건으로 가서 아래 숫자가 다시
                                계산됩니다.
                            </p>
                            <GateOrderPicker
                                groups={groups}
                                excluded={excluded}
                                states={states}
                                onToggle={toggle}
                                onToggleGroup={toggleGroup}
                            />
                        </div>
                    )}

                    {nothingPicked && (
                        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] font-medium text-slate-600">
                            선택된 건이 없습니다.
                        </p>
                    )}

                    {loading && <p className="py-8 text-center text-sm text-slate-500">계산 중…</p>}

                    {!loading && !preview && (result?.error ?? error) && (
                        <p className="py-6 text-center text-sm text-red-600">{result?.error ?? error}</p>
                    )}

                    {!loading && preview && t && (
                        <div
                            className={cn(
                                'flex flex-col gap-4 transition-opacity',
                                // 옛 계산은 흐리게 — 지금 체크 상태의 숫자가 아니다
                                recalculating && 'opacity-50',
                            )}
                        >
                            {stale && (
                                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-medium text-amber-800">
                                    {error ?? '재고가 바뀌어 다시 계산했습니다.'} 아래 내용으로 다시 확인해 주세요.
                                </p>
                            )}

                            {/* ① 결과값 — 이 행위가 만드는 것 */}
                            <div>
                                <p className="text-[12.5px] font-medium text-slate-500">차감 예정</p>
                                <p className="flex items-baseline gap-1.5">
                                    <b className="text-[30px] font-extrabold leading-tight tracking-tight text-foreground tabular-nums">
                                        {fmtKg(t.kg)}
                                    </b>
                                    <span className="text-[15px] font-semibold text-slate-500">kg</span>
                                </p>
                                <p className="text-[12.5px] text-slate-500">
                                    포장 {fmt(t.units)}개 · 로트 {fmt(t.lots)}개 · 오래된 것부터
                                </p>
                            </div>

                            {/* ② 구성 — 카드가 아니라 바 하나 */}
                            {barTotal > 0 && (
                                <div className="flex flex-col gap-1.5">
                                    {/* 색은 매트릭스 셀과 같은 어휘 — 재고없음은 주황(SHORTAGE), 매칭실패는 빨강(UNMATCHED) */}
                                    <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                                        <Bar n={t.full} total={barTotal} className="bg-emerald-500" />
                                        <Bar n={t.partial} total={barTotal} className="bg-amber-500" />
                                        <Bar n={t.none} total={barTotal} className="bg-orange-400" />
                                        <Bar n={t.unmatched} total={barTotal} className="bg-red-500" />
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
                                        <Tally n={t.full} label="정상 · 전량" dot="bg-emerald-500" />
                                        {t.partial > 0 && (
                                            <Tally n={t.partial} label="부분 · 일부만" dot="bg-amber-500" />
                                        )}
                                        {t.none > 0 && (
                                            <Tally n={t.none} label="재고없음 · 차감 0" dot="bg-orange-400" />
                                        )}
                                        <Tally n={t.unmatched} label="제외 · 매칭실패" dot="bg-red-500" />
                                        <span className="text-slate-400">{fmt(barTotal)}품목 구성</span>
                                    </div>
                                </div>
                            )}

                            {/* ③ 유일한 차단 사유 */}
                            {t.unmatched > 0 && (
                                <div className="flex gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                                    <div className="min-w-0 text-[13px] leading-relaxed text-red-700">
                                        <b>{fmt(t.unmatched)}품목은 SKU가 매칭되지 않아 차감할 수 없습니다.</b>
                                        <br />
                                        {/* 수동지정은 없다(c2fc6f3) — 마스터를 고치고 재매칭하는 길뿐이다 */}
                                        품종 관리에서 별칭을, 제품유형 관리에서 규격을 보완한 뒤 매트릭스 상단{' '}
                                        <span className="inline-flex items-center gap-0.5 font-semibold">
                                            <RefreshCw className="h-3 w-3" />
                                            재매칭
                                        </span>
                                        을 누르면 다시 붙습니다. 지금 확정해도 이 품목들은 남습니다.
                                    </div>
                                </div>
                            )}

                            {/* 톤백 — 시안에 없던 갈래(D2d). 자루를 사람이 골라야 해서 일괄에서 빠진다 */}
                            {t.bulk > 0 && (
                                <p className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12.5px] text-slate-600">
                                    <PackageX className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                    <span>
                                        톤백 {fmt(t.bulk)}품목은 자루를 직접 골라야 해서 빠집니다 —{' '}
                                        {/*
                                          * 🔴 폰엔 매트릭스 셀이 없다(`hidden sm:contents`) — **갈 수 없는 길을
                                          * 가리키면 안 된다.** D3 `data-cell` 무반응·M1-3 「이 줄」 무반응과 같은 자리다.
                                          * 폰은 라인 카드 → 배분 바텀시트(M1-5)가 그 길이다.
                                          */}
                                        <span className="sm:hidden">품목을 눌러 자루를 고르세요.</span>
                                        <span className="hidden sm:inline">셀을 눌러 처리하세요.</span>
                                    </span>
                                </p>
                            )}

                            <IssueList
                                title="제외 · 매칭실패"
                                count={t.unmatched}
                                tone="red"
                                note={
                                    // 폰엔 셀이 없어 그 건의 상세로 간다(`onJump`의 `offsetParent` 판정)
                                    <>
                                        <span className="sm:hidden">행을 누르면 그 건으로 이동</span>
                                        <span className="hidden sm:inline">행을 누르면 매트릭스 해당 셀로 이동</span>
                                    </>
                                }
                                rows={preview.skipped
                                    .filter((s) => s.reason === 'UNMATCHED')
                                    .map((s) => ({
                                        itemId: s.itemId,
                                        right: null,
                                    }))}
                                lookup={lookup}
                                onJump={onJump}
                            />

                            {/* 🔴 「일부라도 나가는 것」과 「아무것도 안 나가는 것」을 갈라 놓는다.
                                실측(묶음 #15)에서 부족 18라인이 전부 가용 0이었다 — 한 묶음으로 두면
                                「부분 차감된다」고 읽힌다. */}
                            <IssueList
                                title="부분 차감 · 재고부족"
                                count={t.partial}
                                tone="amber"
                                note="가능한 만큼 차감하고 부분 상태로 남습니다"
                                rows={preview.shortages
                                    .filter((s) => s.allocated > 0)
                                    .map((s) => ({
                                        itemId: s.itemId,
                                        right: `${fmt(s.shortage)}개 부족`,
                                        sub: `주문 ${fmt(s.need)} / 가능 ${fmt(s.allocated)}`,
                                    }))}
                                lookup={lookup}
                                onJump={onJump}
                            />

                            <IssueList
                                title="재고없음 · 이번엔 차감되지 않음"
                                count={t.none}
                                tone="orange"
                                note="가용 재고가 0이라 확정해도 이 품목은 그대로 남습니다"
                                rows={preview.shortages
                                    .filter((s) => s.allocated === 0)
                                    .map((s) => ({
                                        itemId: s.itemId,
                                        right: `${fmt(s.need)}개 필요`,
                                        sub: '가용 0',
                                    }))}
                                lookup={lookup}
                                onJump={onJump}
                            />

                            {t.done > 0 && (
                                <p className="text-[12px] text-slate-400">
                                    이미 전량 차감된 {fmt(t.done)}품목은 건드리지 않습니다.
                                </p>
                            )}

                            {preview.confirmLines === 0 && (
                                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] font-medium text-slate-600">
                                    지금 차감할 수 있는 품목이 없습니다.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-0.5">
                        {/* 목록을 내려도 결과가 보이게 — 선택 모드에선 푸터가 요약을 한 번 더 말한다 */}
                        {pickMode && (
                            <p className="text-[12.5px] text-slate-600">
                                <b className="text-foreground">{fmt(pickedCount)}</b>건
                                {fresh && t && (
                                    <>
                                        {' '}
                                        · <b className="text-foreground">{fmtKg(t.kg)}</b>kg 차감 예정
                                    </>
                                )}
                                {recalculating && <span className="text-slate-400"> · 다시 계산 중…</span>}
                                {excluded.size > 0 && <span className="text-slate-400"> · 제외 {fmt(excluded.size)}</span>}
                            </p>
                        )}
                        {/* 셀은 데스크탑에만 있다 — 폰은 품목 카드에서 취소한다(M1-5) */}
                        <p className="text-[12px] text-slate-500">
                            확인했습니다 — 되돌리려면 <b className="font-semibold">품목 단위로 차감 취소</b>해야 합니다.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={confirming}>
                            돌아가 수정
                        </Button>
                        <Button
                            type="button"
                            onClick={runConfirm}
                            disabled={
                                loading || confirming || !fresh || !preview || preview.confirmLines === 0
                            }
                        >
                            {confirming
                                ? '차감 중…'
                                : `${fmt(preview?.confirmLines ?? 0)}품목 차감 확정`}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ------------------------------------------------------

function Bar({ n, total, className }: { n: number; total: number; className: string }) {
    if (n <= 0) return null
    return <div className={className} style={{ width: `${(n / total) * 100}%` }} />
}

function Tally({ n, label, dot }: { n: number; label: string; dot: string }) {
    return (
        <span className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', dot)} />
            <b className="font-bold tabular-nums text-foreground">{n}</b>
            <span className="text-slate-500">{label}</span>
        </span>
    )
}

type IssueRow = { itemId: number; right: string | null; sub?: string }

function IssueList({
    title,
    count,
    tone,
    note,
    rows,
    lookup,
    onJump,
}: {
    title: string
    count: number
    tone: 'red' | 'amber' | 'orange'
    note: React.ReactNode
    rows: IssueRow[]
    lookup: LineLookup
    onJump: (itemId: number) => void
}) {
    if (rows.length === 0) return null
    return (
        <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
                <b className="text-[13px] font-bold text-foreground">{title}</b>
                <span
                    className={cn(
                        'rounded-md px-1.5 text-[11.5px] font-bold',
                        tone === 'red'
                            ? 'bg-red-100 text-red-600'
                            : tone === 'orange'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-amber-100 text-amber-700',
                    )}
                >
                    {count}
                </span>
                <span className="text-[11.5px] text-slate-400">{note}</span>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
                {rows.map((r, i) => {
                    const at = lookup(r.itemId)
                    return (
                        <button
                            key={r.itemId}
                            type="button"
                            onClick={() => onJump(r.itemId)}
                            className={cn(
                                'flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-slate-50',
                                i > 0 && 'border-t border-slate-100',
                            )}
                        >
                            {/* 🔴 min-w-0 — 없으면 긴 품목명이 칸의 하한이 되어 오른쪽 수치를 밀어낸다 */}
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12.5px] font-semibold text-foreground">
                                    {at?.who ?? `품목 ${r.itemId}`}
                                </span>
                                <span className="block truncate text-[11.5px] text-slate-500">
                                    {at?.what ?? '—'}
                                    {r.sub && ` · ${r.sub}`}
                                </span>
                            </span>
                            {r.right && (
                                <span className="shrink-0 text-[12px] font-bold tabular-nums text-slate-600">
                                    {r.right}
                                </span>
                            )}
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
