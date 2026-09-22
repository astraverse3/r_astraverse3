'use client'

// 매트릭스의 이름칸과 작은 표시 조각들.

import { cn } from '@/lib/utils'
import { nameTiersOf, type ChannelDecl } from '@/lib/purchase-channel'
import { ROW_STATUS_ORDER, type CellStatus, type MatrixRow } from '@/lib/purchase-order-matrix'
import { STATUS_META } from './status-meta'
import { W_NAME_HEAD } from './matrix-layout'

// ------------------------------------------------------
// 이름칸 — `굵은 값 ｜ 세로선 ｜ 연한 값` (C0-c)
// ------------------------------------------------------
/**
 * 앞 값은 고정 폭 + truncate라 구분선이 행마다 같은 자리에 선다. 뒤 값은 남는 폭에서 잘린다.
 * `←` 화살표·색 스트라이프·조건부 2단은 핸드오프에서 기각됐다 — 되살리지 말 것.
 */
export function NameCell({ decl, row }: { decl: ChannelDecl; row: MatrixRow }) {
    const [head, tail] = nameTiersOf(decl, row)
    const full = tail ? `${head} ｜ ${tail}` : head
    if (!tail) {
        return (
            <span className="block truncate text-[12.5px] font-bold text-foreground" title={full}>
                {head}
            </span>
        )
    }
    return (
        <span className="flex items-center" title={full}>
            <span
                className="flex-none truncate text-[12.5px] font-bold text-foreground"
                style={{ width: W_NAME_HEAD }}
            >
                {head}
            </span>
            <span className="min-w-0 truncate border-l border-slate-300 pl-2.5 text-[10.5px] font-medium text-slate-500">
                {tail}
            </span>
        </span>
    )
}

// ------------------------------------------------------
// 작은 조각들
// ------------------------------------------------------
/**
 * 🔴 props를 **명시적으로만** 받는다. 여기 없는 것은 DOM까지 가지 못한다 —
 * `data-*`는 JSX에서 임의 허용이라 **타입이 잡아주지 않고 조용히 사라진다**(D3에서 한 번 당했다:
 * 게이트의 「셀로 이동」이 `data-cell`을 못 찾아 아무 반응이 없었다). 새 속성을 쓰려면 여기 추가할 것.
 */
export function Th({
    as: Tag = 'td',
    className,
    style,
    title,
    onClick,
    children,
    'data-cell': dataCell,
}: {
    as?: 'td' | 'th'
    className?: string
    style?: React.CSSProperties
    title?: string
    onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void
    children: React.ReactNode
    /** 검토 게이트가 이 셀을 찾아오는 앵커 — `${orderId}|${col.key}` */
    'data-cell'?: string
}) {
    return (
        <Tag
            className={cn('h-9 border-b border-r border-slate-100 px-1.5 whitespace-nowrap', className)}
            style={style}
            title={title}
            onClick={onClick}
            data-cell={dataCell}
        >
            {children}
        </Tag>
    )
}

export function StatusDot({ status }: { status: CellStatus }) {
    const s = STATUS_META[status]
    return (
        <span className={cn('inline-flex items-center gap-1 text-[10.5px] font-bold', s.text)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
            {s.label}
        </span>
    )
}

export function Progress({ done, total }: { done: number; total: number }) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return (
        <div className="flex items-center gap-1.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                    className={cn('h-full', pct >= 100 ? 'bg-emerald-400' : 'bg-amber-400')}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="shrink-0 text-[10px] tabular-nums text-slate-500">
                {done}/{total}
            </span>
        </div>
    )
}

export function Legend() {
    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[11.5px]">
            {ROW_STATUS_ORDER.map((key) => {
                const s = STATUS_META[key]
                return (
                    <span key={key} className={cn('inline-flex items-center gap-1.5 font-medium', s.text)}>
                        <span className={cn('h-2 w-2 rounded-sm', s.dot)} />
                        {s.label}
                    </span>
                )
            })}
            <span className="text-slate-400">셀 = 주문 수량 · 소계 = 주문 중량 · 셀 클릭 = 차감 · 이름 클릭 = 주문 상세</span>
        </div>
    )
}
