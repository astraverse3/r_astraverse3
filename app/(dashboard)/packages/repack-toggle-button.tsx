'use client'

import { PackageOpen, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * 재포장 선택 모드 토글 — 액션 라인의 「액션」 그룹 맨 앞(구분선 오른쪽).
 * 선택 상태 자체는 PackageListClient가 들고 있고, 이 버튼은 모드만 켜고 끈다.
 *  - 꺼짐: outline (기존 그대로)
 *  - 켜짐: primary solid + X. 이 동안 같은 줄의 다른 버튼은 disabled 처리하므로
 *          primary가 둘이 되는 일은 없다. min-w로 폭을 고정해 버튼이 움직이지 않는다.
 */
export function RepackToggleButton({
    active,
    onToggle,
}: {
    active: boolean
    onToggle: (next: boolean) => void
}) {
    return (
        <Button
            variant={active ? 'default' : 'outline'}
            size="sm"
            onClick={() => onToggle(!active)}
            aria-pressed={active}
            className="h-8 min-w-[104px] justify-center gap-1.5 px-3 font-semibold"
        >
            <PackageOpen className="h-3.5 w-3.5" />
            {active ? (
                <>
                    <span>재포장 중</span>
                    <span className="mx-0.5 h-3.5 w-px bg-white/35" />
                    <X className="h-3.5 w-3.5" />
                </>
            ) : (
                '재포장'
            )}
        </Button>
    )
}
