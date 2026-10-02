import type { StockChartItem } from '@/components/statistics/StockChart'
import type { StockStatisticsData } from '@/app/actions/stock-statistics'

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

// ── 표·모바일 목록 (작업지시 ⑫ A-1) ──────────────────────────────────────

/** 탭별 이름 칸 머리와 세는 말 — 「나머지 N명 더 보기」·「총 입고 많은 순 · N명」 */
export const STOCK_TAB_META: Record<StockTab, { column: string; unit: string }> = {
  farmer: { column: '생산자', unit: '명' },
  group: { column: '작목반', unit: '곳' },
  variety: { column: '품종', unit: '종' },
}

/** 합계 표는 상위 20줄 + 더 보기(판매분석과 같다) */
export const STOCK_LIMIT = 20

/** 입고순 = 총 입고 많은 순(서버 기본) · 미처리순 = 아직 창고에 남은 벼 많은 순(「누구 벼가 아직 남았나」) */
export type StockSort = 'total' | 'available'

/** 세 탭의 줄을 한 모양으로 — PC 표와 모바일 목록이 같이 쓴다 */
export type StockListRow = {
  key: string
  name: string
  /** 생산자 줄의 작목반 */
  group?: string
  /** 작목반 줄의 인증 */
  cert?: string
  /** 작목반 줄의 생산자 수 */
  farmerCount?: number
  totalKg: number
  consumedKg: number
  releasedKg: number
  availableKg: number
  /** 재고율(%) = 미처리 ÷ 총 입고 */
  stockRate: number
}

export function toStockRows(tab: StockTab, data: StockStatisticsData): StockListRow[] {
  type Nums = Pick<StockListRow, 'totalKg' | 'consumedKg' | 'releasedKg' | 'availableKg' | 'stockRate'>
  const nums = (r: Nums): Nums => ({
    totalKg: r.totalKg,
    consumedKg: r.consumedKg,
    releasedKg: r.releasedKg,
    availableKg: r.availableKg,
    stockRate: r.stockRate,
  })
  if (tab === 'farmer') {
    return data.byFarmer.map(r => ({ key: `f${r.farmerId}`, name: r.farmerName, group: r.groupName, ...nums(r) }))
  }
  if (tab === 'group') {
    return data.byGroup.map(r => ({
      key: `g${r.groupId}`,
      name: r.groupName,
      cert: r.certType,
      farmerCount: r.farmerCount,
      ...nums(r),
    }))
  }
  return data.byVariety.map(r => ({ key: `v${r.varietyId}`, name: r.varietyName, ...nums(r) }))
}

export function sortStockRows(rows: StockListRow[], sort: StockSort): StockListRow[] {
  const by = sort === 'available'
    ? (a: StockListRow, b: StockListRow) => b.availableKg - a.availableKg || b.totalKg - a.totalKg
    : (a: StockListRow, b: StockListRow) => b.totalKg - a.totalKg
  return [...rows].sort(by)
}

/** 재고율 판정 색 — 낮을수록 좋다(처리 완료). 대비 되는 진한 톤(작업지시 ⑫ B-3). PC 표·모바일 목록 공용 */
export function stockRateTone(rate: number): string {
  if (rate <= 20) return 'text-emerald-700'
  if (rate <= 50) return 'text-amber-700'
  return 'text-red-600'
}
