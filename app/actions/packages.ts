'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { recordAuditLog } from '@/lib/audit'
import { requireSession } from '@/lib/auth-guard'
import { sanitizeErrorMessage } from '@/lib/error-sanitize'
import { getVarietyTypeLabel } from '@/lib/variety-labels'

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
    weightPerUnit: number // kg 단위. 그룹 내부 정렬(FIFO) 키
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
    /** 콤마 구분 다중값 가능 (예: "1,2,3") */
    varietyId?: string
    /** 콤마 구분 다중값 가능 (예: "2025,2024") */
    productionYear?: string
    /** 콤마 구분 다중값 가능 (예: "MILLED,PURCHASED") */
    source?: string
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

// -----------------------------
// 메인 조회
// -----------------------------

export async function getPackages(
    params: GetPackagesParams,
): Promise<{ success: true; data: PackageItem[] } | { success: false; error: string }> {
    try {
        const { category, varietyId, productionYear, source, sort = 'weight_desc' } = params

        const splitMulti = (s: string | undefined): string[] =>
            s ? s.split(',').map(x => x.trim()).filter(Boolean) : []

        // -- where 조립 --
        const where: any = { category }

        const sourceList = splitMulti(source).filter((s): s is PackageSource => s === 'MILLED' || s === 'PURCHASED')
        if (sourceList.length === 1) where.source = sourceList[0]
        else if (sourceList.length > 1) where.source = { in: sourceList }

        // [임시] 판매처리 기능 미구현 상태 — 1달 이전 도정산(MILLED)은 사실상 판매된 재고이므로 노출 제외.
        // 매입(PURCHASED)은 적어 그대로 유지. 판매처리 도입(#9 이후) 시 이 블록 제거.
        const cutoff = new Date()
        cutoff.setMonth(cutoff.getMonth() - 1)
        where.AND = [
            ...(where.AND ?? []),
            {
                OR: [
                    { source: 'PURCHASED' },
                    { AND: [{ source: 'MILLED' }, { createdAt: { gte: cutoff } }] },
                ],
            },
        ]

        const varietyIdList = splitMulti(varietyId)
            .map(v => parseInt(v, 10))
            .filter(n => !Number.isNaN(n))
        if (varietyIdList.length > 0) {
            where.AND = [
                ...(where.AND ?? []),
                {
                    OR: [
                        { varietyId: { in: varietyIdList } },
                        { stock: { varietyId: { in: varietyIdList } } },
                    ],
                },
            ]
        }

        const yearList = splitMulti(productionYear)
            .map(y => parseInt(y, 10))
            .filter(n => !Number.isNaN(n))
        if (yearList.length > 0) {
            where.AND = [
                ...(where.AND ?? []),
                {
                    OR: yearList.flatMap(py => [
                        { stock: { productionYear: py } },
                        // PURCHASED는 productionYear 개념 없음 → incomingDate 연도 비교
                        { incomingDate: { gte: new Date(`${py}-01-01`), lt: new Date(`${py + 1}-01-01`) } },
                    ]),
                },
            ]
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
            //  - PURCHASED: 매입처
            //  - MILLED: 포장은 stock 단위로 1:1 매핑이라 1명의 농가만 (lot도 그 농가 기준 생성).
            //    다농장 배치라도 각 포장은 어느 한 stock에 묶여 있음 — "외 N명" 표시는 부정확
            const producer: string =
                r.source === 'PURCHASED'
                    ? r.purchaseVendor ?? '—'
                    : r.stock?.farmer.name ?? '—'

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
                weightPerUnit: r.weightPerUnit,
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
                // FIFO: 같은 규격끼리 묶이도록 weightPerUnit asc, 같은 규격 내에선 오래된 순(date asc)
                // 사용자 sort 옵션은 상위 items 정렬에만 적용. 그룹 내부는 항상 FIFO 유지.
                const sortedRows = [...list].sort(
                    (a, b) =>
                        a.weightPerUnit - b.weightPerUnit ||
                        a.date.localeCompare(b.date),
                )
                const total = sortedRows.reduce((s, r) => s + r.sub, 0)
                items.push({
                    type: 'group',
                    varietyId: vid,
                    variety: sortedRows[0].variety,
                    total,
                    rows: sortedRows,
                })
            }
        }

        // -- 그룹/낱개 정렬 (sort 옵션 반영) --
        // 그룹의 대표 날짜는 sort 방향에 따라 max(latest) 또는 min(oldest)으로 산출.
        // 그룹 rows 자체 순서는 FIFO로 고정이라 rows[0]이 항상 최신은 아님.
        const repDate = (it: PackageItem): string => {
            if (it.type === 'single') return it.date
            if (sort === 'oldest') {
                return it.rows.reduce((m, r) => (r.date < m ? r.date : m), '9999-99-99')
            }
            return it.rows.reduce((m, r) => (r.date > m ? r.date : m), '0000-00-00')
        }
        items.sort((a, b) => {
            if (sort === 'weight_desc') {
                const aw = a.type === 'group' ? a.total : a.sub
                const bw = b.type === 'group' ? b.total : b.sub
                return bw - aw
            }
            const ad = repDate(a)
            const bd = repDate(b)
            return sort === 'oldest' ? ad.localeCompare(bd) : bd.localeCompare(ad)
        })

        return { success: true, data: items }
    } catch (error: any) {
        console.error('[getPackages] failed:', error)
        return { success: false, error: error?.message ?? '제품재고를 불러오지 못했습니다.' }
    }
}

