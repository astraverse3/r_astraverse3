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

import { useEffect, useState } from 'react'
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
import {
    confirmBatch,
    previewBatch,
    type BatchPatch,
    type BatchPreview,
} from '@/app/actions/purchase-order-batch'

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
    sheetName,
    lookup,
    onClose,
    onDone,
    onJump,
}: {
    orderIds: number[]
    sheetName: string
    lookup: LineLookup
    onClose: () => void
    /** 확정 성공 — 바뀐 값만 받아 매트릭스가 다시 그린다(결정 H) */
    onDone: (patch: BatchPatch, summary: { units: number; lines: number }) => void
    /** 이슈 줄 클릭 — 매트릭스의 그 셀로 보낸다 */
    onJump: (itemId: number) => void
}) {
    const [preview, setPreview] = useState<BatchPreview | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [confirming, setConfirming] = useState(false)
    /** 확정을 눌렀는데 재고가 바뀌어 중단된 경우 — 새 계획으로 다시 보고 있다는 표시 */
    const [stale, setStale] = useState(false)

    useEffect(() => {
        let alive = true
        previewBatch(orderIds).then((r) => {
            if (!alive) return
            if (r.success) setPreview(r.data)
            else setError(r.error)
        })
        return () => {
            alive = false
        }
    }, [orderIds])

    const loading = preview === null && error === null

    const runConfirm = async () => {
        if (!preview) return
        setConfirming(true)
        const r = await confirmBatch(orderIds, preview.fingerprint)
        setConfirming(false)
        if (r.success) {
            onDone(r.patch, { units: r.confirmed, lines: r.lines })
            return
        }
        if (r.mismatch) {
            // 아무것도 쓰이지 않았다 — 새 계획으로 갈아끼우고 다시 확인받는다(결정 G)
            setPreview(r.preview)
            setStale(true)
            setError(r.error)
            return
        }
        setError(r.error)
    }

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
                        {sheetName} · {fmt(orderIds.length)}수령처 선택
                    </DialogDescription>
                </DialogHeader>

                <div className="flex min-h-0 flex-col gap-4 overflow-y-auto py-1">
                    {loading && <p className="py-8 text-center text-sm text-slate-500">계산 중…</p>}

                    {!loading && error && !preview && (
                        <p className="py-6 text-center text-sm text-red-600">{error}</p>
                    )}

                    {!loading && preview && t && (
                        <>
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
                                    포장 {fmt(t.units)}개 · 로트 {fmt(t.lots)}개
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
                                        <span className="text-slate-400">{fmt(barTotal)}라인 구성</span>
                                    </div>
                                </div>
                            )}

                            {/* ③ 유일한 차단 사유 */}
                            {t.unmatched > 0 && (
                                <div className="flex gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                                    <div className="min-w-0 text-[13px] leading-relaxed text-red-700">
                                        <b>{fmt(t.unmatched)}라인은 SKU가 매칭되지 않아 차감할 수 없습니다.</b>
                                        <br />
                                        {/* 수동지정은 없다(c2fc6f3) — 마스터를 고치고 재매칭하는 길뿐이다 */}
                                        품종 관리에서 별칭을, 제품유형 관리에서 규격을 보완한 뒤 매트릭스 상단{' '}
                                        <span className="inline-flex items-center gap-0.5 font-semibold">
                                            <RefreshCw className="h-3 w-3" />
                                            재매칭
                                        </span>
                                        을 누르면 다시 붙습니다. 지금 확정해도 이 라인들은 남습니다.
                                    </div>
                                </div>
                            )}

                            {/* 톤백 — 시안에 없던 갈래(D2d). 자루를 사람이 골라야 해서 일괄에서 빠진다 */}
                            {t.bulk > 0 && (
                                <p className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12.5px] text-slate-600">
                                    <PackageX className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                    톤백 {fmt(t.bulk)}라인은 자루를 직접 골라야 해서 빠집니다 — 셀을 눌러 처리하세요.
                                </p>
                            )}

                            <IssueList
                                title="제외 · 매칭실패"
                                count={t.unmatched}
                                tone="red"
                                note="행을 누르면 매트릭스 해당 셀로 이동"
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
                                note="가용 재고가 0이라 확정해도 이 라인은 그대로 남습니다"
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
                                    이미 전량 차감된 {fmt(t.done)}라인은 건드리지 않습니다.
                                </p>
                            )}

                            {preview.confirmLines === 0 && (
                                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] font-medium text-slate-600">
                                    지금 차감할 수 있는 라인이 없습니다.
                                </p>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[12px] text-slate-500">
                        확인했습니다 — 되돌리려면 <b className="font-semibold">셀 단위로 차감 취소</b>해야 합니다.
                    </p>
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={confirming}>
                            돌아가 수정
                        </Button>
                        <Button
                            type="button"
                            onClick={runConfirm}
                            disabled={loading || confirming || !preview || preview.confirmLines === 0}
                        >
                            {confirming
                                ? '차감 중…'
                                : `${fmt(preview?.confirmLines ?? 0)}라인 차감 확정`}
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
    note: string
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
                                    {at?.who ?? `라인 ${r.itemId}`}
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
