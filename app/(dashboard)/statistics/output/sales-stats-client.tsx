'use client'

// 판매분석 — 계획서 docs/plan/plan-판매분석.md · 3단계 plan-판매분석-3단계.md(작업지시 ⑪).
// 재고분석(stock-stats-client.tsx)과 같은 틀: 탭·필터 카드 → 추이 차트 + 요약 카드 → 탭별 표.
// 판매 탭 4개는 아래 표만 바꾸고 다시 조회하지 않는다. 원물출고 탭은 단위(톤)와 기간이 따로라
// 상태도 따로 든다(use-raw-release-stats.ts). 두 상태를 여기서 들고 있어서 탭을 오가도 조건이 남는다.

import type { ReactNode } from 'react'
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { SalesStatisticsData } from '@/app/actions/sales-statistics'
import type { RawReleaseStatisticsData } from '@/app/actions/raw-release-statistics'
import { SalesBody, SalesExcel, SalesFilters } from './_parts/sales-panel'
import { RawBody, RawExcel, RawFilters } from './_parts/raw-release-panel'
import { useSalesStats } from './_parts/use-sales-stats'
import { useRawReleaseStats } from './_parts/use-raw-release-stats'
import { SALES_TABS, type PeriodDraft, type SalesDraft, type StatsTab } from './_parts/utils'

type Props = {
  initialData: SalesStatisticsData
  initialDraft: SalesDraft
  rawInitialData: RawReleaseStatisticsData
  rawInitialDraft: PeriodDraft
  today: string
}

export function SalesStatsClient({ initialData, initialDraft, rawInitialData, rawInitialDraft, today }: Props) {
  const [tab, setTab] = useState<StatsTab>('channel')
  const sales = useSalesStats(initialData, initialDraft, today)
  const raw = useRawReleaseStats(rawInitialData, rawInitialDraft, today)

  function handleTab(next: StatsTab) {
    setTab(next)
    sales.collapse()
  }

  const excel = tab === 'raw' ? <RawExcel r={raw} /> : <SalesExcel s={sales} tab={tab} />

  return (
    <div className="w-full flex flex-col gap-2 px-1.5 sm:px-0 sm:gap-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
        <TabBar tab={tab} onTab={handleTab} isPending={tab === 'raw' ? raw.isPending : sales.isPending} excel={excel} />
        {tab === 'raw' ? (
          <RawFilters r={raw} today={today} excel={excel} />
        ) : (
          <SalesFilters s={sales} today={today} excel={excel} />
        )}
      </div>
      {tab === 'raw' ? <RawBody r={raw} /> : <SalesBody s={sales} tab={tab} />}
    </div>
  )
}

type TabBarProps = {
  tab: StatsTab
  onTab: (t: StatsTab) => void
  isPending: boolean
  /** PC만 — 모바일은 필터 줄에 둔다(탭 5개가 폭을 다 쓴다) */
  excel: ReactNode
}

/** 판매 탭 4개 | 구분선 | 원물출고(작업지시 ⑪ A-1 ②). 모바일은 「별」을 뗀 짧은 라벨(A-3) */
function TabBar({ tab, onTab, isPending, excel }: TabBarProps) {
  return (
    <div className="flex items-center border-b border-slate-100 rounded-t-2xl overflow-hidden">
      {SALES_TABS.map(t => (
        <TabButton key={t.key} active={tab === t.key} onClick={() => onTab(t.key)}>
          <span className="md:hidden">{t.short}</span>
          <span className="hidden md:inline">{t.label}</span>
        </TabButton>
      ))}
      <span className="w-px h-4 bg-slate-200 mx-1 shrink-0" aria-hidden />
      <TabButton active={tab === 'raw'} onClick={() => onTab('raw')}>
        원물출고
      </TabButton>
      <div className="ml-auto flex items-center gap-1 pr-2">
        {isPending && <RefreshCw className="w-3.5 h-3.5 text-slate-300 animate-spin" />}
        <div className="hidden md:flex">{excel}</div>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 md:px-5 py-3 text-[13px] md:text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
        active ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  )
}
