import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { toKstDateTime } from '@/lib/kst-date'
import { isApprovedRole, USER_ROLE } from '@/lib/user-role'
import { PendingActions } from './pending-actions'

// 승인 대기 화면 (백로그 §83 · 작업지시 ③ T4)
//
// 대시보드 레이아웃 밖이다 — 사이드바·탭바 없이 로그인 화면과 같은 중앙 카드.
// 승인 안 된 사람은 대시보드 레이아웃이 여기로 보낸다. 승인되면 「새로고침」 한 번으로 빠져나간다
// (getServerSession이 jwt 콜백을 거쳐 DB의 최신 역할을 읽으므로).
//
// 삭제된 사용자(REVOKED)도 여기로 온다 — 로그인 화면으로 보내면 미들웨어가 로그인 상태의 /login을
// 다시 /로 돌려 무한 왕복이 된다. 「다른 계정으로 로그인」(signOut)으로 푼다.

export const dynamic = 'force-dynamic'

export default async function PendingPage() {
    const session = await getServerSession(authOptions)
    if (!session?.user) redirect('/login')
    if (isApprovedRole(session.user.role)) redirect('/')

    const revoked = session.user.role === USER_ROLE.REVOKED
    // 본인 행만 읽는다. REVOKED는 행이 없다
    const me = revoked
        ? null
        : await prisma.user.findUnique({ where: { id: session.user.id }, select: { createdAt: true } })
    const name = session.user.name || '이름 없음'

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 flex flex-col items-center text-center gap-6">
                <img src="/logo-full.png" alt="땅끝황토친환경" className="w-48 h-auto" />

                <div className="flex flex-col gap-2">
                    <h1 className="text-[18px] font-bold text-slate-900">
                        {revoked ? '이 계정은 더 이상 쓸 수 없어요' : '관리자 승인을 기다리고 있어요'}
                    </h1>
                    <p className="text-[14px] text-slate-600 leading-relaxed">
                        {revoked
                            ? '관리자가 계정을 정리했어요. 다른 계정으로 로그인하거나 관리자에게 문의해 주세요.'
                            : '처음 로그인한 계정은 관리자가 승인해야 쓸 수 있어요. 승인되면 이 화면을 새로고침해 주세요.'}
                    </p>
                </div>

                {!revoked && (
                    <div className="w-full rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 flex items-center gap-3 text-left">
                        <div className="w-10 h-10 shrink-0 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                            {name[0]}
                        </div>
                        <div className="min-w-0">
                            <div className="text-[14px] font-semibold text-slate-800 truncate">{name}</div>
                            <div className="text-[12px] text-slate-500">
                                카카오 로그인
                                {me && (
                                    <>
                                        {' · '}
                                        <span className="font-mono">{toKstDateTime(me.createdAt)}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <PendingActions showRefresh={!revoked} />

                <p className="text-[12px] text-slate-500">승인이 오래 걸리면 사무실(관리자)에게 이름을 알려 주세요.</p>
            </div>
        </div>
    )
}
