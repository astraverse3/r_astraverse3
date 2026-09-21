import {
  getStockStatistics,
  getStockProductionYears,
  getStockGroupOptions,
  getStockVarietyOptions,
} from '@/app/actions/stock-statistics'
import { dashboardProductionYear } from '@/lib/production-year'
import { StockStatsClient } from './stock-stats-client'

export default async function StockStatisticsPage() {
  // 집계 화면이라 대시보드와 같은 기준(11월)을 쓴다 — `lib/production-year.ts`
  const currentYear = dashboardProductionYear()

  const productionYears = await getStockProductionYears()

  // 🔴 예전엔 `productionYears[0]`(DB 최신)을 그대로 썼다 — 대시보드가 겪은 것과 같은
  //    구조다. 26년산이 몇 행만 들어와도 통계가 신곡 기준으로 열려 화면이 비었다.
  //    집계 기준 연도에 데이터가 있으면 그걸 쓰고, 없을 때만 목록 최신으로 물러선다.
  const initYear = productionYears.includes(currentYear)
    ? currentYear
    : (productionYears[0] ?? currentYear)

  const [initialData, groupOptions, varietyOptions] = await Promise.all([
    getStockStatistics({ productionYear: initYear }),
    getStockGroupOptions(initYear),
    getStockVarietyOptions(initYear),
  ])

  return (
    <StockStatsClient
      initialData={initialData}
      productionYears={productionYears}
      groupOptions={groupOptions}
      varietyOptions={varietyOptions}
      initYear={initYear}
    />
  )
}
