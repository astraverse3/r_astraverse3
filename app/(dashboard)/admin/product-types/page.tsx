import { listPackagings, listProductTypes } from '@/app/actions/product-type'
import { getVarieties } from '@/app/actions/admin'
import { ProductTypePageClient } from './product-type-page-client'
import { SectionLoader } from '@/components/ui/section-loader'
import { Suspense } from 'react'

export default async function ProductTypesPage() {
    const [pkgRes, ptRes, vRes] = await Promise.all([
        listPackagings(),
        listProductTypes(),
        getVarieties(),
    ])

    const packagings = pkgRes.success && pkgRes.data ? pkgRes.data : []
    const productTypes = ptRes.success && ptRes.data ? ptRes.data : []
    const varieties = vRes.success && vRes.data ? vRes.data : []

    return (
        <Suspense fallback={<SectionLoader message="제품유형을 불러오는 중" />}>
            <ProductTypePageClient
                packagings={packagings}
                productTypes={productTypes}
                varieties={varieties}
            />
        </Suspense>
    )
}
