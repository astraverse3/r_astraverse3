import { getNotices } from '@/app/actions/notice'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { redirect } from 'next/navigation'
import { NoticeTable } from '@/components/admin/NoticeTable'

export const dynamic = 'force-dynamic'

export default async function AdminNoticesPage() {
    const session = await getServerSession(authOptions)

    // @ts-ignore
    const { role, permissions } = session?.user || {}

    if (!session?.user || (role !== 'ADMIN' && !permissions?.includes('NOTICE_MANAGE'))) {
        redirect('/')
    }

    const notices = await getNotices()

    return (
        <div className="space-y-3 px-1.5 sm:px-0 pb-8 sm:pb-0">
            <div className="flex items-center justify-between px-1 sm:px-0 shrink-0 mb-4 sm:mb-2">
                <h1 className="text-xl font-bold text-slate-900 hidden sm:block">공지사항 관리</h1>
            </div>

            <NoticeTable notices={notices} />
        </div>
    )
}
