'use client'

// 원물출고 탭 화면 조각 — 상태는 use-raw-release-stats.ts. 작업지시 ⑪ A-4에서
// 목적(판매/판매 아님) 구분·목적 필터·목적별 토글은 뺐다: 목적이 비고 칸이라 믿을 수 없다(사용자 2026-10-02).
// 남은 것 = 안내 줄 · 기간(기본 올해) · 월별 막대 · 요약 3장 · 출고처별 표.

import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { RawReleaseStatisticsData } from '@/app/actions/raw-release-statistics'
import type { StatsExcelRow } from '@/app/actions/stats-excel'
import { StatsExcelButton } from '@/components/statistics/StatsExcelButton'
import { RAW_RELEASE_COLOR, RawReleaseChart } from '@/components/statistics/SalesChart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  STAT_HEAD,
  STAT_HEAD_ROW,
  STAT_NAME,
  STAT_NUM,
  STAT_NUM_MAIN,
  STAT_RANK,
  STAT_TABLE,
} from '@/components/statistics/table-styles'
import { CHIPS_ROW, PeriodChip, PeriodPicker, SearchButtons } from './sales-filter-bar'
import { SalesFilterSheet } from './sales-filter-sheet'
import { MobileFilterRow } from './mobile-filter-row'
import type { RawReleaseStats } from './use-raw-release-stats'
import { formatTon } from './utils'

/** 탭 카드 안 — 단위 안내 줄 · PC 기간 줄·칩 / 모바일 한 줄 */
export function RawFilters({ r, today, excel }: { r: RawReleaseStats; today: string; excel: ReactNode }) {
  return (
    <>
      <div className="px-4 py-2 bg-amber-50/60 text-xs text-amber-900 flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>
          <b>벼 원물</b>을 그대로 내보낸 기록이에요. 단위는 <b>톤</b>이고, 제품 판매(kg)와 따로 셉니다.
        </span>
      </div>
      <div className="hidden md:block">
        <div className="px-4 py-3 flex flex-wrap items-center gap-2">
          <PeriodPicker period={r.draft} onPreset={r.pickPreset} onDates={r.changeDates} />
          <SearchButtons isPending={r.isPending} onReset={r.reset} onSearch={r.search} />
        </div>
        <div className={CHIPS_ROW}>
          <PeriodChip period={r.applied} />
        </div>
      </div>
      <MobileFilterRow
        preset={r.applied.preset}
        from={r.applied.from}
        to={r.applied.to}
        today={today}
        count={0}
        onOpen={r.openSheet}
        excel={excel}
      />
    </>
  )
}

/** 탭 카드 아래 — 월별 막대 + 요약 3장, 출고처별 표, 모바일 기간 시트 */
export function RawBody({ r }: { r: RawReleaseStats }) {
  const { data } = r
  return (
    <>
      <div className="flex flex-col md:flex-row gap-2 md:gap-3 md:items-stretch">
        <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <p className="px-4 pt-3 pb-2 text-xs font-semibold text-slate-500">원물 출고 추이 · 월별 (톤)</p>
          <div className="px-2 pb-3">
            <RawReleaseChart data={data.monthly} />
          </div>
        </div>
        <RawSummaryCards data={data} empty={r.empty} />
      </div>

      {!r.empty && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-2">
          <div className="hidden md:block">
            <DestinationTable data={data} />
          </div>
          <div className="md:hidden">
            <DestinationList data={data} />
          </div>
        </div>
      )}

      <SalesFilterSheet
        show={r.showSheet}
        onClose={r.closeSheet}
        preset={r.draft.preset}
        from={r.draft.from}
        to={r.draft.to}
        onPreset={r.pickPreset}
        onDates={r.changeDates}
        isPending={r.isPending}
        onReset={r.reset}
        onSearch={r.search}
      />
    </>
  )
}

function excelRows(data: RawReleaseStatisticsData): StatsExcelRow[] {
  return data.byDestination.map((d, i) => ({
    '순위': i + 1,
    '출고처': d.label,
    '출고량(톤)': Math.round(d.kg) / 1000,
    '건': d.releases,
    '비중(%)': d.share,
  }))
}

export function RawExcel({ r }: { r: RawReleaseStats }) {
  return (
    <StatsExcelButton
      getRows={() => excelRows(r.data)}
      sheetName="원물출고"
      fileNamePrefix={`판매분석_${r.applied.from}_${r.applied.to}_원물출고`}
    />
  )
}

