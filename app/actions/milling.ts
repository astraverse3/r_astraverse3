'use server'

import { PrismaClient, Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'
import { getProductCode, generateLotNo } from '@/lib/lot-generation'
import { recordAuditLog } from '@/lib/audit'
import { requirePermission, requireSession } from '@/lib/auth-guard'
import { sanitizeErrorMessage } from '@/lib/error-sanitize'
import { findOrCreateProductType } from '@/lib/product-type'
import { matchesYieldFilter } from '@/lib/milling-yield'
import { MILLED_OUTPUTS, MILLED_OUTPUT_ONLY } from '@/lib/batch-outputs'
import { diffPackaging, formatPackagingDiffErrors, type PackagingLine } from '@/lib/packaging-diff'
import { movedCountOf, MOVEMENT_COUNT_SELECT } from '@/lib/package-available'

// 도정산 SKU 연동 sentinel.
// - 잔량: 자체 판매 안 함(재포장 소진) → SKU 미부여(productTypeId=null 유지).
// - 톤백: 규격은 '톤백'이고 포장지도 '톤백' Packaging으로 강제(규격명과 동명이나 별개 필드).
const PACKAGE_TYPE_REMAINDER = '잔량'
const PACKAGE_TYPE_TONBAG = '톤백'
const TONBAG_PACKAGING = '톤백'

// Updated to match new schema relations
export type MillingBatchFormData = {
    id?: number
    date: Date
    remarks?: string
    millingType: string
    totalInputKg: number
    selectedStockIds: number[]
}

export type MillingOutputInput = {
    /**
     * 서버 행(MillingOutputPackage) id. 다이얼로그가 기존 행을 복원하면 실려 온다.
     * 있으면 그 행을 고치고, 없으면 새로 만든다 — 전부 지웠다 다시 만들지 않는다 (결정 #62).
     */
    id?: number
    packageType: string
    weightPerUnit: number
    count: number
    totalWeight: number
    stockId?: number
    /** 라인별 포장지(SKU 매칭키). 잔량은 없음(null), 톤백은 '톤백' 고정, 그 외 기본/선택값. */
    packagingId?: number | null
}





export async function startMillingBatch(data: MillingBatchFormData) {
    await requirePermission('OPERATION_MANAGE')
    try {
        const result = await prisma.$transaction(async (tx) => {
            // 0. Update Mode Check
            if (data.id) {
                // --- UPDATE Logic ---
                const batch = await tx.millingBatch.findUnique({
                    where: { id: data.id },
                    include: { stocks: true }
                })
                if (!batch) throw new Error('Batch not found')
                if (batch.isClosed) throw new Error('Batch is closed')

                // Update Batch Metadata
                await tx.millingBatch.update({
                    where: { id: data.id },
                    data: {
                        date: data.date,
                        remarks: data.remarks?.trim(),
                        millingType: data.millingType,
                        totalInputKg: data.totalInputKg // Updated Input Weight
                    }
                })

                // Stocks Handling
                const currentStockIds = batch.stocks.map(s => s.id)
                const newStockIds = data.selectedStockIds

                // 1. Removed Stocks -> Set to AVAILABLE
                const removedIds = currentStockIds.filter(id => !newStockIds.includes(id))
                if (removedIds.length > 0) {
                    await tx.stock.updateMany({
                        where: { id: { in: removedIds } },
                        data: { status: 'AVAILABLE', batchId: null }
                    })
                }

                // 2. New Stocks -> Check Availability & Set to CONSUMED
                const addedIds = newStockIds.filter(id => !currentStockIds.includes(id))
                if (addedIds.length > 0) {
                    const newStocks = await tx.stock.findMany({ where: { id: { in: addedIds } } })
                    const unavailable = newStocks.find(s => s.status !== 'AVAILABLE')
                    if (unavailable) throw new Error(`Stock ${unavailable.bagNo} is not available`)

                    await tx.stock.updateMany({
                        where: { id: { in: addedIds } },
                        data: { status: 'CONSUMED', batchId: data.id }
                    })
                }

                // 3. Ensure kept stocks are linked (redundant but safe) needed? 
                // Existing links persist. We just updated status of broken ones.

                const updated = await tx.millingBatch.findUnique({ where: { id: data.id } })

                await recordAuditLog({
                    action: 'UPDATE',
                    entity: 'MillingBatch',
                    entityId: data.id,
                    details: data,
                    description: `도정 작업 정보 수정: ${data.id}번 작업 (${data.millingType})`
                })

                return updated
            } else {
                // --- CREATE Logic (Original) ---
                // 1. Validate stocks
                const stocks = await tx.stock.findMany({
                    where: { id: { in: data.selectedStockIds } },
                    include: { batch: { select: { isClosed: true } } }
                })

                if (stocks.length !== data.selectedStockIds.length) {
                    throw new Error('일부 재고를 찾을 수 없습니다.')
                }

                const alreadyUsed = stocks.find(s => s.status !== 'AVAILABLE')
                if (alreadyUsed) {
                    throw new Error(`포대 ${alreadyUsed.bagNo}번은 이미 도정 또는 출고된 상태입니다.`)
                }

                // 2. Create Batch
                const newBatch = await tx.millingBatch.create({
                    data: {
                        date: data.date,
                        remarks: data.remarks?.trim(),
                        millingType: data.millingType,
                        totalInputKg: data.totalInputKg,
                        stocks: {
                            connect: data.selectedStockIds.map(id => ({ id }))
                        }
                    }
                })

                await recordAuditLog({
                    action: 'CREATE',
                    entity: 'MillingBatch',
                    entityId: newBatch.id,
                    details: data,
                    description: `새 도정 작업 시작: ${data.millingType} (원곡 ${data.totalInputKg}kg)`
                })

                // 3. Update Stocks status
                await tx.stock.updateMany({
                    where: { id: { in: data.selectedStockIds } },
                    data: {
                        status: 'CONSUMED',
                        batchId: newBatch.id
                    }
                })

                return newBatch
            }
        })

        revalidatePath('/milling')
        revalidatePath('/raw-stocks')
        return { success: true, data: result }
    } catch (error) {
        console.error('Failed to start/update milling batch:', error)
        return { success: false, error: sanitizeErrorMessage(error, '도정 작업 처리에 실패했습니다.') }
    }
}

export type GetMillingLogsParams = {
    keyword?: string
    startDate?: Date
    endDate?: Date
    status?: string // 'milling' | 'packaging' | 'closed' | 'open'(legacy: milling+packaging) | 'active'(legacy alias of open) | 'completed'(legacy alias of closed)
    variety?: string // variety name search
    millingType?: string
    yieldRate?: string
    farmerName?: string
}

export async function getMillingLogs(params?: GetMillingLogsParams) {
    await requireSession()
    try {
        const where: any = {}

        if (params?.startDate && params?.endDate) {
            where.date = {
                gte: params.startDate,
                lte: params.endDate
            }
        }

        // Status filter — 3단계 (도정중/포장중/마감됨) + legacy alias
        if (params?.status) {
            if (params.status === 'milling') {
                where.isClosed = false
                where.outputs = { none: {} }
            } else if (params.status === 'packaging') {
                where.isClosed = false
                where.outputs = { some: {} }
            } else if (params.status === 'closed' || params.status === 'completed') {
                where.isClosed = true
            } else if (params.status === 'open' || params.status === 'active') {
                // legacy: 마감 안 된 모든 작업 (도정중 + 포장중)
                where.isClosed = false
            }
        }

        // Milling Type filter: 콤마 구분 멀티값 지원
        if (params?.millingType) {
            const types = params.millingType.split(',').map(s => s.trim()).filter(Boolean)
            if (types.length === 1) {
                where.millingType = types[0]
            } else if (types.length > 1) {
                where.millingType = { in: types }
            }
        }

        const andConditions: any[] = []

        // Variety filter: 콤마 구분 멀티값 지원 (OR 조건)
        if (params?.variety) {
            const varieties = params.variety.split(',').map(s => s.trim()).filter(Boolean)
            if (varieties.length === 1) {
                andConditions.push({
                    stocks: { some: { variety: { name: { contains: varieties[0] } } } }
                })
            } else if (varieties.length > 1) {
                andConditions.push({
                    OR: varieties.map(v => ({
                        stocks: { some: { variety: { name: { contains: v } } } }
                    }))
                })
            }
        }

        // Farmer Name filter: 콤마 구분 다중 생산자 검색 (OR 조건)
        if (params?.farmerName) {
            const names = params.farmerName.split(',').map(s => s.trim()).filter(Boolean)
            if (names.length === 1) {
                andConditions.push({
                    stocks: { some: { farmer: { name: { contains: names[0] } } } }
                })
            } else if (names.length > 1) {
                andConditions.push({
                    OR: names.map(n => ({
                        stocks: { some: { farmer: { name: { contains: n } } } }
                    }))
                })
            }
        }

        // Keyword filter
        if (params?.keyword) {
            // remarks OR stock.variety.name OR stock.farmer.name
            andConditions.push({
                OR: [
                    { remarks: { contains: params.keyword } },
                    {
                        stocks: {
                            some: {
                                OR: [
                                    { variety: { name: { contains: params.keyword } } },
                                    { farmer: { name: { contains: params.keyword } } }
                                ]
                            }
                        }
                    }
                ]
            })
        }

        if (andConditions.length > 0) {
            where.AND = andConditions
        }

        const logs = await prisma.millingBatch.findMany({
            where,
            include: {
                stocks: {
                    include: {
                        variety: true, // Need variety name
                        farmer: {
                            include: { group: true }
                        }
                    },
                    orderBy: [
                        { farmer: { name: 'asc' } },
                        { bagNo: 'asc' }
                    ]
                },
                // productType.packagingId는 다이얼로그 재진입 시 라인별 포장지 복원에 사용.
                // MILLED_OUTPUTS — 도정관리는 「이 배치에서 도정해 포장한 것」만 다룬다.
                // 재포장 결과가 섞이면 다이얼로그에 도정 포장인 척 복원되고, 수율 필터도
                // 오판정한다. 아래 updatePackagingLogs의 deleteMany와 반드시 같은 필터여야
                // 한다 — 한쪽만 걸면 안 보이는 행을 지우게 된다. (결정 #61)
                // 🔴 orderBy 필수 — 없으면 Postgres가 heap 물리 순서를 준다.
                // UPDATE는 MVCC라 새 튜플을 heap 끝에 쓰므로 **고친 줄만 맨 아래로 밀린다.**
                // 포장수정을 diff로 바꾸기 전(`d18487e`)에는 매 저장마다 전 행을 재생성해
                // 우연히 순서가 맞아 보였을 뿐이다. 만든 순서로 고정한다.
                outputs: {
                    ...MILLED_OUTPUTS,
                    orderBy: { id: 'asc' as const },
                    include: { productType: { select: { packagingId: true } } },
                }
            },
            orderBy: [
                { date: 'desc' },
                { id: 'desc' }
            ]
        })

        // Yield filter: 계산값이라 DB where로 못 걸러 post-query 필터. 미마감 배치는 제외.
        const filtered = params?.yieldRate && params.yieldRate !== 'ALL'
            ? logs.filter(batch => matchesYieldFilter(batch, params.yieldRate))
            : logs

        return { success: true, data: filtered }
    } catch (error) {
        console.error('Failed to get milling logs:', error)
        return { success: false, error: 'Failed to get milling logs' }
    }
}

// Helper: Remove stock from batch
export async function removeStockFromMilling(batchId: number, stockId: number) {
    await requirePermission('OPERATION_MANAGE')
    try {
        const result = await prisma.$transaction(async (tx) => {
            const batch = await tx.millingBatch.findUnique({ where: { id: batchId }, include: { stocks: true } });
            if (!batch) throw new Error('Batch not found');
            if (batch.isClosed) throw new Error('Batch is closed');

            // Set stock back to AVAILABLE and unlink
            await tx.stock.update({
                where: { id: stockId },
                data: {
                    status: 'AVAILABLE',
                    batchId: null
                }
            });

            // 남은 stocks 합산해서 totalInputKg 업데이트
            const remaining = await tx.stock.findMany({
                where: { batchId },
                select: { weightKg: true }
            })
            const newTotalKg = remaining.reduce((sum, s) => sum + s.weightKg, 0)
            await tx.millingBatch.update({
                where: { id: batchId },
                data: { totalInputKg: newTotalKg }
            })

            return { success: true };
        });
        revalidatePath('/milling')
        return result;
    } catch (error) {
        console.error('Failed to remove stock:', error);
        return { success: false, error: 'Failed to remove stock' };
    }
}

export async function addPackagingLog(batchId: number, data: MillingOutputInput) {
    await requirePermission('OPERATION_MANAGE')
    try {
        // Fetch Batch and related Stock info for LOT NUMBER GENERATION
        const batch = await prisma.millingBatch.findUnique({
            where: { id: batchId },
            include: {
                stocks: {
                    include: {
                        variety: true,
                        farmer: {
                            include: { group: true }
                        }
                    }
                }
            }
        });

        if (!batch) throw new Error('Batch not found')

        // --- LOT NUMBER GENERATION LOGIC ---
        // 1. Find matching stock or fallback to primary stock
        const targetStock = batch.stocks.find(s => s.id === data.stockId) || batch.stocks[0];
        if (!targetStock) throw new Error('No stock linked to this batch');

        const productCode = getProductCode(targetStock.variety.type, targetStock.variety.name, batch.millingType);

        // Use helper to generate Lot No consistent with Stock logic
        // 관행(일반) 생산자는 로트번호 없음
        const isConventional = targetStock.farmer.group?.certType === '일반';
        const lotNo = isConventional ? null : generateLotNo({
            incomingDate: targetStock.incomingDate,
            varietyType: targetStock.variety.type,
            varietyName: targetStock.variety.name,
            millingType: batch.millingType,
            certNo: targetStock.farmer.group?.certNo || '00',
            farmerGroupCode: targetStock.farmer.group?.code || '00',
            farmerNo: targetStock.farmer.farmerNo || '00'
        });
        // -----------------------------------

        const output = await prisma.millingOutputPackage.create({
            data: {
                batchId,
                packageType: data.packageType,
                weightPerUnit: data.weightPerUnit,
                count: data.count,
                totalWeight: data.totalWeight,
                productCode, // Save derived code
                lotNo,       // Save generated LOT
                stockId: targetStock.id,
            }
        })

        await recordAuditLog({
            action: 'CREATE',
            entity: 'MillingOutputPackage',
            entityId: output.id,
            details: data,
            description: `도정 생산품 등록: ${data.packageType} ${data.weightPerUnit}kg x ${data.count}`
        })

        revalidatePath('/milling')
        return { success: true, data: output }
    } catch (error) {
        console.error('Failed to add packaging log:', error)
        return { success: false, error: sanitizeErrorMessage(error, '포장 기록 추가에 실패했습니다.') }
    }
}

/**
 * 배치 하나의 도정 포장 행을 **지금 시점으로** 다시 읽는다 (2026-09-02, P3).
 *
 * 포장 다이얼로그는 원래 페이지가 로드될 때 받은 스냅샷(`initialOutputs`)만 보고 있었다.
 * 그래서 탭을 켜둔 채 두면 화면이 낡고, 그 상태로 저장하면 화면에 없던 행을
 * `diffPackaging`이 「사용자가 지운 것」으로 읽어 조용히 삭제했다 — 2026-09-01 사고의 원인이다.
 * 동시에 열어둘 필요도 없다. 탭 하나만 오래 켜두면 성립한다.
 *
 * 🔴 select·필터·정렬은 `getMillingLogs`의 `outputs`와 **정확히 같아야 한다**.
 * 어긋나면 화면에 없는 행을 지우게 된다 (결정 #61이 경고한 그것).
 */
export async function getBatchOutputs(batchId: number) {
    await requireSession()
    try {
        const outputs = await prisma.millingOutputPackage.findMany({
            where: { batchId, ...MILLED_OUTPUT_ONLY },
            orderBy: { id: 'asc' },
            select: {
                id: true,
                packageType: true,
                weightPerUnit: true,
                count: true,
                totalWeight: true,
                stockId: true,
                productType: { select: { packagingId: true } },
            },
        })
        return { success: true as const, data: outputs }
    } catch (error) {
        console.error('Failed to get batch outputs:', error)
        return { success: false as const, error: '포장 내역을 불러오지 못했습니다.' }
    }
}

/** 감사 스냅샷에 필요한 필드만. 실제 조회 결과는 이보다 넓다(구조적 타입). */
type PackagingAuditRow = {
    id: number
    packageType: string
    weightPerUnit: number
    count: number
    totalWeight: number
    stockId: number | null
    lotNo: string | null
    productCode: string | null
    productTypeId: number | null
}

/**
 * 포장 줄 하나를 로그에 남길 만큼만 추린다.
 * 입력 줄(`PackagingLine`)과 기존 행(`PackagingAuditRow`)을 함께 받는다 —
 * 기존 행의 stockId는 nullable이라 `PackagingLine`을 그대로 쓸 수 없다.
 */
const auditLine = (l: {
    packageType: string
    weightPerUnit: number
    count: number
    totalWeight: number
    stockId: number | null
}) => ({
    packageType: l.packageType,
    weightPerUnit: l.weightPerUnit,
    count: l.count,
    totalWeight: l.totalWeight,
    stockId: l.stockId,
})

/**
 * 포장 수정 감사 스냅샷을 만든다 — **삭제를 실행하기 전에** 불러야 한다.
 *
 * 2026-09-01 사고: 배치 #222에서 저장된 포장 행이 사라졌는데 `updatePackagingLogs`가
 * 로그를 하나도 남기지 않아 누가·언제·무엇을 지웠는지 흔적이 0이었다. 결번(id 시퀀스)으로
 * 역추적하는 것 말곤 방법이 없었다.
 * → 삭제 행은 **되살릴 수 있을 만큼** 통째로 남긴다(lotNo·productCode·productTypeId 포함).
 */
function buildPackagingAudit(
    rows: PackagingAuditRow[],
    diff: { toCreate: PackagingLine[]; toUpdate: { id: number; line: PackagingLine }[]; toDelete: number[] },
) {
    const deleteSet = new Set(diff.toDelete)
    const byId = new Map(rows.map(r => [r.id, r]))
    return {
        created: diff.toCreate.map(auditLine),
        updated: diff.toUpdate.map(u => ({
            id: u.id,
            before: byId.has(u.id) ? auditLine(byId.get(u.id)!) : null,
            after: auditLine(u.line),
        })),
        // 🔴 복구용 — 규격·단중·개수·총중량뿐 아니라 로트까지 남겨야 되살릴 수 있다.
        deleted: rows.filter(r => deleteSet.has(r.id)).map(r => ({
            ...auditLine(r),
            id: r.id,
            lotNo: r.lotNo,
            productCode: r.productCode,
            productTypeId: r.productTypeId,
        })),
    }
}

// 포장 내역 수정 — 입력에 실려온 행 id로 diff를 내어 create·update·delete로 반영한다 (결정 #62).
//
// 예전에는 deleteMany 후 전부 재생성했다. PackageMovement(판매·재포장)·Repack이 이 행을
// 참조하기 시작하면서 FK(onDelete 기본 Restrict)에 걸려 저장이 통째로 실패했고(실측 16/181 배치),
// 성공하더라도 행 id와 createdAt이 매번 새로 잡혀 이력과 참조가 우연에 기댔다.
//
// 판정·검증은 lib/packaging-diff.ts(순수 함수 · 단위테스트)가 하고, 여기서는 실행만 한다.
// baselineIds — 다이얼로그가 **열릴 때 받은** 행 id 집합 (P4 · 2026-09-01 사고).
// 「화면에서 지운 행」과 「열린 뒤 남이 추가해 뜬 적 없는 행」을 가르는 유일한 정보다.
// 🔴 선택 인자로 두지 않는다 — undefined면 옛 동작으로 빠져 구멍이 그대로 남는다.
export async function updatePackagingLogs(batchId: number, outputs: MillingOutputInput[], baselineIds: number[]) {
    await requirePermission('OPERATION_MANAGE')
    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Fetch Batch and Stock info for LOT generation
            const batch = await tx.millingBatch.findUnique({
                where: { id: batchId },
                include: {
                    stocks: {
                        include: { variety: true, farmer: { include: { group: true } } }
                    }
                }
            });
            if (!batch || !batch.stocks.length) throw new Error('Batch or stocks not found');

            // 마감된 배치는 고칠 수 없다. 다른 액션들은 이미 막고 있는데(:65 · :340 · :857)
            // 여기만 체크가 없었다 — 2026-09-01 결번 `1368`은 마감(16:02:56) **이후**에
            // 발급됐다. 즉 마감된 배치에 저장이 들어갔다는 뜻이다.
            //
            // ⚠️ 마감 흐름(handleCloseBatch)은 「저장 → 마감」 순서라 저장 시점엔 아직
            // 미마감이다. 마감 해제 후 수정도 isClosed=false라 통과한다. 둘 다 영향 없다.
            //
            // throw가 아니라 이유를 돌려준다 — 도메인 차단은 장애가 아니다 (결정 #63).
            if (batch.isClosed) {
                return {
                    success: false as const,
                    error: '마감된 작업입니다. 마감을 해제한 뒤 수정해 주세요.',
                    errors: [],
                    conflict: undefined,
                };
            }

            const primaryStock = batch.stocks[0];
            const resolveStock = (stockId?: number | null) =>
                (stockId ? batch.stocks.find(s => s.id === stockId) : undefined) ?? primaryStock;

            // 2. 톤백 포장지 sentinel — 톤백 라인이 있을 때만 조회.
            // diff 전에 정규화해야 기존 행의 productType.packagingId와 같은 값끼리 맞댈 수 있다.
            let tonbagPackagingId: number | null = null;
            if (outputs.some(o => o.packageType === PACKAGE_TYPE_TONBAG)) {
                const pkg = await tx.packaging.findUnique({
                    where: { name: TONBAG_PACKAGING },
                    select: { id: true },
                });
                if (!pkg) throw new Error("'톤백' 포장지 마스터가 없습니다. 제품유형 시드를 확인해주세요.");
                tonbagPackagingId = pkg.id;
            }

            // 잔량=SKU 미부여(null), 톤백='톤백' 포장지 강제, 그 외=라인 포장지(미선택 허용).
            const normalizePackagingId = (o: MillingOutputInput): number | null => {
                if (o.packageType === PACKAGE_TYPE_REMAINDER) return null;
                if (o.packageType === PACKAGE_TYPE_TONBAG) return tonbagPackagingId;
                return o.packagingId ?? null;
            };

            const lines: PackagingLine[] = outputs.map(o => ({
                id: o.id,
                packageType: o.packageType,
                weightPerUnit: o.weightPerUnit,
                count: o.count,
                totalWeight: o.totalWeight,
                stockId: resolveStock(o.stockId).id,
                packagingId: normalizePackagingId(o),
            }));

            // 3. 기존 행 + 차감량.
            // MILLED_OUTPUT_ONLY — 재포장 결과는 이 배치의 batchId를 승계했을 뿐 도정 포장이 아니다.
            // 위 getMillingLogs의 로드 필터와 반드시 짝이 맞아야 한다 — 한쪽만 걸면
            // 화면에 없는 행을 지우거나 고치게 된다. (결정 #61)
            const rows = await tx.millingOutputPackage.findMany({
                where: { batchId, ...MILLED_OUTPUT_ONLY },
                select: {
                    id: true,
                    packageType: true,
                    weightPerUnit: true,
                    count: true,
                    totalWeight: true,
                    stockId: true,
                    productType: { select: { packagingId: true } },
                    ...MOVEMENT_COUNT_SELECT,
                    // 아래 3개는 diff가 쓰지 않는다 — **삭제 감사로그의 복구용 스냅샷**이다.
                    // 지우기 전에 남겨두지 않으면 되살릴 근거가 없다 (2026-09-01 사고).
                    lotNo: true,
                    productCode: true,
                    productTypeId: true,
                },
            });

            const diff = diffPackaging(
                rows.map(r => ({
                    id: r.id,
                    packageType: r.packageType,
                    weightPerUnit: r.weightPerUnit,
                    count: r.count,
                    totalWeight: r.totalWeight,
                    stockId: r.stockId,
                    packagingId: r.productType?.packagingId ?? null,
                    movedCount: movedCountOf(r),
                })),
                lines,
                baselineIds,
            );

            // 차단은 도메인 규칙이지 장애가 아니다 — 아직 아무것도 쓰지 않았으므로
            // 그대로 돌려보내 사용자에게 「왜 막혔는지」를 보여준다. (결정 #63)
            if (!diff.ok) {
                // errors는 감사로그용이다 — 「저장이 안 된다」 제보를 다음엔 로그로 확인하려면
                // 무엇이 막았는지가 남아 있어야 한다. 밖에서 벗겨내고 클라이언트엔 안 준다.
                //
                // conflict — 낡은 화면이면 **서버 최신 행을 함께 돌려준다** (P4).
                // 🔴 화면이 이걸로 남의 줄을 합쳐 보여줘야 「한 번 확인」으로 끝난다.
                //    이게 없으면 거부가 곧 재입력 강요가 되고, 그게 2026-09-01 사고 후반부다.
                const stale = diff.errors.some(e => e.code === 'STALE_BASELINE');
                return {
                    success: false as const,
                    error: formatPackagingDiffErrors(diff.errors),
                    errors: diff.errors,
                    conflict: stale ? rows.map(r => ({
                        id: r.id,
                        packageType: r.packageType,
                        weightPerUnit: r.weightPerUnit,
                        count: r.count,
                        totalWeight: r.totalWeight,
                        stockId: r.stockId,
                        productType: r.productType,
                    })) : undefined,
                };
            }

            // 파생 필드 계산 — create·update가 공유한다 (#65)
            const deriveLot = (stockId: number) => {
                const stock = resolveStock(stockId);
                // 관행(일반) 생산자는 로트번호 없음
                const isConventional = stock.farmer.group?.certType === '일반';
                return {
                    productCode: getProductCode(stock.variety.type, stock.variety.name, batch.millingType),
                    lotNo: isConventional ? null : generateLotNo({
                        incomingDate: stock.incomingDate,
                        varietyType: stock.variety.type,
                        varietyName: stock.variety.name,
                        millingType: batch.millingType,
                        certNo: stock.farmer.group?.certNo || '00',
                        farmerGroupCode: stock.farmer.group?.code || '00',
                        farmerNo: stock.farmer.farmerNo || '00'
                    }),
                };
            };

            // 한 배치는 대개 품종·도정유형이 같고 규격만 다르다 — 조합별로 한 번만 찾아
            // 왕복이 줄 수만큼 늘지 않게 한다.
            const productTypeCache = new Map<string, number | null>();
            const resolveProductType = async (line: PackagingLine): Promise<number | null> => {
                if (line.packageType === PACKAGE_TYPE_REMAINDER) return null;
                // 포장지가 정해진 라인만 SKU 연동(미선택 일반 라인은 null 허용).
                if (line.packagingId === null) return null;
                const stock = resolveStock(line.stockId);
                const key = `${stock.varietyId}|${line.packageType}|${line.packagingId}`;
                const cached = productTypeCache.get(key);
                if (cached !== undefined) return cached;
                const productTypeId = await findOrCreateProductType(tx, {
                    varietyId: stock.varietyId,
                    millingType: batch.millingType,
                    packageType: line.packageType,
                    packagingId: line.packagingId,
                    promoteDefaultIfNone: true,
                });
                productTypeCache.set(key, productTypeId);
                return productTypeId;
            };

            // 🔴 감사 스냅샷은 **지우기 전에** 뜬다 — 지운 뒤엔 되살릴 근거가 없다.
            const audit = buildPackagingAudit(rows, diff);

            // 4. 삭제 — 차감이 없는 행만 diff가 넘긴다. 왕복 1회.
            if (diff.toDelete.length > 0) {
                await tx.millingOutputPackage.deleteMany({
                    where: { id: { in: diff.toDelete }, batchId, ...MILLED_OUTPUT_ONLY },
                });
            }

            // 5. 수정 — 바뀐 줄만 온다. 안 바뀐 줄은 id·createdAt이 그대로 남는다 (#65).
            for (const update of diff.toUpdate) {
                const data: Prisma.MillingOutputPackageUncheckedUpdateInput = {
                    packageType: update.line.packageType,
                    weightPerUnit: update.line.weightPerUnit,
                    count: update.line.count,
                    totalWeight: update.line.totalWeight,
                };
                if (update.recalcLot) {
                    data.stockId = update.line.stockId;
                    Object.assign(data, deriveLot(update.line.stockId));
                }
                if (update.recalcProductType) {
                    data.productTypeId = await resolveProductType(update.line);
                }
                await tx.millingOutputPackage.update({ where: { id: update.id }, data });
            }

            // 6. 추가 — INSERT는 왕복 1회로 묶는다.
            // (배송·상차 D1b 교훈: Neon 왕복 250~300ms라 루프 안 INSERT는 20줄에서 타임아웃)
            if (diff.toCreate.length > 0) {
                const created: Prisma.MillingOutputPackageCreateManyInput[] = [];
                for (const line of diff.toCreate) {
                    created.push({
                        batchId,
                        packageType: line.packageType,
                        weightPerUnit: line.weightPerUnit,
                        count: line.count,
                        totalWeight: line.totalWeight,
                        stockId: line.stockId,
                        ...deriveLot(line.stockId),
                        productTypeId: await resolveProductType(line),
                    });
                }
                await tx.millingOutputPackage.createMany({ data: created });
            }

            return { success: true as const, audit };
        }, { timeout: 30000 });

        // 감사로그 — 커밋된 뒤, 트랜잭션 **밖**에서 남긴다(lib/audit.ts는 자체 prisma를 쓴다).
        // 변경 0건도 남긴다 — 「저장했는데 아무것도 안 바뀌었다」 자체가 추적에 필요한 사실이다.
        if (result.success) {
            const { created, updated, deleted } = result.audit
            await recordAuditLog({
                action: 'UPDATE',
                entity: 'MillingOutputPackage',
                entityId: batchId,
                details: { batchId, created, updated, deleted },
                description: `도정 포장 수정: ${batchId}번 작업 — 추가 ${created.length} · 수정 ${updated.length} · 삭제 ${deleted.length}`,
            })
        } else {
            // 차단도 남긴다 — 2026-09-01 「저장이 반복 실패했다」를 다음엔 로그로 확인한다.
            await recordAuditLog({
                action: 'UPDATE',
                entity: 'MillingOutputPackage',
                entityId: batchId,
                details: { batchId, error: result.error, errors: result.errors },
                // 차단 사유는 여러 줄로 온다(결정 #63). 전문은 details에 있으니 요약만 남긴다.
                description: `도정 포장 수정 차단: ${batchId}번 작업 — ${result.error.split('\n')[0]}`,
            })
        }

        revalidatePath('/milling')
        // audit·errors는 로그용이라 클라이언트로 내보내지 않는다. conflict는 화면이 쓴다.
        return result.success
            ? { success: true as const }
            : { success: false as const, error: result.error, conflict: result.conflict }
    } catch (error) {
        console.error('Failed to update packaging logs:', error)
        return { success: false, error: sanitizeErrorMessage(error, '포장 기록 수정에 실패했습니다.') }
    }
}

