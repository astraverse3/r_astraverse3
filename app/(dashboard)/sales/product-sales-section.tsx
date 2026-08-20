import { Package, AlertCircle } from 'lucide-react'
import { listPurchaseUploads } from '@/app/actions/purchase-order'
import { UploadDialog } from './upload-dialog'
import { UploadTable } from './upload-table'

// 제품판매 탭 — 발주서 묶음(=시트 1장, #30) 목록 + 엑셀 업로드 2단계 모달(#31).
// 매트릭스 차감 화면은 D2에서 연결한다.

export async function ProductSalesSection() {
    const res = await listPurchaseUploads()

    return (
        <div className="px-3 sm:px-0 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-500" strokeWidth={1.8} />
                    <h2 className="text-sm font-bold text-slate-900">발주서 판매처리</h2>
                </div>
                <UploadDialog />
            </div>

            {!res.success ? (
                <div className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-red-600 bg-red-50 rounded-lg">
                    <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                    {res.error}
                </div>
            ) : (
                <UploadTable rows={res.data} />
            )}
        </div>
    )
}
