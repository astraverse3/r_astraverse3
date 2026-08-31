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
                outputs: {
                    ...MILLED_OUTPUTS,
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

// 포장 내역 수정 — 입력에 실려온 행 id로 diff를 내어 create·update·delete로 반영한다 (결정 #62).
//
// 예전에는 deleteMany 후 전부 재생성했다. PackageMovement(판매·재포장)·Repack이 이 행을
// 참조하기 시작하면서 FK(onDelete 기본 Restrict)에 걸려 저장이 통째로 실패했고(실측 16/181 배치),
// 성공하더라도 행 id와 createdAt이 매번 새로 잡혀 이력과 참조가 우연에 기댔다.
//
// 판정·검증은 lib/packaging-diff.ts(순수 함수 · 단위테스트)가 하고, 여기서는 실행만 한다.
export async function updatePackagingLogs(batchId: number, outputs: MillingOutputInput[]) {
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
            );

            // 차단은 도메인 규칙이지 장애가 아니다 — 아직 아무것도 쓰지 않았으므로
            // 그대로 돌려보내 사용자에게 「왜 막혔는지」를 보여준다. (결정 #63)
            if (!diff.ok) {
                return { success: false as const, error: formatPackagingDiffErrors(diff.errors) };
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

            return { success: true as const };
        }, { timeout: 30000 });

        revalidatePath('/milling')
        return result
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