export async function deletePackagingLog(outputId: number) {
    await requirePermission('OPERATION_MANAGE')
    try {
        const deleted = await prisma.millingOutputPackage.delete({
            where: { id: outputId }
        })

        await recordAuditLog({
            action: 'DELETE',
            entity: 'MillingOutputPackage',
            entityId: outputId,
            description: `도정 생산품 삭제: ${deleted.packageType} ${deleted.weightPerUnit}kg x ${deleted.count}`
        })

        revalidatePath('/milling')
        return { success: true }
    } catch (error) {
        console.error('Failed to delete packaging log:', error)
        return { success: false, error: 'Failed to delete packaging log' }
    }
}

export async function closeMillingBatch(batchId: number) {
    return updateMillingBatchStatus(batchId, true);
}

export async function reopenMillingBatch(batchId: number) {
    return updateMillingBatchStatus(batchId, false);
}

export async function updateMillingBatchStatus(batchId: number, isClosed: boolean) {
    await requirePermission('OPERATION_MANAGE')
    try {
        const batch = await prisma.millingBatch.findUnique({
            where: { id: batchId },
            select: { id: true, date: true, millingType: true, totalInputKg: true, isClosed: true, remarks: true }
        })

        await prisma.millingBatch.update({
            where: { id: batchId },
            data: { isClosed }
        })

        await recordAuditLog({
            action: 'UPDATE',
            entity: 'MillingBatch',
            entityId: batchId,
            details: {
                변경전: batch?.isClosed ? '마감' : '진행중',
                변경후: isClosed ? '마감' : '진행중',
                도정일: batch?.date ? batch.date.toISOString().split('T')[0] : null,
                도정구분: batch?.millingType,
                투입량: batch?.totalInputKg ? `${batch.totalInputKg}kg` : null,
                비고: batch?.remarks || null,
            },
            description: `도정 작업 상태 변경: ${isClosed ? '마감' : '진행'}`
        })

        revalidatePath('/milling')
        revalidatePath('/raw-stocks')
        return { success: true }
    } catch (error) {
        console.error('Failed to update status:', error)
        return { success: false, error: 'Failed to update status' }
    }
}

