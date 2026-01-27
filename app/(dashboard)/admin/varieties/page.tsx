import Link from 'next/link'
import { ChevronLeft, Pencil } from 'lucide-react'
import { getVarieties } from '@/app/actions/admin'
import { VarietyDialog } from './variety-dialog'

export default async function VarietyPage() {
    const result = await getVarieties()
    const varieties = result.success && result.data ? result.data : []

    return (
        <div className="space-y-6 pb-20">
            {/* Header with Back Button */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Link href="/admin" className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-xl font-bold text-slate-800">품종 관리</h1>
                </div>
                <VarietyDialog mode="create" />
            </div>

            {/* Variety List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {varieties.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                        {varieties.map((variety) => (
                            <div key={variety.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                                <div>
                                    <span className="font-bold text-slate-800">{variety.name}</span>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        ID: {variety.id}
                                    </p>
                                </div>
                                <VarietyDialog
                                    mode="edit"
                                    variety={variety}
                                    trigger={
                                        <button className="p-2 text-slate-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-colors">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    }
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-10 text-center text-slate-400 text-sm">
                        등록된 품종이 없습니다.
                    </div>
                )}
            </div>

            <p className="text-xs text-slate-400 text-center px-4">
                * 등록된 품종은 재고 관리 및 도정 기록 시 선택할 수 있습니다.
            </p>
        </div>
    )
}
