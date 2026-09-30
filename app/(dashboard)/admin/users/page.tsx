import { getUsers } from '@/app/actions/user'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { UserTable } from '@/components/admin/UserTable'
import { PendingUsersBlock } from '@/components/admin/PendingUsersBlock'
import { redirect } from 'next/navigation'
import { USER_ROLE } from '@/lib/user-role'

export default async function AdminUsersPage() {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
        redirect('/')
    }

    const users = await getUsers()
    // 승인 대기는 위 블록으로만 — 표와 「총 N명」은 승인된 사람만(§83 T4)
    const pending = users.filter((u) => u.role === USER_ROLE.PENDING)
    const approved = users.filter((u) => u.role !== USER_ROLE.PENDING)

    return (
        <div className="space-y-3 px-1.5 sm:px-0 pb-24 sm:pb-2">
            <PendingUsersBlock users={pending} />

            <div className="flex items-center justify-end px-1 sm:px-0">
                <span className="text-[13px] font-bold text-[#00a2e8]">총 {approved.length}명</span>
            </div>

            <UserTable
                users={approved}
                currentUserId={session.user.id}
            />
        </div>
    )
}
