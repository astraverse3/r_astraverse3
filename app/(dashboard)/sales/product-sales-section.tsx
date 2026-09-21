import { AlertCircle } from 'lucide-react'
import { listPurchaseUploads } from '@/app/actions/purchase-order'
import { listShippingVendors } from '@/app/actions/shipping-vendor'
import { UploadDialog } from './upload-dialog'
import { UploadTable } from './upload-table'

// 제품판매 탭 — 발주서 묶음(=시트 1장, #30) 목록 + 엑셀 업로드 2단계 모달(#31).
// 매트릭스 차감 화면은 D2에서 연결한다.

export async function ProductSalesSection() {
    // 배송업체는 목록의 「배차 미정」을 그 자리에서 채울 때 쓴다(S4) — 클릭할 때마다 왕복하지 않도록 미리 내려보낸다
    const [res, vendorRes] = await Promise.all([listPurchaseUploads(), listShippingVendors()])
    const vendors = (vendorRes.success ? (vendorRes.data ?? []) : []).filter((v) => v.active)

    return (
        <div className="px-3 sm:px-0 flex flex-col gap-3">
            {/* 모바일에서는 탭 행 오른쪽(sales-tabs의 rightSlot)이 이 버튼을 대신한다 —
                업로드 하나가 한 줄을 통째로 쓰던 것을 없앴다 */}
            <div className="hidden sm:flex items-center justify-end">
                <UploadDialog />
            </div>

            {!res.success ? (
                <div className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-red-600 bg-red-50 rounded-lg">
                    <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                    {res.error}
                </div>
            ) : (
                <UploadTable rows={res.data} vendors={vendors} />
            )}
        </div>
    )
}
