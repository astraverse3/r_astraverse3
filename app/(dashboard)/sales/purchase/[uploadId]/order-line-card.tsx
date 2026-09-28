'use client'

// 라인(품목) 한 장. **건 상세 패널과 건 목록이 함께 쓴다** —
// 택배는 건 상세를 열지 않고 목록 안에서 펼치므로(`ChannelDecl.detail === 'inline'`)
// 카드가 패널에만 있으면 두 벌이 된다.
//
// `onOpen`을 주면 카드가 버튼이 된다 — 누르면 그 라인의 배분 시트(M1-5). 폰에는 셀이 없어
// 톤백 자루 선택·차감 취소·FIFO 손보기가 **이 카드로만** 된다.

import { Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrderLine } from '@/lib/purchase-order-matrix'
import { STATUS_META } from './status-meta'

const fmt = (n: number) => n.toLocaleString()
const fmtKg = (n: number) => (Math.round(n * 10) / 10).toLocaleString()

/** 규격 표기 — 톤백은 자루중량, 나머지는 원본 규격 */
export function specOf(line: OrderLine): string {
    return line.bulk ? `${fmtKg(line.unitWeightKg ?? 0)}kg` : line.packageType
}

export function LineCard({ line, onOpen }: { line: OrderLine; onOpen?: () => void }) {
    const meta = STATUS_META[line.status]
    // 버튼 안에는 div를 둘 수 없어 안쪽은 전부 span이다
    const Tag = onOpen ? 'button' : 'div'
    return (
        <Tag
            {...(onOpen && { type: 'button' as const, onClick: onOpen })}
            className={cn(
                'block w-full rounded-xl border px-3.5 py-2.5 text-left',
                meta.card,
                onOpen && 'transition active:brightness-95',
            )}
        >
            <span className="flex flex-wrap items-center gap-1.5">
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
                {/* 폰은 호버가 없다 — 「눌린다」는 단서가 이것뿐이다 */}
                {onOpen && <ChevronRight className="-mr-1 h-4 w-4 shrink-0 text-slate-300" />}
            </span>
            <span className="mt-1.5 block text-[11.5px] text-slate-500">
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
            </span>
        </Tag>
    )
}
