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

/**
 * 재포장 결과로 고를 수 있는 규격 — 실DB에 존재하는 규격 그대로(2026-08-26 실측).
 * 톤백·잔량은 단위 중량이 건마다 달라 사람이 직접 입력한다(weight=null).
 */
export const REPACK_SPECS: { label: string; weight: number | null }[] = [
  { label: PACKAGE_TYPE_TONBAG, weight: null },
  { label: '20kg', weight: 20 },
  { label: '10kg', weight: 10 },
  { label: '8kg', weight: 8 },
  { label: '5kg', weight: 5 },
  { label: '4kg', weight: 4 },
  { label: '3kg', weight: 3 },
  { label: '1kg', weight: 1 },
  { label: PACKAGE_TYPE_REMAINDER, weight: null },
]

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

// ------------------------------------------------------
// 손실 최종 확인 문구 — 노란 경고를 지나쳐도 한 번 더 멈추게 한다
// (docs/plan/plan-재포장-손실-최종확인.md · 재포장 #26 사례)
// ------------------------------------------------------

/**
 * 규격 · 단중 표기 — 규격 라벨에 이미 무게가 들어 있으면 겹쳐 쓰지 않는다(「5kg · 5kg」 방지).
 *
 * 톤백·잔량은 라벨만으로 무게를 알 수 없어 병기가 필요하고,
 * 규격이 `5kg`인데 단중이 4.8이면 어긋난 것이니 그대로 드러내는 편이 낫다.
 */
export function formatSpec(packageType: string, weightPerUnit: number): string {
  const kg = weightPerUnit.toLocaleString()
  return packageType === `${kg}kg` ? packageType : `${packageType} · ${kg}kg`
}

export type LossConfirmSource = {
  varietyName: string
  packageType: string
  weightPerUnit: number
  takeCount: number
}

/**
 * 손실 확인창 본문. 사람은 개수로 세므로 「N개분」을 같이 쓴다 —
 * 단, 쓸 재고의 개당 중량이 전부 같을 때만(톤백·잔량은 자루마다 달라 개수분이 의미 없다).
 */
export function lossConfirmText(
  sources: LossConfirmSource[],
  sourceKg: number,
  resultKg: number,
): string {
  const lossKg = round3(sourceKg - resultKg)
  const kg = (n: number) => `${n.toLocaleString()}kg`

  const one = sources.length === 1 ? sources[0] : null
  const first = one
    ? `${one.varietyName} ${formatSpec(one.packageType, one.weightPerUnit)} ` +
      `${one.takeCount.toLocaleString()}개(${kg(sourceKg)})를 쓰는데 ${kg(resultKg)}만 만들어요.`
    : `쓸 양 ${kg(sourceKg)} 중 ${kg(resultKg)}만 만들어요.`

  const head = sources[0]
  const countable =
    head !== undefined &&
    head.weightPerUnit > 0 &&
    head.packageType !== PACKAGE_TYPE_TONBAG &&
    head.packageType !== PACKAGE_TYPE_REMAINDER &&
    sources.every(s => s.packageType === head.packageType && s.weightPerUnit === head.weightPerUnit)
  let units = ''
  if (countable) {
    const label = formatSpec(head.packageType, head.weightPerUnit)
    const n = round3(lossKg / head.weightPerUnit)
    units = Number.isInteger(n)
      ? `(${label} ${n.toLocaleString()}개분)`
      : `(${label} 약 ${(Math.round(n * 10) / 10).toLocaleString()}개분)`
  }

  return (
    `${first}\n남는 ${kg(lossKg)}${units}은 손실로 사라져요.\n\n` +
    '재포장은 되돌릴 수 없어요. 실제로 없어진 경우에만 기록하세요.'
  )
}
