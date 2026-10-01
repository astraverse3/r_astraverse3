'use client'

// 수령인 주문 상세 패널 (계획서 D2c C4 · M1-1 · M1-3) — 행 머리글(이름칸)을 누르면 오른쪽에서 열린다.
//
// 그 건의 전 라인을 「작업필요 / 차감 완료」 두 묶음으로 보여주고, 푸터에서 건 단위로 일괄차감한다.
// 라인 탭 → 그 라인의 배분 바텀시트(M1-5, `onOpenLine`). 시트는 이 패널 **위**에 뜬다 —
// 부모가 그동안 `blockOutsideClose`를 켜야 시트 안을 누른 게 이 패널의 바깥 클릭이 되지 않는다.
//
// 🔴 **서버를 부르지 않는다**(M1-1). 라인은 부모가 `buildOrderLines(input, orderId)`로 파생해 넘긴다.
//    옛 경로(`getPurchaseOrderDetail`)는 라인마다 쿼리를 2회 돌아, 「다음 건 ›」으로 67건을 연속
//    이동하면 왕복이 건마다 쌓였다. 파생이라 차감 즉시 숫자가 맞는 것은 덤이다 —
//    예전엔 「열 때마다 다시 읽는다」로 그 낡음을 막고 있었다.
// 🔴 **상태 판정을 여기서 하지 않는다.** 매트릭스 셀과 이 줄이 `cellStatusOf` 한 벌을 쓴다.
//    예전의 `kindOf`는 같은 판정을 다른 이름으로 한 번 더 한 것이었다(M1 §3-B에서 흡수).
// 🔴 **푸터 집계도 여기서 세지 않는다** — `sumOrderLines` 한 벌이다. 라인수와 버튼수는 분모가
//    다른데(실패 포함 / 제외), 화면에서 두 번 세면 그 분기가 조용히 어긋난다.

import { useRef, useState } from 'react'
import { Check, ChevronDown, ChevronRight, List, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ROW_STATUS_ORDER, sumOrderLines, type OrderLine } from '@/lib/purchase-order-matrix'
import { STATUS_META } from './status-meta'
import { LineCard, specOf } from './order-line-card'
import { confirmDialog, type ConfirmOptions } from '@/components/ui/confirm-dialog'
import { OrderEditFooter, OrderEditList, type OrderEditHandlers } from './order-edit-list'

const fmt = (n: number) => n.toLocaleString()
const fmtKg = (n: number) => (Math.round(n * 10) / 10).toLocaleString()


