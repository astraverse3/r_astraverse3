import { LogList } from './log-list'

export const metadata = {
    title: '활동 로그 | MILL LOG',
}

export default function AdminLogsPage() {
    return (
        <div className="space-y-3 px-1.5 sm:px-0 pb-8 sm:pb-0">
            <LogList />
        </div>
    )
}
