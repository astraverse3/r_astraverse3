'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { approveUser, deleteUser } from '@/app/actions/user'
import { toKstDateTime } from '@/lib/kst-date'
import { settle } from '@/lib/settle-action'

type PendingUser = { id: string; name: string | null; email: string | null; createdAt: Date }

/**
 * 사용자 관리 맨 위 「승인 대기」 블록 (백로그 §83 · 작업지시 ③ T4). 대기자가 없으면 안 그린다.
 * 승인 → USER · 권한 빈 채로(아래 표에서 기존처럼 부여). 거절 → 계정 삭제 — 다시 로그인하면 또 대기로 뜬다.
 */
export function PendingUsersBlock({ users }: { users: PendingUser[] }) {
    const [busyId, setBusyId] = useState<string | null>(null)
    if (users.length === 0) return null

    const label = (u: PendingUser) => u.name || u.email || '이름 없음'

    const handleApprove = async (u: PendingUser) => {
        setBusyId(u.id)
        const res = await settle(approveUser(u.id))
        setBusyId(null)
        if (res.success) toast.success(`${label(u)}님을 승인했어요. 권한은 아래 표에서 줄 수 있어요.`)
        else toast.error(res.error)
    }

    const handleReject = async (u: PendingUser) => {
        const ok = await confirmDialog({
            title: '가입 거절',
            description: `${label(u)}님의 가입을 거절할까요?\n계정이 삭제돼요. 다시 로그인하면 승인 대기로 또 올라와요.`,
            destructive: true,
            confirmText: '거절',
        })
        if (!ok) return
        setBusyId(u.id)
        const res = await settle(deleteUser(u.id))
        setBusyId(null)
        if (res.success) toast.success(`${label(u)}님의 가입을 거절했어요.`)
        else toast.error(res.error || '거절하지 못했어요.')
    }

    return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
            <div className="px-4 py-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-amber-200">
                <span className="text-[14px] font-bold text-amber-900">승인 대기</span>
                <span className="font-mono text-[12px] font-bold bg-amber-600 text-white rounded-full px-2 py-0.5">
                    {users.length}
                </span>
                <span className="text-[12px] text-amber-900 sm:ml-2">승인 전에는 아무 화면도 볼 수 없어요</span>
            </div>
            {users.map((u) => (
                <div key={u.id} className="bg-white px-4 py-3 flex items-center gap-3 border-b border-amber-100 last:border-0">
                    <div className="w-9 h-9 shrink-0 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[13px]">
                        {label(u)[0]}
                    </div>
                    <div className="min-w-0">
                        <div className="text-[14px] font-semibold text-slate-800 truncate">{label(u)}</div>
                        <div className="text-[12px] text-slate-500">
                            첫 로그인 <span className="font-mono">{toKstDateTime(u.createdAt)}</span>
                        </div>
                    </div>
                    <div className="ml-auto flex shrink-0 gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="h-9 px-3 text-[13px] text-slate-600"
                            disabled={busyId !== null}
                            onClick={() => handleReject(u)}
                        >
                            거절
                        </Button>
                        <Button
                            type="button"
                            className="h-9 px-4 text-[13px] font-semibold"
                            disabled={busyId !== null}
                            onClick={() => handleApprove(u)}
                        >
                            승인
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    )
}
