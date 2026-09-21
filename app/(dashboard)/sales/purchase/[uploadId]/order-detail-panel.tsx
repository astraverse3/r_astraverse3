'use client'

// 수령인 주문 상세 패널 (계획서 D2c C4 · M1-1 · M1-3) — 행 머리글(이름칸)을 누르면 오른쪽에서 열린다.
//
// 그 건의 전 라인을 「작업 필요 / 차감 완료」 두 묶음으로 보여주고, 푸터에서 건 단위로 일괄차감한다.
// 라인 탭 → FIFO 시트는 M1-5에서 붙는다.
//
// 🔴 **서버를 부르지 않는다**(M1-1). 라인은 부모가 `buildOrderLines(input, orderId)`로 파생해 넘긴다.
//    옛 경로(`getPurchaseOrderDetail`)는 라인마다 쿼리를 2회 돌아, 「다음 건 ›」으로 67건을 연속
//    이동하면 왕복이 건마다 쌓였다. 파생이라 차감 즉시 숫자가 맞는 것은 덤이다 —
//    예전엔 「열 때마다 다시 읽는다」로 그 낡음을 막고 있었다.
// 🔴 **상태 판정을 여기서 하지 않는다.** 매트릭스 셀과 이 줄이 `cellStatusOf` 한 벌을 쓴다.
//    예전의 `kindOf`는 같은 판정을 다른 이름으로 한 번 더 한 것이었다(M1 §3-B에서 흡수).
// 🔴 **푸터 집계도 여기서 세지 않는다** — `sumOrderLines` 한 벌이다. 라인수와 버튼수는 분모가
//    다른데(실패 포함 / 제외), 화면에서 두 번 세면 그 분기가 조용히 어긋난다.

import { useState } from 'react'
import { Check, ChevronDown, ChevronRight, List } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ROW_STATUS_ORDER, sumOrderLines, type OrderLine } from '@/lib/purchase-order-matrix'
import { STATUS_META } from './status-meta'

const fmt = (n: number) => n.toLocaleString()
const fmtKg = (n: number) => (Math.round(n * 10) / 10).toLocaleString()

/** 톤백은 규격칸에 자루중량을 적는다 — 「톤백」만으로는 1,000kg과 200kg이 안 갈린다 */
function specOf(line: OrderLine): string {
    return line.bulk ? `${fmtKg(line.unitWeightKg ?? 0)}kg` : line.packageType
}

export function OrderDetailPanel({
    orderId,
    lines,
    title,
    subtitle,
    siblings,
    onNavigate,
    onBatch,
    onClose,
}: {
    orderId: number | null
    /** 부모가 `buildOrderLines`로 파생해 넘긴다 — 이미 상태 심각도순이다 */
    lines: OrderLine[]
    /** 이름칸 앞 값(굵은 값) */
    title: string
    /** 이름칸 뒤 값. 없으면 한 줄 */
    subtitle: string | null
    /**
     * 「다음 건 ›」이 따라갈 순서 — 패널을 **열 때 찍은 스냅샷**이다(부모가 만든다).
     *
     * 🔴 살아 있는 목록을 그대로 쓰면 안 된다. 모바일 목록의 기본 필터가 「작업 필요」라,
     * 이 건을 차감하는 순간 이 건이 목록에서 빠지고 뒤 건이 한 칸 당겨진다 —
     * 그 상태로 `indexOf + 1`을 하면 **바로 다음 건을 건너뛴다**.
     */
    siblings: number[]
    onNavigate: (orderId: number) => void
    /** 푸터 일괄차감 — 부모가 이 건 하나로 검토 게이트를 연다 */
    onBatch: () => void
    onClose: () => void
}) {
    return (
        <Sheet open={orderId !== null} onOpenChange={(o) => !o && onClose()}>
            <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[468px]">
                {/*
                 * 🔴 `key`로 건마다 새 마운트 — 「다음 건 ›」이 스크롤·접힘 상태를 물려받으면
                 * 새 건을 중간부터 보게 된다. 리셋을 effect로 흉내 내지 않는다.
                 */}
                {orderId !== null && (
                    <Body
                        key={orderId}
                        orderId={orderId}
                        lines={lines}
                        title={title}
                        subtitle={subtitle}
                        siblings={siblings}
                        onNavigate={onNavigate}
                        onBatch={onBatch}
                        onClose={onClose}
                    />
                )}
            </SheetContent>
        </Sheet>
    )
}

