import { subMonths, format } from 'date-fns'
import {
  getMillingStatistics,
  getVarietyOptions,
  getMillingTypeOptions,
} from '@/app/actions/statistics'
import { resolveGroupBy } from '@/lib/statistics-utils'
import { MillingStatsClient } from './milling-stats-client'

export default async function MillingStatisticsPage() {
  const today = new Date()
  const oneMonthAgo = subMonths(today, 1)
  const groupBy = resolveGroupBy(oneMonthAgo, today)

  const [initialData, varietyOptions, millingTypeOptions] = await Promise.all([
    getMillingStatistics({ from: oneMonthAgo, to: today, groupBy, millingTypes: ['백미'] }),
    getVarietyOptions(),
    getMillingTypeOptions(),
  ])

  const currentCropYear = today.getMonth() >= 9
    ? today.getFullYear()       // 10월 이후면 올해 연산
    : today.getFullYear() - 1   // 그 전이면 작년 연산

  return (
    <MillingStatsClient
      initialData={initialData}
      varietyOptions={varietyOptions}
      millingTypeOptions={millingTypeOptions}
      currentCropYear={currentCropYear}
    />
  )
}
