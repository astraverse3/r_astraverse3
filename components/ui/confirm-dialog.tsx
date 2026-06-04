'use client'

import * as React from 'react'
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

export interface ConfirmOptions {
    /** 다이얼로그 제목 (기본: "확인") */
    title?: string
    /** 본문 메시지. 줄바꿈(\n) 지원 */
    description?: string
    /** 확인 버튼 라벨 (기본: "확인") */
    confirmText?: string
    /** 취소 버튼 라벨 (기본: "취소") */
    cancelText?: string
    /** 위험 동작(삭제 등) — 확인 버튼을 빨강으로 */
    destructive?: boolean
}

type ConfirmState = (ConfirmOptions & { resolve: (v: boolean) => void }) | null

// 모듈 레벨 trigger — sonner toast()처럼 컴포넌트 밖에서도 호출 가능
let openExternal: ((s: ConfirmState) => void) | null = null

/**
 * native window.confirm 대체. Promise<boolean> 반환.
 * 문자열 또는 옵션 객체를 받는다. `await confirmDialog('정말 삭제할까요?')`
 * Host(`<ConfirmDialogHost/>`)가 마운트돼 있어야 하며, 없으면 window.confirm으로 폴백.
 */
export function confirmDialog(options: ConfirmOptions | string): Promise<boolean> {
    const opts: ConfirmOptions = typeof options === 'string' ? { description: options } : options
    return new Promise((resolve) => {
        if (!openExternal) {
            // Host 미마운트 폴백 (SSR이 아닌 클라이언트에서만 호출됨)
            resolve(typeof window !== 'undefined' ? window.confirm(opts.description || opts.title || '') : false)
            return
        }
        openExternal({ ...opts, resolve })
    })
}

/** 앱 루트에 1회 마운트하는 전역 confirm 다이얼로그 렌더러 */
export function ConfirmDialogHost() {
    const [state, setState] = React.useState<ConfirmState>(null)

    React.useEffect(() => {
        openExternal = setState
        return () => {
            openExternal = null
        }
    }, [])

    const close = (result: boolean) => {
        setState((prev) => {
            prev?.resolve(result)
            return null
        })
    }

    return (
        <AlertDialog open={!!state} onOpenChange={(open) => { if (!open) close(false) }}>
            <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md rounded-lg">
                <AlertDialogHeader>
                    <AlertDialogTitle>{state?.title ?? '확인'}</AlertDialogTitle>
                    {state?.description && (
                        <AlertDialogDescription className="whitespace-pre-line">
                            {state.description}
                        </AlertDialogDescription>
                    )}
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => close(false)}>
                        {state?.cancelText ?? '취소'}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => close(true)}
                        className={cn(state?.destructive && 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-600')}
                    >
                        {state?.confirmText ?? '확인'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
