import { getOutputStatistics, getOutputVarietyOptions } from '@/app/actions/output-statistics'
import { OutputStatsClient } from './output-stats-client'

export default async function OutputStatisticsPage() {
  const to = new Date()
  const from = new Date(to)
  from.setMonth(from.getMonth() - 12)

  const [initialData, varietyOptions] = await Promise.all([
    getOutputStatistics({ from, to }),
    getOutputVarietyOptions(from, to),
  ])

  return (
    <OutputStatsClient
      initialData={initialData}
      defaultFrom={from.toISOString()}
      defaultTo={to.toISOString()}
      varietyOptions={varietyOptions}
    />
  )
}
