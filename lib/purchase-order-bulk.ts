// 발주서 톤백(벌크) 셀 — 순수 로직 (계획서 D2d 결정 E·I)
//
// 톤백은 자루마다 중량이 제각각이라(실측 124종) 개수 추천이 성립하지 않는다.
// 사람이 자루를 고르고(#34), 시스템은 「요구 vs 실제」 차이를 **보여주기만** 한다(백로그 §40 — 막지 않는다).
// 같은 계산을 D5 엑셀 내보내기가 재사용한다 — 여기 말고 다른 데서 다시 쓰지 말 것.

/** 요구 중량 판정에 필요한 라인 조각 */
export type BulkLineLike = {
  orderedQty: number
  /** 요구 자루중량 (#34). 톤백이 아니면 null */
  unitWeightKg: number | null
}

/** 요구 kg = 자루 수 × 요구 자루중량. 톤백이 아니면 0 */
export function requiredKgOf(line: BulkLineLike): number {
  return line.unitWeightKg !== null ? line.orderedQty * line.unitWeightKg : 0
}

/** 차이 표시 임계 — 이 비율 안이면 「맞음」으로 본다(§40 예시 ±1%). 색만 바꾸고 막지 않는다 */
export const BULK_TOLERANCE = 0.01

export type BulkDelta = {
  /** 실제 − 요구 (kg, 소수 첫째 자리) */
  deltaKg: number
  /** 요구 대비 비율. 요구가 0이면 null */
  deltaPct: number | null
  level: 'exact' | 'over' | 'under'
}

/** 요구 kg 대비 실제 kg 차이. `level`은 ±`BULK_TOLERANCE` 기준 */
export function bulkDelta(requiredKg: number, actualKg: number): BulkDelta {
  const deltaKg = Math.round((actualKg - requiredKg) * 10) / 10
  const deltaPct = requiredKg > 0 ? deltaKg / requiredKg : null
  const within = deltaPct === null ? deltaKg === 0 : Math.abs(deltaPct) <= BULK_TOLERANCE
  return {
    deltaKg,
    deltaPct,
    level: within ? 'exact' : deltaKg > 0 ? 'over' : 'under',
  }
}

export type BulkCandidateLike = {
  packageId: number
  weightPerUnit: number
  /** FIFO 기준일(MILLED=도정일 / PURCHASED=입고일) */
  sortKey: Date | string
}

/**
 * 자루 후보 정렬 — **요구 중량에 가까운 순**, 같으면 오래된 순(FIFO), 그다음 id.
 * 원본 배열은 건드리지 않는다.
 */
export function sortBulkCandidates<T extends BulkCandidateLike>(targetKg: number, rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      Math.abs(a.weightPerUnit - targetKg) - Math.abs(b.weightPerUnit - targetKg) ||
      new Date(a.sortKey).getTime() - new Date(b.sortKey).getTime() ||
      a.packageId - b.packageId,
  )
}
