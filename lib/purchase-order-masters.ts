// 발주서 액션 공용 서버 헬퍼.
//
// 'use server' 파일은 async 함수만 export할 수 있어 타입·동기 헬퍼를 액션끼리 나눠 쓸 수 없다.
// 업로드 액션(purchase-order-upload.ts)과 매칭·차감 액션(purchase-order.ts)이 함께 쓰는
// 조각만 여기에 둔다. (DB 접근이 있어 순수 lib은 아니고, 서버에서만 import한다)

import { prisma } from '@/lib/prisma'
import type { MatcherVariety, MatcherProductType } from '@/lib/purchase-order-matcher'

/** 'yyyy-mm-dd'(시트명·사용자 확정값 유래) → Date. 없으면 null. */
export function toDateOrNull(iso: string | null): Date | null {
  return iso ? new Date(`${iso}T00:00:00Z`) : null
}

export type MatcherMasters = { varieties: MatcherVariety[]; productTypes: MatcherProductType[] }

/** 매칭에 쓸 마스터(품종·SKU) 로드 — 순수 매처에 주입. */
export async function loadMatcherMasters(): Promise<MatcherMasters> {
  const [vs, pts] = await Promise.all([
    prisma.variety.findMany({
      select: { id: true, name: true, category: true, aliases: true },
    }),
    prisma.productType.findMany({
      where: { active: true },
      include: { packaging: { select: { name: true } } },
    }),
  ])
  return {
    varieties: vs.map((v) => ({
      id: v.id,
      name: v.name,
      category: v.category,
      aliases: v.aliases,
    })),
    productTypes: pts.map((p) => ({
      id: p.id,
      varietyId: p.varietyId,
      millingType: p.millingType,
      packageType: p.packageType,
      packagingId: p.packagingId,
      packagingName: p.packaging.name,
      isDefault: p.isDefault,
      active: p.active,
    })),
  }
}
