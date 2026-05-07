import { SalesTabs, type SalesTabValue } from './sales-tabs'
import { ReleaseSection } from './release-section'
import { ComingSoonPanel } from './coming-soon-panel'

const VALID_TABS: SalesTabValue[] = ['rice', 'misc', 'release']

export default async function SalesPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const sp = await searchParams
    const rawTab = typeof sp.tab === 'string' ? sp.tab : 'release'
    const tab: SalesTabValue = (VALID_TABS as string[]).includes(rawTab) ? (rawTab as SalesTabValue) : 'release'

    return (
        <div className="flex flex-col gap-3">
            <SalesTabs activeTab={tab} />
            <div className="flex-1">
                {tab === 'release' && <ReleaseSection searchParams={sp} />}
                {tab === 'rice' && <ComingSoonPanel category="벼" />}
                {tab === 'misc' && <ComingSoonPanel category="잡곡" />}
            </div>
        </div>
    )
}
