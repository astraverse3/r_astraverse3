'use client'

import { PackageMinus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * 재고차감 선택 모드 토글 — 액션 라인의 「도구」 그룹, 재포장 다음 자리.
 * `repack-toggle-button.tsx`를 그대로 본떴다 — 다른 것은 아이콘·라벨뿐이다.
 * 두 토글은 배타(패널이 mode 하나로 관리) — 한쪽이 켜지면 다른 쪽은 disabled.
 */
export function DeductToggleButton({
    active,
    disabled = false,
    onToggle,
}: {
    active: boolean
    disabled?: boolean
    onToggle: (next: boolean) => void
}) {
    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggle(!active)}
            aria-pressed={active}
            disabled={disabled}
            className={cn(
                'h-8 min-w-[96px] justify-center gap-1.5 px-3 font-semibold',
                active
                    ? 'border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15'
                    : 'text-slate-500 hover:text-slate-900',
            )}
        >
            <PackageMinus className="h-3.5 w-3.5" />
            {active ? (
                <>
                    <span>차감 중</span>
                    <span className="mx-0.5 h-3.5 w-px bg-primary/35" />
                    <X className="h-3.5 w-3.5" />
                </>
            ) : (
                '차감'
            )}
        </Button>
    )
}