export function OrderDetailPanel({
    orderId,
    lines,
    title,
    subtitle,
    siblings,
    onNavigate,
    onBatch,
    onOpenLine,
    blockOutsideClose,
    edit,
    initialEdit = false,
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
     * 🔴 살아 있는 목록을 그대로 쓰면 안 된다. 모바일 목록의 기본 필터가 「작업필요」라,
     * 이 건을 차감하는 순간 이 건이 목록에서 빠지고 뒤 건이 한 칸 당겨진다 —
     * 그 상태로 `indexOf + 1`을 하면 **바로 다음 건을 건너뛴다**.
     */
    siblings: number[]
    onNavigate: (orderId: number) => void
    /** 푸터 일괄차감 — 부모가 이 건 하나로 검토 게이트를 연다 */
    onBatch?: () => void
    /** 라인 탭 — 부모가 그 라인 하나로 배분 시트를 연다(M1-5) */
    onOpenLine?: (line: OrderLine) => void
    /**
     * 바깥 클릭으로 닫히는 것을 막는다 — **검토 게이트가 이 패널 위에 열려 있는 동안** 켠다.
     *
     * 🔴 게이트(Dialog)는 이 패널(Sheet)보다 **위 레이어**인데도, 게이트 안 「이 줄」을 누른
     * `pointerdown`이 **이 패널의 바깥 클릭**으로 잡혀 패널이 스스로 닫혔다
     * (2026-09-23 스택으로 확인: `usePointerDownOutside` → `onDismiss` → `onOpenChange(false)`).
     * 위 레이어가 modal이면 아래는 보호되리라 믿었지만 **실제로는 아니었다.**
     *
     * 📌 증상이 「이 줄을 눌렀더니 목록으로 튄다」였다 — 점프가 실패한 게 아니라(`goDetail`은
     * 제대로 돌았다) **그 아래 패널이 닫힌 것**이었다. 딤을 탭해 닫을 때는 멀쩡했는데,
     * 그건 게이트 자기 레이어가 처리하고 끝나 이 패널까지 오지 않기 때문이다 —
     * 🔴 **「닫는 방법에 따라 다르다」가 이 결함의 지문이었다.**
     */
    blockOutsideClose?: boolean
    /** 고치기(수량·품목 취소·건 취소) — 읽기 전용(§60)이면 안 온다. 계획서 plan-발주서-건상세-수정추가 */
    edit?: OrderEditHandlers
    /** 열자마자 고치기 모드 — 폰 택배 목록의 「고치기」로 열 때 */
    initialEdit?: boolean
    onClose: () => void
}) {
    /*
     * 🔴 고치기의 확인창(AlertDialog)이 이 패널 **위**에 뜬다 — 그 안 버튼 터치가 이 패널의 바깥 클릭으로
     *    잡혀 패널까지 닫히는 9/23 결함과 같은 구조다. 확인창이 떠 있는 동안 닫힘을 거르고,
     *    가드는 **클릭이 끝난 뒤에**(`setTimeout 0`) 푼다.
     */
    const confirming = useRef(false)
    const guardedConfirm = async (opts: ConfirmOptions) => {
        confirming.current = true
        try {
            return await confirmDialog(opts)
        } finally {
            setTimeout(() => {
                confirming.current = false
            }, 0)
        }
    }
    return (
        <Sheet
            open={orderId !== null}
            /*
             * 🔴 **닫힘 요청을 여기서 거른다.** `onInteractOutside`의 `preventDefault`만으로는
             * 막히지 않았다(2026-09-23 실측) — 계측 스택이 지목한 곳이 `onOpenChange`라
             * **경로를 막지 말고 결과를 막는다.** 게이트가 열려 있는 동안 이 패널은 어떤 경로로도
             * 닫히지 않는다(바깥 클릭·ESC 전부). 게이트를 닫는 건 게이트 자신의 몫이다.
             */
            onOpenChange={(o) => {
                if (o || blockOutsideClose || confirming.current) return
                onClose()
            }}
        >
            <SheetContent
                side="right"
                showCloseButton={false}
                className="flex w-full flex-col gap-0 p-0 sm:max-w-[468px]"
                onInteractOutside={(e) => {
                    if (blockOutsideClose || confirming.current) e.preventDefault()
                }}
            >
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
                        onOpenLine={onOpenLine}
                        edit={edit}
                        initialEdit={initialEdit}
                        confirm={guardedConfirm}
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
    onOpenLine,
    edit,
    initialEdit,
    confirm,
    onClose,
}: {
    orderId: number
    lines: OrderLine[]
    title: string
    subtitle: string | null
    siblings: number[]
    onNavigate: (orderId: number) => void
    onBatch?: () => void
    onOpenLine?: (line: OrderLine) => void
    edit?: OrderEditHandlers
    initialEdit: boolean
    confirm: (opts: ConfirmOptions) => Promise<boolean>
    onClose: () => void
}) {
    const [editing, setEditing] = useState(initialEdit && edit !== undefined)
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
            <SheetHeader className="shrink-0 gap-2 border-b border-slate-200 pt-3 pr-3 pb-3.5 pl-5">
                {/*
                 * 위 줄 = 눈썹 글자 ……… [고치기][X] 한 묶음(작업지시 ⑦ E1 A안).
                 * 예전엔 X가 absolute로 떠 있고 고치기는 pr-8로 피해 다녔다 — 높이·간격이 따로 놀았다.
                 * 기본 닫기 버튼은 `showCloseButton={false}`로 끄고 여기 `SheetClose`를 직접 둔다.
                 */}
                <div className="flex min-h-8 items-center gap-2">
                    <SheetDescription className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        수령인 주문 상세
                        {at >= 0 && siblings.length > 1 && (
                            <span className="ml-1.5 font-semibold normal-case tracking-normal tabular-nums">
                                {at + 1}/{siblings.length}
                            </span>
                        )}
                    </SheetDescription>
                    <div className="ml-auto flex items-center gap-1">
                        {edit && !editing && lines.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setEditing(true)}
                                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-slate-300 bg-card px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 sm:h-8"
                            >
                                <Pencil className="h-3.5 w-3.5 text-primary" />
                                고치기
                            </button>
                        )}
                        {/* 고치는 중 = 같은 자리에 표시만(누를 수 없다). 나가는 길은 푸터 「완료」 */}
                        {editing && (
                            <span className="inline-flex h-6 items-center gap-1 rounded-md bg-blue-50 px-2 text-[12px] font-semibold text-blue-700">
                                <Pencil className="h-3 w-3" />
                                고치는 중
                            </span>
                        )}
                        <SheetClose className="flex h-10 w-10 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 sm:h-8 sm:w-8">
                            <X className="h-[18px] w-[18px]" />
                            <span className="sr-only">닫기</span>
                        </SheetClose>
                    </div>
                </div>
                <SheetTitle className="flex items-baseline gap-2 text-[19px] font-bold leading-none text-foreground">
                    {title}
                    {subtitle && (
                        <span className="border-l border-slate-300 pl-2 text-[14px] font-medium text-slate-500">
                            {subtitle}
                        </span>
                    )}
                </SheetTitle>
                {/* 고치는 동안엔 진행 막대·상태 뱃지를 숨긴다 — 목록에 자리를 내준다(E1) */}
                {!editing && (
                <>
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
                        <b className="text-slate-700">{lines.length}</b>품목
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
                </>
                )}
            </SheetHeader>

            {/* data-panel-scroll — 「품목 추가」를 펼칠 때 이 상자의 scrollTop만 내린다(scrollIntoView 대신, 작업지시 ⑧ P3) */}
            <div
                data-panel-scroll
                className={cn('min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4', editing ? 'py-3' : 'py-4')}
            >
                {lines.length === 0 && <p className="text-[12.5px] text-slate-400">품목이 없습니다.</p>}
                {editing && edit && lines.length > 0 && <OrderEditList lines={lines} edit={edit} confirm={confirm} />}
                {!editing && work.length > 0 && (
                    <Group label={`작업필요 · ${work.length}품목`} lines={work} onOpenLine={onOpenLine} />
                )}
                {!editing && done.length > 0 && (
                    <DoneGroup
                        lines={done}
                        doneKg={totals.doneKg}
                        collapsed={work.length > 0}
                        onOpenLine={onOpenLine}
                    />
                )}
            </div>

            {editing && edit ? (
                <OrderEditFooter
                    lines={lines}
                    edit={edit}
                    confirm={confirm}
                    title={subtitle ? `${title} · ${subtitle}` : title}
                    onDone={() => setEditing(false)}
                />
            ) : (
            <Footer
                totals={totals}
                nextId={nextId}
                onNavigate={onNavigate}
                onBatch={onBatch}
                onClose={onClose}
            />
            )}
        </>
    )
}