/** 요약 3장 — 출고량(톤) · 출고 건 · 출고처. 모바일은 3열 한 줄(숫자 먼저, order-first) */
function RawSummaryCards({ data, empty }: { data: RawReleaseStatisticsData; empty: boolean }) {
  const cards = [
    { label: '출고량', value: formatTon(data.summary.kg), unit: '톤' },
    { label: '출고', value: data.summary.releases.toLocaleString('ko-KR'), unit: '건' },
    { label: '출고처', value: data.summary.destinations.toLocaleString('ko-KR'), unit: '곳' },
  ]
  const valueTone = empty ? 'text-slate-300' : 'text-slate-800'
  return (
    <div className="order-first md:order-none grid grid-cols-3 gap-2 md:flex md:flex-col md:gap-3 md:w-48 md:shrink-0">
      {cards.map(card => (
        <div key={card.label} className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-100 md:flex-1 md:min-h-0">
          <div className="md:hidden px-2.5 py-2">
            <p className="text-[11px] font-medium text-slate-500">{card.label}</p>
            <p className="mt-0.5 flex items-baseline gap-0.5">
              <span className={`text-base font-bold tabular-nums ${valueTone}`}>{card.value}</span>
              <span className="text-xs text-slate-500">{card.unit}</span>
            </p>
          </div>
          <div className="hidden md:flex md:flex-col md:justify-center md:h-full md:px-4 md:py-3">
            <span className="text-xs font-bold text-slate-500 mb-2">{card.label}</span>
            <div className="flex items-baseline justify-end gap-1">
              <span className={`text-2xl font-bold leading-none tabular-nums ${valueTone}`}>{card.value}</span>
              <span className="text-xs font-semibold text-slate-500">{card.unit}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** PC 출고처별 표 — 판매 탭 표(sales-breakdown-table.tsx)와 같은 틀·겉모양(table-styles). 막대는 1위 대비, 숫자는 전체 대비 % */
function DestinationTable({ data }: { data: RawReleaseStatisticsData }) {
  const maxKg = data.byDestination[0]?.kg ?? 0
  return (
    <div className="overflow-x-auto">
      <Table className={STAT_TABLE} style={{ minWidth: '560px' }}>
        <TableHeader>
          <TableRow className={STAT_HEAD_ROW}>
            <TableHead className={`${STAT_HEAD} w-12 text-right`}>순위</TableHead>
            <TableHead className={STAT_HEAD}>출고처</TableHead>
            <TableHead className={`${STAT_HEAD} text-right`}>출고량 (톤)</TableHead>
            <TableHead className={`${STAT_HEAD} text-right`}>건</TableHead>
            <TableHead className={`${STAT_HEAD} w-[32%]`}>비중</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.byDestination.map((d, i) => (
            <TableRow key={d.key}>
              <TableCell className={STAT_RANK}>{i + 1}</TableCell>
              <TableCell className={`${STAT_NAME} truncate`}>{d.label}</TableCell>
              <TableCell className={STAT_NUM_MAIN}>{formatTon(d.kg)}</TableCell>
              <TableCell className={STAT_NUM}>{d.releases.toLocaleString('ko-KR')}</TableCell>
              <TableCell>
                <span className="flex items-center gap-2">
                  <span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${maxKg > 0 ? (d.kg / maxKg) * 100 : 0}%`, backgroundColor: RAW_RELEASE_COLOR }}
                    />
                  </span>
                  <span className="w-12 text-right tabular-nums text-slate-600">{d.share.toFixed(1)}%</span>
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** 모바일 출고처 목록 — 한 줄: 순위 · 출고처 · 톤(시안 RwMobile) */
function DestinationList({ data }: { data: RawReleaseStatisticsData }) {
  return (
    <div>
      {data.byDestination.map((d, i) => (
        <div key={d.key} className="px-3 py-2.5 flex items-center gap-2 border-b border-slate-100 last:border-b-0">
          <span className="w-5 shrink-0 text-right text-xs tabular-nums text-slate-500">{i + 1}</span>
          <span className="min-w-0 truncate text-[13px] font-semibold text-slate-800">{d.label}</span>
          <span className="ml-auto shrink-0 text-[13px] font-bold tabular-nums text-slate-800">
            {formatTon(d.kg)}
            <span className="ml-0.5 text-[11px] font-medium text-slate-500">톤</span>
          </span>
        </div>
      ))}
    </div>
  )
}
