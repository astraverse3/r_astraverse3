'use client'

// 수령인 주문 상세 패널 (계획서 D2c C4) — 행 머리글(이름칸)을 누르면 오른쪽에서 열린다.
//
// 그 건의 전 라인을 「작업 필요 / 차감 완료」 두 묶음으로 보여준다. `getPurchaseOrderDetail`의
// 첫 호출부다(D1에 만들어졌지만 어떤 화면도 부르지 않았다). 읽기 전용 — 일괄 FIFO 차감은 D3.
//
// 🔴 셀 팝오버가 차감하면 이 패널의 숫자는 낡는다. 그래서 열 때마다 다시 읽는다(`key`로 리마운트).

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { getPurchaseOrderDetail, type DetailLine, type OrderDetail } from '@/app/actions/purchase-order'
import { getDisplayMillingType } from '@/lib/milling-type-display'

const fmt = (n: number) => n.toLocaleString()

/** 라인 상태 — 매트릭스 셀 상태와 같은 의미·같은 색 */
type Kind = 'UNMATCHED' | 'SHORTAGE' | 'PARTIAL' | 'PENDING' | 'COMPLETED'
const KIND_META: Record<Kind, { label: string; badge: string; card: string }> = {
    UNMATCHED: { label: '매칭실패', badge: 'bg-red-50 text-red-600', card: 'border-red-200 bg-red-50/50' },
    SHORTAGE: { label: '재고부족', badge: 'bg-orange-100 text-orange-800', card: 'border-orange-200 bg-orange-50/50' },
    PARTIAL: { label: '부분', badge: 'bg-amber-50 text-amber-700', card: 'border-slate-200 bg-card' },
    PENDING: { label: '대기', badge: 'bg-slate-100 text-slate-500', card: 'border-slate-200 bg-card' },
    COMPLETED: { label: '완료', badge: 'bg-emerald-50 text-emerald-700', card: 'border-emerald-100 bg-emerald-50/40' },
}
const KIND_ORDER: Kind[] = ['UNMATCHED', 'SHORTAGE', 'PARTIAL', 'PENDING', 'COMPLETED']

function kindOf(l: DetailLine): Kind {
    if (l.lineStatus === 'COMPLETED') return 'COMPLETED'
    if (!l.matched) return 'UNMATCHED'
    if (l.availableQty < l.orderedQty - l.allocatedQty) return 'SHORTAGE'
    return l.lineStatus
}

export function OrderDetailPanel({
    orderId,
    title,
    subtitle,
    onClose,
}: {
    orderId: number | null
    /** 이름칸 앞 값(굵은 값) */
    title: string
    /** 이름칸 뒤 값. 없으면 한 줄 */
    subtitle: string | null
    onClose: () => void
}) {
    return (
        <Sheet open={orderId !== null} onOpenChange={(o) => !o && onClose()}>
            <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[468px]">
                {orderId !== null && (
                    <Body key={orderId} orderId={orderId} title={title} subtitle={subtitle} />
                )}
            </SheetContent>
        </Sheet>
    )
}

function Body({ orderId, title, subtitle }: { orderId: number; title: string; subtitle: string | null }) {
    const [detail, setDetail] = useState<OrderDetail | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let alive = true
        getPurchaseOrderDetail(orderId).then((r) => {
            if (!alive) return
            if (r.success) setDetail(r.data)
            else setError(r.error)
        })
        return () => {
            alive = false
        }
    }, [orderId])

    const lines = detail
        ? [...detail.lines].sort((a, b) => KIND_ORDER.indexOf(kindOf(a)) - KIND_ORDER.indexOf(kindOf(b)))
        : []
    const work = lines.filter((l) => kindOf(l) !== 'COMPLETED')
    const done = lines.filter((l) => kindOf(l) === 'COMPLETED')
    const ordered = lines.reduce((s, l) => s + l.orderedQty, 0)
    const allocated = lines.reduce((s, l) => s + l.allocatedQty, 0)
    const pct = ordered > 0 ? Math.round((allocated / ordered) * 100) : 0

    return (
        <>
            <SheetHeader className="shrink-0 gap-2 border-b border-slate-200 px-5 pt-4 pb-3.5">
                <SheetDescription className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                    수령인 주문 상세
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
                {detail && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
                        <span className="text-slate-500">
                            <b className="text-slate-700">{lines.length}</b>라인
                        </span>
                        {KIND_ORDER.map((k) => {
                            const n = lines.filter((l) => kindOf(l) === k).length
                            if (n === 0) return null
                            return (
                                <span key={k} className={cn('rounded px-1.5 py-0.5 font-semibold', KIND_META[k].badge)}>
                                    {KIND_META[k].label} {n}
                                </span>
                            )
                        })}
                    </div>
                )}
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-4">
                {error && <p className="text-[12.5px] text-red-600">{error}</p>}
                {!detail && !error && <p className="text-[12.5px] text-slate-400">불러오는 중…</p>}
                {work.length > 0 && <Group label={`작업 필요 · ${work.length}라인`} lines={work} />}
                {done.length > 0 && <Group label={`차감 완료 · ${done.length}라인`} lines={done} />}
            </div>

            <footer className="shrink-0 border-t border-slate-200 px-5 py-3 text-[11px] text-slate-400">
                라인 차감은 매트릭스 셀에서 합니다. 일괄 차감은 다음 단계(D3)에서 붙습니다.
            </footer>
        </>
    )
}

function Group({ label, lines }: { label: string; lines: DetailLine[] }) {
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

function LineCard({ line }: { line: DetailLine }) {
    const kind = kindOf(line)
    const meta = KIND_META[kind]
    const shown = line.millingType ? getDisplayMillingType(line.millingType, line.varietyType) : null
    const name = line.matched
        ? `${line.variety}${shown && shown !== '백미' ? ` · ${shown}` : ''} ${line.packageType}`
        : `${line.rawItemName} ${line.packageType}`
    const remaining = line.orderedQty - line.allocatedQty
    return (
        <div className={cn('rounded-xl border px-3.5 py-2.5', meta.card)}>
            <div className="flex flex-wrap items-center gap-1.5">
                <span className={cn('text-[13px] font-bold', kind === 'UNMATCHED' ? 'text-red-600' : 'text-foreground')}>
                    {name}
                </span>
                {line.packaging && <span className="text-[11px] text-slate-400">{line.packaging}</span>}
                <span className="text-[12px] tabular-nums text-slate-400">· 주문 {fmt(line.orderedQty)}개</span>
                <span className={cn('ml-auto rounded px-1.5 py-0.5 text-[10.5px] font-semibold', meta.badge)}>
                    {meta.label}
                </span>
            </div>
            <div className="mt-1.5 text-[11.5px] text-slate-500">
                {kind === 'COMPLETED' && (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <Check className="h-3 w-3" />
                        {fmt(line.allocatedQty)}개 차감
                    </span>
                )}
                {kind === 'UNMATCHED' && <span className="text-red-600">품종을 지정해야 차감할 수 있습니다.</span>}
                {kind !== 'COMPLETED' && kind !== 'UNMATCHED' && (
                    <>
                        차감 {fmt(line.allocatedQty)} · 남은 {fmt(remaining)} · 가용 {fmt(line.availableQty)}
                        {line.shortage > 0 && (
                            <span className="ml-1 font-semibold text-orange-700">(부족 {fmt(line.shortage)})</span>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
