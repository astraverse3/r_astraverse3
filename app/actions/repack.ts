'use server'

// 재고 재포장 (결정 #43) — 분할·병합·규격변경을 하나의 액션으로.
//   계획서: docs/plan/plan-재고재포장.md
//
// 설계 핵심 — 가용재고 공식(count - SUM(movements.count))을 바꾸지 않는다.
//   소스 소진 = PackageMovement(type=REPACK) → 기존 공식이 자동 반영
//   결과 생성 = MillingOutputPackage(repackId)
//   Repack 이 둘을 묶는다
//
// ⚠️ 트랜잭션 안에서 루프 INSERT 금지 (배송·상차 D1b 교훈: Neon 왕복 250~300ms × N > 기본 5초).
//    createMany로 왕복을 고정하고 timeout을 30초로 늘린다.

import { z } from 'zod'
import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'
import { recordAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth-guard'
import { sanitizeErrorMessage } from '@/lib/error-sanitize'
import { findOrCreateProductType } from '@/lib/product-type'
import { availableOf, MOVEMENT_COUNT_SELECT } from '@/lib/package-available'
import {
    validateRepack,
    buildLotOptions,
    PACKAGE_TYPE_REMAINDER,
    PACKAGE_TYPE_TONBAG,
    type RepackSource,
    type RepackResultLine,
    type RepackError,
    type LotOption,
} from '@/lib/repack'

const TONBAG_PACKAGING = '톤백'
const MISC_MILLING_SENTINEL = '기타'
const TRANSACTION_TIMEOUT_MS = 30_000

// ------------------------------------------------------
// 공통 — 재고 행에서 동질성 키(품종·도정유형) 파생
//   MILLED + batch 있음(벼)        → batch.millingType, 품종 = stock.varietyId
//   MILLED + batch 없음(잡곡 도정산) → '기타',           품종 = stock.varietyId
//   PURCHASED(잡곡 매입)            → '기타',           품종 = package.varietyId
//   ※ 잔량은 productTypeId가 null이라 SKU로는 판정할 수 없다 → 항상 이 경로로 파생한다
// ------------------------------------------------------

const PACKAGE_IDENTITY_INCLUDE = {
    ...MOVEMENT_COUNT_SELECT,
    batch: { select: { millingType: true } },
    stock: { select: { varietyId: true } },
} as const

type PackageWithIdentity = {
    id: number
    source: 'MILLED' | 'PURCHASED'
    category: 'RICE' | 'MISC_GRAIN'
    varietyId: number | null
    packageType: string
    weightPerUnit: number
    count: number
    lotNo: string | null
    movements: { count: number }[]
    batch: { millingType: string } | null
    stock: { varietyId: number } | null
}

function deriveVarietyId(pkg: PackageWithIdentity): number | null {
    return pkg.source === 'MILLED' ? (pkg.stock?.varietyId ?? null) : pkg.varietyId
}

function deriveMillingType(pkg: PackageWithIdentity): string {
    return pkg.batch?.millingType ?? MISC_MILLING_SENTINEL
}

// 가용 계산은 `lib/package-available.ts`가 단일 원천이다 (§20). 여기 있던 로컬 정의는 승격했다.

// ------------------------------------------------------
// 1. 소스 조회 — 다이얼로그가 열릴 때 선택된 행들의 동질성·가용을 서버가 판정
// ------------------------------------------------------

export type RepackSourceInfo = {
    packageId: number
    varietyId: number
    varietyName: string
    /** MILLED=농가명 / PURCHASED=매입처. 로트만으로는 어느 건지 못 고른다 */
    producer: string
    millingType: string
    source: 'MILLED' | 'PURCHASED'
    category: 'RICE' | 'MISC_GRAIN'
    lotNo: string | null
    packageType: string
    weightPerUnit: number
    available: number
}

/** 로트 후보 + 생산자 — 로트번호는 (입고일+제품코드+인증+농가)라 사람이 보고 고르기 어렵다 */
export type RepackLotOption = LotOption & { producer: string }

export type GetRepackSourcesResult =
    | {
          success: true
          sources: RepackSourceInfo[]
          /** 결과 줄이 승계할 로트 후보 (전량 소진 기준). 1개면 UI가 자동 선택 */
          lotOptions: RepackLotOption[]
          /** 전량 소진 시 총 중량(kg) — 다이얼로그 상단 요약 */
          totalKg: number
      }
    | { success: false; error: string; errors?: RepackError[] }

export async function getRepackSources(packageIds: number[]): Promise<GetRepackSourcesResult> {
    await requirePermission('OPERATION_MANAGE')
    try {
        const ids = Array.from(new Set(packageIds.filter(id => Number.isInteger(id) && id > 0)))
        if (ids.length === 0) return { success: false, error: '재포장할 재고를 선택해 주세요.' }

        const rows = await prisma.millingOutputPackage.findMany({
            where: { id: { in: ids } },
            include: {
                ...PACKAGE_IDENTITY_INCLUDE,
                variety: { select: { name: true } },
                stock: {
                    select: {
                        varietyId: true,
                        variety: { select: { name: true } },
                        farmer: { select: { name: true } },
                    },
                },
            },
        })
        if (rows.length !== ids.length) {
            return { success: false, error: '선택한 재고 중 일부를 찾을 수 없습니다.' }
        }

        const sources: RepackSourceInfo[] = []
        for (const r of rows) {
            const varietyId = deriveVarietyId(r as unknown as PackageWithIdentity)
            if (varietyId === null) {
                return { success: false, error: `품종을 알 수 없는 재고가 있습니다. (재고 #${r.id})` }
            }
            const available = availableOf(r)
            if (available <= 0) {
                return { success: false, error: `이미 소진된 재고가 포함돼 있습니다. (재고 #${r.id})` }
            }
            sources.push({
                packageId: r.id,
                varietyId,
                varietyName: r.stock?.variety?.name ?? r.variety?.name ?? '',
                // packages.ts와 같은 규칙: PURCHASED=매입처, MILLED=농가명
                producer:
                    r.source === 'PURCHASED'
                        ? (r.purchaseVendor ?? '—')
                        : (r.stock?.farmer?.name ?? '—'),
                millingType: deriveMillingType(r as unknown as PackageWithIdentity),
                source: r.source,
                category: r.category,
                lotNo: r.lotNo,
                packageType: r.packageType,
                weightPerUnit: r.weightPerUnit,
                available,
            })
        }

        // 동질성만 미리 확인한다(결과 줄은 아직 없으므로 전량 소진 가정으로 검증).
        const probe: RepackSource[] = sources.map(s => ({ ...s, takeCount: s.available }))
        const check = validateRepack(probe, [
            {
                packageType: PACKAGE_TYPE_REMAINDER,
                weightPerUnit: 0.001,
                count: 1,
                packagingId: null,
                inheritFromPackageId: probe[0].packageId,
            },
        ])
        if (!check.ok) {
            const blocking = check.errors.filter(e => e.code.startsWith('MIXED'))
            if (blocking.length > 0) {
                return { success: false, error: blocking[0].message, errors: blocking }
            }
        }

        // 로트 후보에 대표 소스의 생산자를 붙인다 — 로트번호만으론 고르기 어렵다
        const producerByPackageId = new Map(sources.map(s => [s.packageId, s.producer]))
        const lotOptions: RepackLotOption[] = buildLotOptions(probe).map(o => ({
            ...o,
            producer: producerByPackageId.get(o.packageId) ?? '—',
        }))
        const totalKg = probe.reduce((s, p) => s + p.weightPerUnit * p.takeCount, 0)

        return { success: true, sources, lotOptions, totalKg: Math.round(totalKg * 1000) / 1000 }
    } catch (error) {
        console.error('[getRepackSources] failed:', error)
        return { success: false, error: sanitizeErrorMessage(error, '재고 조회에 실패했습니다.') }
    }
}

// ------------------------------------------------------
// 2. 재포장 실행
// ------------------------------------------------------

const CreateRepackSchema = z.object({
    sources: z
        .array(
            z.object({
                packageId: z.number().int().positive(),
                takeCount: z.number().int().positive(),
            }),
        )
        .min(1),
    results: z
        .array(
            z.object({
                packageType: z.string().min(1).max(30),
                weightPerUnit: z.number().positive(),
                count: z.number().int().positive(),
                packagingId: z.number().int().positive().nullable(),
                inheritFromPackageId: z.number().int().positive(),
            }),
        )
        .min(1),
    occurredAt: z.coerce.date().optional(),
    note: z.string().max(500).nullable().optional(),
    /** 손실 경고를 사용자가 확인했는지 (§3.5) */
    confirmLoss: z.boolean().optional(),
})

export type CreateRepackInput = z.input<typeof CreateRepackSchema>

export type CreateRepackResult =
    | { success: true; repackId: number; lossKg: number }
    | { success: false; error: string; errors?: RepackError[] }
    /** 손실이 1%를 넘음 — 사용자 확인 후 confirmLoss=true로 재요청 */
    | { success: false; needsLossConfirm: true; sourceKg: number; resultKg: number; lossKg: number }

/** 검증 실패를 트랜잭션 밖으로 실어 나르는 전용 에러. */
class RepackValidationFailed extends Error {
    constructor(public errors: RepackError[]) {
        super(errors[0]?.message ?? '입력을 확인해 주세요.')
        this.name = 'RepackValidationFailed'
    }
}

/** 손실 확인이 필요함을 트랜잭션 밖으로 실어 나르는 전용 에러(롤백된다). */
class RepackLossConfirmRequired extends Error {
    constructor(
        public sourceKg: number,
        public resultKg: number,
        public lossKg: number,
    ) {
        super('LOSS_CONFIRM_REQUIRED')
        this.name = 'RepackLossConfirmRequired'
    }
}

export async function createRepack(input: CreateRepackInput): Promise<CreateRepackResult> {
    const session = await requirePermission('OPERATION_MANAGE')
    try {
        const data = CreateRepackSchema.parse(input)

        const outcome = await prisma.$transaction(
            async tx => {
                // -- 1왕복: 소스 재조회 (가용을 트랜잭션 안에서 다시 본다 — 동시성) --
                const ids = data.sources.map(s => s.packageId)
                const rows = await tx.millingOutputPackage.findMany({
                    where: { id: { in: ids } },
                    include: PACKAGE_IDENTITY_INCLUDE,
                })
                if (rows.length !== new Set(ids).size) {
                    throw new Error('선택한 재고 중 일부를 찾을 수 없습니다.')
                }
                const byId = new Map(rows.map(r => [r.id, r as unknown as PackageWithIdentity]))

                const sources: RepackSource[] = data.sources.map(s => {
                    const p = byId.get(s.packageId)!
                    const varietyId = deriveVarietyId(p)
                    if (varietyId === null) {
                        throw new Error(`품종을 알 수 없는 재고가 있습니다. (재고 #${p.id})`)
                    }
                    return {
                        packageId: p.id,
                        varietyId,
                        millingType: deriveMillingType(p),
                        source: p.source,
                        category: p.category,
                        lotNo: p.lotNo,
                        packageType: p.packageType,
                        weightPerUnit: p.weightPerUnit,
                        available: availableOf(p),
                        takeCount: s.takeCount,
                    }
                })

                const results: RepackResultLine[] = data.results
                const verdict = validateRepack(sources, results)
                if (!verdict.ok) throw new RepackValidationFailed(verdict.errors)
                if (verdict.lossWarning && !data.confirmLoss) {
                    throw new RepackLossConfirmRequired(
                        verdict.sourceKg,
                        verdict.resultKg,
                        verdict.lossKg,
                    )
                }

                const head = sources[0]

                // -- 결과 줄의 SKU 결정 — 고유 (규격+포장지) 조합 수만큼만 조회/생성 --
                let tonbagPackagingId: number | null = null
                const skuCache = new Map<string, number | null>()
                for (const r of results) {
                    const key = `${r.packageType}|${r.packagingId ?? 'null'}`
                    if (skuCache.has(key)) continue

                    // 잔량은 자체 판매하지 않아 SKU를 부여하지 않는다 (app/actions/milling.ts:15)
                    if (r.packageType === PACKAGE_TYPE_REMAINDER) {
                        skuCache.set(key, null)
                        continue
                    }

                    // 톤백은 포장지를 '톤백'으로 강제한다 (규격명과 동명이나 별개 필드)
                    let packagingId = r.packagingId
                    if (r.packageType === PACKAGE_TYPE_TONBAG) {
                        if (tonbagPackagingId === null) {
                            const pkg = await tx.packaging.findUnique({
                                where: { name: TONBAG_PACKAGING },
                                select: { id: true },
                            })
                            if (!pkg) {
                                throw new Error(
                                    "'톤백' 포장지 마스터가 없습니다. 제품유형 시드를 확인해주세요.",
                                )
                            }
                            tonbagPackagingId = pkg.id
                        }
                        packagingId = tonbagPackagingId
                    }

                    if (packagingId === null) {
                        skuCache.set(key, null)
                        continue
                    }
                    skuCache.set(
                        key,
                        await findOrCreateProductType(tx, {
                            varietyId: head.varietyId,
                            millingType: head.millingType,
                            packageType: r.packageType,
                            packagingId,
                            promoteDefaultIfNone: true,
                        }),
                    )
                }

                // -- 1왕복: Repack 생성 --
                const repack = await tx.repack.create({
                    data: {
                        occurredAt: data.occurredAt ?? new Date(),
                        note: data.note ?? null,
                        lossKg: verdict.lossKg,
                        createdById: session.user?.id,
                        createdName: session.user?.name ?? undefined,
                    },
                    select: { id: true },
                })

                // -- 1왕복: 소스 소진(type=REPACK) --
                await tx.packageMovement.createMany({
                    data: sources.map(s => ({
                        packageId: s.packageId,
                        count: s.takeCount,
                        type: 'REPACK' as const,
                        repackId: repack.id,
                        occurredAt: data.occurredAt ?? new Date(),
                        note: data.note ?? null,
                        createdById: session.user?.id,
                        createdName: session.user?.name ?? undefined,
                    })),
                })

                // -- 1왕복: 결과 행 생성 (출처는 지정한 소스에서 승계 §3.4) --
                await tx.millingOutputPackage.createMany({
                    data: results.map(r => {
                        const from = byId.get(r.inheritFromPackageId)! as unknown as {
                            batchId: number | null
                            stockId: number | null
                            varietyId: number | null
                            purchaseVendor: string | null
                            incomingDate: Date | null
                            productCode: string | null
                            lotNo: string | null
                        }
                        return {
                            source: head.source,
                            category: head.category,
                            batchId: from.batchId,
                            stockId: from.stockId,
                            varietyId: from.varietyId,
                            purchaseVendor: from.purchaseVendor,
                            incomingDate: from.incomingDate,
                            packageType: r.packageType,
                            weightPerUnit: r.weightPerUnit,
                            count: r.count,
                            totalWeight: Math.round(r.weightPerUnit * r.count * 1000) / 1000,
                            productCode: from.productCode,
                            lotNo: from.lotNo,
                            productTypeId:
                                skuCache.get(`${r.packageType}|${r.packagingId ?? 'null'}`) ?? null,
                            repackId: repack.id,
                        }
                    }),
                })

                return {
                    repackId: repack.id,
                    lossKg: verdict.lossKg,
                    sourceKg: verdict.sourceKg,
                    resultKg: verdict.resultKg,
                }
            },
            { timeout: TRANSACTION_TIMEOUT_MS },
        )

        await recordAuditLog({
            action: 'CREATE',
            entity: 'Repack',
            entityId: outcome.repackId,
            details: {
                sources: data.sources,
                results: data.results,
                sourceKg: outcome.sourceKg,
                resultKg: outcome.resultKg,
                lossKg: outcome.lossKg,
            },
            description: `재포장: ${data.sources.length}개 재고 ${outcome.sourceKg}kg → ${data.results.length}종 ${outcome.resultKg}kg (손실 ${outcome.lossKg}kg)`,
        })

        revalidatePath('/packages')
        revalidatePath('/')

        return { success: true, repackId: outcome.repackId, lossKg: outcome.lossKg }
    } catch (error) {
        if (error instanceof RepackLossConfirmRequired) {
            return {
                success: false,
                needsLossConfirm: true,
                sourceKg: error.sourceKg,
                resultKg: error.resultKg,
                lossKg: error.lossKg,
            }
        }
        if (error instanceof RepackValidationFailed) {
            return { success: false, error: error.message, errors: error.errors }
        }
        console.error('[createRepack] failed:', error)
        return { success: false, error: sanitizeErrorMessage(error, '재포장에 실패했습니다.') }
    }
}

// ------------------------------------------------------
// 3. 되돌리기 (§3.6) — 결과 행에 차감이 하나도 없을 때만
//
// ⚠️ 의도적으로 어느 화면에도 연결하지 않았다 (결정 #57, 2026-08-27).
//    죽은 코드가 아니라 보류된 진입점이다. 지우지 말 것.
//
//    되돌릴 일은 실수·착오뿐이라 아주 가끔이고, 역방향 재포장(결과를 다시 소스로 골라
//    원래 규격으로 합치기)이라는 정식 우회로가 있다 — getRepackSources는 repackId를
//    보지 않으므로 재포장 결과 행도 그냥 소스가 된다.
//    게다가 재포장한 것을 다시 재포장하는 건 정상 동선이라(톤백 → 20kg → 5kg),
//    두 번째 재포장 순간 첫 재포장은 아래 검사에 걸려 되돌릴 수 없게 된다.
//    즉 이 함수가 유효한 창은 「재포장 직후 ~ 팔리거나 다시 재포장되기 전」뿐이다.
//
//    화면을 붙이는 날 함께 고칠 것 (결정 #60): 아래 거부 메시지가 「이미 차감된」이라
//    판매로 읽히는데, 실제로는 다시 재포장된 경우일 수 있다. movement.type으로 갈라야 한다.
// ------------------------------------------------------

export async function cancelRepack(
    repackId: number,
): Promise<{ success: true } | { success: false; error: string }> {
    await requirePermission('OPERATION_MANAGE')
    try {
        if (!Number.isInteger(repackId) || repackId <= 0) {
            return { success: false, error: '잘못된 요청입니다.' }
        }

        const summary = await prisma.$transaction(
            async tx => {
                const repack = await tx.repack.findUnique({
                    where: { id: repackId },
                    include: {
                        results: {
                            select: {
                                id: true,
                                totalWeight: true,
                                movements: { select: { id: true } },
                            },
                        },
                        sources: { select: { id: true } },
                    },
                })
                if (!repack) throw new Error('재포장 이력을 찾을 수 없습니다.')

                // 결과가 이미 팔렸으면 되돌릴 수 없다
                const used = repack.results.filter(r => r.movements.length > 0)
                if (used.length > 0) {
                    throw new Error(
                        `이미 차감된 재고가 있어 되돌릴 수 없습니다. (재고 #${used[0].id})`,
                    )
                }

                const resultKg = repack.results.reduce((s, r) => s + r.totalWeight, 0)

                // 결과 행 삭제 → 소스 소진(REPACK movement) 삭제 → Repack 삭제
                await tx.millingOutputPackage.deleteMany({ where: { repackId } })
                await tx.packageMovement.deleteMany({ where: { repackId } })
                await tx.repack.delete({ where: { id: repackId } })

                return {
                    resultCount: repack.results.length,
                    sourceCount: repack.sources.length,
                    resultKg: Math.round(resultKg * 1000) / 1000,
                }
            },
            { timeout: TRANSACTION_TIMEOUT_MS },
        )

        await recordAuditLog({
            action: 'DELETE',
            entity: 'Repack',
            entityId: repackId,
            details: summary,
            description: `재포장 되돌리기: 결과 ${summary.resultCount}행(${summary.resultKg}kg) 삭제, 소스 ${summary.sourceCount}건 복원`,
        })

        revalidatePath('/packages')
        revalidatePath('/')

        return { success: true }
    } catch (error) {
        console.error('[cancelRepack] failed:', error)
        return { success: false, error: sanitizeErrorMessage(error, '되돌리기에 실패했습니다.') }
    }
}
