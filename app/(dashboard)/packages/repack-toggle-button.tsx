'use client'

import { PackageOpen, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * 재포장 선택 모드 토글 — 액션 라인의 「도구」 그룹(구분선 왼쪽), 엑셀 다음.
 * 선택 상태 자체는 PackageListClient가 들고 있고, 이 버튼은 모드만 켜고 끈다.
 *  - 꺼짐: ghost. 새 데이터를 만드는 게 아니라 가진 재고를 다시 나누는 도구라
 *          등록 버튼(`+ 포장하기`)보다 한 단 낮게 둔다. 같은 outline이면 동급으로 튄다.
 *  - 켜짐: 파랑 틴트 + X. 이 동안 같은 줄의 다른 버튼은 disabled 처리하므로
 *          틴트 하나만 살아있어 모드가 분명하다. min-w로 폭을 고정해 버튼이 움직이지 않는다.
 *
 * 새 어휘를 만들지 않는다 — ghost는 `재포장 취소`에, 파랑 틴트는 필터 활성에 이미 쓴다.
 */
export function RepackToggleButton({
    active,
    disabled = false,
    onToggle,
}: {
    active: boolean
    /** 차감 모드 동안 잠근다 — 두 선택 모드는 배타 (D4) */
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
            <PackageOpen className="h-3.5 w-3.5" />
            {active ? (
                <>
                    <span>재포장 중</span>
                    <span className="mx-0.5 h-3.5 w-px bg-primary/35" />
                    <X className="h-3.5 w-3.5" />
                </>
            ) : (
                '재포장'
            )}
        </Button>
    )
}
