'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { recordAuditLog } from '@/lib/audit'
import { requireSession } from '@/lib/auth-guard'
import { sanitizeErrorMessage } from '@/lib/error-sanitize'
import { generateLotNo } from '@/lib/lot-generation'

/**
 * 잡곡 원물재고 액션
 *  - category=MISC_GRAIN인 Stock만 다룸. 벼(RICE)는 app/actions/stock.ts에서 별도 처리
 *  - sourceType: CONSIGNMENT(위탁도정) / FARMER_MILLED(농가도정)
 *  - 외부매입(PURCHASED)은 Stock 경유 안 함 — MillingOutputPackage에서 처리(작업 단계 #8)
 */

// -----------------------------
// zod 스키마 — 잡곡 입고 폼
// -----------------------------

const baseSchema = z.object({
    productionYear: z.number().int().min(2000).max(2100),
    bagNo: z.number().int().positive(),
    weightKg: z.number().positive(),
    incomingDate: z.date(),
    farmerId: z.number().int().positive(),
    varietyId: z.number().int().positive(),
    actualFarmer: z.string().optional(),
})

const consignmentSchema = baseSchema.extend({
    sourceType: z.literal('CONSIGNMENT'),
    rawWeightKg: z.number().positive(),
    millingVendor: z.string().min(1).max(100),
})

const farmerMilledSchema = baseSchema.extend({
    sourceType: z.literal('FARMER_MILLED'),
    rawWeightKg: z.null().optional(),
    millingVendor: z.null().optional(),
})

export const MiscStockFormSchema = z.discriminatedUnion('sourceType', [
    consignmentSchema,
    farmerMilledSchema,
])

export type MiscStockFormData = z.infer<typeof MiscStockFormSchema>

// -----------------------------
// 헬퍼: 로트번호 생성 (벼와 동일 규칙 — 작목반 미소속/일반은 null)
// -----------------------------
async function deriveLotNo(
    incomingDate: Date,
    farmerId: number,
    varietyId: number,
): Promise<string | null> {
    const farmer = await prisma.farmer.findUnique({
        where: { id: farmerId },
        include: { group: true },
    })
    const variety = await prisma.variety.findUnique({ where: { id: varietyId } })

    if (!farmer || !variety) throw new Error('Invalid Farmer or Variety')

    if (!farmer.group || farmer.group.certType === '일반') return null

    return generateLotNo({
        incomingDate,
        varietyType: variety.type,
        varietyName: variety.name,
        millingType: '백미', // 잡곡은 millingType 의미 없음 — getProductCode가 품종명으로 21~215 산출
        certNo: farmer.group.certNo,
        farmerGroupCode: farmer.group.code,
        farmerNo: farmer.farmerNo || '',
    })
}

// -----------------------------
// CREATE — 잡곡 입고
// -----------------------------
export async function createMiscStock(input: MiscStockFormData) {
    await requireSession()
    try {
        const data = MiscStockFormSchema.parse(input)

        // 품종이 MISC_GRAIN인지 확인
        const variety = await prisma.variety.findUnique({
            where: { id: data.varietyId },
            select: { id: true, name: true, category: true, type: true },
        })
        if (!variety) throw new Error('품종을 찾을 수 없습니다.')
        if (variety.category !== 'MISC_GRAIN') {
            throw new Error(`잡곡 품종이 아닙니다: ${variety.name}`)
        }

        // 중복 체크 — 잡곡 풀에서 (year + farmer + variety + bagNo)
        const existing = await prisma.stock.findFirst({
            where: {
                category: 'MISC_GRAIN',
                productionYear: data.productionYear,
                farmerId: data.farmerId,
                varietyId: data.varietyId,
                bagNo: data.bagNo,
            },
            include: { farmer: true },
        })
        if (existing) {
            throw new Error(
                `이미 등록된 일련번호입니다. (생산자: ${existing.farmer.name}, 품종: ${variety.name}, 번호: ${data.bagNo})`,
            )
        }

        const lotNo = await deriveLotNo(data.incomingDate, data.farmerId, data.varietyId)

        const stock = await prisma.stock.create({
            data: {
                category: 'MISC_GRAIN',
                sourceType: data.sourceType,
                rawWeightKg: data.sourceType === 'CONSIGNMENT' ? data.rawWeightKg : null,
                millingVendor: data.sourceType === 'CONSIGNMENT' ? data.millingVendor.trim() : null,
                productionYear: data.productionYear,
                bagNo: data.bagNo,
                weightKg: data.weightKg,
                incomingDate: data.incomingDate,
                farmerId: data.farmerId,
                varietyId: data.varietyId,
                actualFarmer: data.actualFarmer?.trim() || null,
                status: 'AVAILABLE',
                lotNo,
            },
        })

        await recordAuditLog({
            action: 'CREATE',
            entity: 'Stock',
            entityId: stock.id,
            details: data,
            description: `잡곡 입고(${data.sourceType === 'CONSIGNMENT' ? '위탁도정' : '농가도정'}): ${variety.name} (${data.weightKg}kg)`,
        })

        revalidatePath('/raw-stocks')
        return { success: true, data: stock }
    } catch (error) {
        console.error('Failed to create misc stock:', error)
        return { success: false, error: sanitizeErrorMessage(error, '잡곡 입고 등록에 실패했습니다.') }
    }
}

