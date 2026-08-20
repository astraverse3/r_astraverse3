import { SalesTabs } from './sales-tabs'
import { resolveSalesTab } from './sales-tab-constants'
import { ReleaseSection } from './release-section'
import { ProductSalesSection } from './product-sales-section'

export default async function SalesPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const sp = await searchParams
    // 탭 상수는 'use client'가 아닌 sales-tab-constants에서 가져온다 —
    // 클라이언트 모듈에서 가져오면 서버에서 값이 함수 참조로 바뀐다(§파일 주석 참고)
    const tab = resolveSalesTab(sp.tab)

    return (
        <div className="flex flex-col gap-3">
            <SalesTabs activeTab={tab} />
            <div className="flex-1">
                {tab === 'product' && <ProductSalesSection />}
                {tab === 'release' && <ReleaseSection searchParams={sp} />}
            </div>
        </div>
    )
}
