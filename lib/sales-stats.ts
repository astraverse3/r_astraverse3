// 판매분석 집계 — 'use server' 아님(테스트 가능). 계획서 docs/plan/plan-판매분석.md
//
// 「판매」 = 제품재고에서 「판매」 사유로 빠진 것(PackageMovement type=SALE). 경로는 둘이다.
//   - 발주서 일괄차감: orderItem이 있다 → 채널·거래처(발주처)는 PurchaseOrder에서
//   - 차감 창 직접 판매: orderItem이 없다 → 채널 「직접판매」, 거래처는 손으로 적은 customer
// 증정·분실·파손·기타·재포장은 판매가 아니라 여기 들어오지 않는다(조회에서 type=SALE만).
// 금액 필드는 없다(결정 #25) — kg·개수만 센다.

import type { PurchaseChannel, StockCategory } from '@prisma/client'
import type { GroupBy } from '@/app/actions/statistics'
import { getDisplayMillingType } from './milling-type-display'
import { CHANNEL_META } from './purchase-channel'
import { bucketKeyOf, bucketsBetween } from './stats-bucket'

export const SALES_CHANNELS = ['DELIVERY', 'EMART', 'MEAL_SEOUL', 'MEAL_HAENAM', 'CORPORATE', 'DIRECT'] as const
export type SalesChannel = (typeof SALES_CHANNELS)[number]

export const SALES_CHANNEL_LABEL: Record<SalesChannel, string> = {
  DELIVERY: CHANNEL_META.DELIVERY.label,
  EMART: CHANNEL_META.EMART.label,
  MEAL_SEOUL: CHANNEL_META.MEAL_SEOUL.label,
  MEAL_HAENAM: CHANNEL_META.MEAL_HAENAM.label,
  CORPORATE: CHANNEL_META.CORPORATE.label,
  DIRECT: '직접판매',
}

export const NO_CUSTOMER = '거래처 미입력'

// 잡곡 SKU의 도정유형 자리 — 표시하지 않는다(purchase-order-add.ts와 같은 값)
const MISC_MILLING_SENTINEL = '기타'

/** 집계 단위 한 줄 = 차감 한 줄 */
export type SaleLine = {
  occurredAt: Date
  count: number
  kg: number
  channel: SalesChannel
  customer: string
  /** 「주문 수」를 세는 키 — 발주서는 주문, 직접 판매는 차감 한 번(같은 createdAt·거래처) */
  orderKey: string
  category: StockCategory
  varietyId: number | null
  variety: string
  productKey: string
  productLabel: string
}

type VarietyRef = { id: number; name: string; type: string | null }

/** DB 조회 결과 한 줄 — `app/actions/sales-statistics.ts`의 select와 같은 모양 */
export type SaleMovementRow = {
  count: number
  occurredAt: Date
  createdAt: Date
  customer: string | null
  orderItem: { order: { id: number; channel: PurchaseChannel; vendor: string } } | null
  package: {
    weightPerUnit: number
    packageType: string
    category: StockCategory
    stock: { variety: VarietyRef } | null
    variety: VarietyRef | null
    productType: { id: number; millingType: string; packaging: { name: string } } | null
  }
}

export function toSaleLine(row: SaleMovementRow): SaleLine {
  const pkg = row.package
  // 도정산은 원물(stock)의 품종, 매입은 행에 직접 — 제품재고 목록(getPackages)과 같은 규칙
  const variety = pkg.stock?.variety ?? pkg.variety
  const varietyName = variety?.name ?? '품종 미상'
  const order = row.orderItem?.order
  const customer = order ? order.vendor : row.customer?.trim() || NO_CUSTOMER

  const pt = pkg.productType
  const milling =
    pt && pt.millingType !== MISC_MILLING_SENTINEL ? getDisplayMillingType(pt.millingType, variety?.type) : null
  // 포장지 이름이 규격과 같으면(톤백) 「톤백 · 톤백」이 되니 한 번만
  const packaging = pt && pt.packaging.name !== pkg.packageType ? ` · ${pt.packaging.name}` : ''
  const productLabel = [varietyName, milling, pkg.packageType].filter(Boolean).join(' ') + packaging

  return {
    occurredAt: row.occurredAt,
    count: row.count,
    kg: row.count * pkg.weightPerUnit,
    channel: order ? order.channel : 'DIRECT',
    customer,
    orderKey: order ? `o:${order.id}` : `d:${row.createdAt.getTime()}|${customer}`,
    category: pkg.category,
    varietyId: variety?.id ?? null,
    variety: varietyName,
    // SKU가 없는 행(잔량)은 품종·규격으로 묶는다
    productKey: pt ? `sku:${pt.id}` : `raw:${varietyName}|${pkg.packageType}`,
    productLabel,
  }
}

export type SalesFilter = {
  categories?: StockCategory[]
  channels?: SalesChannel[]
  varietyIds?: number[]
}

/** 빈 배열·undefined는 「전체」 */
export function filterSales(lines: SaleLine[], f: SalesFilter): SaleLine[] {
  return lines.filter(
    l =>
      (!f.categories?.length || f.categories.includes(l.category)) &&
      (!f.channels?.length || f.channels.includes(l.channel)) &&
      (!f.varietyIds?.length || (l.varietyId !== null && f.varietyIds.includes(l.varietyId))),
  )
}

