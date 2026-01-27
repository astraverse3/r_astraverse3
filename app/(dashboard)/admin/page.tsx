import Link from 'next/link'
import { Package, ChevronRight } from 'lucide-react'

export default function AdminPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-xl font-bold text-slate-800">관리자 설정</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Variety Management Card */}
                <Link href="/admin/varieties" className="block group">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 group-hover:border-blue-300 group-hover:shadow-md transition-all">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <Package className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors">품종 관리</h3>
                                    <p className="text-sm text-slate-500 mt-1">도정 작업에 사용될 벼 품종을 등록하고 수정합니다.</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                        </div>
                    </div>
                </Link>

                {/* Placeholder for future admin features */}
                {/* <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center justify-center text-slate-400 text-sm">
            추가 기능 준비 중...
        </div> */}
            </div>
        </div>
    )
}
