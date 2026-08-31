// 가용재고 계산 — 'use server' 아님(테스트 가능)
//
// 백로그 §20 / 결정 #73·#78.
//
//   가용 = count - SUM(movements.count)
//
// 이 한 줄이 지점마다 손으로 쓰여 있었다(6곳). `lib/batch-outputs.ts`(#61)와 같은
// 냄새다 — 그때도 지점마다 붙이다 **두 번 놓쳤고** 수율·통계가 이중 계상됐다.
// 가용재고는 판매·재포장·발주서가 모두 딛는 값이라 어긋나면 더 넓게 번진다.
//
// 규칙(`lib/package-guard.ts`)과 계산(여기)을 나눈다.
// 의존은 available → guard 단방향이다. guard는 이 파일을 쓰지 않는다.
//
// 🔴 **DB 집계는 여기 오지 않는다 (#73).**
// `purchase-order.ts`의 `allocatedQtyOfItem`·`packageMovement.aggregate`,
// `package-movement.ts`의 before/after 집계는 행을 로드하지 않고 DB에서 합을 낸다.
// 공식은 같지만 계산 위치가 달라, 메모리 헬퍼로 바꾸면 왕복이 늘거나 전 행을 끌어와야 한다.
// 공식을 고칠 일이 생기면 **그 세 곳도 함께** 봐야 한다.

import type { GuardedPackage } from './package-guard'

/**
 * Prisma select 조각. 호출부가 그대로 펼쳐 넣는다 —
 * `select: { id: true, ...MOVEMENT_COUNT_SELECT }`
 *
 * 계산 함수와 짝이라 여기 함께 둔다. select를 빠뜨리면 타입이 먼저 잡아준다.
 */
export const MOVEMENT_COUNT_SELECT = { movements: { select: { count: true } } } as const

/** 차감 이력만 있으면 되는 행 */
export type WithMovements = { movements: { count: number }[] }

/** 가용을 낼 수 있는 행 */
export type CountedRow = WithMovements & { count: number }

/** 판매·재포장 등으로 이미 빠져나간 개수 */
export function movedCountOf(row: WithMovements): number {
  return row.movements.reduce((sum, m) => sum + m.count, 0)
}

/**
 * 지금 쓸 수 있는 개수. **음수가 나올 수 있다** —
 * 그건 데이터가 깨졌다는 신호이므로 0으로 덮지 않는다.
 * 목록은 `available <= 0`으로 거르고, 쓰기 경로는 `package-guard`가 막는다.
 */
export function availableOf(row: CountedRow): number {
  return row.count - movedCountOf(row)
}

/**
 * 조회 결과를 guard가 볼 수 있는 모양으로 옮긴다.
 * `app/actions/packages.ts`의 로컬 헬퍼였던 것을 승격했다 — 파일 밖에서 못 썼다.
 *
 * `weightPerUnit`·`packagingId`는 넣은 축만 검사된다 (#74).
 * 잡곡 매입처럼 포장지 개념이 없는 경로는 안 넣으면 그만이다.
 */
export function toGuarded(
  row: WithMovements & {
    id: number
    packageType: string
    count: number
    repackId?: number | null
    weightPerUnit?: number
    packagingId?: number | null
  },
): GuardedPackage {
  return {
    id: row.id,
    packageType: row.packageType,
    count: row.count,
    movedCount: movedCountOf(row),
    repackId: row.repackId,
    weightPerUnit: row.weightPerUnit,
    packagingId: row.packagingId,
  }
}