// -----------------------------
// 잡곡 포장 — selector용 사용 가능 stock 목록 (#7b/#7c)
// -----------------------------

export interface AvailableMiscStock {
    id: number
    productionYear: number
    bagNo: number
    weightKg: number
    remainingKg: number
    incomingDate: string // ISO yyyy-mm-dd
    lotNo: string | null
    sourceType: 'CONSIGNMENT' | 'FARMER_MILLED' | 'GERMINATION' | null
    variety: { id: number; name: string }
    farmer: { id: number; name: string; group: { certType: string } | null }
}

/**
 * 포장 가능한 잡곡 stock 목록 — 진입점 ②(제품재고 헤더 [+ 포장하기])에서 selector로 사용.
 * - category=MISC_GRAIN, status=AVAILABLE, remainingKg > 0
 * - FIFO 정렬: 입고일 오래된 순
 */
export async function getAvailableMiscStocks(): Promise<
    { success: true; data: AvailableMiscStock[] } | { success: false; error: string }
> {
    await requireSession()
    try {
        const stocks = await prisma.stock.findMany({
            where: { category: 'MISC_GRAIN', status: 'AVAILABLE' },
            include: {
                variety: { select: { id: true, name: true } },
                farmer: { include: { group: { select: { certType: true } } } },
                outputPackages: { select: { totalWeight: true } },
            },
            orderBy: { incomingDate: 'asc' },
        })

        const data: AvailableMiscStock[] = stocks
            .map(s => {
                const consumed = s.outputPackages.reduce((sum, p) => sum + p.totalWeight, 0)
                const remainingKg = Math.max(0, s.weightKg - consumed)
                return {
                    id: s.id,
                    productionYear: s.productionYear,
                    bagNo: s.bagNo,
                    weightKg: s.weightKg,
                    remainingKg,
                    incomingDate: s.incomingDate.toISOString().slice(0, 10),
                    lotNo: s.lotNo,
                    sourceType: s.sourceType as 'CONSIGNMENT' | 'FARMER_MILLED' | 'GERMINATION' | null,
                    variety: { id: s.variety.id, name: s.variety.name },
                    farmer: {
                        id: s.farmer.id,
                        name: s.farmer.name,
                        group: s.farmer.group ? { certType: s.farmer.group.certType } : null,
                    },
                }
            })
            .filter(s => s.remainingKg > 0.001)

        return { success: true, data }
    } catch (error) {
        console.error('[getAvailableMiscStocks] failed:', error)
        return { success: false, error: '포장 가능한 재고 목록을 불러오지 못했습니다.' }
    }
}

// -----------------------------
// 잡곡 포장 — 신규 등록 (#7b)
// -----------------------------

const EPSILON_KG = 0.001

const CreateMiscPackageSchema = z.object({
    stockId: z.number().int().positive(),
    packageType: z.string().min(1).max(20),
    weightPerUnit: z.number().positive(),
    count: z.number().int().positive(),
})

export type CreateMiscPackageInput = z.infer<typeof CreateMiscPackageSchema>

