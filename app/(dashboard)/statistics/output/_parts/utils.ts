import type { StockCategory } from '@prisma/client'
import type { SalesAxis, SalesChannel } from '@/lib/sales-stats'
import { DEFAULT_SALES_PERIOD, presetRange, type SalesPeriodPreset } from '@/lib/sales-period'

export type SalesTab = SalesAxis

export const SALES_TABS: { key: SalesTab; label: string; column: string }[] = [
  { key: 'channel', label: '채널별', column: '채널' },
  { key: 'customer', label: '거래처별', column: '거래처' },
  { key: 'variety', label: '품종별', column: '품종' },
  { key: 'product', label: '제품별', column: '제품' },
]

export function formatKg(v: number) {
  return v.toLocaleString('ko-KR', { maximumFractionDigits: 1 })
}

export const CATEGORY_OPTIONS = [
  { id: 'RICE' as const, label: '벼' },
  { id: 'MISC_GRAIN' as const, label: '잡곡' },
]

/** 화면에서 고르는 조건 한 벌 — 고르는 중(draft)과 마지막으로 조회한 것(applied)을 같은 모양으로 둔다 */
export type SalesDraft = {
  preset: SalesPeriodPreset
  from: string
  to: string
  categories: StockCategory[]
  channels: SalesChannel[]
  varietyIds: number[]
}

export function defaultDraft(today: string): SalesDraft {
  return {
    preset: DEFAULT_SALES_PERIOD,
    ...presetRange(DEFAULT_SALES_PERIOD, today),
    categories: [],
    channels: [],
    varietyIds: [],
  }
}

export function toggleIn<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter(x => x !== v) : [...list, v]
}

/** 「2026-10-01 ~ 2026-10-02」 — 같은 날이면 하루만 */
export function periodText(from: string, to: string): string {
  return from === to ? from : `${from} ~ ${to}`
}
