import { Suspense } from 'react'

import { getPackages, type GetPackagesParams, type PackageItem, type PackageSort } from '@/app/actions/packages'
import { getVarieties } from '@/app/actions/admin'
import { getMiscVarieties } from '@/app/actions/misc-stock'
import { PackagesTabs, type PackageTab } from './packages-tabs'
import { RicePackagePanel } from './rice-package-panel'
import { MiscPackagePanel } from './misc-package-panel'

export const dynamic = 'force-dynamic'

const SORT_VALUES: PackageSort[] = ['latest', 'oldest', 'weight_desc']

function parseSort(raw: unknown): PackageSort {
    return typeof raw === 'string' && (SORT_VALUES as string[]).includes(raw)
        ? (raw as PackageSort)
        : 'weight_desc'
}

const pickStr = (v: string | string[] | undefined): string | undefined =>
    typeof v === 'string' ? v : undefined

export default async function PackagesPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const resolvedParams = await searchParams
    const tab: PackageTab = resolvedParams.tab === 'misc' ? 'misc' : 'rice'

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <div className="grid grid-cols-1 gap-2 pb-24 sm:pb-2 px-1.5 sm:px-0">
                <div className="pt-2 px-1">
                    <PackagesTabs activeTab={tab} />
                </div>
                {tab === 'misc' ? (
                    <MiscPanelLoader resolvedParams={resolvedParams} />
                ) : (
                    <RicePanelLoader resolvedParams={resolvedParams} />
                )}
            </div>
        </Suspense>
    )
}

async function RicePanelLoader({
    resolvedParams,
}: {
    resolvedParams: { [key: string]: string | string[] | undefined }
}) {
    const filters: GetPackagesParams = {
        category: 'RICE',
        varietyId: pickStr(resolvedParams.varietyId),
        productionYear: pickStr(resolvedParams.productionYear),
        source: pickStr(resolvedParams.source),
        sort: parseSort(resolvedParams.sort),
    }

    const [packagesResult, varietiesResult] = await Promise.all([
        getPackages(filters),
        getVarieties(),
    ])
    const items: PackageItem[] = packagesResult.success ? packagesResult.data : []
    const varieties = (varietiesResult.success && varietiesResult.data ? varietiesResult.data : []) as { id: number; name: string }[]

    return <RicePackagePanel items={items} varieties={varieties} />
}

async function MiscPanelLoader({
    resolvedParams,
}: {
    resolvedParams: { [key: string]: string | string[] | undefined }
}) {
    const filters: GetPackagesParams = {
        category: 'MISC_GRAIN',
        varietyId: pickStr(resolvedParams.varietyId),
        productionYear: pickStr(resolvedParams.productionYear),
        source: pickStr(resolvedParams.source),
        sort: parseSort(resolvedParams.sort),
    }

    const [packagesResult, varietiesResult] = await Promise.all([
        getPackages(filters),
        getMiscVarieties(),
    ])
    const items: PackageItem[] = packagesResult.success ? packagesResult.data : []
    const varieties = (varietiesResult.success && varietiesResult.data ? varietiesResult.data : []) as { id: number; name: string }[]

    return <MiscPackagePanel items={items} varieties={varieties} />
}
