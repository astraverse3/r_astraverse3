'use client'

// useTransition + reject 받기.
//
// 🔴 React 19는 transition 안에서 던진 오류를 가장 가까운 에러 경계로 올린다. 이 앱은 (dashboard)에
// 경계가 없어서 **페이지 전체가 Next 기본 에러 화면**으로 바뀌고, 입력하던 값도 날아간다.
// try 없이 throw하는 액션(통계·설정)을 transition 안에서 부를 때 쓴다.

import { useCallback, useTransition } from 'react'
import { toast } from 'sonner'
import { CONNECTION_ERROR } from '@/lib/settle-action'

/** `useTransition`과 같은 모양 `[isPending, start]`. 실패하면 화면은 그대로 두고 토스트만 띄운다. */
export function useSafeTransition(message: string = CONNECTION_ERROR) {
    const [isPending, startTransition] = useTransition()
    const start = useCallback(
        (fn: () => Promise<void>) => {
            startTransition(async () => {
                try {
                    await fn()
                } catch (error) {
                    console.error('[useSafeTransition] failed:', error)
                    toast.error(message)
                }
            })
        },
        [message],
    )
    return [isPending, start] as const
}
