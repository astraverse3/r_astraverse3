import {
  getStockStatistics,
  getStockProductionYears,
  getStockGroupOptions,
  getStockVarietyOptions,
} from '@/app/actions/stock-statistics'
import { StockStatsClient } from './stock-stats-client'

export default async function StockStatisticsPage() {
  const today = new Date()
  const currentYear = today.getMonth() >= 9
    ? today.getFullYear()
    : today.getFullYear() - 1

  const productionYears = await getStockProductionYears()
  const initYear = productionYears[0] ?? currentYear

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