function Body({
    orderId,
    lines,
    title,
    subtitle,
    siblings,
    onNavigate,
    onBatch,
    onClose,
}: {
    orderId: number
    lines: OrderLine[]
    title: string
    subtitle: string | null
    siblings: number[]
    onNavigate: (orderId: number) => void
    onBatch: () => void
    onClose: () => void
}) {
    const work = lines.filter((l) => l.status !== 'COMPLETED')
    const done = lines.filter((l) => l.status === 'COMPLETED')
    const ordered = lines.reduce((s, l) => s + l.orderedQty, 0)
    const allocated = lines.reduce((s, l) => s + l.allocatedQty, 0)
    const pct = ordered > 0 ? Math.round((allocated / ordered) * 100) : 0
    const totals = sumOrderLines(lines)

    const at = siblings.indexOf(orderId)
    const nextId = at >= 0 ? siblings[at + 1] : undefined

    return (
        <>
            <SheetHeader className="shrink-0 gap-2 border-b border-slate-200 px-5 pt-4 pb-3.5">
                <SheetDescription className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                    수령인 주문 상세
                    {at >= 0 && siblings.length > 1 && (
                        <span className="ml-1.5 font-semibold normal-case tracking-normal text-slate-300">
                            {at + 1}/{siblings.length}
                        </span>
                    )}
                </SheetDescription>
                <SheetTitle className="flex items-baseline gap-2 text-[19px] font-bold leading-none text-foreground">
                    {title}
                    {subtitle && (
                        <span className="border-l border-slate-300 pl-2 text-[14px] font-medium text-slate-500">
                            {subtitle}
                        </span>
                    )}
                </SheetTitle>
                <div className="flex items-center gap-3 pt-1">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                            className={cn('h-full', pct >= 100 ? 'bg-emerald-400' : 'bg-amber-400')}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                    <span className="shrink-0 text-[12px] tabular-nums text-slate-500">
                        {fmt(allocated)}/{fmt(ordered)}
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
                    <span className="text-slate-500">
                        <b className="text-slate-700">{lines.length}</b>라인
                    </span>
                    {ROW_STATUS_ORDER.map((k) => {
                        const n = lines.filter((l) => l.status === k).length
                        if (n === 0) return null
                        return (
                            <span key={k} className={cn('rounded px-1.5 py-0.5 font-semibold', STATUS_META[k].badge)}>
                                {STATUS_META[k].label} {n}
                            </span>
                        )
                    })}
                </div>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-4">
                {lines.length === 0 && <p className="text-[12.5px] text-slate-400">라인이 없습니다.</p>}
                {work.length > 0 && <Group label={`작업 필요 · ${work.length}라인`} lines={work} />}
                {done.length > 0 && (
                    <DoneGroup lines={done} doneKg={totals.doneKg} collapsed={work.length > 0} />
                )}
            </div>

            <Footer
                totals={totals}
                nextId={nextId}
                onNavigate={onNavigate}
                onBatch={onBatch}
                onClose={onClose}
            />
        </>
    )
}

/**
 * 푸터 — 「무엇이 남았나」 한 줄과 행동 두 개.
 *
 * 🔴 **라인수와 버튼수는 분모가 다르다**(의도). `작업 필요 7라인`은 사람이 볼 줄 수라 매칭실패를
 * 포함하고, `6라인 일괄차감`은 버튼이 실제로 건드릴 줄 수라 매칭실패를 뺀다 — 실패 라인은 FIFO로
 * 풀리지 않고 품종 관리 보완 뒤 재매칭으로만 풀린다(2026-09-16 수동지정 철회).
 */
