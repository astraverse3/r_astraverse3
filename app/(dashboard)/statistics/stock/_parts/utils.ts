import type { StockChartItem } from '@/components/statistics/StockChart'

export type StockTab = 'farmer' | 'group' | 'variety'

export const CERT_TYPE_OPTIONS = ['유기농', '무농약', '일반'] as const
export const MAX_CHART_ITEMS = 20

export function formatKg(v: number) {
  return v.toLocaleString('ko-KR', { maximumFractionDigits: 1 })
}

export function toChartItems(
  rows: { name: string; consumed: number; available: number; released: number; total: number }[],
): StockChartItem[] {
  // 기타 집계 없이 상위 MAX_CHART_ITEMS개만 표시 (기타가 너무 커서 왜곡되는 문제 방지)
  return rows.slice(0, MAX_CHART_ITEMS).map(r => ({
    name: r.name,
    consumed: r.consumed,
    available: r.available,
    released: r.released,
    total: r.total,
  }))
}
