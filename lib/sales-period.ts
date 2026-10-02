// 판매분석 기간 프리셋 — 'use server' 아님(테스트 가능).
// 날짜는 전부 KST 'yyyy-mm-dd' 문자열로 다룬다. 달력 계산만 하고 프로세스 시간대에 기대지 않는다(lib/kst-date.ts).
// 「최근 N개월」은 이번 달을 포함한 N개 달의 1일부터 — 월별 칸이 잘리지 않게 달 경계에 맞춘다.

export const SALES_PERIOD_PRESETS = [
  { key: 'thisMonth', label: '이번 달' },
  { key: 'lastMonth', label: '지난 달' },
  { key: 'last3m', label: '최근 3개월' },
  { key: 'last6m', label: '최근 6개월' },
  { key: 'thisYear', label: '올해' },
  { key: 'last12m', label: '최근 1년' },
  { key: 'custom', label: '직접 지정' },
] as const

export type SalesPeriodPreset = (typeof SALES_PERIOD_PRESETS)[number]['key']

export type SalesPresetWithRange = Exclude<SalesPeriodPreset, 'custom'>

export const DEFAULT_SALES_PERIOD: SalesPresetWithRange = 'thisMonth'

const pad = (n: number) => String(n).padStart(2, '0')

/** (연, 0-based 월)의 1일 'yyyy-mm-01' — 월이 범위를 넘으면 해를 넘긴다 */
function firstOfMonth(year: number, month0: number): string {
  const d = new Date(Date.UTC(year, month0, 1))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`
}

/** (연, 0-based 월)의 말일 */
function lastOfMonth(year: number, month0: number): string {
  const d = new Date(Date.UTC(year, month0 + 1, 0))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** 프리셋 → 기간(양 끝 포함). today는 KST 'yyyy-mm-dd'(`todayKst()`) */
export function presetRange(preset: SalesPresetWithRange, today: string): { from: string; to: string } {
  const [y, m] = today.split('-').map(Number)
  const m0 = m - 1
  switch (preset) {
    case 'thisMonth':
      return { from: firstOfMonth(y, m0), to: today }
    case 'lastMonth':
      return { from: firstOfMonth(y, m0 - 1), to: lastOfMonth(y, m0 - 1) }
    case 'last3m':
      return { from: firstOfMonth(y, m0 - 2), to: today }
    case 'last6m':
      return { from: firstOfMonth(y, m0 - 5), to: today }
    case 'thisYear':
      return { from: `${y}-01-01`, to: today }
    case 'last12m':
      return { from: firstOfMonth(y, m0 - 11), to: today }
  }
}
