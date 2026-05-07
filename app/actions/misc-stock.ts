'use server'

import { z } from 'zod'
import * as XLSX from 'xlsx'
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

// bagNo는 server에서 자동 할당 (input에 포함하지 않음)
const baseSchema = z.object({
    productionYear: z.number().int().min(2000).max(2100),
    weightKg: z.number().positive(),
    incomingDate: z.date(),
    farmerId: z.number().int().positive(),
    varietyId: z.number().int().positive(),
    actualFarmer: z.string().optional(),
})

const consignmentSchema = baseSchema.extend({
    sourceType: z.literal('CONSIGNMENT'), // 도정위탁
    rawWeightKg: z.number().positive(),
    millingVendor: z.string().min(1).max(100),
})

const farmerMilledSchema = baseSchema.extend({
    sourceType: z.literal('FARMER_MILLED'), // 농가도정
    rawWeightKg: z.null().optional(),
    millingVendor: z.null().optional(),
})

const germinationSchema = baseSchema.extend({
    sourceType: z.literal('GERMINATION'), // 발아위탁 — rawWeightKg=현미중량, millingVendor=발아업체
    rawWeightKg: z.number().positive(),
    millingVendor: z.string().min(1).max(100),
})

// 'use server' 파일은 async 함수만 export 가능 — 스키마 자체는 모듈 내부에서만 사용
const MiscStockFormSchema = z.discriminatedUnion('sourceType', [
    consignmentSchema,
    farmerMilledSchema,
    germinationSchema,
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

        const lotNo = await deriveLotNo(data.incomingDate, data.farmerId, data.varietyId)

        // 위탁(CONSIGNMENT)·발아(GERMINATION) 모두 rawWeightKg/millingVendor 저장.
        // 의미는 sourceType별로 다름: 위탁은 원물중량/도정업체, 발아는 현미중량/발아업체.
        const hasVendorAndRaw = data.sourceType === 'CONSIGNMENT' || data.sourceType === 'GERMINATION'

        // 일련번호(bagNo)는 server에서 자동 할당 — (year, farmer, variety, MISC_GRAIN) 조합 max+1.
        // race-safe: 트랜잭션 안에서 max 조회 + create
        const stock = await prisma.$transaction(async (tx) => {
            const lastBag = await tx.stock.findFirst({
                where: {
                    category: 'MISC_GRAIN',
                    productionYear: data.productionYear,
                    farmerId: data.farmerId,
                    varietyId: data.varietyId,
                },
                orderBy: { bagNo: 'desc' },
                select: { bagNo: true },
            })
            const nextBagNo = (lastBag?.bagNo ?? 0) + 1

            return await tx.stock.create({
                data: {
                    category: 'MISC_GRAIN',
                    sourceType: data.sourceType,
                    rawWeightKg: hasVendorAndRaw ? data.rawWeightKg : null,
                    millingVendor: hasVendorAndRaw ? data.millingVendor.trim() : null,
                    productionYear: data.productionYear,
                    bagNo: nextBagNo,
                    weightKg: data.weightKg,
                    incomingDate: data.incomingDate,
                    farmerId: data.farmerId,
                    varietyId: data.varietyId,
                    actualFarmer: data.actualFarmer?.trim() || null,
                    status: 'AVAILABLE',
                    lotNo,
                },
            })
        })

        const sourceLabel =
            data.sourceType === 'CONSIGNMENT' ? '도정위탁'
                : data.sourceType === 'GERMINATION' ? '발아위탁'
                    : '농가도정'

        await recordAuditLog({
            action: 'CREATE',
            entity: 'Stock',
            entityId: stock.id,
            details: data,
            description: `잡곡 입고(${sourceLabel}): ${variety.name} (${data.weightKg}kg)`,
        })

        revalidatePath('/raw-stocks')
        return { success: true, data: stock }
    } catch (error) {
        console.error('Failed to create misc stock:', error)
        return { success: false, error: sanitizeErrorMessage(error, '잡곡 입고 등록에 실패했습니다.') }
    }
}

