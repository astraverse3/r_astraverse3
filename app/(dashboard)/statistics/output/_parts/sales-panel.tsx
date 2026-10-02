'use client'

// 판매 탭 화면 조각 — 상태는 use-sales-stats.ts. 필터(탭 카드 안)와 본문(카드 아래)으로 나눈다:
// 탭 줄은 부모가 그리고, 그 아래를 탭마다 바꾼다.

import type { ReactNode } from 'react'
import type { SalesStatisticsData } from '@/app/actions/sales-statistics'
import type { StatsExcelRow } from '@/app/actions/stats-excel'
import { StatsExcelButton } from '@/components/statistics/StatsExcelButton'
import { SalesChannelLegend, SalesTrendChart, presentChannels } from '@/components/statistics/SalesChart'
import { SalesSummaryCards } from './sales-summary-cards'
import { SalesBreakdownTable } from './sales-breakdown-table'
import { SalesBreakdownList } from './sales-breakdown-list'
import { SalesAppliedChips, SalesFilterBar } from './sales-filter-bar'
import { SalesConditionSections, SalesFilterSheet } from './sales-filter-sheet'
import { MobileFilterRow } from './mobile-filter-row'
import type { SalesStats } from './use-sales-stats'
import { SALES_TABS, conditionCount, visibleRows, type SalesTab } from './utils'

const GROUP_LABEL = { day: '일별', week: '주별', month: '월별' } as const

/** 탭 카드 안 — PC 필터 줄·적용 조건 칩 / 모바일 한 줄 */
export function SalesFilters({ s, today, excel }: { s: SalesStats; today: string; excel: ReactNode }) {
  return (
    <>
      <div className="hidden md:block">
        <SalesFilterBar
          draft={s.draft}
          onChange={s.change}
          onPreset={s.pickPreset}
          varietyOptions={s.varietyOptions}
          isPending={s.isPending}
          onReset={s.reset}
          onSearch={s.search}
        />
        <SalesAppliedChips
          applied={s.applied}
          varietyName={id => s.data.varietyOptions.find(v => v.id === id)?.name ?? '품종'}
          onRemove={patch => s.run({ ...s.applied, ...patch })}
        />
      </div>
      <MobileFilterRow
        preset={s.applied.preset}
        from={s.applied.from}
        to={s.applied.to}
        today={today}
        count={conditionCount(s.applied)}
        onOpen={s.openSheet}
        excel={excel}
      />
    </>
  )
}

/** 탭 카드 아래 — 추이 + 요약, 탭별 표, 모바일 조건 시트 */
export function SalesBody({ s, tab }: { s: SalesStats; tab: SalesTab }) {
  return (
    <>
      <div className="flex flex-col md:flex-row gap-2 md:gap-3 md:items-stretch">
        <TrendCard data={s.data} />
        <SalesSummaryCards summary={s.data.summary} empty={s.empty} />
      </div>

      {!s.empty && <BreakdownCard data={s.data} tab={tab} showAll={s.showAll} onShowAll={s.expand} />}

      <SalesFilterSheet
        show={s.showSheet}
        onClose={s.closeSheet}
        preset={s.draft.preset}
        from={s.draft.from}
        to={s.draft.to}
        onPreset={s.pickPreset}
        onDates={s.change}
        isPending={s.isPending}
        onReset={s.reset}
        onSearch={s.search}
      >
        <SalesConditionSections draft={s.draft} onChange={s.change} varietyOptions={s.varietyOptions} />
      </SalesFilterSheet>
    </>
  )
}

function rowsOf(data: SalesStatisticsData, tab: SalesTab) {
  return { channel: data.byChannel, customer: data.byCustomer, variety: data.byVariety, product: data.byProduct }[tab]
}

/** 엑셀은 접은 줄까지 전부 */
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

export function SalesExcel({ s, tab }: { s: SalesStats; tab: SalesTab }) {
  const label = SALES_TABS.find(t => t.key === tab)!.label
  return (
    <StatsExcelButton
      getRows={() => excelRows(s.data, tab)}
      sheetName={label}
      fileNamePrefix={`판매분석_${s.applied.from}_${s.applied.to}_${label}`}
    />
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
        <SalesTrendChart data={data.trend} groupBy={data.groupBy} />
      </div>
    </div>
  )
}

type BreakdownCardProps = { data: SalesStatisticsData; tab: SalesTab; showAll: boolean; onShowAll: () => void }

/** PC는 6칸 표, 모바일은 두 줄 목록 — 보일 줄·접기 규칙은 하나(visibleRows) */
function BreakdownCard({ data, tab, showAll, onShowAll }: BreakdownCardProps) {
  const shown = visibleRows(rowsOf(data, tab), tab, showAll)
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-2">
      <div className="hidden md:block">
        <SalesBreakdownTable
          rows={shown.rows}
          hidden={shown.hidden}
          onShowAll={onShowAll}
          column={SALES_TABS.find(t => t.key === tab)!.column}
        />
      </div>
      <div className="md:hidden">
        <SalesBreakdownList rows={shown.rows} hidden={shown.hidden} onShowAll={onShowAll} />
      </div>
    </div>
  )
}
