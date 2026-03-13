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
        <div className="space-y-3 px-1.5 sm:px-0 pb-24 sm:pb-2">
            <NoticeTable notices={notices} />
        </div>
    )
}
