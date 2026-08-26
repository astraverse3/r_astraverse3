// 재고 재포장 검증·계산 순수 로직 — 'use server' 아님(테스트 가능)
//
// 계획서 docs/plan/plan-재고재포장.md / 결정 #43:
//   분할·병합·규격변경은 전부 「소스 행 N개를 소진하고 결과 행 M개를 만든다 · 중량 보존」 하나의 행위.
//     분할     톤백 1,004kg×1 → 1,000kg×1 + 4kg×1
//     규격변경  잔량 4kg×1     → 1kg×4
//     병합     잔량 10행 84kg → 20kg×4 + 잔량 4kg
//
// DB 접근은 하지 않는다. 액션(repack.ts)이 조회 결과를 넣어 호출한다.

/** 재포장 규격 sentinel — 잔량은 SKU 미부여(productTypeId=null), 톤백은 포장지 '톤백' 강제. */
export const PACKAGE_TYPE_REMAINDER = '잔량'
export const PACKAGE_TYPE_TONBAG = '톤백'

/** 손실이 소스 합의 이 비율을 넘으면 경고(차단은 아님). 실물이라 오차는 존재한다. */
export const LOSS_WARN_RATIO = 0.01

// ------------------------------------------------------
// 입력 타입
// ------------------------------------------------------

/** 소진 대상 재고 행 + 이번에 몇 개를 쓸지. */
export type RepackSource = {
  packageId: number
  /** 동질성 판정 키 (결정 #43 §3.2) */
  varietyId: number
  millingType: string
  source: 'MILLED' | 'PURCHASED'
  category: 'RICE' | 'MISC_GRAIN'
  /** 표시·승계용. PURCHASED 잡곡은 null */
  lotNo: string | null
  packageType: string
  weightPerUnit: number
  /** 가용 개수 = count - SUM(movements.count) */
  available: number
  /** 이번 재포장으로 소진할 개수 */
  takeCount: number
}

/** 새로 만들 재고 행 1줄. */
export type RepackResultLine = {
  packageType: string
  weightPerUnit: number
  count: number
  /** 잔량은 null(SKU 미부여). 그 외는 포장지 마스터 id */
  packagingId: number | null
  /**
   * 출처를 승계할 소스 행 id (결정 #43 §3.4).
   * lotNo·batchId·stockId·varietyId·purchaseVendor·incomingDate·productCode를 이 행에서 가져온다.
   * 소스가 단일 로트면 UI가 자동 지정하고, 2로트 이상이면 사람이 고른다.
   */
  inheritFromPackageId: number
}

// ------------------------------------------------------
// 검증
// ------------------------------------------------------

export type RepackErrorCode =
  | 'NO_SOURCE'
  | 'NO_RESULT'
  | 'MIXED_VARIETY'
  | 'MIXED_MILLING_TYPE'
  | 'MIXED_SOURCE'
  | 'MIXED_CATEGORY'
  | 'INVALID_TAKE_COUNT'
  | 'EXCEEDS_AVAILABLE'
  | 'INVALID_RESULT_LINE'
  | 'UNKNOWN_INHERIT_SOURCE'
  | 'REMAINDER_WITH_PACKAGING'
  | 'RESULT_EXCEEDS_SOURCE'

export type RepackError = { code: RepackErrorCode; message: string }

export type RepackValidation =
  | {
      ok: true
      sourceKg: number
      resultKg: number
      lossKg: number
      /** 손실이 LOSS_WARN_RATIO를 넘음 — 저장 전에 확인을 한 번 받는다(차단 아님) */
      lossWarning: boolean
    }
  | { ok: false; errors: RepackError[] }

const round3 = (n: number): number => Math.round(n * 1000) / 1000

/** 소스 소진 중량 합(kg). */
export function sumSourceKg(sources: RepackSource[]): number {
  return round3(sources.reduce((s, x) => s + x.weightPerUnit * x.takeCount, 0))
}

/** 결과 생성 중량 합(kg). */
export function sumResultKg(results: RepackResultLine[]): number {
  return round3(results.reduce((s, x) => s + x.weightPerUnit * x.count, 0))
}

/**
 * 재포장 입력 전체 검증. 통과하면 중량 합계와 손실을 함께 돌려준다.
 *
 * 차단 조건:
 *   - 소스가 품종·도정유형·출처·분류 중 하나라도 다름 (물리적으로 섞을 수 없다)
 *   - 소진 개수가 가용을 초과 (없는 재고를 쓸 수 없다)
 *   - 결과 중량 합이 소스 합을 초과 (없는 쌀을 만들 수 없다)
 */
