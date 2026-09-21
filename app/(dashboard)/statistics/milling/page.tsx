import {
  getMillingStatistics,
  getVarietyOptions,
  getMillingTypeOptions,
} from '@/app/actions/statistics'
import { resolveGroupBy, resolveQuickPeriod } from '@/lib/statistics-utils'
import { dashboardProductionYear } from '@/lib/production-year'
import { MillingStatsClient } from './milling-stats-client'

export default async function MillingStatisticsPage() {
  // 🔴 여기와 `statistics/millingtype/page.tsx`에 `getMonth() >= 9`(10월 경계)가 복붙돼
  //    있었다. 대시보드는 11월에 넘어가는데 통계만 10월에 먼저 넘어가, 10월 한 달 동안
  //    두 화면이 서로 다른 해를 가리켰다. 집계 화면이니 대시보드와 같은 기준을 쓴다.
  const currentCropYear = dashboardProductionYear()

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