/**
 * 잡곡 포장 등록.
 *  - source=MILLED, category=MISC_GRAIN
 *  - stockId 참조 (배치는 잡곡에 없음 → batchId=null)
 *  - lotNo는 stock.lotNo 그대로 복사
 *  - 트랜잭션 내부에서 잔량 재계산 → 초과 시 차단 → status 자동 전이 (CONSUMED)
 *  - 동시성: status='AVAILABLE' 조건부 update로 후행 충돌 차단
 */
export async function createMiscPackage(
    input: CreateMiscPackageInput,
): Promise<{ success: true; id: number } | { success: false; error: string }> {
    await requireSession()
    try {
        const data = CreateMiscPackageSchema.parse(input)
        const totalWeight = +(data.weightPerUnit * data.count).toFixed(3)

        const result = await prisma.$transaction(async (tx) => {
            const stock = await tx.stock.findUnique({
                where: { id: data.stockId },
                include: {
                    variety: { select: { name: true } },
                    outputPackages: { select: { totalWeight: true } },
                },
            })
            if (!stock) throw new Error('재고를 찾을 수 없습니다.')
            if (stock.category !== 'MISC_GRAIN') throw new Error('잡곡 재고가 아닙니다.')
            if (stock.status !== 'AVAILABLE') throw new Error('보관중 상태가 아닙니다.')

            const consumed = stock.outputPackages.reduce((sum, p) => sum + p.totalWeight, 0)
            const remainingKg = stock.weightKg - consumed
            if (totalWeight - remainingKg > EPSILON_KG) {
                throw new Error(`재고(${remainingKg.toFixed(2)}kg)를 초과했습니다.`)
            }

            const created = await tx.millingOutputPackage.create({
                data: {
                    source: 'MILLED',
                    category: 'MISC_GRAIN',
                    stockId: stock.id,
                    batchId: null,
                    varietyId: null,
                    packageType: data.packageType,
                    weightPerUnit: data.weightPerUnit,
                    count: data.count,
                    totalWeight,
                    lotNo: stock.lotNo,
                },
            })

            // status 자동 전이: 잔량 - totalWeight ≤ ε 이면 CONSUMED
            const nextRemaining = remainingKg - totalWeight
            if (nextRemaining <= EPSILON_KG) {
                // 동시성 가드: status='AVAILABLE' 조건부 update
                await tx.stock.updateMany({
                    where: { id: stock.id, status: 'AVAILABLE' },
                    data: { status: 'CONSUMED' },
                })
            }

            return { id: created.id, varietyName: stock.variety.name }
        })

        await recordAuditLog({
            action: 'CREATE',
            entity: 'MillingOutputPackage',
            entityId: result.id,
            details: { ...data, totalWeight },
            description: `잡곡 포장: ${result.varietyName} ${data.packageType} × ${data.count}개 (${totalWeight}kg)`,
        })

        revalidatePath('/raw-stocks')
        revalidatePath('/packages')
        revalidatePath('/')

        return { success: true, id: result.id }
    } catch (error) {
        console.error('[createMiscPackage] failed:', error)
        return { success: false, error: sanitizeErrorMessage(error, '포장 등록에 실패했습니다.') }
    }
}

// -----------------------------
// 잡곡 포장 — 수정 컨텍스트 조회 (다이얼로그 prefill용, #7c)
// -----------------------------

export interface MiscPackageEditContext {
    id: number
    variety: string
    producer: string
    lotNo: string | null
    packageType: string
    weightPerUnit: number
    count: number
    /** 원물 stock 총중량 */
    stockWeightKg: number
    /** 같은 stock의 다른 포장 합 (자기 제외) — 본 행 수정 한도 = stockWeightKg - otherSum */
    otherSum: number
}

export async function getMiscPackageEditContext(
    id: number,
): Promise<{ success: true; data: MiscPackageEditContext } | { success: false; error: string }> {
    await requireSession()
    try {
        const pkg = await prisma.millingOutputPackage.findUnique({
            where: { id },
            include: {
                stock: {
                    include: {
                        variety: { select: { name: true } },
                        farmer: { select: { name: true } },
                        outputPackages: { select: { id: true, totalWeight: true } },
                    },
                },
            },
        })
        if (!pkg) return { success: false, error: '포장을 찾을 수 없습니다.' }
        if (pkg.category !== 'MISC_GRAIN') return { success: false, error: '잡곡 포장이 아닙니다.' }
        if (pkg.source !== 'MILLED' || !pkg.stock) {
            return { success: false, error: '도정산 포장만 본 화면에서 수정할 수 있습니다.' }
        }
        const otherSum = pkg.stock.outputPackages
            .filter(p => p.id !== id)
            .reduce((s, p) => s + p.totalWeight, 0)
        return {
            success: true,
            data: {
                id: pkg.id,
                variety: pkg.stock.variety.name,
                producer: pkg.stock.farmer.name,
                lotNo: pkg.stock.lotNo ?? null,
                packageType: pkg.packageType,
                weightPerUnit: pkg.weightPerUnit,
                count: pkg.count,
                stockWeightKg: pkg.stock.weightKg,
                otherSum,
            },
        }
    } catch (error) {
        console.error('[getMiscPackageEditContext] failed:', error)
        return { success: false, error: '컨텍스트 조회에 실패했습니다.' }
    }
}

