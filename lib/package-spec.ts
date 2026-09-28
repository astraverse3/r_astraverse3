// 포장 규격 문자열 — 중량 파싱과 「만들 규격」 버튼 목록 (백로그 §48 · `docs/plan/plan-규격버튼-SKU연동.md`)
//
// 의존성 없는 순수 모듈이다. 🔴 엑셀 파서(`purchase-order-parser.ts`)에 두지 않는 이유 —
// 그 파일은 xlsx를 import하므로 포장·재포장 다이얼로그가 끌어오면 번들에 xlsx가 딸려 올 수 있다.
// 규칙은 한 곳이다: 파서의 `normalizeSpec`도 이 `specWeightKg`를 부른다.

/**
 * 규격 → kg. `907g`→0.907 · `1kg`→1 · `1,000kg`→1000 · 단위 없음·파싱 불가→null.
 * 공백·콤마는 무시한다(`1 kg` = `1kg`).
 */
export function specWeightKg(spec: string): number | null {
  const m = /^([\d.]+)(kg|g)$/i.exec(spec.replace(/[\s,]/g, ''))
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return null
  return m[2].toLowerCase() === 'kg' ? n : n / 1000
}

type SpecButton = { label: string; weight: number | null }

/** 톤백·잔량·기타처럼 무게가 정해지지 않은 버튼(`null` 또는 0 sentinel) */
const isSentinel = (b: SpecButton) => b.weight === null || b.weight <= 0

/**
 * 고정 버튼 목록에 **SKU에만 있는 규격**을 끼워 넣는다(백로그 §48).
 *
 * - 고정 목록의 순서·값은 그대로 둔다 — 그 품종에 SKU가 없는 규격(예: 8kg)도 지금처럼 만들 수 있어야 한다
 *   (저장할 때 SKU가 자동으로 생기는 흐름, `findOrCreateProductType`)
 * - 끼울 자리는 **무게 내림차순** — 907g은 1kg 뒤, 끝의 센티널(잔량) 앞
 * - 무게를 못 읽는 SKU 규격은 버린다(단중을 채울 수 없어 버튼으로 만들 수 없다)
 */
export function mergeSpecButtons<T extends SpecButton>(
  base: readonly T[],
  skuSpecs: readonly string[],
): (T | { label: string; weight: number })[] {
  const known = new Set(base.map((b) => b.label))
  const extras = [...new Set(skuSpecs)]
    .filter((s) => !known.has(s))
    .map((label) => ({ label, weight: specWeightKg(label) }))
    .filter((e): e is { label: string; weight: number } => e.weight !== null)
    .sort((a, b) => b.weight - a.weight)
  if (extras.length === 0) return [...base]

  const out: (T | { label: string; weight: number })[] = []
  let seenNumeric = false
  for (const b of base) {
    if (isSentinel(b)) {
      // 앞쪽 센티널(톤백)은 그대로, 숫자 규격 **뒤**의 센티널(잔량) 앞에서 남은 걸 다 쏟는다
      if (seenNumeric) out.push(...extras.splice(0))
    } else {
      seenNumeric = true
      while (extras.length > 0 && extras[0].weight > (b.weight as number)) out.push(extras.shift()!)
    }
    out.push(b)
  }
  out.push(...extras)
  return out
}