// -----------------------------
// READ 파라미터
// -----------------------------
export type GetMiscStocksParams = {
    productionYear?: string
    varietyId?: string
    farmerId?: string
    farmerName?: string
    sourceType?: string // 'CONSIGNMENT' | 'FARMER_MILLED' (콤마 구분 멀티)
    status?: string
    sort?: string
    certType?: string
}

// 공통 where 빌더 (그룹화·평면 조회 모두 사용)
function buildMiscWhere(params?: GetMiscStocksParams) {
    const where: any = { category: 'MISC_GRAIN' }
    const andConditions: any[] = []

    if (params?.productionYear) {
        const years = params.productionYear.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
        if (years.length === 1) where.productionYear = years[0]
        else if (years.length > 1) where.productionYear = { in: years }
    }

    if (params?.varietyId) {
        const ids = params.varietyId.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
        if (ids.length === 1) where.varietyId = ids[0]
        else if (ids.length > 1) where.varietyId = { in: ids }
    }

    if (params?.status && params.status !== 'ALL') {
        where.status = params.status
    }

    if (params?.farmerId && params.farmerId !== 'ALL') {
        where.farmerId = parseInt(params.farmerId)
    }

    if (params?.sourceType) {
        const types = params.sourceType.split(',').map(s => s.trim()).filter(Boolean)
        if (types.length === 1) where.sourceType = types[0]
        else if (types.length > 1) where.sourceType = { in: types }
    }

    if (params?.farmerName) {
        const names = params.farmerName.split(',').map(s => s.trim()).filter(Boolean)
        const nameOr = (n: string) => ({
            OR: [
                { farmer: { name: { contains: n } } },
                { actualFarmer: { contains: n } },
            ],
        })
        if (names.length === 1) andConditions.push(nameOr(names[0]))
        else if (names.length > 1) andConditions.push({ OR: names.map(nameOr) })
    }

    if (params?.certType) {
        const certList = params.certType.split(',').map(s => s.trim()).filter(Boolean)
        if (certList.length === 1) {
            andConditions.push({ farmer: { group: { certType: certList[0] } } })
        } else if (certList.length > 1) {
            andConditions.push({
                OR: certList.map(c => ({ farmer: { group: { certType: c } } })),
            })
        }
    }

    if (andConditions.length > 0) where.AND = andConditions
    return where
}

// -----------------------------
// READ — 평면 조회
// -----------------------------
export async function getMiscStocks(params?: GetMiscStocksParams) {
    await requireSession()
    try {
        const where = buildMiscWhere(params)

        let orderBy: any = { createdAt: 'desc' }
        if (params?.sort === 'oldest') orderBy = { createdAt: 'asc' }
        else if (params?.sort === 'weight_desc') orderBy = { weightKg: 'desc' }
        else if (params?.sort === 'weight_asc') orderBy = { weightKg: 'asc' }

        const stocks = await prisma.stock.findMany({
            where,
            orderBy,
            include: {
                variety: true,
                farmer: { include: { group: true } },
            },
        })
        return { success: true, data: stocks }
    } catch (error) {
        console.error('Failed to get misc stocks:', error)
        return { success: false, error: '잡곡 재고 조회에 실패했습니다.' }
    }
}

// -----------------------------
// READ — 그룹 집계 (벼와 동일 키: 년도+품종+인증)
// -----------------------------
export type MiscStockGroup = {
    key: string
    year: number
    variety: string
    certType: string
    totalWeight: number
    count: number
    farmerSetSize: number
    items: any[]
}

export async function getMiscStockGroups(params?: GetMiscStocksParams) {
    await requireSession()
    try {
        const where = buildMiscWhere(params)

        const stocks = await prisma.stock.findMany({
            where,
            select: {
                id: true,
                productionYear: true,
                weightKg: true,
                variety: { select: { name: true } },
                farmer: {
                    select: {
                        id: true,
                        group: { select: { certType: true } },
                    },
                },
            },
        })

        const grouped: Record<string, MiscStockGroup> = {}

        stocks.forEach((stock: any) => {
            const certType = stock.farmer?.group?.certType || '일반'
            const key = `${stock.productionYear}-${stock.variety?.name}-${certType}`

            if (!grouped[key]) {
                grouped[key] = {
                    key,
                    year: stock.productionYear,
                    variety: stock.variety?.name || 'Unknown',
                    certType,
                    totalWeight: 0,
                    count: 0,
                    farmerSetSize: 0,
                    items: [],
                }
                ;(grouped[key] as any)._farmerIds = new Set()
            }

            grouped[key].totalWeight += stock.weightKg
            grouped[key].count += 1
            if (stock.farmer?.id) {
                ;(grouped[key] as any)._farmerIds.add(stock.farmer.id)
            }
        })

        const result = Object.values(grouped).map((g: any) => {
            g.farmerSetSize = g._farmerIds.size
            delete g._farmerIds
            return g as MiscStockGroup
        })

        result.sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year
            const aIsGeneral = a.certType === '일반'
            const bIsGeneral = b.certType === '일반'
            if (aIsGeneral && !bIsGeneral) return 1
            if (!aIsGeneral && bIsGeneral) return -1
            if (a.variety !== b.variety) return a.variety.localeCompare(b.variety, 'ko')
            return a.certType.localeCompare(b.certType, 'ko')
        })

        return { success: true, data: result }
    } catch (error) {
        console.error('Failed to get misc stock groups:', error)
        return { success: false, error: '잡곡 그룹 조회에 실패했습니다.' }
    }
}

