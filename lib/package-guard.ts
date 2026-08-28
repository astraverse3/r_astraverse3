// 제품재고 행을 고치거나 지울 때의 차감 보호 — 'use server' 아님(테스트 가능)
//
// 계획서 docs/plan/plan-잡곡차감보호.md / 결정 #66~#70.
//
// 가용재고 = count - SUM(movements.count) 위에 얹히는 규칙이다.
//   · 이미 나간 것을 없던 일로 만들 수 없다 (삭제 거부)
//   · 이미 나간 것보다 적게 남길 수 없다 (축소 거부 — 가용이 음수가 된다)
//   · 이미 나간 물건의 정체를 바꿀 수 없다 (품종·규격 변경 거부)
//   · 재포장 결과는 원본의 소진량과 짝이라 따로 손대지 않는다
//
// 규칙과 **문구**의 단일 원천이다. 지점마다 손으로 쓰면 반드시 어긋난다 —
// `lib/batch-outputs.ts`(#61) 때 두 번 놓쳤고 수율·통계가 이중 계상됐다.
// 단건 액션(`app/actions/packages.ts`의 잡곡 수정·삭제)과
// 배열 diff(`lib/packaging-diff.ts`의 벼 포장 수정)가 **함께** 이 파일을 쓴다.
//
// DB 접근은 하지 않는다. 호출부가 조회 결과를 넣는다.

/** 검사 대상 한 행. `movedCount`는 호출부가 SUM(movements.count)로 넣는다. */
export type GuardedPackage = {
  id: number
  packageType: string
  count: number
  /** 판매·재포장 등으로 이미 빠져나간 개수 */
  movedCount: number
  /** 재포장으로 생겨난 행이면 그 Repack id. 원래부터 있던 행은 null */
  repackId?: number | null
}

export type GuardResult =
  | { ok: true }
  | { ok: false; reason: string }

/**
 * 재포장 결과를 이 경로로 지우면 원본의 REPACK movement가 남아 원본이 영원히
 * 소진 상태가 된다 — 결과도 원본도 없어 재고가 증발한다 (결정 #59).
 * 되돌리기 화면은 만들지 않기로 했으므로(결정 #57) 역방향 재포장이 정식 경로다.
 */
export const REPACK_DELETE_BLOCKED =
  '재포장으로 만든 재고는 삭제할 수 없어요. 되돌리려면 이 재고를 다시 재포장해 원래 규격으로 합쳐주세요.'

/**
 * 재포장 결과의 수량·중량을 고치면 **원본에서 소진한 양과 어긋난다** — 중량 보존이 깨진다.
 * 잘못 만들었으면 역방향 재포장으로 되돌린다 (결정 #57·#69).
 */
export const REPACK_UPDATE_BLOCKED =
  '재포장으로 만든 재고는 수정할 수 없어요. 고치려면 이 재고를 다시 재포장해 주세요.'

/** 「20kg × 3 (3개 중 3개 차감됨)」 — 사람이 어느 줄인지 알아볼 수 있게. */
export function describeDeduction(pkg: GuardedPackage): string {
  return `${pkg.packageType} × ${pkg.count} (${pkg.count}개 중 ${pkg.movedCount}개 차감됨)`
}

/** 「20kg × 3」 */
export function describePackage(pkg: GuardedPackage): string {
  return `${pkg.packageType} × ${pkg.count}`
}

/** 이미 나간 게 있으면 지울 수 없다. 재포장 결과도 이 경로로는 못 지운다. */
export function guardDelete(pkg: GuardedPackage): GuardResult {
  if (pkg.repackId != null) return { ok: false, reason: REPACK_DELETE_BLOCKED }
  if (pkg.movedCount > 0) {
    return { ok: false, reason: describeDeduction(pkg) }
  }
  return { ok: true }
}

/**
 * 재포장 결과는 이 경로로 고칠 수 없다 (#69).
 * 지금까지 삭제만 막고 수정은 열려 있었다 — 비일관이었다.
 */
export function guardUpdate(pkg: GuardedPackage): GuardResult {
  if (pkg.repackId != null) return { ok: false, reason: REPACK_UPDATE_BLOCKED }
  return { ok: true }
}

/**
 * 이미 나간 것보다 적게 남길 수는 없다 — 가용 재고가 음수가 되고,
 * 그러면 목록 필터(`available <= 0`)에 걸려 **깨진 행이 화면에서 사라진다.**
 * 늘리는 것은 자유다.
 */
export function guardCountChange(pkg: GuardedPackage, nextCount: number): GuardResult {
  if (nextCount < pkg.movedCount) {
    return {
      ok: false,
      reason: `${describePackage(pkg)} → ${nextCount}개로 줄일 수 없어요. 이미 ${pkg.movedCount}개가 판매·재포장됐습니다.`,
    }
  }
  return { ok: true }
}

/**
 * 이미 나간 물건의 정체는 바꿀 수 없다 (결정 #70 A안).
 * 수량 증가·매입처·매입일 정정은 이 검사에 걸리지 않는다 — 오타 하나 못 고칠 이유는 없다.
 */
export function guardIdentityChange(
  pkg: GuardedPackage,
  next: { packageType?: string; varietyId?: number },
  current: { varietyId?: number | null },
): GuardResult {
  if (pkg.movedCount === 0) return { ok: true }

  const specChanged = next.packageType !== undefined && next.packageType !== pkg.packageType
  const varietyChanged =
    next.varietyId !== undefined &&
    current.varietyId != null &&
    next.varietyId !== current.varietyId

  if (specChanged || varietyChanged) {
    return { ok: false, reason: describeDeduction(pkg) }
  }
  return { ok: true }
}

// ------------------------------------------------------
// 사용자에게 보여줄 문장
// ------------------------------------------------------

/**
 * FK 에러(원인 불명)를 **차단 이유가 적힌 메시지**로 바꾸는 게 이 모듈의 핵심이라,
 * 「무엇이 · 몇 개가 걸렸는지 · 어떻게 풀 수 있는지」를 함께 낸다.
 */
export function blockedMessage(header: string, reasons: string[], hint?: string): string {
  return [header, ...reasons.map((r) => `  · ${r}`), ...(hint ? [hint] : [])].join('\n')
}

export const DELETE_BLOCKED_HEADER = '이미 판매·재포장된 포장은 지울 수 없어요.'
export const IDENTITY_BLOCKED_HEADER = '이미 판매·재포장된 포장은 품종·규격을 바꿀 수 없어요.'
export const DEDUCTION_HINT = '포장을 되돌리려면 판매를 취소하거나 재포장을 정리해 주세요.'

/** 단건 액션용 — 한 행이 삭제로 막혔을 때. */
export function deleteBlockedMessage(pkg: GuardedPackage): string {
  return blockedMessage(DELETE_BLOCKED_HEADER, [describeDeduction(pkg)], DEDUCTION_HINT)
}

/** 단건 액션용 — 한 행이 품종·규격 변경으로 막혔을 때. */
export function identityBlockedMessage(pkg: GuardedPackage): string {
  return blockedMessage(IDENTITY_BLOCKED_HEADER, [describeDeduction(pkg)])
}
