import { getSalesStatistics } from '@/app/actions/sales-statistics'
import { getRawReleaseStatistics } from '@/app/actions/raw-release-statistics'
import { todayKst } from '@/lib/kst-date'
import { SalesStatsClient } from './sales-stats-client'
import { defaultDraft, defaultRawDraft } from './_parts/utils'

// 판매분석 — 판매 = 제품재고에서 「판매」로 빠진 것(docs/plan/plan-판매분석.md). 기본 기간은 이번 달.
// 원물출고 탭은 기간을 따로 들고 기본이 올해다(plan-판매분석-3단계.md) — 두 조회를 같이 띄운다
export default async function SalesStatisticsPage() {
  const today = todayKst()
  const draft = defaultDraft(today)
  const rawDraft = defaultRawDraft(today)
  const [res, rawRes] = await Promise.all([
    getSalesStatistics({ from: draft.from, to: draft.to }),
    getRawReleaseStatistics({ from: rawDraft.from, to: rawDraft.to }),
  ])

  if (!res.success) return <LoadError message={res.error} />
  if (!rawRes.success) return <LoadError message={rawRes.error} />
  return (
    <SalesStatsClient
      initialData={res.data}
      initialDraft={draft}
      rawInitialData={rawRes.data}
      rawInitialDraft={rawDraft}
      today={today}
    />
  )
}

function LoadError({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center text-sm text-slate-500">
      {message}
    </div>
  )
}
