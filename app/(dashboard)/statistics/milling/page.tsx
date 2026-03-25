import {
  getMillingStatistics,
  getVarietyOptions,
  getMillingTypeOptions,
} from '@/app/actions/statistics'
import { resolveGroupBy } from '@/lib/statistics-utils'
import { MillingStatsClient } from './milling-stats-client'

export default async function MillingStatisticsPage() {
  const today = new Date()

  const currentCropYear = today.getMonth() >= 9
    ? today.getFullYear()       // 10월 이후면 올해 연산
    : today.getFullYear() - 1   // 그 전이면 작년 연산

  const cropYearFrom = new Date(`${currentCropYear}-01-01`)
  const cropYearTo = new Date(`${currentCropYear + 1}-03-31`)
  const groupBy = resolveGroupBy(cropYearFrom, cropYearTo)

  const [initialData, varietyOptions, millingTypeOptions] = await Promise.all([
    getMillingStatistics({ from: cropYearFrom, to: cropYearTo, groupBy, millingTypes: ['백미'] }),
    getVarietyOptions(),
    getMillingTypeOptions(),
  ])

  return (
    <MillingStatsClient
      initialData={initialData}
      varietyOptions={varietyOptions}
      millingTypeOptions={millingTypeOptions}
      currentCropYear={currentCropYear}
    />
  )
}
