'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, RotateCcw, Search, X, RefreshCw, SlidersHorizontal } from 'lucide-react'
import {
  PackageTypePieChart,
  MonthlyBarChart,
  DestinationBarChart,
  ITEM_H,
} from '@/components/statistics/OutputChart'
import { getOutputStatistics } from '@/app/actions/output-statistics'
import type {
  OutputStatisticsData,
  VarietyOption,
} from '@/app/actions/output-statistics'
import { StatsExcelButton } from '@/components/statistics/StatsExcelButton'

// ── 타입 ──────────────────────────────────────────────────────────────────

type OutputTab = 'package' | 'month' | 'destination'

type Props = {
  initialData: OutputStatisticsData
  defaultFrom: string
  defaultTo: string
  varietyOptions: VarietyOption[]
}

// ── 기간 옵션 ─────────────────────────────────────────────────────────────

type PeriodOption = { label: string; months: number | null }

const PERIOD_OPTIONS: PeriodOption[] = [
  { label: '전체',   months: null },
  { label: '1년',    months: 12 },
  { label: '6개월',  months: 6 },
  { label: '3개월',  months: 3 },
  { label: '1개월',  months: 1 },
]
const DEFAULT_PERIOD_MONTHS = 12

function computeDateRange(months: number | null): { from: Date; to: Date } {
  const to = new Date()
  if (months === null) return { from: new Date('2000-01-01'), to }
  const from = new Date(to)
  from.setMonth(from.getMonth() - months)
  return { from, to }
}

// ── 유틸 ──────────────────────────────────────────────────────────────────

function formatKg(v: number) {
  return v.toLocaleString('ko-KR', { maximumFractionDigits: 1 })
}

// ── 멀티셀렉트 드롭다운 ───────────────────────────────────────────────────

