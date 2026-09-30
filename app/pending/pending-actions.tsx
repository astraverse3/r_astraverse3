'use client'

import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

/** 승인 대기 화면의 버튼 두 개 — 새로고침은 서버 페이지를 다시 그려 최신 역할을 본다(승인됐으면 /로) */
export function PendingActions({ showRefresh }: { showRefresh: boolean }) {
    const router = useRouter()
    return (
        <div className="w-full flex flex-col gap-2">
            {showRefresh && (
                <Button type="button" className="h-11 text-[15px] font-semibold" onClick={() => router.refresh()}>
                    새로고침
                </Button>
            )}
            <Button
                type="button"
                variant="ghost"
                className="h-11 text-[14px] text-slate-600"
                onClick={() => signOut({ callbackUrl: '/login' })}
            >
                다른 계정으로 로그인
            </Button>
        </div>
    )
}
