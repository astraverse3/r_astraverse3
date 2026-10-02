import type { StockCategory } from '@prisma/client'
import type { SalesAxis, SalesChannel } from '@/lib/sales-stats'
import { DEFAULT_SALES_PERIOD, presetRange, type SalesPeriodPreset, type SalesPresetWithRange } from '@/lib/sales-period'

export type SalesTab = SalesAxis

/** 판매 탭 4개 + 원물출고 — 원물출고는 구분선 뒤 5번째(작업지시 ⑪ A-1 ②) */
export type StatsTab = SalesTab | 'raw'

/** `short` = 모바일 라벨 — 「별」을 떼야 탭 5개가 360 폭에 들어간다(작업지시 ⑪ A-3). 표 머리글(column)과 같은 말 */
export const SALES_TABS: { key: SalesTab; label: string; short: string; column: string }[] = [
  { key: 'channel', label: '채널별', short: '채널', column: '채널' },
  { key: 'customer', label: '거래처별', short: '거래처', column: '거래처' },
  { key: 'variety', label: '품종별', short: '품종', column: '품종' },
  { key: 'product', label: '제품별', short: '제품', column: '제품' },
]

/**
 * 거래처 탭은 앞 20곳만(작업지시 ⑪ A-1 ③). 엑셀은 전체.
 * 거래처 = 모든 채널에서 발주처(`PurchaseOrder.vendor`)다. 택배는 발주처가 판매처(스토어·식당)라 여러 곳이고
 * 개인 주문자는 수령인 쪽이라 세지 않는다 — 「수백 곳」은 아니다(10/2 실측 8곳). 서울급식은 구청별로 는다
 */
export const CUSTOMER_LIMIT = 20

/** 탭 표에 보일 줄 + 접어 둔 줄 수 — PC 표·모바일 목록이 같은 규칙을 쓴다 */
export function visibleRows<T>(rows: T[], tab: SalesTab, showAll: boolean): { rows: T[]; hidden: number } {
  if (tab !== 'customer' || showAll || rows.length <= CUSTOMER_LIMIT) return { rows, hidden: 0 }
  return { rows: rows.slice(0, CUSTOMER_LIMIT), hidden: rows.length - CUSTOMER_LIMIT }
}

export function formatKg(v: number) {
  return v.toLocaleString('ko-KR', { maximumFractionDigits: 1 })
}

/** 원물출고 — kg를 톤으로, 소수 첫째 자리까지 */
export function formatTon(kg: number) {
  return (kg / 1000).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export const CATEGORY_OPTIONS = [
  { id: 'RICE' as const, label: '벼' },
  { id: 'MISC_GRAIN' as const, label: '잡곡' },
]

/** 기간 한 벌 — 판매·원물출고 탭이 따로 든다 */
export type PeriodDraft = {
  preset: SalesPeriodPreset
  from: string
  to: string
}

/** 화면에서 고르는 조건 한 벌 — 고르는 중(draft)과 마지막으로 조회한 것(applied)을 같은 모양으로 둔다 */
export type SalesDraft = PeriodDraft & {
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

/**
 * 원물출고 탭 기본 기간 = 올해(작업지시 ⑪ A-4). 출고가 1월에 몰려 있어서
 * 「이번 달」이면 늘 비어 보인다 — 그래서 판매 탭과 기간을 따로 든다
 */
const DEFAULT_RAW_PERIOD: SalesPresetWithRange = 'thisYear'

export function defaultRawDraft(today: string): PeriodDraft {
  return { preset: DEFAULT_RAW_PERIOD, ...presetRange(DEFAULT_RAW_PERIOD, today) }
}

/** 프리셋 고르기 — 「직접 지정」은 지금 기간에서 손으로 고쳐 나간다 */
export function withPreset<T extends PeriodDraft>(d: T, preset: SalesPeriodPreset, today: string): T {
  return preset === 'custom' ? { ...d, preset } : { ...d, preset, ...presetRange(preset, today) }
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