// -----------------------------
// 잡곡 포장 — 수정 (#7c)
// -----------------------------

const UpdateMiscPackageSchema = z.object({
    packageType: z.string().min(1).max(20),
    weightPerUnit: z.number().positive(),
    count: z.number().int().positive(),
})

export type UpdateMiscPackageInput = z.infer<typeof UpdateMiscPackageSchema>

/**
 * 잡곡 포장 수정 (MILLED 전용 — PURCHASED는 #8 매입 다이얼로그와 함께).
 *  - 변경 가능 필드: packageType, weightPerUnit, count (totalWeight = wpu × count 자동 산출)
 *  - 트랜잭션: 같은 stock 내 다른 포장 합 + 새 totalWeight ≤ stock.weightKg 검증 → update → status 재평가
 *  - 동시성: status 분기는 둘 다 조건부 updateMany (이전 status에 따라 매칭되는 케이스만 갱신)
 */
export async function updateMiscPackage(
    id: number,
    input: UpdateMiscPackageInput,
): Promise<{ success: true } | { success: false; error: string }> {
    await requireSession()
    try {
        const data = UpdateMiscPackageSchema.parse(input)
        const newTotalWeight = +(data.weightPerUnit * data.count).toFixed(3)

        await prisma.$transaction(async (tx) => {
            const pkg = await tx.millingOutputPackage.findUnique({
                where: { id },
                select: {
                    id: true,
                    source: true,
                    category: true,
                    stockId: true,
                    totalWeight: true,
                },
            })
            if (!pkg) throw new Error('포장을 찾을 수 없습니다.')
            if (pkg.category !== 'MISC_GRAIN') throw new Error('잡곡 포장이 아닙니다.')
            if (pkg.source !== 'MILLED') throw new Error('도정산 포장만 본 화면에서 수정할 수 있습니다.')
            if (pkg.stockId == null) throw new Error('연결된 원물재고가 없습니다.')

            const stock = await tx.stock.findUnique({
                where: { id: pkg.stockId },
                include: {
                    variety: { select: { name: true } },
                    outputPackages: { select: { id: true, totalWeight: true } },
                },
            })
            if (!stock) throw new Error('원물재고를 찾을 수 없습니다.')

            // 본 행 제외한 다른 포장 합
            const otherSum = stock.outputPackages
                .filter(p => p.id !== id)
                .reduce((s, p) => s + p.totalWeight, 0)
            const limit = stock.weightKg - otherSum
            if (newTotalWeight - limit > EPSILON_KG) {
                throw new Error(`수정 가능 한도(${limit.toFixed(2)}kg)를 초과했습니다.`)
            }

            await tx.millingOutputPackage.update({
                where: { id },
                data: {
                    packageType: data.packageType,
                    weightPerUnit: data.weightPerUnit,
                    count: data.count,
                    totalWeight: newTotalWeight,
                },
            })

            // status 재평가: 새 잔량 = stock.weightKg - (otherSum + newTotalWeight)
            const newRemaining = limit - newTotalWeight
            if (newRemaining <= EPSILON_KG) {
                await tx.stock.updateMany({
                    where: { id: stock.id, status: 'AVAILABLE' },
                    data: { status: 'CONSUMED' },
                })
            } else {
                // 잔량 양수면 AVAILABLE로 복원 (이전 CONSUMED였더라도)
                await tx.stock.updateMany({
                    where: { id: stock.id, status: 'CONSUMED' },
                    data: { status: 'AVAILABLE' },
                })
            }

            return { varietyName: stock.variety.name }
        })

        await recordAuditLog({
            action: 'UPDATE',
            entity: 'MillingOutputPackage',
            entityId: id,
            details: { ...data, totalWeight: newTotalWeight },
            description: `잡곡 포장 수정: ${data.packageType} × ${data.count}개 (${newTotalWeight}kg)`,
        })

        revalidatePath('/raw-stocks')
        revalidatePath('/packages')
        revalidatePath('/')

        return { success: true }
    } catch (error) {
        console.error('[updateMiscPackage] failed:', error)
        return { success: false, error: sanitizeErrorMessage(error, '포장 수정에 실패했습니다.') }
    }
}

