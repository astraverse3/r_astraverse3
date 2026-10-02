'use server'

// 판매분석 「원물출고」 탭 조회 — 계획서 docs/plan/plan-판매분석-3단계.md
// 옛 판매분석(output-statistics.ts)의 원물출고 부분을 옮겼다. 기간은 판매 탭과 따로 든다(기본 올해).

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth-guard'
import { sanitizeErrorMessage } from '@/lib/error-sanitize'
import { kstDayRange } from '@/lib/kst-date'
import {
  releaseByDestination,
  releaseMonthly,
  summarizeReleases,
  toReleaseLine,
  type ReleaseDestinationRow,
  type ReleaseMonthBucket,
  type ReleaseSummary,
} from '@/lib/raw-release-stats'

const YMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
// 조회량 상한 — 판매 탭(sales-statistics.ts)과 같다
const MAX_DAYS = 3 * 366

const FiltersSchema = z.object({ from: YMD, to: YMD })

export type RawReleaseFilters = z.input<typeof FiltersSchema>

export type RawReleaseStatisticsData = {
  from: string
  to: string
  summary: ReleaseSummary
  monthly: ReleaseMonthBucket[]
  byDestination: ReleaseDestinationRow[]
}

export type RawReleaseStatisticsResult =
  | { success: true; data: RawReleaseStatisticsData }
  | { success: false; error: string }

export async function getRawReleaseStatistics(input: RawReleaseFilters): Promise<RawReleaseStatisticsResult> {
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

    const rows = await prisma.stockRelease.findMany({
      where: { date: { gte: fromRange.gte, lt: toRange.lt } },
      select: { date: true, destination: true, stocks: { select: { weightKg: true } } },
    })
    const lines = rows.map(toReleaseLine)

    return {
      success: true,
      data: {
        from: f.from,
        to: f.to,
        summary: summarizeReleases(lines),
        monthly: releaseMonthly(lines, fromRange.gte, toRange.gte),
        byDestination: releaseByDestination(lines),
      },
    }
  } catch (error) {
    console.error('[getRawReleaseStatistics] failed:', error)
    return { success: false, error: sanitizeErrorMessage(error, '원물출고 통계를 불러오지 못했습니다.') }
  }
}
