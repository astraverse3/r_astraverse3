import { format, differenceInDays, subDays, subMonths, subYears } from 'date-fns'
import type { GroupBy, QuickPeriod } from '@/app/actions/statistics'

// 조회 기간 일수 → groupBy 자동 결정
export function resolveGroupBy(from: Date, to: Date): GroupBy {
  const diff = differenceInDays(to, from)
  if (diff <= 14) return 'day'
  if (diff <= 90) return 'week'
  return 'month'
}

// 빠른기간 버튼 → { from, to, groupBy } 반환
export function resolveQuickPeriod(
  period: QuickPeriod,
  cropYear?: number
): { from: Date; to: Date; groupBy: GroupBy } {
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  switch (period) {
    case '1w': {
      const from = subDays(today, 7)
      return { from, to: today, groupBy: 'day' }
    }
    case '1m': {
      const from = subMonths(today, 1)
      return { from, to: today, groupBy: 'week' }
    }
    case '3m': {
      const from = subMonths(today, 3)
      return { from, to: today, groupBy: 'week' }
    }
    case '6m': {
      const from = subMonths(today, 6)
      return { from, to: today, groupBy: 'month' }
    }
    case '1y': {
      const from = subYears(today, 1)
      return { from, to: today, groupBy: 'month' }
    }
    case 'cropYear': {
      const year = cropYear ?? today.getFullYear()
      const from = new Date(`${year}-01-01`)
      const to = new Date(`${year + 1}-03-31`)
      to.setHours(23, 59, 59, 999)
      return { from, to, groupBy: 'month' }
    }
    default: {
      const from = subMonths(today, 1)
      return { from, to: today, groupBy: 'week' }
    }
  }
}
