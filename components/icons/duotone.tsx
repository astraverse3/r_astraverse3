import type { SVGProps, ReactNode } from "react"

export type DuotoneIconProps = Omit<SVGProps<SVGSVGElement>, 'stroke' | 'fill'> & {
    active?: boolean
    strokeWidth?: number
}

// 핵심 5 메뉴 듀오톤 아이콘 — handoff.md §2.2
// active=false: stroke-only (lucide와 동일 톤)
// active=true: 내부를 currentColor로 채움 + 내부 라인을 #fff로 뒤집어 듀오톤

type BaseProps = DuotoneIconProps & { children: ReactNode; defaultStrokeWidth?: number }

function Base({ children, className, strokeWidth, defaultStrokeWidth = 1.8, active: _active, ...rest }: BaseProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={24}
            height={24}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth ?? defaultStrokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            {...rest}
        >
            {children}
        </svg>
    )
}

export function RawStockIcon({ active = false, ...props }: DuotoneIconProps) {
    return (
        <Base {...props} active={active}>
            <path
                d="M12 4a7 7 0 0 1 7 7c0 .5-.1 1-.2 1.4C17 13 14.6 11 12 11s-5 2-6.8 1.4C5.1 12 5 11.5 5 11a7 7 0 0 1 7-7Z"
                fill={active ? 'currentColor' : 'none'}
            />
            <path d="M5 14c1.5 3 3.5 6 7 6s5.5-3 7-6" />
        </Base>
    )
}

export function MillingIcon({ active = false, ...props }: DuotoneIconProps) {
    return (
        <Base {...props} active={active} defaultStrokeWidth={1.6}>
            <path
                d="M12 3.5 14 5l2.5-.5.8 2.4 2.3 1-.3 2.5 1.7 1.8-1.2 2.2.7 2.4-2.3.9-.8 2.4-2.5-.3L12 21l-1.9-1.7-2.5.3-.8-2.4-2.3-.9.7-2.4-1.2-2.2L5.7 9.9l-.3-2.5 2.3-1 .8-2.4 2.5.5z"
                fill={active ? 'currentColor' : 'none'}
            />
            <circle
                cx="12"
                cy="12"
                r="3"
                fill={active ? '#fff' : 'none'}
                stroke={active ? '#fff' : 'currentColor'}
            />
        </Base>
    )
}

export function PackageIcon({ active = false, ...props }: DuotoneIconProps) {
    return (
        <Base {...props} active={active}>
            <path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" fill={active ? 'currentColor' : 'none'} />
            <path d="M4 7.5 12 12l8-4.5" stroke={active ? '#fff' : 'currentColor'} />
            <path d="M12 12v9" stroke={active ? '#fff' : 'currentColor'} />
        </Base>
    )
}

export function SalesIcon({ active = false, ...props }: DuotoneIconProps) {
    return (
        <Base {...props} active={active}>
            <path
                d="M4 5h2.5l1 3m0 0 2 8h9l2-7h-13"
                fill={active ? 'currentColor' : 'none'}
            />
            <circle cx="10" cy="19" r="1.6" fill={active ? 'currentColor' : 'none'} />
            <circle cx="17" cy="19" r="1.6" fill={active ? 'currentColor' : 'none'} />
        </Base>
    )
}

export function StatsIcon({ active = false, ...props }: DuotoneIconProps) {
    return (
        <Base {...props} active={active}>
            <path
                d="M12 3v9l8 2.2A9 9 0 1 1 12 3Z"
                fill={active ? 'currentColor' : 'none'}
            />
            <path
                d="M14 3.3A9 9 0 0 1 20.7 10H14Z"
                fill={active ? '#fff' : 'none'}
                stroke={active ? '#fff' : 'currentColor'}
            />
        </Base>
    )
}