// float 누적(0.907kg 등)을 화면에 내보내기 전 소수 첫째 자리로
const round1 = (v: number) => Math.round(v * 10) / 10

export type SalesSummary = { kg: number; count: number; orders: number; customers: number }

export function summarizeSales(lines: SaleLine[]): SalesSummary {
  return {
    kg: round1(lines.reduce((s, l) => s + l.kg, 0)),
    count: lines.reduce((s, l) => s + l.count, 0),
    orders: new Set(lines.map(l => l.orderKey)).size,
    customers: new Set(lines.map(l => `${l.channel}|${l.customer}`)).size,
  }
}

/**
 * 기간 길이로 추이 칸을 정한다 — 31일 이하 일별, 186일 이하 주별, 그 이상 월별.
 * from·to는 KST 'yyyy-mm-dd'(양 끝 포함).
 */
export function pickGroupBy(fromYmd: string, toYmd: string): GroupBy {
  const days = (Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / 86_400_000 + 1
  if (days <= 31) return 'day'
  if (days <= 186) return 'week'
  return 'month'
}

export type SalesTrendBucket = {
  key: string
  tooltipLabel: string
  total: number
  byChannel: Record<SalesChannel, number>
}

const emptyByChannel = (): Record<SalesChannel, number> =>
  Object.fromEntries(SALES_CHANNELS.map(c => [c, 0])) as Record<SalesChannel, number>

/** 기간 안의 칸 전부(빈 칸 포함) × 채널별 kg. from·to는 그 KST 날 안의 아무 순간 */
export function salesTrend(lines: SaleLine[], from: Date, to: Date, groupBy: GroupBy): SalesTrendBucket[] {
  const buckets = bucketsBetween(from, to, groupBy).map(b => ({
    ...b,
    total: 0,
    byChannel: emptyByChannel(),
  }))
  const byKey = new Map(buckets.map(b => [b.key, b]))
  for (const l of lines) {
    const b = byKey.get(bucketKeyOf(l.occurredAt, groupBy))
    if (!b) continue // 조회 기간 밖 — 조회 조건과 같은 경계라 실제로는 없다
    b.total += l.kg
    b.byChannel[l.channel] += l.kg
  }
  return buckets.map(b => ({
    ...b,
    total: round1(b.total),
    byChannel: Object.fromEntries(SALES_CHANNELS.map(c => [c, round1(b.byChannel[c])])) as Record<SalesChannel, number>,
  }))
}

export type SalesAxis = 'channel' | 'customer' | 'variety' | 'product'

export type SalesBreakdownRow = {
  key: string
  label: string
  /** 보조 표기 — 거래처의 채널 */
  sub: string | null
  /** 채널별·거래처별 줄의 채널(색을 칠할 때). 품종·제품 줄은 여러 채널이 섞여 null */
  channel: SalesChannel | null
  kg: number
  count: number
  orders: number
  /** 기간 판매량 대비 % (소수 첫째 자리) */
  share: number
}

type AxisKey = { key: string; label: string; sub: string | null; channel: SalesChannel | null }

function axisOf(l: SaleLine, axis: SalesAxis): AxisKey {
  switch (axis) {
    case 'channel':
      return { key: l.channel, label: SALES_CHANNEL_LABEL[l.channel], sub: null, channel: l.channel }
    case 'customer':
      // 같은 이름이 채널마다 다른 거래처일 수 있어 채널까지 키로 쓴다
      return { key: `${l.channel}|${l.customer}`, label: l.customer, sub: SALES_CHANNEL_LABEL[l.channel], channel: l.channel }
    case 'variety':
      return { key: l.varietyId === null ? `name:${l.variety}` : `id:${l.varietyId}`, label: l.variety, sub: null, channel: null }
    case 'product':
      return { key: l.productKey, label: l.productLabel, sub: null, channel: null }
  }
}

/** 축별 합계 — kg 많은 순(같으면 이름순) */
export function salesBreakdown(lines: SaleLine[], axis: SalesAxis): SalesBreakdownRow[] {
  const total = lines.reduce((s, l) => s + l.kg, 0)
  const map = new Map<string, Omit<AxisKey, 'key'> & { kg: number; count: number; orders: Set<string> }>()
  for (const l of lines) {
    const { key, ...ref } = axisOf(l, axis)
    const row = map.get(key) ?? { ...ref, kg: 0, count: 0, orders: new Set<string>() }
    row.kg += l.kg
    row.count += l.count
    row.orders.add(l.orderKey)
    map.set(key, row)
  }
  return [...map.entries()]
    .map(([key, r]) => ({
      key,
      label: r.label,
      sub: r.sub,
      channel: r.channel,
      kg: round1(r.kg),
      count: r.count,
      orders: r.orders.size,
      share: total > 0 ? round1((r.kg / total) * 100) : 0,
    }))
    .sort((a, b) => b.kg - a.kg || a.label.localeCompare(b.label, 'ko'))
}
