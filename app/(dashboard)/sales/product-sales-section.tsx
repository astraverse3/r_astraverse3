import { Package, Upload, AlertCircle } from 'lucide-react'
import { listPurchaseUploads } from '@/app/actions/purchase-order'

// 제품판매 탭 골격 (단계5) — 발주서 묶음 목록을 실제 listPurchaseUploads로 표시.
// 엑셀 업로드·건상세·차감 UI는 단계6(Claude Design 핸드오프)에서 완성.

const STATUS_META = {
    completed: { label: '완료', cls: 'bg-emerald-50 text-emerald-700' },
    partial: { label: '부분', cls: 'bg-amber-50 text-amber-700' },
    pending: { label: '대기', cls: 'bg-slate-100 text-slate-500' },
} as const

export async function ProductSalesSection() {
    const res = await listPurchaseUploads()
    const uploads = res.success ? res.data : []

    return (
        <div className="px-3 sm:px-0 flex flex-col gap-3">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-500" strokeWidth={1.8} />
                    <h2 className="text-sm font-bold text-slate-900">발주서 판매처리</h2>
                </div>
                {/* 업로드 버튼 — 기능 연결은 단계6 */}
                <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed"
                    title="엑셀 업로드 기능은 곧 추가됩니다"
                >
                    <Upload className="w-3.5 h-3.5" strokeWidth={1.8} />
                    엑셀 업로드
                </span>
            </div>

            {!res.success && (
                <div className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-red-600 bg-red-50 rounded-lg">
                    <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                    {res.error}
                </div>
            )}

            {res.success && uploads.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 sm:py-24 px-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                        <Package className="w-8 h-8 text-slate-400" strokeWidth={1.8} />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-1.5">발주서 판매처리</h3>
                    <p className="text-sm text-slate-500 max-w-md leading-relaxed">
                        통합 발주서(엑셀)를 업로드하면 규격별로 제품재고를 차감해 판매처리해요.
                        <br />
                        <span className="font-medium text-slate-700">엑셀 업로드 화면은 곧 추가됩니다.</span>
                    </p>
                </div>
            )}

            {res.success && uploads.length > 0 && (
                <div className="flex flex-col gap-2">
                    {uploads.map(u => (
                        <div
                            key={u.id}
                            className="flex items-center justify-between gap-3 px-3.5 py-3 bg-white border border-slate-200 rounded-xl"
                        >
                            <div className="min-w-0">
                                <p className="text-[13.5px] font-semibold text-slate-900 truncate">
                                    {u.fileName}
                                </p>
                                <p className="text-[11.5px] text-slate-400 mt-0.5">
                                    {u.createdAt} · {u.orderCount}건
                                    {u.uploadedName ? ` · ${u.uploadedName}` : ''}
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {(['completed', 'partial', 'pending'] as const).map(k =>
                                    u.statusCount[k] > 0 ? (
                                        <span
                                            key={k}
                                            className={`px-1.5 py-0.5 text-[10.5px] font-medium rounded ${STATUS_META[k].cls}`}
                                        >
                                            {STATUS_META[k].label} {u.statusCount[k]}
                                        </span>
                                    ) : null,
                                )}
                                {u.unmatched > 0 && (
                                    <span className="px-1.5 py-0.5 text-[10.5px] font-medium rounded bg-red-50 text-red-600">
                                        매칭실패 {u.unmatched}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