export function validateRepack(
  sources: RepackSource[],
  results: RepackResultLine[],
): RepackValidation {
  const errors: RepackError[] = []

  if (sources.length === 0) {
    errors.push({ code: 'NO_SOURCE', message: '재포장할 재고를 선택해 주세요.' })
  }
  if (results.length === 0) {
    errors.push({ code: 'NO_RESULT', message: '만들어질 규격을 한 줄 이상 입력해 주세요.' })
  }
  if (errors.length > 0) return { ok: false, errors }

  // -- 소스 동질성 (§3.2). 로트(lotNo)는 달라도 된다 --
  const head = sources[0]
  if (sources.some((s) => s.varietyId !== head.varietyId)) {
    errors.push({ code: 'MIXED_VARIETY', message: '품종이 다른 재고는 함께 재포장할 수 없습니다.' })
  }
  if (sources.some((s) => s.millingType !== head.millingType)) {
    errors.push({
      code: 'MIXED_MILLING_TYPE',
      message: '도정유형이 다른 재고는 함께 재포장할 수 없습니다.',
    })
  }
  if (sources.some((s) => s.source !== head.source)) {
    errors.push({
      code: 'MIXED_SOURCE',
      message: '도정산과 매입 재고는 함께 재포장할 수 없습니다.',
    })
  }
  if (sources.some((s) => s.category !== head.category)) {
    errors.push({ code: 'MIXED_CATEGORY', message: '벼와 잡곡은 함께 재포장할 수 없습니다.' })
  }

  // -- 소진 개수 --
  for (const s of sources) {
    if (!Number.isInteger(s.takeCount) || s.takeCount <= 0) {
      errors.push({
        code: 'INVALID_TAKE_COUNT',
        message: `소진 개수는 1개 이상의 정수여야 합니다. (재고 #${s.packageId})`,
      })
      continue
    }
    if (s.takeCount > s.available) {
      errors.push({
        code: 'EXCEEDS_AVAILABLE',
        message: `가용 재고(${s.available}개)보다 많이 쓸 수 없습니다. (재고 #${s.packageId})`,
      })
    }
  }

  // -- 결과 줄 --
  const sourceIds = new Set(sources.map((s) => s.packageId))
  for (const [i, r] of results.entries()) {
    const line = i + 1
    if (!r.packageType?.trim()) {
      errors.push({ code: 'INVALID_RESULT_LINE', message: `${line}번째 줄: 규격을 선택해 주세요.` })
    }
    if (!(r.weightPerUnit > 0)) {
      errors.push({
        code: 'INVALID_RESULT_LINE',
        message: `${line}번째 줄: 단위 중량은 0보다 커야 합니다.`,
      })
    }
    if (!Number.isInteger(r.count) || r.count <= 0) {
      errors.push({
        code: 'INVALID_RESULT_LINE',
        message: `${line}번째 줄: 개수는 1개 이상의 정수여야 합니다.`,
      })
    }
    if (!sourceIds.has(r.inheritFromPackageId)) {
      errors.push({
        code: 'UNKNOWN_INHERIT_SOURCE',
        message: `${line}번째 줄: 로트를 선택해 주세요.`,
      })
    }
    // 잔량은 자체 판매하지 않아 SKU를 부여하지 않는다(app/actions/milling.ts:15)
    if (r.packageType === PACKAGE_TYPE_REMAINDER && r.packagingId !== null) {
      errors.push({
        code: 'REMAINDER_WITH_PACKAGING',
        message: `${line}번째 줄: 잔량에는 포장지를 지정하지 않습니다.`,
      })
    }
  }

  if (errors.length > 0) return { ok: false, errors }

  // -- 중량 보존 (§3.5) --
  const sourceKg = sumSourceKg(sources)
  const resultKg = sumResultKg(results)
  if (resultKg > sourceKg) {
    return {
      ok: false,
      errors: [
        {
          code: 'RESULT_EXCEEDS_SOURCE',
          message: `만들 양(${resultKg}kg)이 쓸 양(${sourceKg}kg)보다 많습니다.`,
        },
      ],
    }
  }

  const lossKg = round3(sourceKg - resultKg)
  return {
    ok: true,
    sourceKg,
    resultKg,
    lossKg,
    lossWarning: lossKg > round3(sourceKg * LOSS_WARN_RATIO),
  }
}

// ------------------------------------------------------
// 로트 후보 (§3.3) — 결과 줄이 승계할 소스를 고르는 드롭다운용
// ------------------------------------------------------

export type LotOption = {
  /** 이 로트를 대표하는 소스 행 id — 결과 줄의 inheritFromPackageId가 된다 */
  packageId: number
  lotNo: string | null
  /** 이 로트가 이번 재포장에 내놓는 중량(kg) — 「어느 로트가 얼마나 들어갔는지」 표시용 */
  kg: number
}

/**
 * 소스들을 로트별로 묶어 결과 줄의 승계 후보를 만든다.
 * 같은 로트에 소스 행이 여러 개면 첫 행을 대표로 삼는다(출처 필드가 같으므로 어느 것이든 동일).
 * lotNo가 null인 매입 잡곡은 행마다 별개 후보가 된다(합칠 근거가 없다).
 */
export function buildLotOptions(sources: RepackSource[]): LotOption[] {
  const byLot = new Map<string, LotOption>()
  for (const s of sources) {
    // lotNo가 없으면 행 자체를 키로 — 매입 잡곡은 로트로 묶이지 않는다
    const key = s.lotNo ?? `__pkg_${s.packageId}`
    const kg = s.weightPerUnit * s.takeCount
    const found = byLot.get(key)
    if (found) found.kg = round3(found.kg + kg)
    else byLot.set(key, { packageId: s.packageId, lotNo: s.lotNo, kg: round3(kg) })
  }
  return Array.from(byLot.values())
}