function Footer({
    totals,
    nextId,
    onNavigate,
    onBatch,
    onClose,
}: {
    totals: ReturnType<typeof sumOrderLines>
    nextId: number | undefined
    onNavigate: (orderId: number) => void
    onBatch: () => void
    onClose: () => void
}) {
    const nextButton =
        nextId !== undefined ? (
            <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0 gap-1 px-3.5"
                onClick={() => onNavigate(nextId)}
            >
                다음 건
                <ChevronRight className="h-4 w-4" />
            </Button>
        ) : (
            <Button type="button" variant="outline" className="h-11 shrink-0 gap-1.5 px-3.5" onClick={onClose}>
                <List className="h-4 w-4" />
                목록으로
            </Button>
        )

    return (
        <footer className="shrink-0 border-t border-slate-200 px-4 py-3">
            {totals.workLines > 0 ? (
                <>
                    <div className="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 px-0.5 text-[12px] text-slate-500">
                        <span>
                            작업 필요 <b className="text-foreground">{fmt(totals.workLines)}</b>라인
                        </span>
                        <span>
                            · 남은 <b className="text-foreground">{fmtKg(totals.remainingKg)}</b>kg
                        </span>
                        {/*
                         * 🔴 단위 없는 규격(`500`)은 중량이 `null`이라 위 kg 합계에서 **말없이 빠진다**.
                         * 틀린 값이 아니라 모자란 값이라 화면이 말해 주지 않으면 알 길이 없다(핸드오프 §8-1).
                         */}
                        {totals.unknownWeight && (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-700">
                                일부 규격 중량 미산정
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            className="h-11 flex-1"
                            disabled={totals.batchLines === 0}
                            onClick={onBatch}
                        >
                            {totals.batchLines > 0
                                ? `${fmt(totals.batchLines)}라인 FIFO 일괄차감`
                                : '차감할 라인이 없습니다'}
                        </Button>
                        {nextButton}
                    </div>
                </>
            ) : (
                <div className="flex items-center gap-2">
                    <span className="flex-1 px-0.5 text-[12px] text-slate-500">
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <Check className="h-3.5 w-3.5" />
                            전부 차감 완료
                        </span>
                        {totals.doneKg > 0 && <span className="ml-1.5">· {fmtKg(totals.doneKg)}kg</span>}
                    </span>
                    {nextButton}
                </div>
            )}
        </footer>
    )
}

function Group({ label, lines }: { label: string; lines: OrderLine[] }) {
    return (
        <div className="mb-5">
            <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
            <div className="flex flex-col gap-2">
                {lines.map((l) => (
                    <LineCard key={l.itemId} line={l} />
                ))}
            </div>
        </div>
    )
}

/**
 * 차감이 끝난 줄은 **한 줄로 접는다**(핸드오프 §4.1). 작업 필요가 하나도 없으면 접을 이유가 없다 —
 * 그때는 완료 목록이 곧 이 화면의 내용이다.
 */
function DoneGroup({
    lines,
    doneKg,
    collapsed: initial,
}: {
    lines: OrderLine[]
    doneKg: number
    collapsed: boolean
}) {
    const [open, setOpen] = useState(!initial)
    const head = lines[0]
    const summary =
        `${head.title} ${specOf(head)}` +
        (lines.length > 1 ? ` 외 ${fmt(lines.length - 1)}건` : '') +
        ' · 전부 차감 완료' +
        (doneKg > 0 ? ` · ${fmtKg(doneKg)}kg` : '')

    return (
        <div className="mb-5">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="flex w-full items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3.5 py-2.5 text-left active:bg-emerald-50"
            >
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-emerald-800">{summary}</span>
                {open ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-emerald-600" />
                )}
            </button>
            {open && (
                <div className="mt-2 flex flex-col gap-2">
                    {lines.map((l) => (
                        <LineCard key={l.itemId} line={l} />
                    ))}
                </div>
            )}
        </div>
    )
}

function LineCard({ line }: { line: OrderLine }) {
    const meta = STATUS_META[line.status]
    return (
        <div className={cn('rounded-xl border px-3.5 py-2.5', meta.card)}>
            <div className="flex flex-wrap items-center gap-1.5">
                <span
                    className={cn(
                        'text-[13px] font-bold',
                        line.status === 'UNMATCHED' ? 'text-red-600' : 'text-foreground',
                    )}
                >
                    {line.title} {specOf(line)}
                </span>
                {line.packagingName && <span className="text-[11px] text-slate-400">{line.packagingName}</span>}
                <span className="text-[12px] tabular-nums text-slate-400">· 주문 {fmt(line.orderedQty)}개</span>
                <span className={cn('ml-auto rounded px-1.5 py-0.5 text-[10.5px] font-semibold', meta.badge)}>
                    {meta.label}
                </span>
            </div>
            <div className="mt-1.5 text-[11.5px] text-slate-500">
                {line.status === 'COMPLETED' && (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <Check className="h-3 w-3" />
                        {fmt(line.allocatedQty)}개 차감
                    </span>
                )}
                {line.status === 'UNMATCHED' && (
                    // 수동지정은 2026-09-16에 철회됐다 — 푸는 길은 품종 관리 보완 뒤 재매칭뿐이다
                    <span className="text-red-600">
                        품종을 못 찾았습니다. 품종 관리에서 별칭을 추가한 뒤 재매칭하세요.
                    </span>
                )}
                {line.status !== 'COMPLETED' && line.status !== 'UNMATCHED' && (
                    <>
                        차감 {fmt(line.allocatedQty)} · 남은 {fmt(line.remainingQty)} · 가용{' '}
                        {fmt(Math.floor(line.availableQty ?? 0))}
                        {line.shortage > 0 && (
                            <span className="ml-1 font-semibold text-orange-700">(부족 {fmt(line.shortage)})</span>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
