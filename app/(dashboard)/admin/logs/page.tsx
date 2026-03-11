import { LogList } from './log-list'
import { Activity } from 'lucide-react'

export const metadata = {
    title: '활동 로그 | MILL LOG',
}

export default function AdminLogsPage() {
    return (
        <div className="flex flex-col gap-8 p-4 md:p-8 pb-24 max-w-7xl mx-auto">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-blue-600 font-semibold mb-1">
                    <Activity className="w-5 h-5" />
                    <span>System History</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">활동 로그</h1>
                <p className="text-slate-500 text-sm">
                    시스템 내에서 발생한 주요 데이터 변경 및 작업 이력을 확인하고 추적할 수 있습니다.
                </p>
            </div>

            <LogList />
        </div>
    )
}
