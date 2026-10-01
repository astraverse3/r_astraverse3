// 발주서 매트릭스 — 포장지·규격 수정 팝업의 선택지 (plan-매트릭스-포장지규격-수정 ②)
// 'use server' 아님(테스트 가능).
//
// 🔴 고치는 것은 SKU가 아니라 **엑셀에서 읽은 원본 값**(`packageType`·`rawPackaging`)이다. 고른 뒤
//    SKU는 매처가 정한다. 그래서 선택지는 「지금 등록된 활성 SKU에 실제로 있는 값」만 낸다 —
//    없는 조합을 고르면 매처가 실패하고, 9/16에 철회한 수동지정처럼 화면이 SKU를 만들어 낼 수도 없다.

import { matchKey, type MatcherProductType } from './purchase-order-matcher'
import { compareSpec } from './package-spec'

/** 원본 규격 sentinel — 수정 대상이 아니다(톤백은 자루중량 축, 잔량은 판매 SKU가 아니다) */
const NOT_EDITABLE_SPECS = new Set(['톤백', '잔량'])

export type ColumnEditField = 'packaging' | 'packageType'

export type ColumnEditOption = {
  value: string
  current: boolean
  disabled: boolean
  /** 막힌 이유 — 「5kg 없음」 */
  reason: string | null
}

const sameItem = (a: MatcherProductType, b: MatcherProductType) =>
  a.varietyId === b.varietyId && a.millingType === b.millingType

/**
 * 포장지 선택지 — `scope`는 바꿀 묶음의 SKU들(같은 품종·도정·포장지, 규격만 다르다).
 * 다른 포장지로 옮기려면 **묶음 안 모든 규격**에 그 포장지 SKU가 있어야 한다. 하나라도 없으면 막고 이유를 적는다.
 */
export function packagingOptions(
  scope: readonly MatcherProductType[],
  all: readonly MatcherProductType[],
): ColumnEditOption[] {
  const head = scope[0]
  if (!head) return []
  const specs = [...new Map(scope.map((s) => [matchKey(s.packageType), s.packageType])).entries()]

  const byPackaging = new Map<string, MatcherProductType[]>()
  for (const p of all) {
    if (!p.active || !sameItem(p, head)) continue
    // 톤백 전용 포장지가 「10kg 없음」으로 막힌 채 줄줄이 뜨면 시끄럽다 — 처음부터 후보가 아니다
    if (NOT_EDITABLE_SPECS.has(p.packageType)) continue
    const list = byPackaging.get(p.packagingName)
    if (list) list.push(p)
    else byPackaging.set(p.packagingName, [p])
  }

  return [...byPackaging.entries()]
    .map(([name, skus]) => {
      const have = new Set(skus.map((s) => matchKey(s.packageType)))
      const missing = specs.filter(([key]) => !have.has(key)).map(([, label]) => label)
      const current = name === head.packagingName
      return {
        value: name,
        current,
        disabled: current || missing.length > 0,
        reason: current ? null : missing.length > 0 ? `${missing.join('·')} 없음` : null,
      }
    })
    // 지금 값 → 고를 수 있는 것 → 막힌 것, 그 안에서 이름순
    .sort(
      (a, b) =>
        Number(b.current) - Number(a.current) ||
        Number(a.disabled) - Number(b.disabled) ||
        a.value.localeCompare(b.value, 'ko'),
    )
}

/**
 * 규격 선택지 — `scope`는 바꿀 열의 SKU 하나. 같은 품종·도정·**포장지**의 활성 SKU 규격들.
 * 규격 버튼과 같은 순서(`compareSpec`, 무거운 것부터). 톤백·잔량은 뺀다.
 */
export function packageTypeOptions(
  scope: MatcherProductType,
  all: readonly MatcherProductType[],
): ColumnEditOption[] {
  const seen = new Map<string, MatcherProductType>()
  for (const p of all) {
    if (!p.active || !sameItem(p, scope) || p.packagingId !== scope.packagingId) continue
    if (NOT_EDITABLE_SPECS.has(p.packageType)) continue
    const key = matchKey(p.packageType)
    if (!seen.has(key)) seen.set(key, p)
  }
  const currentKey = matchKey(scope.packageType)
  return [...seen.entries()]
    .sort(([, a], [, b]) => compareSpec(a.packageType, b.packageType))
    .map(([key, p]) => ({
      value: p.packageType,
      current: key === currentKey,
      disabled: key === currentKey,
      reason: null,
    }))
}

/** 이 SKU 규격을 수정 대상으로 받는가 — 톤백·잔량 열은 이번 범위가 아니다 */
export function isEditableSpec(packageType: string): boolean {
  return !NOT_EDITABLE_SPECS.has(packageType)
}
