import { Suspense } from 'react'
import { getFarmersWithGroups } from '@/app/actions/admin'
import { AddFarmerDialog } from './add-farmer-dialog'
import { ExcelButtons } from './excel-buttons'
import { FarmerFilters } from './farmer-filters'
import { FarmerPageClient } from './farmer-page-client'
import { SectionLoader } from '@/components/ui/section-loader'
import { defaultProductionYears } from '@/lib/production-year'

export default async function AdminFarmersPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const resolvedParams = await searchParams

    // 🔴 기본 연도를 **서버에서** 건다. 필터 위젯 기본값만으로는 안 걸린다 —
    //    조회는 URL만 보기 때문에, 메뉴로 그냥 들어오면 전 연도가 쏟아졌다.
    //    작목반은 해마다 새로 만들어져 쌓이는 데이터라 기본이 「전체」면 못 쓴다.
    //    `cropYear=ALL`이 명시적 전체 탈출구다(필터에서 연도를 모두 해제하면 보낸다).
    //
    // ⚠️ 단일 연도(`defaultProductionYear`)가 아니라 **2년분**을 쓴다. 실측(2026-09-21)에
    //    26년산 작목반은 1개뿐이고 25년산이 70개였다 — 신곡 작목반은 수확기에 하나씩
    //    만들어지므로, 당해년도만 걸면 생산자 179명 중 1명만 남아 화면이 빈다.
    const rawCropYear = typeof resolvedParams.cropYear === 'string' ? resolvedParams.cropYear : undefined
    const cropYear = rawCropYear === 'ALL'
        ? undefined
        : (rawCropYear ?? defaultProductionYears('RICE').join(','))

    const filters = {
        groupName: typeof resolvedParams.groupName === 'string' ? resolvedParams.groupName : undefined,
        farmerName: typeof resolvedParams.farmerName === 'string' ? resolvedParams.farmerName : undefined,
        certType: typeof resolvedParams.certType === 'string' ? resolvedParams.certType : undefined,
        cropYear,
        producesMiscGrain: resolvedParams.producesMiscGrain === '1',
        sortBy: 'group' as const, // Force Sort by Group for Admin List
    }

    const response = await getFarmersWithGroups(filters)
    const farmers = response.success ? response.data || [] : []

    return (
        <Suspense fallback={<SectionLoader message="농가 목록을 불러오는 중" />}>
            <FarmerPageClient
                farmers={farmers}
                filtersSlot={<FarmerFilters />}
                excelSlot={<ExcelButtons />}
                addDialogSlot={<AddFarmerDialog />}
            />
        </Suspense>
    )
}
