import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * 트랜잭션 클라이언트 또는 기본 prisma 클라이언트 둘 다 받을 수 있는 타입.
 * 등록 흐름(매입/포장)이 자체 트랜잭션 안에서 호출하는 경우 tx를 주입한다.
 */
type DbClient = Prisma.TransactionClient | typeof prisma

export type FindOrCreateProductTypeParams = {
  varietyId: number
  millingType: string // 잡곡 sentinel='기타'
  packageType: string
  packagingId: number // '매입포장' sentinel 허용
  /**
   * 새 SKU를 생성하는데 그 (품종+도정+규격) 조합에 기존 기본(isDefault)이 하나도 없으면
   * 이 SKU를 기본으로 승격한다. 잡곡처럼 기본이 미시드된 조합의 첫 등록을 기본으로 삼는 용도.
   * 기존 기본이 있으면(사용자가 다른 포장지를 일부러 고른 경우) 건드리지 않는다.
   */
  promoteDefaultIfNone?: boolean
}

/**
 * (품종+도정+규격+포장지) 4키로 ProductType(SKU)을 조회하고, 없으면 생성해 id를 반환한다.
 *
 * - 내부 헬퍼(무가드): 상위 포장/매입 액션이 MILLING/STOCK 권한으로 이미 가드한다.
 * - `'use server'`가 아닌 순수 모듈이라 트랜잭션 클라이언트(tx)를 인자로 받을 수 있다.
 * - upsert로 동시 생성 경합(unique 위반)을 안전하게 흡수한다.
 * - 기본값: isDefault=false 생성(기본 추천은 관리 화면에서 명시적으로 지정).
 *   `promoteDefaultIfNone`이면 그 조합의 기본 부재 시에만 신규 SKU를 기본으로.
 */
export async function findOrCreateProductType(
  client: DbClient,
  params: FindOrCreateProductTypeParams,
): Promise<number> {
  const { varietyId, millingType, packageType, packagingId } = params

  // 기존 SKU가 있으면 그대로 반환(기본 여부 변경 없음).
  const existing = await client.productType.findUnique({
    where: {
      varietyId_millingType_packageType_packagingId: {
        varietyId,
        millingType,
        packageType,
        packagingId,
      },
    },
    select: { id: true },
  })
  if (existing) return existing.id

  // 신규 생성 — 조합에 기본이 없으면 승격(옵션).
  let isDefault = false
  if (params.promoteDefaultIfNone) {
    const hasDefault = await client.productType.findFirst({
      where: { varietyId, millingType, packageType, isDefault: true },
      select: { id: true },
    })
    isDefault = !hasDefault
  }

  // upsert로 동시 생성 경합(unique 위반) 흡수.
  const created = await client.productType.upsert({
    where: {
      varietyId_millingType_packageType_packagingId: {
        varietyId,
        millingType,
        packageType,
        packagingId,
      },
    },
    update: {},
    create: { varietyId, millingType, packageType, packagingId, isDefault },
    select: { id: true },
  })

  return created.id
}
