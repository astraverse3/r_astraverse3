'use server'

// 판매분석 조회 — 계획서 docs/plan/plan-판매분석.md
// 조회는 기간 + type=SALE만 DB에서 걸고, 곡종·채널·품종은 메모리에서 거른다(lib/sales-stats.ts).
// 품종 선택지는 「기간 안에 팔린 품종」이라 필터 전 목록에서 뽑아야 하기 때문이다.

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth-guard'
import { sanitizeErrorMessage } from '@/lib/error-sanitize'
import { kstDayRange } from '@/lib/kst-date'
import type { GroupBy } from '@/app/actions/statistics'
import {
  SALES_CHANNELS,
  filterSales,
  pickGroupBy,
  salesBreakdown,
  salesTrend,
  summarizeSales,
  toSaleLine,
  type SalesBreakdownRow,
  type SalesSummary,
  type SalesTrendBucket,
} from '@/lib/sales-stats'

const YMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
// 조회량 상한 — 화면 프리셋은 최대 1년이다
const MAX_DAYS = 3 * 366

const FiltersSchema = z.object({
  from: YMD,
  to: YMD,
  categories: z.array(z.enum(['RICE', 'MISC_GRAIN'])).max(2).optional(),
  channels: z.array(z.enum(SALES_CHANNELS)).max(SALES_CHANNELS.length).optional(),
  varietyIds: z.array(z.number().int().positive()).max(500).optional(),
})

export type SalesFilters = z.input<typeof FiltersSchema>

export type SalesStatisticsData = {
  from: string
  to: string
  groupBy: GroupBy
  summary: SalesSummary
  trend: SalesTrendBucket[]
  byChannel: SalesBreakdownRow[]
  byCustomer: SalesBreakdownRow[]
  byVariety: SalesBreakdownRow[]
  byProduct: SalesBreakdownRow[]
  /** 기간 안에 팔린 품종(필터 전) — 품종 선택지 */
  varietyOptions: { id: number; name: string }[]
}

export type SalesStatisticsResult =
  | { success: true; data: SalesStatisticsData }
  | { success: false; error: string }

const VARIETY_SELECT = { select: { id: true, name: true, type: true } } as const

export async function getSalesStatistics(input: SalesFilters): Promise<SalesStatisticsResult> {
  try {
    await requireSession()
    const f = FiltersSchema.parse(input)
    const fromRange = kstDayRange(f.from)
    const toRange = kstDayRange(f.to)
    if (!fromRange || !toRange) return { success: false, error: '날짜가 올바르지 않습니다.' }
    if (fromRange.gte > toRange.gte) return { success: false, error: '시작일이 종료일보다 늦습니다.' }
    if ((toRange.lt.getTime() - fromRange.gte.getTime()) / 86_400_000 > MAX_DAYS) {
      return { success: false, error: '기간은 3년까지 조회할 수 있습니다.' }
    }

    const rows = await prisma.packageMovement.findMany({
      where: { type: 'SALE', occurredAt: { gte: fromRange.gte, lt: toRange.lt } },
      select: {
        count: true,
        occurredAt: true,
        createdAt: true,
        customer: true,
        orderItem: { select: { order: { select: { id: true, channel: true, vendor: true } } } },
        package: {
          select: {
            weightPerUnit: true,
            packageType: true,
            category: true,
            stock: { select: { variety: VARIETY_SELECT } },
            variety: VARIETY_SELECT,
            productType: { select: { id: true, millingType: true, packaging: { select: { name: true } } } },
          },
        },
      },
    })

    const all = rows.map(toSaleLine)
    const lines = filterSales(all, f)
    const groupBy = pickGroupBy(f.from, f.to)

    const varietyOptions = [
      ...new Map(all.filter(l => l.varietyId !== null).map(l => [l.varietyId!, l.variety])).entries(),
    ]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))

    return {
      success: true,
      data: {
        from: f.from,
        to: f.to,
        groupBy,
        summary: summarizeSales(lines),
        trend: salesTrend(lines, fromRange.gte, toRange.gte, groupBy),
        byChannel: salesBreakdown(lines, 'channel'),
        byCustomer: salesBreakdown(lines, 'customer'),
        byVariety: salesBreakdown(lines, 'variety'),
        byProduct: salesBreakdown(lines, 'product'),
        varietyOptions,
      },
    }
  } catch (error) {
    console.error('[getSalesStatistics] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '판매 통계를 불러오지 못했습니다.') }
  }
}
