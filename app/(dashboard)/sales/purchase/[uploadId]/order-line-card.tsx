'use client'

// 라인(품목) 한 장. **건 상세 패널과 건 목록이 함께 쓴다** —
// 택배는 건 상세를 열지 않고 목록 안에서 펼치므로(`ChannelDecl.detail === 'inline'`)
// 카드가 패널에만 있으면 두 벌이 된다.

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrderLine } from '@/lib/purchase-order-matrix'
import { STATUS_META } from './status-meta'

const fmt = (n: number) => n.toLocaleString()
const fmtKg = (n: number) => (Math.round(n * 10) / 10).toLocaleString()

/** 규격 표기 — 톤백은 자루중량, 나머지는 원본 규격 */
export function specOf(line: OrderLine): string {
    return line.bulk ? `${fmtKg(line.unitWeightKg ?? 0)}kg` : line.packageType
}

export function LineCard({ line }: { line: OrderLine }) {
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