export async function deleteMillingBatch(batchId: number) {
    await requirePermission('OPERATION_MANAGE')
    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Check if safe to delete
            const batch = await tx.millingBatch.findUnique({
                where: { id: batchId },
                include: { stocks: true }
            })
            if (!batch) throw new Error('Batch not found');

            // 2. Revert Stock status to AVAILABLE
            await tx.stock.updateMany({
                where: { batchId },
                data: {
                    status: 'AVAILABLE',
                    batchId: null
                }
            });

            // 3. Delete outputs first (cascade might handle, but explicit is safer)
            // ⚠️ 여기는 일부러 MILLED_OUTPUT_ONLY를 쓰지 않는다 (결정 #61).
            // 배치를 통째로 없애는 자리라 재포장 결과만 남기면 batch 없는 고아가 된다.
            // 재포장 결과가 있으면 원본에 REPACK movement가 붙어 있어 PackageMovement의
            // FK(Restrict)가 이 삭제를 막는다 — 그 차단이 올바른 동작이다.
            await tx.millingOutputPackage.deleteMany({
                where: { batchId }
            });

            // 4. Delete batch
            await tx.millingBatch.delete({
                where: { id: batchId }
            });

            return { success: true };
        });

        await recordAuditLog({
            action: 'DELETE',
            entity: 'MillingBatch',
            entityId: batchId,
            description: `도정 작업 삭제: ${batchId}번 작업 (원곡 상태로 복구됨)`
        })

        revalidatePath('/milling')
        revalidatePath('/raw-stocks')
        return result
    } catch (error) {
        console.error('Failed to delete batch:', error)
        return { success: false, error: sanitizeErrorMessage(error, '도정 작업 삭제에 실패했습니다.') }
    }
}