// -----------------------------
// 잡곡 포장 — 삭제 (#7c)
// -----------------------------

/**
 * 잡곡 포장 삭제 — 정정 용도.
 *  - "포장이 없었던 것으로 되돌림" — MILLED는 stock 잔량 복구 + status 재평가
 *  - 비판매 차감(증정/분실/파손)은 본 함수와 의미 다름 → 백로그 §14 (#9 판매처리와 통합 설계)
 *  - PURCHASED는 stock 참조 없어 단순 delete (단, 본 #7c는 MILLED만 — PURCHASED는 #8과 함께)
 */
export async function deleteMiscPackage(
    id: number,
): Promise<{ success: true } | { success: false; error: string }> {
    await requireSession()
    try {
        const audit = await prisma.$transaction(async (tx) => {
            const pkg = await tx.millingOutputPackage.findUnique({
                where: { id },
                select: {
                    id: true,
                    source: true,
                    category: true,
                    stockId: true,
                    packageType: true,
                    count: true,
                    totalWeight: true,
                    stock: { select: { variety: { select: { name: true } } } },
                },
            })
            if (!pkg) throw new Error('포장을 찾을 수 없습니다.')
            if (pkg.category !== 'MISC_GRAIN') throw new Error('잡곡 포장이 아닙니다.')

            await tx.millingOutputPackage.delete({ where: { id } })

            // MILLED만 stock status 재평가 (PURCHASED는 stock 참조 없음)
            if (pkg.source === 'MILLED' && pkg.stockId != null) {
                // 삭제 후 잔량 양수면 AVAILABLE 복원 (이전 CONSUMED였을 가능성)
                await tx.stock.updateMany({
                    where: { id: pkg.stockId, status: 'CONSUMED' },
                    data: { status: 'AVAILABLE' },
                })
            }

            return {
                varietyName: pkg.stock?.variety.name ?? '-',
                packageType: pkg.packageType,
                count: pkg.count,
                totalWeight: pkg.totalWeight,
            }
        })

        await recordAuditLog({
            action: 'DELETE',
            entity: 'MillingOutputPackage',
            entityId: id,
            details: audit,
            description: `잡곡 포장 삭제: ${audit.varietyName} ${audit.packageType} × ${audit.count}개 (${audit.totalWeight}kg)`,
        })

        revalidatePath('/raw-stocks')
        revalidatePath('/packages')
        revalidatePath('/')

        return { success: true }
    } catch (error) {
        console.error('[deleteMiscPackage] failed:', error)
        return { success: false, error: sanitizeErrorMessage(error, '포장 삭제에 실패했습니다.') }
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

// -----------------------------
// 매입 품종 자동완성 (type='PURCHASED' 전용 — #8 매입 다이얼로그)
// -----------------------------

export async function getPurchaseVarieties(): Promise<
    { success: true; data: { id: number; name: string }[] } | { success: false; error: string }
> {
    await requireSession()
    try {
        const varieties = await prisma.variety.findMany({
            where: { type: 'PURCHASED' },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        })
        return { success: true, data: varieties }
    } catch (error) {
        console.error('[getPurchaseVarieties] failed:', error)
        return { success: false, error: '매입 품종 목록을 불러오지 못했습니다.' }
    }
}

// -----------------------------
// 잡곡 매입 등록 (#8b)
// 신규 품종 자동 생성(findOrCreate). 동일 name이 다른 type으로 존재 시 충돌 안내 + 차단.
// -----------------------------

const CreateMiscPurchaseSchema = z.object({
    purchaseVendor: z.string().trim().min(1).max(100),
    varietyName: z.string().trim().min(1).max(50),
    incomingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '입력일 형식은 YYYY-MM-DD이어야 합니다.'),
    packageType: z.string().trim().min(1).max(20),
    weightPerUnit: z.number().positive(),
    count: z.number().int().positive(),
})

export type CreateMiscPurchaseInput = z.infer<typeof CreateMiscPurchaseSchema>

/**
 * 변수명 → 매입 품종 findOrCreate.
 * 같은 name이 다른 type으로 이미 존재하면 충돌 에러 반환(저장 차단).
 *
 * 반환:
 *  - `{ ok: true, varietyId, created }` — 정상 매핑 (created=true면 신규 생성)
 *  - `{ ok: false, error }` — 충돌 안내
 */
async function findOrCreatePurchaseVariety(
    name: string,
): Promise<{ ok: true; varietyId: number; created: boolean } | { ok: false; error: string }> {
    // 1) 같은 이름 + type=PURCHASED 매칭 (재사용)
    const exact = await prisma.variety.findFirst({
        where: { name, type: 'PURCHASED' },
        select: { id: true },
    })
    if (exact) return { ok: true, varietyId: exact.id, created: false }

    // 2) 다른 type으로 존재하면 unique 위반 → 한글 곡종명 포함 안내
    const conflict = await prisma.variety.findFirst({
        where: { name },
        select: { type: true },
    })
    if (conflict) {
        const label = getVarietyTypeLabel(conflict.type)
        return { ok: false, error: `이미 '${label}' 곡종으로 등록된 품종이에요. 다른 이름을 사용해주세요.` }
    }

    // 3) 신규 생성
    const created = await prisma.variety.create({
        data: { name, type: 'PURCHASED', category: 'MISC_GRAIN' },
        select: { id: true },
    })
    return { ok: true, varietyId: created.id, created: true }
}

export async function createMiscPurchase(
    rawInput: unknown,
): Promise<{ success: true; data: { id: number; varietyCreated: boolean } } | { success: false; error: string }> {
    await requireSession()
    try {
        const parsed = CreateMiscPurchaseSchema.safeParse(rawInput)
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }
        }
        const { purchaseVendor, varietyName, incomingDate, packageType, weightPerUnit, count } = parsed.data

        const lookup = await findOrCreatePurchaseVariety(varietyName)
        if (!lookup.ok) return { success: false, error: lookup.error }

        const totalWeight = +(weightPerUnit * count).toFixed(3)
        const incoming = new Date(`${incomingDate}T00:00:00`)

        const created = await prisma.millingOutputPackage.create({
            data: {
                source: 'PURCHASED',
                category: 'MISC_GRAIN',
                batchId: null,
                stockId: null,
                varietyId: lookup.varietyId,
                purchaseVendor,
                incomingDate: incoming,
                packageType,
                weightPerUnit,
                count,
                totalWeight,
                lotNo: null,
                productCode: null,
            },
            select: { id: true },
        })

        await recordAuditLog({
            action: 'CREATE',
            entity: 'MillingOutputPackage',
            entityId: created.id,
            details: { source: 'PURCHASED', purchaseVendor, varietyName, incomingDate, packageType, count, totalWeight, varietyCreated: lookup.created },
            description: `잡곡 매입 등록: ${purchaseVendor} / ${varietyName} / ${packageType}×${count} (${totalWeight}kg)`,
        })

        revalidatePath('/packages')

        return { success: true, data: { id: created.id, varietyCreated: lookup.created } }
    } catch (error) {
        console.error('[createMiscPurchase] failed:', error)
        return { success: false, error: sanitizeErrorMessage(error, '매입 등록에 실패했습니다.') }
    }
}

