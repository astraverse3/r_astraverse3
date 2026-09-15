// 발주서 톤백(벌크) 셀 — 순수 로직 (계획서 D2d 결정 E'·I)
//
// 톤백은 자루마다 중량이 제각각이라(실측 124종) 「개수」 추천이 성립하지 않는다.
// 그래서 **kg으로 FIFO**를 돈다(사용자 결정 2026-09-14): 오래된 자루부터 kg을 채워 나가고,
// 요구량을 넘기는 자루 하나만 쪼갠다(`createRepack`). 자루가 여러 개 쓰여도 된다.
// 추천 목표는 요구 kg가 아니라 **요구 + 자루 무게**다(결정 K, 2026-09-15): 1톤 주문은 1,003kg으로 맞춰 보낸다.
// 「요구 vs 실제」 차이는 **보여주기만** 한다(백로그 §40 — 막지 않는다). D5 엑셀이 같은 계산을 쓴다.

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

// ------------------------------------------------------
// kg FIFO 추천
// ------------------------------------------------------

/** 톤백 자루 무게(kg/자루). 추천 목표에 요구 자루 수만큼 더한다(결정 K). 사람이 ±1kg로 조절할 수 있다 */
export const BULK_TARE_KG = 3

/** 추천 목표 kg = 남은 요구 kg + 자루 무게 × 남은 요구 자루 수. 남은 요구가 0이면 0 */
export function bulkTargetKg(remainingKg: number, remainingBags: number): number {
  if (remainingKg <= 0 || remainingBags <= 0) return 0
  return Math.round((remainingKg + BULK_TARE_KG * remainingBags) * 1000) / 1000
}

/** 자루 행 — `count>1`이면 같은 중량 자루 N개 묶음. **입력 순서가 FIFO**여야 한다(호출부가 정렬해 넘긴다) */
export type BulkBagLike = {
  packageId: number
  weightPerUnit: number
  /** 가용 자루 수 */
  available: number
}

export type BulkSuggestion = {
  /** 통째로 쓰는 자루 (packageId, 자루 수) */
  whole: { packageId: number; count: number }[]
  /** 요구량을 넘기는 자루 하나를 쪼개 쓸 몫. 딱 맞아떨어지거나 재고가 모자라면 null */
  split: { packageId: number; kg: number } | null
  /** 통째 + 쪼갠 몫의 합 */
  totalKg: number
  /** 재고가 모자라 못 채운 kg */
  shortageKg: number
}

/**
 * kg FIFO 그리디. 오래된 자루부터 통째로 담다가, 다음 자루가 남은 요구량을 넘기면
 * 그 자루에서 남은 만큼만 쪼개 쓰고 멈춘다. 자루가 여러 개 쓰여도 된다(사용자 결정).
 * `bags`는 FIFO 순으로 정렬돼 있어야 한다.
 */
export function suggestBulkAllocation(requiredKg: number, bags: BulkBagLike[]): BulkSuggestion {
  const whole: BulkSuggestion['whole'] = []
  let split: BulkSuggestion['split'] = null
  let remaining = Math.round(requiredKg * 1000) / 1000

  for (const b of bags) {
    if (remaining <= 0) break
    if (b.available <= 0 || b.weightPerUnit <= 0) continue
    // 이 행에서 통째로 담을 수 있는 자루 수
    const fit = Math.min(b.available, Math.floor(remaining / b.weightPerUnit + 1e-9))
    if (fit > 0) {
      whole.push({ packageId: b.packageId, count: fit })
      remaining = Math.round((remaining - fit * b.weightPerUnit) * 1000) / 1000
    }
    // 아직 남았고 이 행에 자루가 더 있으면 → 그 자루를 쪼갠다
    if (remaining > 0 && fit < b.available) {
      split = { packageId: b.packageId, kg: remaining }
      remaining = 0
      break
    }
  }

  const totalKg = Math.round((requiredKg - remaining) * 1000) / 1000
  return { whole, split, totalKg, shortageKg: Math.round(remaining * 1000) / 1000 }
}
