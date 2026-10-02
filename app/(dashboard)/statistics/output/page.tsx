import { getSalesStatistics } from '@/app/actions/sales-statistics'
import { todayKst } from '@/lib/kst-date'
import { SalesStatsClient } from './sales-stats-client'
import { defaultDraft } from './_parts/utils'

// 판매분석 — 판매 = 제품재고에서 「판매」로 빠진 것(docs/plan/plan-판매분석.md). 기본 기간은 이번 달
export default async function SalesStatisticsPage() {
  const today = todayKst()
  const draft = defaultDraft(today)
  const res = await getSalesStatistics({ from: draft.from, to: draft.to })

  if (!res.success) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center text-sm text-slate-500">
        {res.error}
      </div>
    )
  }
  return <SalesStatsClient initialData={res.data} initialDraft={draft} today={today} />
}