// -----------------------------
// 잡곡 매입 수정 컨텍스트 조회 (#8c)
// -----------------------------

export interface MiscPurchaseEditContext {
    id: number
    purchaseVendor: string
    varietyId: number
    varietyName: string
    incomingDate: string // YYYY-MM-DD
    packageType: string
    weightPerUnit: number
    count: number
}

export async function getMiscPurchaseEditContext(
    id: number,
): Promise<{ success: true; data: MiscPurchaseEditContext } | { success: false; error: string }> {
    await requireSession()
    try {
        const pkg = await prisma.millingOutputPackage.findUnique({
            where: { id },
            include: { variety: { select: { id: true, name: true } } },
        })
        if (!pkg) return { success: false, error: '매입 레코드를 찾을 수 없습니다.' }
        if (pkg.source !== 'PURCHASED' || pkg.category !== 'MISC_GRAIN') {
            return { success: false, error: '잡곡 매입 레코드만 본 화면에서 수정할 수 있습니다.' }
        }
        if (!pkg.variety || !pkg.purchaseVendor || !pkg.incomingDate) {
            return { success: false, error: '매입 레코드에 필수 필드가 누락되어 있습니다.' }
        }
        return {
            success: true,
            data: {
                id: pkg.id,
                purchaseVendor: pkg.purchaseVendor,
                varietyId: pkg.variety.id,
                varietyName: pkg.variety.name,
                incomingDate: pkg.incomingDate.toISOString().slice(0, 10),
                packageType: pkg.packageType,
                weightPerUnit: pkg.weightPerUnit,
                count: pkg.count,
            },
        }
    } catch (error) {
        console.error('[getMiscPurchaseEditContext] failed:', error)
        return { success: false, error: '컨텍스트 조회에 실패했습니다.' }
    }
}

