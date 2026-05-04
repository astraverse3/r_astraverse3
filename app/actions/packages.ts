'use server'

import { prisma } from '@/lib/prisma'

/**
 * 제품재고 페이지 (`/packages`) 데이터 액션
 *
 * - 단일 모델 `MillingOutputPackage`를 source(MILLED|PURCHASED) × category(RICE|MISC_GRAIN) 두 축으로 분기 조회
 * - UI는 핸드오프 §4.2 스펙대로 **품종 그룹 펼침 + 낱개 행 혼합** 구조 (`PackageItem`)
 * - 그룹/낱개 분기는 서버에서 처리 (varietyId 기준, 행 1개 = single, 2개+ = group)
 *
 * 잡곡 포장/매입 다이얼로그(#7·#8) 머지 전까지 잡곡 탭은 데이터 0건 상태로 동작.
 */

// -----------------------------
// 타입
// -----------------------------

export type PackageSource = 'MILLED' | 'PURCHASED'
export type PackageCategory = 'RICE' | 'MISC_GRAIN'

export type PackageRow = {
    id: number
    varietyId: number
    variety: string
    spec: string // packageType ('5kg', '1kg', '500g', '톤백', …)
    qty: number // count
    producer: string // MILLED: farmer.name (+ "외 N명") / PURCHASED: purchaseVendor
    lot: string | null
    date: string // ISO yyyy-mm-dd
    sub: number // totalWeight (kg)
    source: PackageSource
}

export type PackageGroup = {
    type: 'group'
    varietyId: number
    variety: string
    total: number // 합계 kg
    rows: PackageRow[]
}

export type PackageSingle = {
    type: 'single'
} & PackageRow

export type PackageItem = PackageGroup | PackageSingle

export type PackageSort = 'latest' | 'oldest' | 'weight_desc'

export interface GetPackagesParams {
    category: PackageCategory
    varietyId?: string
    productionYear?: string
    source?: PackageSource
    sort?: PackageSort
}

// -----------------------------
// 헬퍼
// -----------------------------

const toIsoDate = (d: Date): string => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

const formatProducerForBatch = (
    primary: { name: string } | null,
    batchStocksCount: number,
): string => {
    if (!primary) return '—'
    if (batchStocksCount > 1) return `${primary.name} 외 ${batchStocksCount - 1}명`
    return primary.name
}

// -----------------------------
// 메인 조회
// -----------------------------

