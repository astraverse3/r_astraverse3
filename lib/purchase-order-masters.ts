// 발주서 액션 공용 서버 헬퍼.
//
// 'use server' 파일은 async 함수만 export할 수 있어 타입·동기 헬퍼를 액션끼리 나눠 쓸 수 없다.
// 업로드 액션(purchase-order-upload.ts)과 매칭·차감 액션(purchase-order.ts)이 함께 쓰는
// 조각만 여기에 둔다. (DB 접근이 있어 순수 lib은 아니고, 서버에서만 import한다)

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  hasMillingToken,
  normalizeItemName,
  type MatcherVariety,
  type MatcherProductType,
} from '@/lib/purchase-order-matcher'

/** 'yyyy-mm-dd'(시트명·사용자 확정값 유래) → Date. 없으면 null. */
export function toDateOrNull(iso: string | null): Date | null {
  return iso ? new Date(`${iso}T00:00:00Z`) : null
}

export type MatcherMasters = { varieties: MatcherVariety[]; productTypes: MatcherProductType[] }

/** 매칭에 쓸 마스터(품종·SKU) 로드 — 순수 매처에 주입. */
export async function loadMatcherMasters(): Promise<MatcherMasters> {
  const [vs, pts] = await Promise.all([
    prisma.variety.findMany({
      select: { id: true, name: true, category: true, aliases: true, type: true },
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
      type: v.type,
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

// ------------------------------------------------------
// 별칭 학습 (#22 · D2e 결정 S·T)
// ------------------------------------------------------

/** 학습을 건너뛴 이유. `null`이면 학습됨. */
export type AliasSkipReason =
  | 'empty' // 토큰이 비었다
  | 'same_as_name' // 품종 이름 그대로 — 학습할 게 없다
  | 'already' // 이미 그 품종 별칭이다
  | 'milling_token' // 도정 단어가 섞였다 (결정 T)
  | 'taken' // 다른 품종의 이름·별칭이다 (결정 S)

/**
 * 발주서 품목명을 품종 별칭으로 학습한다(#22).
 *
 * 학습되는 건 원본이 아니라 **정규화한 품종토큰**이다(브랜드 접두 제거·도정 접미 분리 후).
 * 비교는 공백을 무시하므로 띄어쓰기만 다른 표기는 자동으로 커버된다.
 *
 * 🔴 두 경우엔 **학습하지 않는다**. 지정 자체는 정상이고 별칭만 안 만든다 —
 *   ① 도정 단어가 섞인 토큰(결정 T): `백미 천지향5세`를 학습하면 나중에 `현미 …`가 백미로 붙는다
 *   ② 다른 품종이 이미 쓰는 이름·별칭(결정 S): 매처가 먼저 만난 쪽을 집어 엉뚱한 품종에 붙는다
 */
export async function learnVarietyAlias(
  tx: Prisma.TransactionClient,
  varietyId: number,
  rawItemName: string,
): Promise<
  { learned: string; reason: null } | { learned: null; reason: AliasSkipReason }
> {
  const { varietyToken } = normalizeItemName(rawItemName)
  const key = varietyToken.trim()
  if (!key) return { learned: null, reason: 'empty' }
  if (hasMillingToken(key)) return { learned: null, reason: 'milling_token' }

  const target = await tx.variety.findUnique({
    where: { id: varietyId },
    select: { name: true, aliases: true },
  })
  if (!target) return { learned: null, reason: 'empty' }
  if (stripSpacesForAlias(key) === stripSpacesForAlias(target.name)) {
    return { learned: null, reason: 'same_as_name' }
  }
  if (target.aliases.some((a) => stripSpacesForAlias(a) === stripSpacesForAlias(key))) {
    return { learned: null, reason: 'already' }
  }

  // 다른 품종이 이미 그 이름을 쓰는가 — 전 품종을 훑는다(41행, 부담 없음)
  const all = await tx.variety.findMany({ select: { id: true, name: true, aliases: true } })
  const clash = all.some(
    (v) =>
      v.id !== varietyId &&
      (stripSpacesForAlias(v.name) === stripSpacesForAlias(key) ||
        v.aliases.some((a) => stripSpacesForAlias(a) === stripSpacesForAlias(key))),
  )
  if (clash) return { learned: null, reason: 'taken' }

  await tx.variety.update({ where: { id: varietyId }, data: { aliases: { push: key } } })
  return { learned: key, reason: null }
}

/** 매처와 같은 비교 규칙(공백 무시). */
function stripSpacesForAlias(s: string): string {
  return s.replace(/\s+/g, '')
}
