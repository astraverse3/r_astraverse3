import {
  getMillingStatistics,
  getMillingStatsByMillingType,
  getVarietyOptions,
  getMillingTypeOptions,
} from '@/app/actions/statistics'
import { resolveQuickPeriod } from '@/lib/statistics-utils'
import { dashboardProductionYear } from '@/lib/production-year'
import { MillingTypeStatsClient } from './millingtype-stats-client'

const DEFAULT_VARIETIES = ['백옥찰', '서농22호', '천지향1세', '천지향5세', '새청무', '하이아미']

export default async function MillingTypeStatisticsPage() {
  // 집계 화면이라 대시보드와 같은 기준(11월)을 쓴다 — `statistics/milling/page.tsx` 참고
  const currentCropYear = dashboardProductionYear()

  const { from: initFrom, to: initTo, groupBy } = resolveQuickPeriod('6m')

  const [varietyOptions, millingTypeOptions] = await Promise.all([
    getVarietyOptions(),
    getMillingTypeOptions(),
  ])

  const initVarieties = DEFAULT_VARIETIES.filter(v => varietyOptions.includes(v))
  const initMillingTypes = millingTypeOptions

  const [initialChartData, initialStats] = await Promise.all([
    getMillingStatsByMillingType({
      from: initFrom,
      to: initTo,
      groupBy,
      millingTypes: initMillingTypes.length ? initMillingTypes : ['백미'],
      varieties: initVarieties.length ? initVarieties : undefined,
    }),
    getMillingStatistics({
      from: initFrom,
      to: initTo,
      groupBy,
      millingTypes: initMillingTypes.length ? initMillingTypes : undefined,
      varieties: initVarieties.length ? initVarieties : undefined,
    }),
  ])

  return (
    <MillingTypeStatsClient
      initialChartData={initialChartData}
      initialSummary={initialStats.summary}
      varietyOptions={varietyOptions}
      millingTypeOptions={millingTypeOptions}
      currentCropYear={currentCropYear}
    />
  )
}