export async function deleteMillingBatches(ids: number[]) {
    await requirePermission('OPERATION_MANAGE')
    try {
        const results = {
            success: [] as number[],
            failed: [] as { id: number; reason: string }[]
        }

        for (const id of ids) {
            const batch = await prisma.millingBatch.findUnique({
                where: { id },
                select: {
                    id: true,
                    date: true,
                    // ⚠️ 여기는 일부러 MILLED_OUTPUTS를 쓰지 않는다 (결정 #61).
                    // 이 카운트는 「포장이 하나라도 있으면 배치 삭제 금지」 판정이고,
                    // 통과하면 아래에서 batchId로 outputs를 통째로 지운다.
                    // 재포장 결과를 카운트에서 빼면 그것만 남은 배치가 삭제를 통과해
                    // 재포장 결과가 함께 지워진다 — 거르지 않는 쪽이 안전하다.
                    _count: {
                        select: { outputs: true }
                    }
                }
            })

            if (!batch) {
                results.failed.push({
                    id,
                    reason: `작업 ${id}: 찾을 수 없음`
                })
                continue
            }

            // Check if any packaging has been done
            if (batch._count.outputs > 0) {
                const dateStr = new Date(batch.date).toLocaleDateString('ko-KR')
                results.failed.push({
                    id,
                    reason: `${dateStr} 작업: 포장 진행되어 삭제 불가`
                })
                continue
            }

            try {
                await prisma.$transaction(async (tx) => {
                    // Revert stock status
                    await tx.stock.updateMany({
                        where: { batchId: id },
                        data: {
                            status: 'AVAILABLE',
                            batchId: null
                        }
                    })

                    // Delete outputs
                    await tx.millingOutputPackage.deleteMany({
                        where: { batchId: id }
                    })

                    // Delete batch
                    await tx.millingBatch.delete({
                        where: { id }
                    })
                })
                
                // 삭제 성공 시 활동 로그 기록
                await recordAuditLog({
                    action: 'DELETE',
                    entity: 'MillingBatch',
                    entityId: id,
                    description: `도정 작업 삭제: ${id}번 작업 (원곡 상태로 복구됨)`
                })

                results.success.push(id)
            } catch (error) {
                const dateStr = new Date(batch.date).toLocaleDateString('ko-KR')
                results.failed.push({
                    id,
                    reason: `${dateStr} 작업: 삭제 실패`
                })
            }
        }

        revalidatePath('/milling')
        revalidatePath('/raw-stocks')

        return {
            success: true,
            data: results
        }
    } catch (error) {
        console.error('Failed to delete milling batches:', error)
        return { success: false, error: 'Failed to delete milling batches' }
    }
}


