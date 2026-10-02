'use client'

// 판매분석 — 계획서 docs/plan/plan-판매분석.md. 재고분석(stock-stats-client.tsx)과 같은 틀:
// 탭·필터 카드 → 추이 차트 + 요약 카드 → 탭별 표. 탭은 아래 표만 바꾸고 다시 조회하지 않는다.

import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { getSalesStatistics, type SalesStatisticsData } from '@/app/actions/sales-statistics'
import { presetRange, type SalesPeriodPreset } from '@/lib/sales-period'
import type { StatsExcelRow } from '@/app/actions/stats-excel'
import { StatsExcelButton } from '@/components/statistics/StatsExcelButton'
import { SalesChannelLegend, SalesTrendChart, presentChannels } from '@/components/statistics/SalesChart'
import { useSafeTransition } from '@/app/(dashboard)/use-safe-transition'
import { SalesSummaryCards } from './_parts/sales-summary-cards'
import { SalesBreakdownTable } from './_parts/sales-breakdown-table'
import { SalesAppliedChips, SalesFilterBar } from './_parts/sales-filter-bar'
import { SALES_TABS, defaultDraft, visibleRows, type SalesDraft, type SalesTab } from './_parts/utils'

const GROUP_LABEL = { day: '일별', week: '주별', month: '월별' } as const

type Props = { initialData: SalesStatisticsData; initialDraft: SalesDraft; today: string }

export function SalesStatsClient({ initialData, initialDraft, today }: Props) {
  const [data, setData] = useState(initialData)
  const [draft, setDraft] = useState(initialDraft)
  const [applied, setApplied] = useState(initialDraft)
  const [tab, setTab] = useState<SalesTab>('channel')
  // 거래처 「더 보기」 — 탭을 바꾸거나 다시 조회하면 다시 접는다
  const [showAll, setShowAll] = useState(false)
  const [isPending, start] = useSafeTransition('판매 통계를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.')
  const empty = data.summary.count === 0
  const shown = visibleRows(rowsOf(data, tab), tab, showAll)

  const varietyOptions = useMemo(
    () => data.varietyOptions.map(v => ({ id: v.id, label: v.name })),
    [data.varietyOptions],
  )

  function run(next: SalesDraft) {
    start(async () => {
      const { from, to, categories, channels, varietyIds } = next
      const res = await getSalesStatistics({ from, to, categories, channels, varietyIds })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      setData(res.data)
      setApplied(next)
      setDraft(next)
      setShowAll(false)
    })
  }

  function handleTab(next: SalesTab) {
    setTab(next)
    setShowAll(false)
  }

  function handlePreset(preset: SalesPeriodPreset) {
    // 「직접 지정」은 지금 기간에서 손으로 고쳐 나간다
    setDraft(d => (preset === 'custom' ? { ...d, preset } : { ...d, preset, ...presetRange(preset, today) }))
  }

  return (
    <div className="w-full flex flex-col gap-2 px-1.5 sm:px-0 sm:gap-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
        <TabBar tab={tab} onTab={handleTab} data={data} applied={applied} isPending={isPending} />
        <div className="hidden md:block">
          <SalesFilterBar
            draft={draft}
            onChange={patch => setDraft(d => ({ ...d, ...patch }))}
            onPreset={handlePreset}
            varietyOptions={varietyOptions}
            isPending={isPending}
            onReset={() => run(defaultDraft(today))}
            onSearch={() => run(draft)}
          />
        </div>
        <SalesAppliedChips
          applied={applied}
          varietyName={id => data.varietyOptions.find(v => v.id === id)?.name ?? '품종'}
          onRemove={patch => run({ ...applied, ...patch })}
        />
      </div>

      <div className="flex flex-col md:flex-row gap-2 md:gap-3 md:items-stretch">
        <TrendCard data={data} />
        <SalesSummaryCards summary={data.summary} empty={empty} />
      </div>

      {!empty && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-2">
          <SalesBreakdownTable
            rows={shown.rows}
            hidden={shown.hidden}
            onShowAll={() => setShowAll(true)}
            column={SALES_TABS.find(t => t.key === tab)!.column}
          />
        </div>
      )}
    </div>
  )
}

function rowsOf(data: SalesStatisticsData, tab: SalesTab) {
  return { channel: data.byChannel, customer: data.byCustomer, variety: data.byVariety, product: data.byProduct }[tab]
}

function excelRows(data: SalesStatisticsData, tab: SalesTab): StatsExcelRow[] {
  const column = SALES_TABS.find(t => t.key === tab)!.column
  return rowsOf(data, tab).map((r, i) => ({
    '순위': i + 1,
    [column]: r.label,
    ...(tab === 'customer' ? { '채널': r.sub ?? '' } : {}),
    '판매량(kg)': r.kg,
    '개수': r.count,
    '주문': r.orders,
    '비중(%)': r.share,
  }))
}

type TabBarProps = {
  tab: SalesTab
  onTab: (t: SalesTab) => void
  data: SalesStatisticsData
  applied: SalesDraft
  isPending: boolean
}

function TabBar({ tab, onTab, data, applied, isPending }: TabBarProps) {
  const label = SALES_TABS.find(t => t.key === tab)!.label
  return (
    <div className="flex border-b border-slate-100 rounded-t-2xl overflow-hidden">
      {SALES_TABS.map(t => (
        <button
          key={t.key}
          type="button"
          onClick={() => onTab(t.key)}
          className={`px-4 sm:px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
            tab === t.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          {t.label}
        </button>
      ))}
      <div className="ml-auto flex items-center gap-1 pr-2">
        {isPending && <RefreshCw className="w-3.5 h-3.5 text-slate-300 animate-spin" />}
        <StatsExcelButton
          getRows={() => excelRows(data, tab)}
          sheetName={label}
          fileNamePrefix={`판매분석_${applied.from}_${applied.to}_${label}`}
        />
      </div>
    </div>
  )
}

function TrendCard({ data }: { data: SalesStatisticsData }) {
  return (
    <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2 shrink-0">
        <p className="text-xs font-semibold text-slate-500">판매량 추이 · {GROUP_LABEL[data.groupBy]}</p>
        <SalesChannelLegend channels={presentChannels(data.trend)} />
      </div>
      <div className="px-2 pb-3">
        <SalesTrendChart data={data.trend} />
      </div>
    </div>
  )
}
