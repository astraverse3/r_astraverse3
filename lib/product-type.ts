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
}

/**
 * (품종+도정+규격+포장지) 4키로 ProductType(SKU)을 조회하고, 없으면 생성해 id를 반환한다.
 *
 * - 내부 헬퍼(무가드): 상위 포장/매입 액션이 MILLING/STOCK 권한으로 이미 가드한다.
 * - `'use server'`가 아닌 순수 모듈이라 트랜잭션 클라이언트(tx)를 인자로 받을 수 있다.
 * - upsert로 동시 생성 경합(unique 위반)을 안전하게 흡수한다.
 * - isDefault는 false로 자동생성(기본 추천은 관리 화면에서 명시적으로 지정).
 */
export async function findOrCreateProductType(
  client: DbClient,
  params: FindOrCreateProductTypeParams,
): Promise<number> {
  const { varietyId, millingType, packageType, packagingId } = params

  const productType = await client.productType.upsert({
    where: {
      varietyId_millingType_packageType_packagingId: {
        varietyId,
        millingType,
        packageType,
        packagingId,
      },
    },
    update: {},
    create: { varietyId, millingType, packageType, packagingId },
    select: { id: true },
  })

  return productType.id
}
