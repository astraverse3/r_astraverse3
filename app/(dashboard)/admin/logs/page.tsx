import { LogList } from './log-list'
import { Activity } from 'lucide-react'

export const metadata = {
    title: '활동 로그 | MILL LOG',
}

export default function AdminLogsPage() {
    return (
        <div className="flex flex-col min-h-screen bg-transparent">
            {/* Header Section with Glassmorphism Effect */}
            <section className="px-4 pt-6 pb-2 sm:px-6 sm:pt-8 sm:pb-4 max-w-7xl mx-auto w-full">
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-[11px] font-bold text-blue-600 uppercase tracking-wider shadow-sm">
                            <Activity className="w-3 h-3" />
                            System History
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div className="space-y-1">
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                                활동 로그
                            </h1>
                            <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-2xl">
                                시스템 내에서 발생한 주요 데이터 변경 및 작업 이력을 실시간으로 확인하고 추적할 수 있습니다.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="px-4 sm:px-6 pb-24 max-w-7xl mx-auto w-full">
                <LogList />
            </section>
        </div>
    )
}