export async function updateMillingBatchStocks(batchId: number, stockIds: number[]) {
    await requirePermission('OPERATION_MANAGE')
    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Validate Batch
            const batch = await tx.millingBatch.findUnique({
                where: { id: batchId },
                include: { stocks: true }
            })
            if (!batch) throw new Error('Batch not found')
            if (batch.isClosed) throw new Error('Batch is closed')

            // 2. Determine Removed Stocks -> Set to AVAILABLE
            const currentStockIds = batch.stocks.map(s => s.id)
            const remainingStockIds = currentStockIds.filter(id => stockIds.includes(id))
            const removedStockIds = currentStockIds.filter(id => !stockIds.includes(id))

            if (removedStockIds.length > 0) {
                await tx.stock.updateMany({
                    where: { id: { in: removedStockIds } },
                    data: {
                        status: 'AVAILABLE',
                        batchId: null
                    }
                })
            }

            // 3. Determine New Stocks -> Set to CONSUMED & Link
            // Note: existing stocks that are kept don't need update, but safe to re-link or just ensure they are fine.
            // But we need to update status of NEW stocks.
            const newStockIds = stockIds.filter(id => !currentStockIds.includes(id))

            if (newStockIds.length > 0) {
                // Verify new stocks are available
                const newStocks = await tx.stock.findMany({
                    where: { id: { in: newStockIds } }
                })
                const unavailable = newStocks.find(s => s.status !== 'AVAILABLE')
                if (unavailable) {
                    throw new Error(`Stock ${unavailable.bagNo} is not available`)
                }

                await tx.stock.updateMany({
                    where: { id: { in: newStockIds } },
                    data: {
                        status: 'CONSUMED',
                        batchId: batchId
                    }
                })
            }

            // 4. Recalculate Total Input Weight
            // We need weights of ALL final stocks.
            const allFinalStocks = await tx.stock.findMany({
                where: { id: { in: stockIds } }
            })
            const newTotalInputKg = allFinalStocks.reduce((sum, s) => sum + s.weightKg, 0)

            // 5. Update Batch
            const updatedBatch = await tx.millingBatch.update({
                where: { id: batchId },
                data: {
                    totalInputKg: newTotalInputKg
                }
            })

            return updatedBatch
        })

        revalidatePath('/milling')
        revalidatePath('/raw-stocks')
        return { success: true, data: result }
    } catch (error) {
        console.error('Failed to update milling batch stocks:', error)
        return { success: false, error: 'Failed to update batch stocks' }
    }
}

export async function updateMillingBatchMetadata(batchId: number, data: { date: Date, remarks: string, millingType?: string }) {
    await requirePermission('OPERATION_MANAGE')
    try {
        const updateData: any = {
            date: data.date,
            remarks: data.remarks.trim() || null,
        }
        if (data.millingType) {
            updateData.millingType = data.millingType
        }
        await prisma.millingBatch.update({
            where: { id: batchId },
            data: updateData
        })
        revalidatePath('/milling')
        return { success: true }
    } catch (error) {
        console.error('Failed to update milling batch metadata:', error)
        return { success: false, error: 'Failed to update' }
    }
}
