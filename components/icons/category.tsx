import type { SVGProps } from 'react'

/**
 * 카테고리(벼/잡곡) 구분용 line 아이콘.
 * 핸드오프 번들 `tabs-variations.jsx` 시안에서 발췌.
 *  - viewBox 24×24, currentColor
 *  - 기본 strokeWidth=2, 활성 시 2.4 권장
 */

export type CategoryIconProps = Omit<SVGProps<SVGSVGElement>, 'stroke' | 'fill'> & {
    strokeWidth?: number
}

// 벼 — 줄기와 좌우 잎 (핸드오프 RiceIcon)
export function RiceIcon({ className = '', strokeWidth = 2, ...rest }: CategoryIconProps) {
    return (
        <svg
            className={className}
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...rest}
        >
            <path d="M12 2v20" />
            <path d="M12 6c-2 0-3.5 1.5-3.5 3.5S10 12 12 12" />
            <path d="M12 6c2 0 3.5 1.5 3.5 3.5S14 12 12 12" />
            <path d="M12 12c-2 0-3.5 1.5-3.5 3.5S10 18 12 18" />
            <path d="M12 12c2 0 3.5 1.5 3.5 3.5S14 18 12 18" />
        </svg>
    )
}

// 잡곡 — 5개 원형 씨앗 (핸드오프 GrainIcon)
export function GrainIcon({ className = '', strokeWidth = 2, ...rest }: CategoryIconProps) {
    return (
        <svg
            className={className}
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...rest}
        >
            <circle cx="7" cy="8" r="2.5" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="12" cy="14" r="2.3" />
            <circle cx="18" cy="15" r="1.8" />
            <circle cx="6" cy="16" r="2" />
        </svg>
    )
}