/**
 * 푸터 — 「무엇이 남았나」 한 줄과 행동 두 개.
 *
 * 🔴 **줄 수와 버튼 수는 분모가 다르다**(의도). `작업필요 7품목`은 사람이 볼 줄 수라 매칭실패·톤백을
 * 포함하고, `6품목 일괄차감`은 버튼이 실제로 건드릴 줄 수라 **둘 다 뺀다** — 매칭실패는 품종 관리
 * 보완 뒤 재매칭으로만 풀리고(2026-09-16 수동지정 철회), 톤백은 자루를 사람이 골라야 한다(결정 D).
 *
 * 🔴 **빠진 줄은 푸터가 말해 준다.** 안 적으면 「작업필요 4품목」인데 버튼이 비활성인 이유가 없다 —
 * `#19 시아스`는 4품목이 전부 톤백이라 이 화면에서 일괄로 할 수 있는 일이 하나도 없다.
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
    onBatch?: () => void
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
                            작업필요 <b className="text-foreground">{fmt(totals.workLines)}</b>품목
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
                        {/* 톤백은 일괄에서 빠진다 — 버튼 수와 작업필요 수가 갈리는 유일한 다른 사유다 */}
                        {totals.bulkLines > 0 && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-600">
                                톤백 {fmt(totals.bulkLines)}품목 별도
                            </span>
                        )}
                    </div>
                    {/* 읽기 전용(§60)이면 일괄차감 없이 「다음 건」만 — 오른쪽 끝에 둔다 */}
                    <div className="flex items-center justify-end gap-2">
                        {onBatch && (
                            <Button
                                type="button"
                                className="h-11 flex-1"
                                disabled={totals.batchLines === 0}
                                onClick={onBatch}
                            >
                                {totals.batchLines > 0 ? (
                                    `${fmt(totals.batchLines)}품목 일괄차감`
                                ) : totals.bulkLines > 0 ? (
                                    // 폰·데스크탑 모두 카드가 눌리므로(M1-5) 한 벌이다 — 예전엔 폰만 「PC에서」였다
                                    '톤백은 품목을 눌러 자루 선택'
                                ) : (
                                    '차감할 품목이 없습니다'
                                )}
                            </Button>
                        )}
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

function Group({
    label,
    lines,
    onOpenLine,
}: {
    label: string
    lines: OrderLine[]
    onOpenLine?: (line: OrderLine) => void
}) {
    return (
        <div className="mb-5">
            <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
            <div className="flex flex-col gap-2">
                {lines.map((l) => (
                    <LineCard key={l.itemId} line={l} onOpen={onOpenLine && (() => onOpenLine(l))} />
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
    onOpenLine,
}: {
    lines: OrderLine[]
    doneKg: number
    collapsed: boolean
    /** 완료 라인도 연다 — 폰에서 차감 취소로 가는 유일한 길이다 */
    onOpenLine?: (line: OrderLine) => void
}) {
    const [open, setOpen] = useState(!initial)
    const head = lines[0]
    const summary =
        `${head.title} ${specOf(head)}` +
        (lines.length > 1 ? ` 외 ${fmt(lines.length - 1)}품목` : '') +
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
                        <LineCard key={l.itemId} line={l} onOpen={onOpenLine && (() => onOpenLine(l))} />
                    ))}
                </div>
            )}
        </div>
    )
}

