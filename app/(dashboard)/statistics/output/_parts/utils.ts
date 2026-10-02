import type { StockCategory } from '@prisma/client'
import type { SalesAxis, SalesChannel } from '@/lib/sales-stats'
import { DEFAULT_SALES_PERIOD, presetRange, type SalesPeriodPreset } from '@/lib/sales-period'

export type SalesTab = SalesAxis

/** `short` = 모바일 라벨 — 「별」을 떼야 탭 5개가 360 폭에 들어간다(작업지시 ⑪ A-3). 표 머리글(column)과 같은 말 */
export const SALES_TABS: { key: SalesTab; label: string; short: string; column: string }[] = [
  { key: 'channel', label: '채널별', short: '채널', column: '채널' },
  { key: 'customer', label: '거래처별', short: '거래처', column: '거래처' },
  { key: 'variety', label: '품종별', short: '품종', column: '품종' },
  { key: 'product', label: '제품별', short: '제품', column: '제품' },
]

/** 거래처 탭은 앞 20곳만(작업지시 ⑪ A-1 ③) — 택배는 주문자가 거래처라 곧 수백 곳이 된다. 엑셀은 전체 */
export const CUSTOMER_LIMIT = 20

/** 탭 표에 보일 줄 + 접어 둔 줄 수 — PC 표·모바일 목록이 같은 규칙을 쓴다 */
export function visibleRows<T>(rows: T[], tab: SalesTab, showAll: boolean): { rows: T[]; hidden: number } {
  if (tab !== 'customer' || showAll || rows.length <= CUSTOMER_LIMIT) return { rows, hidden: 0 }
  return { rows: rows.slice(0, CUSTOMER_LIMIT), hidden: rows.length - CUSTOMER_LIMIT }
}

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

/** 모바일 한 줄용 — 양 끝이 올해면 연도를 뗀다(「10-01 ~ 10-02」) */
export function shortPeriodText(from: string, to: string, today: string): string {
  const year = today.slice(0, 4)
  if (from.slice(0, 4) !== year || to.slice(0, 4) !== year) return periodText(from, to)
  return periodText(from.slice(5), to.slice(5))
}

/** 걸린 조건 종류 수(곡종·채널·품종) — 모바일 「조건 N」. 기간은 줄에 늘 보여서 세지 않는다 */
export function conditionCount(d: SalesDraft): number {
  return [d.categories, d.channels, d.varietyIds].filter(list => list.length > 0).length
}