// -----------------------------
// READ — 그룹 펼침 (특정 그룹의 항목)
// -----------------------------
export async function getMiscStocksByGroup(
    groupKey: { year: number; variety: string; certType: string },
    params?: GetMiscStocksParams,
) {
    await requireSession()
    try {
        const andConditions: any[] = [
            { category: 'MISC_GRAIN' },
            { productionYear: groupKey.year },
            { variety: { name: groupKey.variety } },
        ]

        if (groupKey.certType === '일반') {
            andConditions.push({
                OR: [
                    { farmer: { groupId: null } },
                    { farmer: { group: { certType: '일반' } } },
                ],
            })
        } else {
            andConditions.push({ farmer: { group: { certType: groupKey.certType } } })
        }

        if (params?.status && params.status !== 'ALL') {
            andConditions.push({ status: params.status })
        }

        if (params?.sourceType) {
            const types = params.sourceType.split(',').map(s => s.trim()).filter(Boolean)
            if (types.length === 1) andConditions.push({ sourceType: types[0] })
            else if (types.length > 1) andConditions.push({ sourceType: { in: types } })
        }

        if (params?.farmerName) {
            const names = params.farmerName.split(',').map(s => s.trim()).filter(Boolean)
            const nameOr = (n: string) => ({
                OR: [
                    { farmer: { name: { contains: n } } },
                    { actualFarmer: { contains: n } },
                ],
            })
            if (names.length === 1) andConditions.push(nameOr(names[0]))
            else if (names.length > 1) andConditions.push({ OR: names.map(nameOr) })
        }

        const stocks = await prisma.stock.findMany({
            where: { AND: andConditions },
            orderBy: [{ farmer: { name: 'asc' } }, { bagNo: 'asc' }],
            include: {
                variety: true,
                farmer: { include: { group: true } },
            },
        })

        return { success: true, data: stocks }
    } catch (error) {
        console.error('Failed to get misc stocks by group:', error)
        return { success: false, error: '잡곡 그룹 항목 조회에 실패했습니다.' }
    }
}

// -----------------------------
// 헬퍼 쿼리: 위탁 도정업체 자동완성용
// -----------------------------
export async function getMillingVendors() {
    await requireSession()
    try {
        const rows = await prisma.stock.findMany({
            where: {
                category: 'MISC_GRAIN',
                sourceType: 'CONSIGNMENT',
                millingVendor: { not: null },
            },
            distinct: ['millingVendor'],
            select: { millingVendor: true },
            orderBy: { millingVendor: 'asc' },
        })
        const vendors = rows
            .map(r => r.millingVendor)
            .filter((v): v is string => !!v)
        return { success: true, data: vendors }
    } catch (error) {
        console.error('Failed to get milling vendors:', error)
        return { success: false, error: '도정업체 목록 조회에 실패했습니다.' }
    }
}

// -----------------------------
// 헬퍼 쿼리: 잡곡 품종 목록 (category=MISC_GRAIN)
// -----------------------------
export async function getMiscVarieties() {
    await requireSession()
    try {
        const varieties = await prisma.variety.findMany({
            where: { category: 'MISC_GRAIN' },
            orderBy: { name: 'asc' },
        })
        return { success: true, data: varieties }
    } catch (error) {
        console.error('Failed to get misc varieties:', error)
        return { success: false, error: '잡곡 품종 목록 조회에 실패했습니다.' }
    }
}

// -----------------------------
// 헬퍼 쿼리: 잡곡 다이얼로그용 농가 목록 (producesMiscGrain=true)
// -----------------------------
export async function getMiscFarmers() {
    await requireSession()
    try {
        const farmers = await prisma.farmer.findMany({
            where: { producesMiscGrain: true },
            include: { group: true },
            orderBy: { name: 'asc' },
        })
        return { success: true, data: farmers }
    } catch (error) {
        console.error('Failed to get misc farmers:', error)
        return { success: false, error: '잡곡 농가 목록 조회에 실패했습니다.' }
    }
}