// -----------------------------
// 잡곡 매입 수정 (#8c)
// -----------------------------

const UpdateMiscPurchaseSchema = CreateMiscPurchaseSchema

export async function updateMiscPurchase(
    id: number,
    rawInput: unknown,
): Promise<{ success: true; data: { varietyCreated: boolean } } | { success: false; error: string }> {
    await requireSession()
    try {
        const parsed = UpdateMiscPurchaseSchema.safeParse(rawInput)
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }
        }
        const { purchaseVendor, varietyName, incomingDate, packageType, weightPerUnit, count } = parsed.data

        const existing = await prisma.millingOutputPackage.findUnique({
            where: { id },
            select: { source: true, category: true },
        })
        if (!existing) return { success: false, error: '매입 레코드를 찾을 수 없습니다.' }
        if (existing.source !== 'PURCHASED' || existing.category !== 'MISC_GRAIN') {
            return { success: false, error: '잡곡 매입 레코드만 수정할 수 있습니다.' }
        }

        const lookup = await findOrCreatePurchaseVariety(varietyName)
        if (!lookup.ok) return { success: false, error: lookup.error }

        const totalWeight = +(weightPerUnit * count).toFixed(3)
        const incoming = new Date(`${incomingDate}T00:00:00`)

        await prisma.millingOutputPackage.update({
            where: { id },
            data: {
                varietyId: lookup.varietyId,
                purchaseVendor,
                incomingDate: incoming,
                packageType,
                weightPerUnit,
                count,
                totalWeight,
            },
        })

        await recordAuditLog({
            action: 'UPDATE',
            entity: 'MillingOutputPackage',
            entityId: id,
            details: { source: 'PURCHASED', purchaseVendor, varietyName, incomingDate, packageType, count, totalWeight, varietyCreated: lookup.created },
            description: `잡곡 매입 수정: ${purchaseVendor} / ${varietyName} / ${packageType}×${count}`,
        })

        revalidatePath('/packages')

        return { success: true, data: { varietyCreated: lookup.created } }
    } catch (error) {
        console.error('[updateMiscPurchase] failed:', error)
        return { success: false, error: sanitizeErrorMessage(error, '매입 수정에 실패했습니다.') }
    }
}

// -----------------------------
// 잡곡 매입 삭제 (#8c) — Stock 참조 없으므로 단순 delete
// -----------------------------

export async function deleteMiscPurchase(
    id: number,
): Promise<{ success: true } | { success: false; error: string }> {
    await requireSession()
    try {
        const existing = await prisma.millingOutputPackage.findUnique({
            where: { id },
            select: { source: true, category: true, purchaseVendor: true, packageType: true, count: true },
        })
        if (!existing) return { success: false, error: '매입 레코드를 찾을 수 없습니다.' }
        if (existing.source !== 'PURCHASED' || existing.category !== 'MISC_GRAIN') {
            return { success: false, error: '잡곡 매입 레코드만 삭제할 수 있습니다.' }
        }

        await prisma.millingOutputPackage.delete({ where: { id } })

        await recordAuditLog({
            action: 'DELETE',
            entity: 'MillingOutputPackage',
            entityId: id,
            details: { source: 'PURCHASED', purchaseVendor: existing.purchaseVendor, packageType: existing.packageType, count: existing.count },
            description: `잡곡 매입 삭제 (id=${id})`,
        })

        revalidatePath('/packages')

        return { success: true }
    } catch (error) {
        console.error('[deleteMiscPurchase] failed:', error)
        return { success: false, error: sanitizeErrorMessage(error, '매입 삭제에 실패했습니다.') }
    }
}
