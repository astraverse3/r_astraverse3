'use client'

// [−][수량][+] 한 덩어리 — 건 상세 고치기 목록(작업지시 ⑦)과 품목 고르기(⑧)가 같은 모양을 쓴다.
// 가운데는 입력칸이라 직접 입력도 된다. − 는 `min`, + 는 `max`에서 멈춘다.
// 14px — 작업지시 ④ 규칙(layout이 확대를 막고 있어 iOS 확대가 안 일어난다)

import type { ReactNode } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

export type StepperTone = 'normal' | 'changed' | 'invalid'

export function QtyStepper({
    value,
    onValue,
    min,
    max,
    disabled,
    tone = 'normal',
    label,
}: {
    /** 입력 중이라 문자열 */
    value: string
    onValue: (v: string) => void
    min: number
    max: number
    disabled?: boolean
    /** changed = 파랑(바뀐 값) · invalid = 빨강 테두리 */
    tone?: StepperTone
    label: string
}) {
    const n = Number(value)
    const current = value !== '' && Number.isInteger(n) ? n : min
    const step = (d: number) => onValue(String(Math.min(max, Math.max(min, current + d))))
    const changed = tone === 'changed'
    const sep = changed ? 'border-blue-200' : 'border-slate-200'
    return (
        <div
            className={cn(
                'inline-flex shrink-0 items-center overflow-hidden rounded-md border bg-card',
                changed ? 'border-blue-500 ring-2 ring-blue-100' : tone === 'invalid' ? 'border-red-300' : 'border-slate-300',
            )}
        >
            <StepButton label="하나 줄이기" disabled={disabled || current <= min} onClick={() => step(-1)} className={cn('border-r', sep)}>
                <Minus className="h-3.5 w-3.5" />
            </StepButton>
            <Input
                type="number"
                inputMode="numeric"
                min={min}
                max={max}
                value={value}
                disabled={disabled}
                onChange={(e) => onValue(e.target.value)}
                aria-label={label}
                className={cn(
                    'h-10 w-11 rounded-none border-0 bg-transparent px-0 text-center font-mono text-[14px] font-semibold shadow-none focus-visible:ring-0 sm:h-8',
                    '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                    changed ? 'text-blue-700' : 'text-slate-800',
                )}
            />
            <StepButton label="하나 늘리기" disabled={disabled || current >= max} onClick={() => step(1)} className={cn('border-l', sep)}>
                <Plus className="h-3.5 w-3.5" />
            </StepButton>
        </div>
    )
}

function StepButton({
    label,
    disabled,
    onClick,
    className,
    children,
}: {
    label: string
    disabled?: boolean
    onClick: () => void
    className: string
    children: ReactNode
}) {
    return (
        <button
            type="button"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className={cn(
                'flex h-10 w-10 items-center justify-center text-slate-500 hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-transparent sm:h-8 sm:w-8',
                className,
            )}
        >
            {children}
        </button>
    )
}
