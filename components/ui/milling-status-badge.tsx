import { cn } from "@/lib/utils"

// 도정 작업 상태 3단계 — docs/handoff/status-migration.md
// 판정: isClosed + outputs.length
//  - isClosed === true            → closed   (마감됨)
//  - !isClosed && hasOutputs      → packaging (포장중)
//  - !isClosed && !hasOutputs     → milling  (도정중)

export type MillingStatusKey = 'milling' | 'packaging' | 'closed'

type StatusStyle = {
    label: string
    bg: string
    text: string
    border: string
    dot: string
    animate: boolean
}

export const MILLING_STATUS: Record<MillingStatusKey, StatusStyle> = {
    milling: {
        label: '도정중',
        bg: 'bg-sky-50',
        text: 'text-sky-700',
        border: 'border-sky-200',
        dot: 'bg-sky-500',
        animate: false,
    },
    packaging: {
        label: '포장중',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500',
        animate: true,
    },
    closed: {
        label: '마감됨',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
        animate: false,
    },
}

export function getMillingStatus({ isClosed, hasOutputs }: { isClosed: boolean; hasOutputs: boolean }): MillingStatusKey {
    if (isClosed) return 'closed'
    if (hasOutputs) return 'packaging'
    return 'milling'
}

type MillingStatusBadgeProps = {
    isClosed: boolean
    hasOutputs: boolean
    size?: 'sm' | 'md'
    className?: string
}

export function MillingStatusBadge({ isClosed, hasOutputs, size = 'md', className }: MillingStatusBadgeProps) {
    const key = getMillingStatus({ isClosed, hasOutputs })
    const s = MILLING_STATUS[key]
    const sizeCls = size === 'sm' ? 'h-[18px] px-1.5 text-[10px]' : 'h-6 px-2.5 text-[11px]'
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap border',
                sizeCls,
                s.bg,
                s.text,
                s.border,
                className,
            )}
        >
            <span className={cn('w-1.5 h-1.5 rounded-full', s.dot, s.animate && 'animate-pulse')} />
            {s.label}
        </span>
    )
}