export async function getPackages(
    params: GetPackagesParams,
): Promise<{ success: true; data: PackageItem[] } | { success: false; error: string }> {
    try {
        const { category, varietyId, productionYear, source, sort = 'latest' } = params

        // -- where 조립 --
        const where: any = { category }
        if (source) where.source = source

        if (varietyId) {
            const vid = parseInt(varietyId, 10)
            if (!Number.isNaN(vid)) {
                // MILLED는 stock.varietyId, PURCHASED는 자기 varietyId — OR로 둘 다 수용
                where.OR = [
                    { varietyId: vid },
                    { stock: { varietyId: vid } },
                ]
            }
        }

        if (productionYear) {
            const py = parseInt(productionYear, 10)
            if (!Number.isNaN(py)) {
                where.AND = [
                    ...(where.AND ?? []),
                    {
                        OR: [
                            { stock: { productionYear: py } },
                            // PURCHASED는 productionYear 개념 없음 → incomingDate 연도 비교
                            { incomingDate: { gte: new Date(`${py}-01-01`), lt: new Date(`${py + 1}-01-01`) } },
                        ],
                    },
                ]
            }
        }

        // 정렬은 1차 DB orderBy. weight_desc는 행 단위 정렬이라 group total 정렬은 후처리.
        const orderBy =
            sort === 'oldest'
                ? { createdAt: 'asc' as const }
                : sort === 'weight_desc'
                    ? { totalWeight: 'desc' as const }
                    : { createdAt: 'desc' as const }

        const rows = await prisma.millingOutputPackage.findMany({
            where,
            include: {
                variety: { select: { id: true, name: true } },
                stock: {
                    include: {
                        variety: { select: { id: true, name: true } },
                        farmer: { select: { name: true } },
                    },
                },
                batch: { include: { stocks: { select: { id: true } } } },
            },
            orderBy,
        })

        // -- 행 → PackageRow 변환 --
        const flat: PackageRow[] = rows.map(r => {
            // varietyId·variety 추출: MILLED는 stock.variety, PURCHASED는 자기 variety
            const varietyId =
                r.variety?.id ?? r.stock?.variety.id ?? 0
            const varietyName =
                r.variety?.name ?? r.stock?.variety.name ?? '—'

            // producer 추출
            let producer: string
            if (r.source === 'PURCHASED') {
                producer = r.purchaseVendor ?? '—'
            } else {
                producer = formatProducerForBatch(
                    r.stock?.farmer ?? null,
                    r.batch?.stocks.length ?? 1,
                )
            }

            // 표시용 날짜: PURCHASED는 incomingDate, MILLED는 createdAt
            const date =
                r.source === 'PURCHASED' && r.incomingDate
                    ? toIsoDate(r.incomingDate)
                    : toIsoDate(r.createdAt)

            return {
                id: r.id,
                varietyId,
                variety: varietyName,
                spec: r.packageType,
                qty: r.count,
                producer,
                lot: r.lotNo,
                date,
                sub: r.totalWeight,
                source: r.source as PackageSource,
            }
        })

        // -- varietyId 기준 그룹핑 (단, varietyId=0 행은 낱개로만) --
        const buckets = new Map<number, PackageRow[]>()
        for (const row of flat) {
            const key = row.varietyId
            const arr = buckets.get(key) ?? []
            arr.push(row)
            buckets.set(key, arr)
        }

        const items: PackageItem[] = []
        for (const [vid, list] of buckets) {
            if (list.length === 1) {
                items.push({ type: 'single', ...list[0] })
            } else {
                const total = list.reduce((s, r) => s + r.sub, 0)
                items.push({
                    type: 'group',
                    varietyId: vid,
                    variety: list[0].variety,
                    total,
                    rows: list,
                })
            }
        }

        // -- 그룹/낱개 정렬 (sort 옵션 반영) --
        items.sort((a, b) => {
            if (sort === 'weight_desc') {
                const aw = a.type === 'group' ? a.total : a.sub
                const bw = b.type === 'group' ? b.total : b.sub
                return bw - aw
            }
            // latest: 그룹은 가장 최신 행, 낱개는 자기 date 기준
            const ad = a.type === 'group' ? a.rows[0].date : a.date
            const bd = b.type === 'group' ? b.rows[0].date : b.date
            return sort === 'oldest' ? ad.localeCompare(bd) : bd.localeCompare(ad)
        })

        return { success: true, data: items }
    } catch (error: any) {
        console.error('[getPackages] failed:', error)
        return { success: false, error: error?.message ?? '제품재고를 불러오지 못했습니다.' }
    }
}

// -----------------------------
// 매입처 distinct (잡곡 매입 다이얼로그 자동완성용 — #8에서 사용)
// -----------------------------

export async function getPurchaseVendors(): Promise<{ success: true; data: string[] } | { success: false; error: string }> {
    try {
        const rows = await prisma.millingOutputPackage.findMany({
            where: { source: 'PURCHASED', purchaseVendor: { not: null } },
            select: { purchaseVendor: true },
            distinct: ['purchaseVendor'],
            orderBy: { purchaseVendor: 'asc' },
        })
        const vendors = rows
            .map(r => r.purchaseVendor)
            .filter((v): v is string => !!v)
        return { success: true, data: vendors }
    } catch (error: any) {
        console.error('[getPurchaseVendors] failed:', error)
        return { success: false, error: error?.message ?? '매입처 목록을 불러오지 못했습니다.' }
    }
}
