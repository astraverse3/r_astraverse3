'use server'

// 제품재고 차감 공용 액션 (결정 #19·#20·#25 — 백로그 §14 통합)
//
// PackageMovement 단일 모델로 세 경로를 일반화한다(발주서 일괄은 별도 purchase-order.ts).
// 본 파일은 발주서와 무관한 **개별 판매등록 / 비판매 차감**(증정·분실·파손·기타) 공용.
//   - 가용재고 = package.count - SUM(movement.count)  (type 무관 전체 합산)
//   - 차감 취소 = 레코드 하드삭제 → 가용 자동복원 + recordAuditLog 필수(#17)
//   - ⚠️ 비판매(SALE 외)도 원물(stock) 복원 안 함(#19)
//   - 금액(단가·매출액) 미관리(#25) — 수량·거래처·로트만

import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { recordAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth-guard'
import { sanitizeErrorMessage } from '@/lib/error-sanitize'
import { MOVEMENT_COUNT_SELECT, availableOf } from '@/lib/package-available'
import { REPACK_CANCEL_BLOCKED, blockedMessage } from '@/lib/package-guard'

type MutationResult =
  | { success: true; id: number }
  | { success: false; error: string }

const NON_SALE_TYPES = ['GIFT', 'LOST', 'DAMAGED', 'OTHER'] as const

/** 사람이 직접 만드는 차감 사유. REPACK은 재포장 흐름 전용이라 여기 없다. */
const MANUAL_TYPES = ['SALE', ...NON_SALE_TYPES] as const
type ManualType = (typeof MANUAL_TYPES)[number]

/** 사유 표시 문구의 단일 원천 — 감사로그·에러 문구가 함께 쓴다. */
const MOVEMENT_LABEL: Record<ManualType, string> = {
  SALE: '판매',
  GIFT: '증정',
  LOST: '분실',
  DAMAGED: '파손',
  OTHER: '기타',
}

// -----------------------------
// 가용 재검증 + movement 생성 (트랜잭션 내부 공용)
// -----------------------------
type CreateMovementArgs = {
  packageId: number
  count: number
  type: 'SALE' | (typeof NON_SALE_TYPES)[number]
  customer: string | null
  note: string | null
  occurredAt?: Date
  createdById?: string
  createdName?: string
}

async function createMovementChecked(
  tx: Prisma.TransactionClient,
  args: CreateMovementArgs,
): Promise<{ id: number; packageType: string }> {
  const pkg = await tx.millingOutputPackage.findUnique({
    where: { id: args.packageId },
    select: { count: true, packageType: true },
  })
  if (!pkg) throw new Error('제품재고를 찾을 수 없습니다.')

  // 차감 전 가용 검증
  const before = await tx.packageMovement.aggregate({
    where: { packageId: args.packageId },
    _sum: { count: true },
  })
  const available = pkg.count - (before._sum.count ?? 0)
  if (args.count > available) {
    throw new Error(`가용 재고(${available}개)를 초과했습니다.`)
  }

  const created = await tx.packageMovement.create({
    data: {
      packageId: args.packageId,
      count: args.count,
      type: args.type,
      customer: args.customer,
      note: args.note,
      occurredAt: args.occurredAt ?? new Date(),
      createdById: args.createdById,
      createdName: args.createdName,
    },
    select: { id: true },
  })

  // 동시성 사후검증(Prisma FOR UPDATE 부재 보강): 총 차감이 보유를 넘으면 롤백.
  const after = await tx.packageMovement.aggregate({
    where: { packageId: args.packageId },
    _sum: { count: true },
  })
  if ((after._sum.count ?? 0) > pkg.count) {
    throw new Error('동시 차감으로 재고가 부족합니다. 다시 시도해주세요.')
  }

  return { id: created.id, packageType: pkg.packageType }
}

// -----------------------------
// 개별 판매등록 (type=SALE, 발주서 무관)
// -----------------------------
const CreateSaleSchema = z.object({
  packageId: z.number().int().positive(),
  count: z.number().int().positive(),
  customer: z.string().trim().min(1).max(100).optional(), // 거래처
  occurredAt: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional(),
})

export async function createSale(
  input: z.input<typeof CreateSaleSchema>,
): Promise<MutationResult> {
  const session = await requirePermission('OPERATION_MANAGE')
  try {
    const data = CreateSaleSchema.parse(input)
    const created = await prisma.$transaction((tx) =>
      createMovementChecked(tx, {
        packageId: data.packageId,
        count: data.count,
        type: 'SALE',
        customer: data.customer ?? null,
        note: data.note ?? null,
        occurredAt: data.occurredAt,
        createdById: session.user?.id,
        createdName: session.user?.name ?? undefined,
      }),
    )

    await recordAuditLog({
      action: 'CREATE',
      entity: 'PackageMovement',
      entityId: created.id,
      details: { ...data, type: 'SALE' },
      description: `제품재고 판매차감 #${data.packageId} ${created.packageType} × ${data.count}개${data.customer ? ` / ${data.customer}` : ''}`,
    })

    revalidatePath('/packages')
    revalidatePath('/sales')
    return { success: true, id: created.id }
  } catch (error) {
    console.error('[createSale] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '판매 등록에 실패했습니다.') }
  }
}

// -----------------------------
// 비판매 차감 (증정/분실/파손/기타)
// -----------------------------
const CreateNonSaleSchema = z.object({
  packageId: z.number().int().positive(),
  count: z.number().int().positive(),
  type: z.enum(NON_SALE_TYPES),
  note: z.string().trim().max(500).optional(), // 사유 메모
  occurredAt: z.coerce.date().optional(),
})

export async function createNonSaleMovement(
  input: z.input<typeof CreateNonSaleSchema>,
): Promise<MutationResult> {
  const session = await requirePermission('OPERATION_MANAGE')
  try {
    const data = CreateNonSaleSchema.parse(input)
    const created = await prisma.$transaction((tx) =>
      createMovementChecked(tx, {
        packageId: data.packageId,
        count: data.count,
        type: data.type,
        customer: null,
        note: data.note ?? null,
        occurredAt: data.occurredAt,
        createdById: session.user?.id,
        createdName: session.user?.name ?? undefined,
      }),
    )

    await recordAuditLog({
      action: 'CREATE',
      entity: 'PackageMovement',
      entityId: created.id,
      details: data,
      description: `제품재고 비판매차감(${MOVEMENT_LABEL[data.type]}) #${data.packageId} ${created.packageType} × ${data.count}개`,
    })

    revalidatePath('/packages')
    revalidatePath('/sales')
    return { success: true, id: created.id }
  } catch (error) {
    console.error('[createNonSaleMovement] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '차감 등록에 실패했습니다.') }
  }
}

// -----------------------------
// 일괄 차감 — 「재고차감」 화면 (결정 N1~N3)
// -----------------------------
//
// 1건 차감도 「1건만 고른 경우」다(N3) — 화면은 이 액션 하나만 쓴다.
//
// 🔴 **왕복을 행 수와 무관하게 3회로 고정한다.**
// 위의 단건 액션을 200번 부르면 왕복 250~300ms × 200 ≈ 1분 → 트랜잭션 타임아웃.
// 배송·상차 적재에서 이미 터뜨린 그 모양이다(교훈: 루프 안 INSERT는 20회가 한계).
const BulkItemSchema = z.object({
  packageId: z.number().int().positive(),
  count: z.number().int().positive(),
})

const CreateBulkSchema = z.object({
  items: z.array(BulkItemSchema).min(1).max(500),
  type: z.enum(MANUAL_TYPES), // REPACK 불가 — 재포장 흐름 전용이다
  customer: z.string().trim().min(1).max(100).optional(),
  note: z.string().trim().max(500).optional(),
  occurredAt: z.coerce.date().optional(),
})

export type BulkMovementResult =
  | { success: true; rows: number; totalCount: number }
  | { success: false; error: string }

export async function createBulkMovements(
  input: z.input<typeof CreateBulkSchema>,
): Promise<BulkMovementResult> {
  const session = await requirePermission('OPERATION_MANAGE')
  try {
    const data = CreateBulkSchema.parse(input)
    // 거래처는 판매에서만 의미가 있다 — 금액은 관리하지 않는다(#25).
    const customer = data.type === 'SALE' ? (data.customer ?? null) : null
    const occurredAt = data.occurredAt ?? new Date()

    // 같은 행이 두 줄로 들어와도 가용 검증은 합으로 봐야 맞다.
    const requestedById = new Map<number, number>()
    for (const it of data.items) {
      requestedById.set(it.packageId, (requestedById.get(it.packageId) ?? 0) + it.count)
    }
    const ids = [...requestedById.keys()]

    await prisma.$transaction(
      async (tx) => {
        // ① 대상 조회 1회 — 가용은 메모리에서 낸다(lib/package-available.ts).
        const pkgs = await tx.millingOutputPackage.findMany({
          where: { id: { in: ids } },
          select: { id: true, count: true, packageType: true, ...MOVEMENT_COUNT_SELECT },
        })
        if (pkgs.length !== ids.length) {
          throw new Error('제품재고를 찾을 수 없습니다. 목록을 새로고침한 뒤 다시 시도해주세요.')
        }

        const blocked = pkgs
          .map((pkg) => ({ pkg, requested: requestedById.get(pkg.id) ?? 0, available: availableOf(pkg) }))
          .filter(({ requested, available }) => requested > available)
          .map(({ pkg, requested, available }) => `${pkg.packageType} — 가용 ${available}개, 요청 ${requested}개`)
        if (blocked.length > 0) {
          throw new Error(blockedMessage('가용 재고를 초과했습니다.', blocked))
        }

        // ② 생성 1회
        await tx.packageMovement.createMany({
          data: data.items.map((it) => ({
            packageId: it.packageId,
            count: it.count,
            type: data.type,
            customer,
            note: data.note ?? null,
            occurredAt,
            createdById: session.user?.id,
            createdName: session.user?.name ?? undefined,
          })),
        })

        // ③ 동시성 사후검증 1회(Prisma FOR UPDATE 부재 보강) — 넘치면 전체 롤백.
        const sums = await tx.packageMovement.groupBy({
          by: ['packageId'],
          where: { packageId: { in: ids } },
          _sum: { count: true },
        })
        const heldById = new Map(pkgs.map((p) => [p.id, p.count]))
        for (const s of sums) {
          if ((s._sum.count ?? 0) > (heldById.get(s.packageId) ?? 0)) {
            throw new Error('동시 차감으로 재고가 부족합니다. 다시 시도해주세요.')
          }
        }
      },
      { timeout: 30_000 },
    )

    const totalCount = data.items.reduce((sum, it) => sum + it.count, 0)
    await recordAuditLog({
      action: 'CREATE',
      entity: 'PackageMovement',
      details: { ...data, customer, occurredAt }, // 전체 배열은 여기 남는다
      description: `재고차감(${MOVEMENT_LABEL[data.type]}) ${data.items.length}행 · ${totalCount.toLocaleString()}개`,
    })

    revalidatePath('/packages')
    revalidatePath('/sales')
    return { success: true, rows: data.items.length, totalCount }
  } catch (error) {
    console.error('[createBulkMovements] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '재고 차감에 실패했습니다.') }
  }
}

// -----------------------------
// 차감 취소 — 하드삭제 + 가용 자동복원 + 감사로그(#17)
// -----------------------------
export async function cancelMovement(
  movementId: number,
): Promise<{ success: true } | { success: false; error: string }> {
  await requirePermission('OPERATION_MANAGE')
  try {
    const mv = await prisma.packageMovement.findUnique({ where: { id: movementId } })
    if (!mv) return { success: false, error: '차감 기록을 찾을 수 없습니다.' }
    // 발주서 라인에 묶인 movement는 발주서 흐름(cancelOrderItemMovements)에서 취소 — 혼선 방지.
    if (mv.orderItemId !== null) {
      return { success: false, error: '발주서 차감은 발주서 상세에서 취소해주세요.' }
    }
    // 재포장 소진분을 지우면 원본만 복원되고 결과 행은 남아 재고가 이중 계상된다.
    // 「차감된 재고 보기」에 재포장 소진 행이 노출되면서 닿게 된 경로다(결정 #57·#59).
    if (mv.repackId !== null) {
      return { success: false, error: REPACK_CANCEL_BLOCKED }
    }

    await prisma.packageMovement.delete({ where: { id: movementId } })

    await recordAuditLog({
      action: 'DELETE',
      entity: 'PackageMovement',
      entityId: movementId,
      details: mv,
      description: `제품재고 차감취소 #${mv.packageId} ${mv.type} × ${mv.count}개`,
    })

    revalidatePath('/packages')
    revalidatePath('/sales')
    return { success: true }
  } catch (error) {
    console.error('[cancelMovement] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '차감 취소에 실패했습니다.') }
  }
}

// -----------------------------
// 차감 이력 조회 (판매·비판매 통합, 공개)
// -----------------------------
export type MovementRow = {
  id: number
  count: number
  /** REPACK도 나온다 — 재포장 소진분이 같은 테이블에 있다. */
  type: ManualType | 'REPACK'
  customer: string | null
  note: string | null
  occurredAt: string // ISO yyyy-mm-dd
  createdName: string | null
  fromOrder: boolean // 발주서 경로 여부(orderItemId != null)
  fromRepack: boolean // 재포장 경로 여부(repackId != null)
  /** 되돌릴 수 있는 건지 — 화면은 이 값만 보면 된다. 서버도 같은 규칙으로 거부한다. */
  cancellable: boolean
}

export async function listMovements(
  packageId: number,
): Promise<{ success: true; data: MovementRow[] } | { success: false; error: string }> {
  try {
    const rows = await prisma.packageMovement.findMany({
      where: { packageId },
      orderBy: { occurredAt: 'desc' },
    })
    const data: MovementRow[] = rows.map((r) => ({
      id: r.id,
      count: r.count,
      type: r.type as MovementRow['type'],
      customer: r.customer,
      note: r.note,
      occurredAt: r.occurredAt.toISOString().slice(0, 10),
      createdName: r.createdName,
      fromOrder: r.orderItemId !== null,
      fromRepack: r.repackId !== null,
      cancellable: r.orderItemId === null && r.repackId === null,
    }))
    return { success: true, data }
  } catch (error) {
    console.error('[listMovements] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '차감 이력을 불러오지 못했습니다.') }
  }
}
