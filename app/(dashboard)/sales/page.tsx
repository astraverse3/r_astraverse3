import { SalesTabs, DEFAULT_SALES_TAB, type SalesTabValue } from './sales-tabs'
import { ReleaseSection } from './release-section'
import { ProductSalesSection } from './product-sales-section'

const VALID_TABS: SalesTabValue[] = ['product', 'release']

export default async function SalesPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const sp = await searchParams
    const rawTab = typeof sp.tab === 'string' ? sp.tab : DEFAULT_SALES_TAB
    const tab: SalesTabValue = (VALID_TABS as string[]).includes(rawTab)
        ? (rawTab as SalesTabValue)
        : DEFAULT_SALES_TAB

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