function MultiSelectDropdown({
  options,
  selected,
  onToggle,
  placeholder,
  colorClass,
}: {
  options: VarietyOption[]
  selected: number[]
  onToggle: (id: number) => void
  placeholder: string
  colorClass: string
}) {
  const [open, setOpen] = useState(false)
  const isActive = selected.length > 0

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 pl-3 pr-2 py-1.5 text-xs font-semibold rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer whitespace-nowrap ${
          isActive ? colorClass : 'bg-slate-100 text-slate-700'
        }`}
      >
        {isActive ? `${placeholder} (${selected.length})` : placeholder}
        <ChevronDown className="w-3 h-3 ml-0.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-lg shadow-lg border border-slate-100 py-1 w-max min-w-[140px] max-h-[240px] overflow-y-auto">
            {options.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-400">항목 없음</p>
            )}
            {options.map(opt => (
              <label
                key={opt.id}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs text-slate-700 whitespace-nowrap"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt.id)}
                  onChange={() => onToggle(opt.id)}
                  className="w-3.5 h-3.5 rounded accent-blue-500"
                />
                {opt.name}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── 요약 카드 ─────────────────────────────────────────────────────────────

function OutputSummaryCards({ summary }: { summary: OutputStatisticsData['summary'] }) {
  const cards = [
    {
      label: '총 생산량',
      value: formatKg(summary.totalProductionKg),
      unit: 'kg',
      accent: '#00a2e8',
      valueColor: '#00a2e8',
    },
    {
      label: '총 출고량',
      value: formatKg(summary.totalReleaseKg),
      unit: 'kg',
      accent: '#8dc540',
      valueColor: '#7db037',
    },
    {
      label: '포장 수량',
      value: summary.totalPackageCount.toLocaleString('ko-KR'),
      unit: '개',
      accent: '#f89c1e',
      valueColor: '#cc7b0c',
    },
    {
      label: '출고처 수',
      value: summary.destinationCount.toLocaleString('ko-KR'),
      unit: '곳',
      accent: '#94a3b8',
      valueColor: '#475569',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 md:flex md:flex-col md:gap-3 md:w-48 md:shrink-0">
      {cards.map(card => (
        <div key={card.label} className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-100 overflow-hidden md:flex-1 md:min-h-0">
          <div className="h-[3px]" style={{ backgroundColor: card.accent }} />
          {/* 모바일 */}
          <div className="md:hidden px-3 py-2.5 flex items-center justify-between gap-1.5 min-w-0">
            <p className="text-xs font-medium text-slate-400 shrink-0">{card.label}</p>
            <div className="flex items-baseline gap-0.5 min-w-0">
              <span className="text-sm font-bold tabular-nums truncate" style={{ color: card.valueColor }}>
                {card.value}
              </span>
              <span className="text-xs font-medium text-slate-400 shrink-0">{card.unit}</span>
            </div>
          </div>
          {/* PC */}
          <div className="hidden md:flex md:flex-col md:justify-center md:h-full md:px-4 md:py-3">
            <div className="flex items-center gap-1 mb-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: card.accent }} />
              <span className="text-xs font-bold text-slate-500">{card.label}</span>
            </div>
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-2xl font-bold leading-none" style={{ color: card.valueColor }}>
                {card.value}
              </span>
              <span className="text-xs font-semibold text-slate-500">{card.unit}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────

export function OutputStatsClient({ initialData, varietyOptions }: Props) {
  const [data, setData]                             = useState(initialData)
  const [activeTab, setActiveTab]                   = useState<OutputTab>('package')
  const [periodMonths, setPeriodMonths]             = useState<number | null>(DEFAULT_PERIOD_MONTHS)
  const [selectedVarietyIds, setSelectedVarietyIds] = useState<number[]>([])
  const [showFilter, setShowFilter]                 = useState(false)
  const [isPending, startTransition]                = useTransition()

  // ── 기간 변경: 즉시 fetch (품종 필터 유지) ─────────────────────────────
  function handlePeriodChange(months: number | null) {
    setPeriodMonths(months)
    const { from, to } = computeDateRange(months)
    startTransition(async () => {
      const newData = await getOutputStatistics({
        from,
        to,
        varietyIds: selectedVarietyIds.length ? selectedVarietyIds : undefined,
      })
      setData(newData)
    })
  }

  // ── 품종 토글 ─────────────────────────────────────────────────────────
  function handleVarietyToggle(id: number) {
    setSelectedVarietyIds(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    )
  }

  // ── 검색 ──────────────────────────────────────────────────────────────
  function handleSearch() {
    const { from, to } = computeDateRange(periodMonths)
    startTransition(async () => {
      const newData = await getOutputStatistics({
        from,
        to,
        varietyIds: selectedVarietyIds.length ? selectedVarietyIds : undefined,
      })
      setData(newData)
    })
  }

  // ── 초기화 ────────────────────────────────────────────────────────────
  function handleReset() {
    setPeriodMonths(DEFAULT_PERIOD_MONTHS)
    setSelectedVarietyIds([])
    const { from, to } = computeDateRange(DEFAULT_PERIOD_MONTHS)
    startTransition(async () => {
      const newData = await getOutputStatistics({ from, to })
      setData(newData)
    })
  }

  // ── 칩 제거 ───────────────────────────────────────────────────────────
  function removeChipVariety(id: number) {
    const newIds = selectedVarietyIds.filter(v => v !== id)
    setSelectedVarietyIds(newIds)
    const { from, to } = computeDateRange(periodMonths)
    startTransition(async () => {
      const newData = await getOutputStatistics({
        from,
        to,
        varietyIds: newIds.length ? newIds : undefined,
      })
      setData(newData)
    })
  }

  const TABS: { key: OutputTab; label: string; disabled?: boolean }[] = [
    { key: 'package',     label: '규격별' },
    { key: 'month',       label: '월별',    disabled: true },
    { key: 'destination', label: '출고처별', disabled: true },
  ]

  const hasActiveFilters = selectedVarietyIds.length > 0
  const activeFilterCount = selectedVarietyIds.length > 0 ? 1 : 0

  // 출고처 차트 높이
  const CHART_SCROLL_MAX_H = 10 * ITEM_H
  const destChartH = Math.max(data.byDestination.length * ITEM_H, ITEM_H * 3)

  const periodLabel =
    periodMonths === null
      ? '전체 기간'
      : `최근 ${periodMonths >= 12 ? `${periodMonths / 12}년` : `${periodMonths}개월`}`

  return (
    <div className="w-full flex flex-col gap-2 px-1.5 sm:px-0 sm:gap-4">

      {/* ── 탭 + 필터 카드 ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">

        {/* 탭 바 */}
        <div className="flex border-b border-slate-100 rounded-t-2xl overflow-hidden">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => !tab.disabled && setActiveTab(tab.key)}
              disabled={tab.disabled}
              className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                tab.disabled
                  ? 'border-transparent text-slate-300 cursor-not-allowed'
                  : activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1 pr-2">
            {isPending && <RefreshCw className="w-3.5 h-3.5 text-slate-300 animate-spin" />}
            <StatsExcelButton
              getRows={() => {
                if (activeTab === 'month') {
                  return data.byMonth.map(r => ({
                    '월': r.month,
                    '생산량(kg)': r.productionKg,
                    '출고량(kg)': r.releaseKg,
                  }))
                }
                if (activeTab === 'destination') {
                  return data.byDestination.map(r => ({
                    '출고처': r.destination,
                    '출고량(kg)': r.releaseKg,
                    '출고 건수': r.releaseCount,
                  }))
                }
                return data.byPackageType.map(r => ({
                  '포장규격': r.packageType,
                  '수량': r.count,
                  '총중량(kg)': r.totalWeight,
                  '비율(%)': r.percentage,
                }))
              }}
              sheetName={
                activeTab === 'month' ? '월별'
                  : activeTab === 'destination' ? '출고처별'
                  : '규격별'
              }
              fileNamePrefix={`출고분석_${activeTab}`}
            />
            {/* 모바일 필터 버튼 */}
            <button
              onClick={() => setShowFilter(true)}
              className={`md:hidden flex items-center gap-1.5 h-8 px-2 rounded-lg border text-xs font-semibold transition-colors ${
                activeFilterCount > 0
                  ? 'bg-[#00a2e8]/10 text-[#00a2e8] border-[#00a2e8]/30'
                  : 'text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {activeFilterCount > 0 && (
                <span className="h-5 px-1.5 bg-[#00a2e8]/20 text-[#008cc9] ml-0.5 rounded-full text-[10px] flex items-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* PC: 인라인 필터 바 */}
        <div className="hidden md:block">
          <div className="px-4 py-3 flex flex-wrap items-center gap-2">
            {/* 기간 버튼 */}
            <span className="text-xs font-semibold text-slate-400 mr-1">기간</span>
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.label}
                type="button"
                onClick={() => handlePeriodChange(opt.months)}
                disabled={isPending}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                  periodMonths === opt.months
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}

            {/* 구분선 */}
            <div className="w-px h-5 bg-slate-200 mx-1" />

            {/* 품종 멀티셀렉트 */}
            <MultiSelectDropdown
              options={varietyOptions}
              selected={selectedVarietyIds}
              onToggle={handleVarietyToggle}
              placeholder="품종"
              colorClass="bg-green-50 text-green-700"
            />

            {/* 초기화 / 검색 */}
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleReset}
                disabled={isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-3 h-3" />
                초기화
              </button>
              <button
                type="button"
                onClick={handleSearch}
                disabled={isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                <Search className="w-3 h-3" />
                검색
              </button>
            </div>
          </div>

          {/* PC: 적용 조건 칩 */}
          {hasActiveFilters && (
            <div className="px-4 py-2 border-t border-slate-50 flex flex-wrap items-center gap-1.5 min-h-[2.5rem]">
              <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">
                {periodLabel}
              </span>
              {selectedVarietyIds.map(id => {
                const v = varietyOptions.find(o => o.id === id)
                if (!v) return null
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => removeChipVariety(id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium hover:bg-green-100 transition-colors"
                  >
                    {v.name}
                    <X className="w-3 h-3" />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 모바일: 항상 표시 칩 */}
        <div className="md:hidden px-4 py-2 flex flex-wrap gap-1.5 min-h-[2.5rem]">
          <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">
            {periodLabel}
          </span>
          {selectedVarietyIds.map(id => {
            const v = varietyOptions.find(o => o.id === id)
            if (!v) return null
            return (
              <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                {v.name}
                <button onClick={() => removeChipVariety(id)}><X className="w-3 h-3" /></button>
              </span>
            )
          })}
        </div>
      </div>

      {/* ── 필터 팝업 (모바일) ── */}
      {showFilter && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowFilter(false)} />
          <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+8px)] left-3 right-3 z-50 bg-white rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-52px-3.5rem-env(safe-area-inset-bottom)-16px)] overflow-hidden">

            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
              <h3 className="text-sm font-bold text-slate-800">검색 조건</h3>
              <button onClick={() => setShowFilter(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* 스크롤 영역 */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2.5 flex flex-col gap-3">

              {/* 기간 */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">기간</p>
                <div className="flex flex-wrap gap-1.5">
                  {PERIOD_OPTIONS.map(opt => (
                    <button
                      key={opt.label}
                      onClick={() => handlePeriodChange(opt.months)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                        periodMonths === opt.months
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 품종 */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  품종
                  {selectedVarietyIds.length > 0 && (
                    <span className="ml-1.5 font-normal normal-case text-green-600">{selectedVarietyIds.length}개 선택</span>
                  )}
                </p>
                {varietyOptions.length === 0 ? (
                  <p className="text-xs text-slate-400">항목 없음</p>
                ) : (
                  <div className="max-h-[160px] overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                    {varietyOptions.map(v => (
                      <label
                        key={v.id}
                        className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedVarietyIds.includes(v.id)}
                          onChange={() => handleVarietyToggle(v.id)}
                          className="w-3.5 h-3.5 rounded accent-green-500 shrink-0"
                        />
                        <span className="text-xs text-slate-700">{v.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="px-4 py-3 border-t border-slate-100 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => { handleReset(); setShowFilter(false) }}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors"
              >
                초기화
              </button>
              <button
                onClick={() => { handleSearch(); setShowFilter(false) }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors"
              >
                <Search className="w-4 h-4" />
                검색
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── 차트 + 서머리 카드 ── */}
      <div className="flex flex-col md:flex-row gap-2 md:gap-3 md:items-stretch">

        {/* 차트 영역 */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {activeTab === 'package'     && '포장 규격별 생산 현황'}
              {activeTab === 'month'       && '월별 생산 · 출고 추이'}
              {activeTab === 'destination' && '출고처별 출고 현황'}
            </p>
          </div>

          {activeTab === 'package' && (
            <PackageTypePieChart data={data.byPackageType} />
          )}

          {activeTab === 'month' && (
            <div className="px-4 pb-4">
              <MonthlyBarChart data={data.byMonth} height={320} />
            </div>
          )}

          {activeTab === 'destination' && (
            <div
              className="overflow-y-auto px-4 pb-3"
              style={{ maxHeight: CHART_SCROLL_MAX_H }}
            >
              <div style={{ height: destChartH }}>
                <DestinationBarChart data={data.byDestination} height={destChartH} />
              </div>
            </div>
          )}
        </div>

        {/* 서머리 카드 */}
        <OutputSummaryCards summary={data.summary} />
      </div>

      {/* ── 테이블 (비활성) ── */}
      {/*
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-2">
        {activeTab === 'package'     && <PackageTypeTable  rows={data.byPackageType}  />}
        {activeTab === 'month'       && <MonthlyTable      rows={data.byMonth}        />}
        {activeTab === 'destination' && <DestinationTable  rows={data.byDestination}  />}
      </div>
      */}

    </div>
  )
}
