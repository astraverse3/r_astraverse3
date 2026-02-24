import { getUsers } from '@/app/actions/user'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { UserTable } from '@/components/admin/UserTable'
import { Users } from 'lucide-react'
import { redirect } from 'next/navigation'

export default async function AdminUsersPage() {
    const session = await getServerSession(authOptions)

    // @ts-ignore
    if (!session?.user || session.user.role !== 'ADMIN') {
        redirect('/')
    }

    const users = await getUsers()

    return (
        <div className="space-y-6">
            <div className="flex items-center">
                <span className="text-sm text-slate-400">총 {users.length}명</span>
            </div>

            <UserTable
                users={users}
                // @ts-ignore
                currentUserId={session.user.id}
            />
        </div>
    )
}
