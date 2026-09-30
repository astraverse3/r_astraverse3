'use client'

// 헤더 알림(종) — 작업지시 ⑥ · 시안 `docs/handoff/점검-2026-09/시안/헤더-알림-시안.html`
//
// 알림은 레이아웃(서버)이 계산해 내려준다(`lib/notifications.ts`). 여기는 그리기만 한다.
// 승인·거절 뒤엔 액션의 `revalidatePath('/', 'layout')`로 새 items가 내려와 숫자가 저절로 준다.
// PC는 Popover, 모바일은 DropdownMenu — 기존 헤더(프로필 팝오버 · 모바일 드롭다운)와 같은 짝이다.

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { BellIcon, CheckCircleIcon, UserPlusIcon } from '@/components/icons/duotone'
import type { HeaderNotification } from '@/lib/notifications'
import { cn } from '@/lib/utils'

type Variant = 'mobile' | 'desktop'

/** 종류별 모양 — 새 종류는 여기와 `HeaderNotification.kind`에 한 줄씩 */
const KIND: Record<HeaderNotification['kind'], { icon: ReactNode; tile: string; title: (n: number) => ReactNode }> = {
    'pending-users': {
        icon: <UserPlusIcon active width={17} height={17} />,
        tile: 'bg-amber-50 text-amber-600',
        title: (n) => (
            <>
                승인 대기 <b className="font-mono">{n}</b>명
            </>
        ),
    },
}

// 목록 겉모양 — 기본 팝오버·드롭다운의 bg-popover·p-4/p-1을 덮는다(지시서: 배경 bg-card)
const PANEL = 'flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-card p-0 shadow-lg'
// 모바일 최대 높이 = 화면 − 헤더(44) − 탭바(60) − 탭바 띄움(16) − 여유(24) − 안전영역. 탭바(fixed z-40)에 안 겹친다
const MOBILE_MAX_H = 'max-h-[calc(100dvh-44px-60px-16px-24px-env(safe-area-inset-bottom))]'

export function HeaderBell({ items, variant }: { items: HeaderNotification[]; variant: Variant }) {
    const [open, setOpen] = useState(false)
    const total = items.reduce((sum, it) => sum + it.count, 0)
    const trigger = <BellTrigger total={total} open={open} variant={variant} />

    if (variant === 'mobile') {
        return (
            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
                {/* 좌우 8px — 종이 오른쪽 끝이 아니라서 collisionPadding으로 화면 안에 붙인다 */}
                <DropdownMenuContent
                    align="end"
                    sideOffset={4}
                    collisionPadding={8}
                    className={cn(PANEL, 'w-[calc(100vw-16px)]', MOBILE_MAX_H)}
                >
                    <PanelHead />
                    <PanelBody empty={items.length === 0}>
                        {items.map((it) => (
                            // DropdownMenuItem이 누르면 닫는다
                            <DropdownMenuItem key={it.kind} asChild className="p-0 focus:bg-slate-50">
                                <Row item={it} variant={variant} />
                            </DropdownMenuItem>
                        ))}
                    </PanelBody>
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className={cn(PANEL, 'w-[340px] max-h-[420px]')}>
                <PanelHead />
                <PanelBody empty={items.length === 0}>
                    {items.map((it) => (
                        <Row key={it.kind} item={it} variant={variant} onNavigate={() => setOpen(false)} />
                    ))}
                </PanelBody>
            </PopoverContent>
        </Popover>
    )
}

/**
 * 트리거 — 모바일 40×40/아이콘 20 · PC 32×32/18. 색: 열림 blue · 1건 이상 slate-600 · 0건 slate-400.
 * 🔴 뱃지는 **아이콘 기준**(relative span 안)으로 붙인다 — 버튼 기준이면 모바일(40)과 PC(32)에서 자리가 달라진다.
 * Radix Trigger가 asChild로 props·ref를 넘기므로 받은 것을 button에 그대로 흘린다.
 */
function BellTrigger({
    total,
    open,
    variant,
    ...rest
}: { total: number; open: boolean; variant: Variant } & React.ComponentProps<'button'>) {
    const mobile = variant === 'mobile'
    return (
        <button
            type="button"
            aria-label={total > 0 ? `알림 ${total}건` : '알림 없음'}
            className={cn(
                'flex shrink-0 items-center justify-center rounded-full transition-colors focus:outline-none',
                mobile ? 'h-10 w-10' : 'h-8 w-8',
                open ? 'bg-blue-50 text-blue-600' : total > 0 ? 'text-slate-600 hover:bg-slate-50' : 'text-slate-400 hover:bg-slate-50',
            )}
            {...rest}
        >
            <span className="relative flex">
                <BellIcon active={open} width={mobile ? 20 : 18} height={mobile ? 20 : 18} />
                {total > 0 && (
                    <span className="absolute left-[calc(100%-8px)] -top-[7px] h-[18px] min-w-[18px] rounded-full bg-red-600 px-1 text-center font-mono text-[11px] font-bold leading-[18px] text-white ring-2 ring-white">
                        {total > 99 ? '99+' : total}
                    </span>
                )}
            </span>
        </button>
    )
}

function PanelHead() {
    return (
        <div className="flex h-11 shrink-0 items-center border-b border-slate-100 px-4">
            <span className="text-[14px] font-semibold text-slate-800">알림</span>
        </div>
    )
}

/** 넘치면 본문만 스크롤 */
function PanelBody({ empty, children }: { empty: boolean; children: ReactNode }) {
    return (
        <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto p-1.5">
            {empty ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <CheckCircleIcon active width={22} height={22} />
                    </span>
                    <p className="text-[13px] font-medium text-slate-700">확인할 알림이 없어요</p>
                </div>
            ) : (
                children
            )}
        </div>
    )
}

/** 한 줄 — 모바일 48 · PC 40. DropdownMenuItem(asChild)이 props·ref를 넘기므로 Link에 흘린다 */
function Row({
    item,
    variant,
    onNavigate,
    ...rest
}: { item: HeaderNotification; variant: Variant; onNavigate?: () => void } & Omit<React.ComponentProps<typeof Link>, 'href'>) {
    const k = KIND[item.kind]
    return (
        <Link
            href={item.href}
            onClick={onNavigate}
            className={cn(
                'flex items-center gap-3 rounded-lg px-3 hover:bg-slate-50',
                variant === 'mobile' ? 'h-12' : 'h-10',
            )}
            {...rest}
        >
            <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', k.tile)}>{k.icon}</span>
            <span className="min-w-0 flex-1 text-[13px] font-semibold text-slate-800">{k.title(item.count)}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        </Link>
    )
}
