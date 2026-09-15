// 발주서 톤백(벌크) 셀 — 순수 로직 (계획서 D2d 결정 F·I·M)
//
// 톤백은 자루마다 중량이 제각각이라(실측 124종) 「개수」 추천이 성립하지 않는다.
// 결정 M(2026-09-15 리셋): 팝오버는 **선택만** 한다. 쪼개기는 제품재고 화면에서.
// 발주 자루 하나를 만족하는 재고 자루 = 발주 자루중량 이상, **+10kg 이하**(`BULK_FIT_KG`). 1,000은 1,000~1,010.
// 추천은 FIFO로 맞는 자루를 남은 발주 수만큼 고르는 것뿐. 모자라면 사람에게 알린다(막지 않는다 — 결정 F).
// 「요구 vs 실제」 차이는 **보여주기만** 한다(백로그 §40). D5 엑셀이 같은 계산을 쓴다.

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

/** 발주 자루 하나가 허용하는 초과 kg — 고정 10kg(사용자 결정 2026-09-15). 부족은 허용하지 않는다 */
export const BULK_FIT_KG = 10

/** 재고 자루가 발주 자루 하나를 그대로 만족하는가 — `unitKg ≤ w ≤ unitKg + BULK_FIT_KG` */
export function fitsUnit(weightPerUnit: number, unitKg: number): boolean {
  return weightPerUnit >= unitKg - 1e-9 && weightPerUnit <= unitKg + BULK_FIT_KG + 1e-9
}

export type BulkDelta = {
  /** 실제 − 요구 (kg, 소수 첫째 자리) */
  deltaKg: number
  /** 요구 대비 비율. 요구가 0이면 null */
  deltaPct: number | null
  level: 'exact' | 'over' | 'under'
}

/**
 * 요구 kg 대비 실제 kg 차이. `level`은 `toleranceKg` 기준 — 0 이상 tolerance 이하면 `exact`(추천과 같은 폭).
 * `toleranceKg` 기본 = 0(딱 맞을 때만 exact). 호출부는 보통 발주 자루 수 × `BULK_FIT_KG`를 넣는다
 */
export function bulkDelta(requiredKg: number, actualKg: number, toleranceKg = 0): BulkDelta {
  const deltaKg = Math.round((actualKg - requiredKg) * 10) / 10
  const deltaPct = requiredKg > 0 ? deltaKg / requiredKg : null
  const within = deltaKg >= 0 && deltaKg <= toleranceKg + 1e-9
  return {
    deltaPct,
    deltaKg,
    level: within ? 'exact' : deltaKg > 0 ? 'over' : 'under',
  }
}

// ------------------------------------------------------
// 추천 — 맞는 자루를 FIFO로 통째
// ------------------------------------------------------

/** 자루 행 — `count>1`이면 같은 중량 자루 N개 묶음. **입력 순서가 FIFO**여야 한다(호출부가 정렬해 넘긴다) */
export type BulkBagLike = {
  packageId: number
  weightPerUnit: number
  /** 가용 자루 수 */
  available: number
}

export type BulkWholeSuggestion = {
  /** 통째로 쓰는 자루 (packageId, 자루 수) — FIFO 순 */
  whole: { packageId: number; count: number }[]
  /** 고른 kg 합 */
  totalKg: number
  /** 맞는 자루가 없어 못 채운 발주 자루 수 */
  shortUnits: number
}

/**
 * 발주 `units`자루 × `unitKg`를 **맞는 자루만으로** 채운다. 오래된 순으로 `fitsUnit` 자루를 1자루씩(count>1 행은 남은 만큼).
 * 안 맞는 자루는 건너뛴다 — 쪼개기는 여기 몫이 아니다(결정 M). `bags`는 FIFO 순이어야 한다.
 */
export function suggestBulkWhole(unitKg: number, units: number, bags: BulkBagLike[]): BulkWholeSuggestion {
  const whole: BulkWholeSuggestion['whole'] = []
  let left = Math.max(0, units)
  let totalKg = 0
  for (const b of bags) {
    if (left <= 0) break
    if (b.available <= 0 || !fitsUnit(b.weightPerUnit, unitKg)) continue
    const take = Math.min(b.available, left)
    whole.push({ packageId: b.packageId, count: take })
    left -= take
    totalKg += take * b.weightPerUnit
  }
  return { whole, totalKg: Math.round(totalKg * 1000) / 1000, shortUnits: left }
}