// -----------------------------
// UPDATE — 잡곡 입고 수정
// -----------------------------
export async function updateMiscStock(id: number, input: MiscStockFormData) {
    await requireSession()
    try {
        const data = MiscStockFormSchema.parse(input)

        const variety = await prisma.variety.findUnique({
            where: { id: data.varietyId },
            select: { id: true, name: true, category: true, type: true },
        })
        if (!variety) throw new Error('품종을 찾을 수 없습니다.')
        if (variety.category !== 'MISC_GRAIN') {
            throw new Error(`잡곡 품종이 아닙니다: ${variety.name}`)
        }

        const current = await prisma.stock.findUnique({
            where: { id },
            select: {
                id: true,
                category: true,
                status: true,
                bagNo: true,
                productionYear: true,
                farmerId: true,
                varietyId: true,
                incomingDate: true,
            },
        })
        if (!current) throw new Error('재고를 찾을 수 없습니다.')
        if (current.category !== 'MISC_GRAIN') {
            throw new Error('잡곡 재고가 아닙니다.')
        }
        if (current.status !== 'AVAILABLE') {
            throw new Error('보관중 상태가 아닌 잡곡 재고는 수정할 수 없습니다.')
        }

        const hasVendorAndRaw = data.sourceType === 'CONSIGNMENT' || data.sourceType === 'GERMINATION'

        // 로트 영향 필드 변경 시 재생성
        const lotShouldRegen =
            data.incomingDate.getTime() !== current.incomingDate.getTime()
            || data.farmerId !== current.farmerId
            || data.varietyId !== current.varietyId

        const newLotNo = lotShouldRegen
            ? await deriveLotNo(data.incomingDate, data.farmerId, data.varietyId)
            : undefined

        const updated = await prisma.stock.update({
            where: { id },
            data: {
                sourceType: data.sourceType,
                rawWeightKg: hasVendorAndRaw ? data.rawWeightKg : null,
                millingVendor: hasVendorAndRaw ? data.millingVendor.trim() : null,
                productionYear: data.productionYear,
                weightKg: data.weightKg,
                incomingDate: data.incomingDate,
                farmerId: data.farmerId,
                varietyId: data.varietyId,
                actualFarmer: data.actualFarmer?.trim() || null,
                ...(newLotNo !== undefined && { lotNo: newLotNo }),
                // bagNo는 자동 부여된 값을 그대로 유지 (수정 시 재할당 안 함)
            },
        })

        await recordAuditLog({
            action: 'UPDATE',
            entity: 'Stock',
            entityId: id,
            details: { input: data },
            description: `잡곡 입고 수정: ${variety.name} (${data.weightKg}kg)`,
        })

        revalidatePath('/raw-stocks')
        return { success: true, data: updated }
    } catch (error) {
        console.error('Failed to update misc stock:', error)
        return { success: false, error: sanitizeErrorMessage(error, '잡곡 입고 수정에 실패했습니다.') }
    }
}

// -----------------------------
// DELETE — 잡곡 입고 삭제 (CONSUMED 또는 포장 연결 시 거절)
// -----------------------------
export async function deleteMiscStock(id: number) {
    await requireSession()
    try {
        const current = await prisma.stock.findUnique({
            where: { id },
            select: {
                id: true,
                category: true,
                status: true,
                _count: { select: { outputPackages: true } },
            },
        })
        if (!current) throw new Error('재고를 찾을 수 없습니다.')
        if (current.category !== 'MISC_GRAIN') {
            throw new Error('잡곡 재고가 아닙니다.')
        }
        if (current.status === 'CONSUMED' || current._count.outputPackages > 0) {
            throw new Error('이미 포장된 잡곡 재고는 삭제할 수 없습니다.')
        }

        const deleted = await prisma.stock.delete({
            where: { id },
            include: { variety: true, farmer: true },
        })

        await recordAuditLog({
            action: 'DELETE',
            entity: 'Stock',
            entityId: id,
            description: `잡곡 입고 삭제: ${deleted.farmer.name} - ${deleted.variety.name} (${deleted.weightKg}kg)`,
        })

        revalidatePath('/raw-stocks')
        return { success: true }
    } catch (error) {
        console.error('Failed to delete misc stock:', error)
        return { success: false, error: sanitizeErrorMessage(error, '잡곡 입고 삭제에 실패했습니다.') }
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
                outputPackages: { select: { totalWeight: true } },
            },
        })

        // 각 stock의 잔량(재고) 계산: stock.weightKg - sum(outputPackages.totalWeight)
        // 별도 DB 컬럼 없이 매 조회 시 재산출 — 등록·수정·삭제 모두 자동 반영
        const withRemaining = stocks.map(({ outputPackages, ...rest }) => {
            const consumed = outputPackages.reduce((sum, p) => sum + p.totalWeight, 0)
            const remainingKg = Math.max(0, rest.weightKg - consumed)
            return { ...rest, remainingKg }
        })

        return { success: true, data: withRemaining }
    } catch (error) {
        console.error('Failed to get misc stocks:', error)
        return { success: false, error: '잡곡 재고 조회에 실패했습니다.' }
    }
}

