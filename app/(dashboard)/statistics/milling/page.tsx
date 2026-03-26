import {
  getMillingStatistics,
  getVarietyOptions,
  getMillingTypeOptions,
} from '@/app/actions/statistics'
import { resolveGroupBy, resolveQuickPeriod } from '@/lib/statistics-utils'
import { MillingStatsClient } from './milling-stats-client'

export default async function MillingStatisticsPage() {
  const today = new Date()

  const currentCropYear = today.getMonth() >= 9
    ? today.getFullYear()
    : today.getFullYear() - 1

  const { from: initFrom, to: initTo, groupBy } = resolveQuickPeriod('6m')

  const [initialData, varietyOptions, millingTypeOptions] = await Promise.all([
    getMillingStatistics({ from: initFrom, to: initTo, groupBy, millingTypes: ['백미'], varieties: ['하이아미', '서농22호', '천지향1세', '새청무'] }),
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