// -----------------------------
// 그룹 메타 타입 (클라이언트 그룹핑 결과)
// 잡곡은 데이터 규모가 작아 일괄 fetch + 클라이언트 그룹핑(생산자 패턴) 채택.
// 서버 그룹핑/펼침 액션(getMiscStockGroups/getMiscStocksByGroup)은 제거됨.
// -----------------------------
export type MiscStockGroup = {
    key: string
    year: number
    variety: string
    certType: string
    totalWeight: number      // 입고 합계 (kg)
    remainingTotal: number   // 재고(잔량) 합계 (kg)
    count: number
    farmerSetSize: number
    items: any[]
}

// -----------------------------
// 헬퍼 쿼리: 도정업체 자동완성 (sourceType=CONSIGNMENT)
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
// 헬퍼 쿼리: 발아업체 자동완성 (sourceType=GERMINATION)
// -----------------------------
export async function getSproutingVendors() {
    await requireSession()
    try {
        const rows = await prisma.stock.findMany({
            where: {
                category: 'MISC_GRAIN',
                sourceType: 'GERMINATION',
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
        console.error('Failed to get sprouting vendors:', error)
        return { success: false, error: '발아업체 목록 조회에 실패했습니다.' }
    }
}

// -----------------------------
// 헬퍼 쿼리: 잡곡 품종 목록 (category=MISC_GRAIN, type≠PURCHASED)
// 매입 전용 품종(type='PURCHASED')은 잡곡 입고 화면에 노출되지 않도록 제외 (#8 격리 정책)
// -----------------------------
export async function getMiscVarieties() {
    await requireSession()
    try {
        const varieties = await prisma.variety.findMany({
            where: { category: 'MISC_GRAIN', type: { not: 'PURCHASED' } },
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

// -----------------------------
// 잡곡 원물재고 엑셀 다운로드 (#10)
// 현재 활성 필터 적용. 업로드는 본 단계 범위 외.
// -----------------------------

const MISC_SOURCE_LABEL: Record<string, string> = {
    CONSIGNMENT: '도정위탁',
    FARMER_MILLED: '농가도정',
    GERMINATION: '발아위탁',
}

const MISC_EXPORT_HEADERS = [
    '입고일자', '생산년도', '생산자', '농가명', '작목반', '인증구분',
    '품종', '일련번호', '입고유형', '원물중량(kg)', '입고중량(kg)', '수율(%)',
    '위탁업체', '로트번호', '상태',
] as const

export async function exportMiscStocks(
    params?: GetMiscStocksParams,
): Promise<
    { success: true; data: string; fileName: string } | { success: false; error: string }
> {
    await requireSession()
    try {
        const where = buildMiscWhere(params)

        const stocks = await prisma.stock.findMany({
            where,
            include: {
                farmer: { include: { group: true } },
                variety: true,
            },
            orderBy: [{ productionYear: 'desc' }, { incomingDate: 'desc' }, { id: 'desc' }],
        })

        const rows = stocks.map(s => ({
            '입고일자': s.incomingDate ? s.incomingDate.toISOString().slice(0, 10) : '',
            '생산년도': s.productionYear,
            '생산자': s.farmer.name,
            '농가명': s.actualFarmer ?? '',
            '작목반': s.farmer.group?.name ?? '',
            '인증구분': s.farmer.group?.certType ?? '일반',
            '품종': s.variety.name,
            '일련번호': s.bagNo,
            '입고유형': s.sourceType ? (MISC_SOURCE_LABEL[s.sourceType] ?? s.sourceType) : '',
            '원물중량(kg)': s.rawWeightKg ?? '',
            '입고중량(kg)': s.weightKg,
            '수율(%)':
                s.sourceType === 'CONSIGNMENT' && s.rawWeightKg && s.rawWeightKg > 0
                    ? +((s.weightKg / s.rawWeightKg) * 100).toFixed(1)
                    : '',
            '위탁업체': s.millingVendor ?? '',
            '로트번호': s.lotNo ?? '',
            '상태': s.status === 'AVAILABLE' ? '보관중' : s.status === 'CONSUMED' ? '소진됨' : s.status,
        }))

        const worksheet =
            rows.length === 0
                ? XLSX.utils.aoa_to_sheet([[...MISC_EXPORT_HEADERS]])
                : XLSX.utils.json_to_sheet(rows)

        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'MiscStocks')

        const buf = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' })

        await recordAuditLog({
            action: 'EXPORT',
            entity: 'Stock',
            description: `잡곡 원물재고 엑셀 다운로드 (${rows.length}건)`,
        })

        return {
            success: true,
            data: buf,
            fileName: `misc_stock_list_${new Date().toISOString().slice(0, 10)}.xlsx`,
        }
    } catch (error) {
        console.error('[exportMiscStocks] failed:', error)
        return { success: false, error: '엑셀 다운로드에 실패했습니다.' }
    }
}
