'use client'

import { useState, useTransition, useMemo } from 'react'
import { format } from 'date-fns'
import { Calendar, RefreshCw, Search, X, SlidersHorizontal } from 'lucide-react'
import { SummaryCards } from '@/components/statistics/SummaryCards'
import { MillingChart } from '@/components/statistics/MillingChart'
import { MultiSeriesChart } from '@/components/statistics/MultiSeriesChart'
import { MillingTable } from '@/components/statistics/MillingTable'
import { MultiSelectDropdown, type MultiSelectOption } from '@/components/statistics/MultiSelectDropdown'
import {
  getMillingStatistics,
  getMillingStatsByVariety,
  getMillingStatsByMillingType,
} from '@/app/actions/statistics'
import type {
  MillingStatisticsData,
  MultiSeriesChartData,
  QuickPeriod,
  GroupBy,
} from '@/app/actions/statistics'
import { resolveQuickPeriod, resolveGroupBy } from '@/lib/statistics-utils'
import {
  MAIN_TABS,
  QUICK_PERIODS,
  DEFAULT_PERIOD_VARIETIES,
  DEFAULT_VARIETIES,
  DEFAULT_MILLINGTYPE_VARIETIES,
  MAX_VARIETY_SELECT,
  type MainTab,
} from './_parts/constants'
import { MillingFilterSheet } from './_parts/milling-filter-sheet'
import { StatsExcelButton } from '@/components/statistics/StatsExcelButton'

type Props = {
  initialData: MillingStatisticsData
  varietyOptions: string[]
  millingTypeOptions: string[]
  currentCropYear: number
}

// ── 빈 멀티시리즈 데이터 ──────────────────────────
function emptyMultiSeries(groupBy: GroupBy): MultiSeriesChartData {
  return { periods: [], seriesNames: [], groupBy }
}

// ── 컴포넌트 ──────────────────────────────────────
export function MillingStatsClient({
  initialData,
  varietyOptions,
  millingTypeOptions,
  currentCropYear,
}: Props) {
  const [data, setData]                             = useState(initialData)
  const [varietyChartData, setVarietyChartData]     = useState<MultiSeriesChartData>(() => emptyMultiSeries(initialData.groupBy))
  const [millingTypeChartData, setMillingTypeChartData] = useState<MultiSeriesChartData>(() => emptyMultiSeries(initialData.groupBy))

  const [mainTab, setMainTab]             = useState<MainTab>('period')
  const [quickPeriod, setQuickPeriod]     = useState<QuickPeriod>('6m')
  const [cropYear, setCropYear]           = useState(currentCropYear)
  const [from, setFrom] = useState(() => {
    const r = resolveQuickPeriod('6m')
    return format(r.from, 'yyyy-MM-dd')
  })
  const [to, setTo] = useState(() => {
    const r = resolveQuickPeriod('6m')
    return format(r.to, 'yyyy-MM-dd')
  })
  const [showCustomDate, setShowCustomDate]         = useState(false)
  const [selectedVarieties, setSelectedVarieties]   = useState<string[]>(DEFAULT_PERIOD_VARIETIES)
  const [selectedMillingTypes, setSelectedMillingTypes] = useState<string[]>(['백미'])

  // 생산자 검색
  const [farmerInput, setFarmerInput]       = useState('')
  const [appliedFarmers, setAppliedFarmers] = useState<string[]>([])

  // 필터 팝업 (모바일 전용)
  const [showFilter, setShowFilter] = useState(false)

  const [isPending, startTransition] = useTransition()

  // ── 드롭다운 옵션 변환 (MultiSelectDropdown 형식) ─
  const varietyDropdownOptions = useMemo<MultiSelectOption<string>[]>(
    () => varietyOptions.map(v => ({ id: v, label: v })),
    [varietyOptions]
  )
  const millingTypeDropdownOptions = useMemo<MultiSelectOption<string>[]>(
    () => millingTypeOptions.map(t => ({ id: t, label: t })),
    [millingTypeOptions]
  )

  // ── 데이터 fetch ─────────────────────────────────
  function fetchPeriod(overrides?: {
    from?: string; to?: string
    groupBy?: GroupBy
    varieties?: string[]; millingTypes?: string[]
    farmers?: string[]
    cropYear?: number
  }) {
    const resolvedFrom    = overrides?.from         ?? from
    const resolvedTo      = overrides?.to           ?? to
    const resolvedVars    = overrides?.varieties    ?? selectedVarieties
    const resolvedTypes   = overrides?.millingTypes ?? selectedMillingTypes
    const resolvedFarmers = overrides?.farmers      ?? appliedFarmers
    const resolvedGroupBy = overrides?.groupBy      ?? resolveGroupBy(new Date(resolvedFrom), new Date(resolvedTo))

    startTransition(async () => {
      const result = await getMillingStatistics({
        from: new Date(resolvedFrom),
        to: new Date(resolvedTo),
        groupBy: resolvedGroupBy,
        varieties: resolvedVars.length ? resolvedVars : undefined,
        millingTypes: resolvedTypes.length ? resolvedTypes : undefined,
        farmers: resolvedFarmers.length ? resolvedFarmers : undefined,
        cropYear: overrides?.cropYear,
      })
      setData(result)
    })
  }

  function fetchVariety(overrides?: {
    from?: string; to?: string
    varieties?: string[]; millingTypes?: string[]
    farmers?: string[]
    cropYear?: number
  }) {
    const resolvedFrom    = overrides?.from         ?? from
    const resolvedTo      = overrides?.to           ?? to
    const resolvedVars    = overrides?.varieties    ?? selectedVarieties
    const resolvedTypes   = overrides?.millingTypes ?? selectedMillingTypes
    const resolvedFarmers = overrides?.farmers      ?? appliedFarmers
    const resolvedGroupBy = resolveGroupBy(new Date(resolvedFrom), new Date(resolvedTo))

    startTransition(async () => {
      const [chart, stats] = await Promise.all([
        getMillingStatsByVariety({
          from: new Date(resolvedFrom),
          to: new Date(resolvedTo),
          groupBy: resolvedGroupBy,
          varieties: resolvedVars.length ? resolvedVars : DEFAULT_VARIETIES,
          millingTypes: resolvedTypes.length ? resolvedTypes : undefined,
          farmers: resolvedFarmers.length ? resolvedFarmers : undefined,
          cropYear: overrides?.cropYear,
        }),
        getMillingStatistics({
          from: new Date(resolvedFrom),
          to: new Date(resolvedTo),
          groupBy: resolvedGroupBy,
          varieties: resolvedVars.length ? resolvedVars : undefined,
          millingTypes: resolvedTypes.length ? resolvedTypes : undefined,
          farmers: resolvedFarmers.length ? resolvedFarmers : undefined,
          cropYear: overrides?.cropYear,
        }),
      ])
      setVarietyChartData(chart)
      setData(stats)
    })
  }

  function fetchMillingType(overrides?: {
    from?: string; to?: string
    varieties?: string[]; millingTypes?: string[]
    farmers?: string[]
    cropYear?: number
  }) {
    const resolvedFrom    = overrides?.from         ?? from
    const resolvedTo      = overrides?.to           ?? to
    const resolvedVars    = overrides?.varieties    ?? selectedVarieties
    const resolvedTypes   = overrides?.millingTypes ?? selectedMillingTypes
    const resolvedFarmers = overrides?.farmers      ?? appliedFarmers
    const resolvedGroupBy = resolveGroupBy(new Date(resolvedFrom), new Date(resolvedTo))

    startTransition(async () => {
      const [chart, stats] = await Promise.all([
        getMillingStatsByMillingType({
          from: new Date(resolvedFrom),
          to: new Date(resolvedTo),
          groupBy: resolvedGroupBy,
          millingTypes: resolvedTypes.length ? resolvedTypes : millingTypeOptions,
          varieties: resolvedVars.length ? resolvedVars : undefined,
          farmers: resolvedFarmers.length ? resolvedFarmers : undefined,
          cropYear: overrides?.cropYear,
        }),
        getMillingStatistics({
          from: new Date(resolvedFrom),
          to: new Date(resolvedTo),
          groupBy: resolvedGroupBy,
          millingTypes: resolvedTypes.length ? resolvedTypes : undefined,
          varieties: resolvedVars.length ? resolvedVars : undefined,
          farmers: resolvedFarmers.length ? resolvedFarmers : undefined,
          cropYear: overrides?.cropYear,
        }),
      ])
      setMillingTypeChartData(chart)
      setData(stats)
    })
  }

  // 탭에 맞는 fetch 실행
  function fetchCurrent(tab: MainTab, overrides?: {
    from?: string; to?: string
    varieties?: string[]; millingTypes?: string[]
    farmers?: string[]
    cropYear?: number
    groupBy?: GroupBy
  }) {
    if (tab === 'period')      fetchPeriod(overrides)
    else if (tab === 'variety') fetchVariety(overrides)
    else                        fetchMillingType(overrides)
  }

  // ── 탭 전환 ───────────────────────────────────────
  // 탭 전환 시 품종·도정구분·생산자 필터는 각 탭 기본값으로 강제 리셋 (기간 필터는 유지)
  function handleTabChange(tab: MainTab) {
    setMainTab(tab)
    setFarmerInput('')
    setAppliedFarmers([])

    if (tab === 'period') {
      // 기간별: 품종 5개 + 도정구분 백미
      const vars = DEFAULT_PERIOD_VARIETIES.filter(v => varietyOptions.includes(v))
      setSelectedVarieties(vars)
      setSelectedMillingTypes(['백미'])
      fetchPeriod({ varieties: vars, millingTypes: ['백미'], farmers: [] })
    } else if (tab === 'variety') {
      // 품종별: 품종 5개 + 도정구분 백미
      const vars = DEFAULT_VARIETIES.filter(v => varietyOptions.includes(v))
      setSelectedVarieties(vars)
      setSelectedMillingTypes(['백미'])
      fetchVariety({ varieties: vars, millingTypes: ['백미'], farmers: [] })
    } else {
      // 도정구분별: 품종 6개 + 도정구분 전체
      const allTypes = millingTypeOptions
      const vars = DEFAULT_MILLINGTYPE_VARIETIES.filter(v => varietyOptions.includes(v))
      setSelectedMillingTypes(allTypes)
      setSelectedVarieties(vars)
      fetchMillingType({ millingTypes: allTypes, varieties: vars, farmers: [] })
    }
  }

  // ── 검색 버튼 ─────────────────────────────────────
  function handleSearch() {
    const terms = farmerInput.split(',').map(s => s.trim()).filter(Boolean)
    setAppliedFarmers(terms)
    fetchCurrent(mainTab, { farmers: terms })
  }

  // ── 초기화 ────────────────────────────────────────
  function handleReset() {
    const r = resolveQuickPeriod('6m')
    const newFrom = format(r.from, 'yyyy-MM-dd')
    const newTo   = format(r.to,   'yyyy-MM-dd')
    setQuickPeriod('6m')
    setFrom(newFrom)
    setTo(newTo)
    setCropYear(currentCropYear)
    setShowCustomDate(false)
    setSelectedVarieties(DEFAULT_PERIOD_VARIETIES)
    setSelectedMillingTypes(['백미'])
    setFarmerInput('')
    setAppliedFarmers([])

    if (mainTab === 'period') {
      fetchPeriod({ from: newFrom, to: newTo, groupBy: r.groupBy, varieties: DEFAULT_PERIOD_VARIETIES, millingTypes: ['백미'], farmers: [] })
    } else if (mainTab === 'variety') {
      setSelectedVarieties(DEFAULT_VARIETIES)
      fetchVariety({ from: newFrom, to: newTo, varieties: DEFAULT_VARIETIES, millingTypes: [] })
    } else {
      const allTypes = millingTypeOptions
      const vars = DEFAULT_MILLINGTYPE_VARIETIES.filter(v => varietyOptions.includes(v))
      setSelectedMillingTypes(allTypes)
      setSelectedVarieties(vars)
      fetchMillingType({ from: newFrom, to: newTo, millingTypes: allTypes, varieties: vars })
    }
  }

  // ── 빠른기간 선택 ─────────────────────────────────
  function handleQuickPeriod(key: QuickPeriod) {
    if (key === 'custom') {
      setQuickPeriod('custom')
      setShowCustomDate(true)
      return
    }
    const r = resolveQuickPeriod(key, cropYear)
    setQuickPeriod(key)
    setFrom(format(r.from, 'yyyy-MM-dd'))
    setTo(format(r.to, 'yyyy-MM-dd'))
    setShowCustomDate(false)
    // 모바일 팝업 열려있을 때는 검색버튼 클릭 시 fetch
    if (showFilter) return
    fetchCurrent(mainTab, {
      from: format(r.from, 'yyyy-MM-dd'),
      to: format(r.to, 'yyyy-MM-dd'),
      groupBy: r.groupBy,
      cropYear: key === 'cropYear' ? cropYear : undefined,
    })
  }

  // ── 연산 변경 ─────────────────────────────────────
  function handleCropYear(year: number) {
    setCropYear(year)
    if (quickPeriod === 'cropYear') {
      const r = resolveQuickPeriod('cropYear', year)
      setFrom(format(r.from, 'yyyy-MM-dd'))
      setTo(format(r.to, 'yyyy-MM-dd'))
      // 모바일 팝업 열려있을 때는 검색버튼 클릭 시 fetch
      if (showFilter) return
      fetchCurrent(mainTab, {
        from: format(r.from, 'yyyy-MM-dd'),
        to: format(r.to, 'yyyy-MM-dd'),
        cropYear: year,
      })
    }
  }

  // ── 날짜 직접 입력 ────────────────────────────────
  function handleCustomDate(newFrom: string, newTo: string) {
    setFrom(newFrom)
    setTo(newTo)
  }

  // ── 품종 멀티셀렉 ─────────────────────────────────
  function toggleVariety(name: string) {
    setSelectedVarieties(prev => {
      if (prev.includes(name)) return prev.filter(v => v !== name)
      if (prev.length >= MAX_VARIETY_SELECT) return prev
      return [...prev, name]
    })
  }

  // ── 도정구분 멀티셀렉 ─────────────────────────────
  function toggleMillingType(type: string) {
    setSelectedMillingTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  // ── 칩 제거 → 즉시 fetch ──────────────────────────
  function removeVarietyChip(name: string) {
    const next = selectedVarieties.filter(v => v !== name)
    setSelectedVarieties(next)
    fetchCurrent(mainTab, { varieties: next })
  }

  function removeMillingTypeChip(type: string) {
    const next = selectedMillingTypes.filter(t => t !== type)
    setSelectedMillingTypes(next)
    fetchCurrent(mainTab, { millingTypes: next })
  }

  function removeFarmerChip(name: string) {
    const next = appliedFarmers.filter(n => n !== name)
    setAppliedFarmers(next)
    fetchCurrent(mainTab, { farmers: next })
  }

  // ── 기간 레이블 ───────────────────────────────────
  function getPeriodLabel(): string {
    if (quickPeriod === 'cropYear') return `${cropYear}년산`
    if (quickPeriod === 'custom') return `${from} ~ ${to}`
    return QUICK_PERIODS.find(p => p.key === quickPeriod)?.label ?? quickPeriod
  }

  function getMobilePeriodLabel(): string {
    if (quickPeriod === 'cropYear') return `'${String(cropYear).slice(2)}년산`
    if (quickPeriod === 'custom') return '직접입력'
    return QUICK_PERIODS.find(p => p.key === quickPeriod)?.label ?? quickPeriod
  }

  function getMobilePeriodSub(): string {
    return `${from.slice(5).replace('-', '/')} ~ ${to.slice(5).replace('-', '/')}`
  }

  // ── 활성 필터 카운트 (모바일 뱃지용) ─────────────
  const activeFilterCount = [
    quickPeriod !== '6m',
    selectedVarieties.length > 0,
    selectedMillingTypes.length > 0 && !(selectedMillingTypes.length === 1 && selectedMillingTypes[0] === '백미'),
    appliedFarmers.length > 0,
  ].filter(Boolean).length

  // ── 연산 년도 목록 ────────────────────────────────
  const cropYearOptions = [
    currentCropYear - 1,
    currentCropYear,
    currentCropYear + 1,
  ].filter(y => y >= 2020)

  // ── 렌더 ─────────────────────────────────────────
  return (
    <div className="w-full flex flex-col gap-2 px-1.5 sm:px-0 sm:gap-4">

      {/* ── 탭 + 필터 ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">

        {/* 메인 탭 */}
        <div className="flex border-b border-slate-100 rounded-t-2xl overflow-hidden">
          {MAIN_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                mainTab === tab.key
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
              getRows={() => data.tableData.map(r => ({
                '날짜': r.date,
                '도정종류': r.millingType,
                '품종': r.varieties,
                '생산자': r.farmers,
                '투입량(kg)': r.inputKg,
                '생산량(kg)': r.outputKg,
                '수율(%)': r.yieldRate,
                '비고': r.remarks ?? '',
              }))}
              sheetName="수율분석"
              fileNamePrefix={`수율분석_${mainTab}`}
            />
            {/* 모바일 전용 필터 버튼 */}
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

            {/* 빠른기간 칩 */}
            <div className="flex items-center gap-1">
              {QUICK_PERIODS.map(p => {
                if (p.key === 'custom') {
                  return (
                    <button
                      key="custom"
                      onClick={() => handleQuickPeriod('custom')}
                      title="날짜 직접 입력"
                      className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                        quickPeriod === 'custom'
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                    </button>
                  )
                }
                return (
                  <button
                    key={p.key}
                    onClick={() => handleQuickPeriod(p.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      quickPeriod === p.key
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {p.key === 'cropYear' ? `${cropYear}년산` : p.label}
                  </button>
                )
              })}
            </div>

            {/* 연산 년도 선택 */}
            {quickPeriod === 'cropYear' && (
              <div className="flex items-center gap-1 border-l border-slate-100 pl-2">
                {cropYearOptions.map(y => (
                  <button
                    key={y}
                    onClick={() => handleCropYear(y)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      cropYear === y
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}

            {/* 날짜 직접 입력 */}
            {showCustomDate && (
              <div className="flex items-center gap-2 border-l border-slate-100 pl-3">
                <input
                  type="date"
                  value={from}
                  onChange={e => handleCustomDate(e.target.value, to)}
                  className="bg-slate-100 border-0 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <span className="text-slate-300 text-xs">~</span>
                <input
                  type="date"
                  value={to}
                  onChange={e => handleCustomDate(from, e.target.value)}
                  className="bg-slate-100 border-0 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            )}

            {/* 구분선 */}
            <div className="h-5 w-px bg-slate-100 mx-1" />

            {/* 품종 드롭다운 */}
            <MultiSelectDropdown
              options={varietyDropdownOptions}
              selected={selectedVarieties}
              onToggle={toggleVariety}
              onClearAll={() => setSelectedVarieties([])}
              placeholder="품종"
              maxSelect={mainTab === 'variety' ? MAX_VARIETY_SELECT : undefined}
              maxSelectHint={mainTab === 'variety' ? `최대 ${MAX_VARIETY_SELECT}개 선택` : undefined}
            />

            {/* 도정구분 드롭다운 */}
            <MultiSelectDropdown
              options={millingTypeDropdownOptions}
              selected={selectedMillingTypes}
              onToggle={toggleMillingType}
              onClearAll={() => setSelectedMillingTypes([])}
              placeholder="도정구분"
              minWidth={140}
            />

            {/* 구분선 */}
            <div className="h-5 w-px bg-slate-100 mx-1" />

            {/* 생산자 검색 */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={farmerInput}
                onChange={e => setFarmerInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
                placeholder="생산자명 (쉼표로 구분)"
                className="bg-slate-100 border-0 rounded-lg px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 w-44"
              />
            </div>

            {/* 검색 / 초기화 버튼 */}
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={handleReset}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-colors"
              >
                초기화
              </button>
              <button
                onClick={handleSearch}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-semibold hover:bg-blue-600 active:bg-blue-700 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                검색
              </button>
            </div>
          </div>

          {/* PC: 적용된 조건 칩 */}
          <div className="px-4 py-2 border-t border-slate-50 min-h-[2.5rem] leading-loose">
            <span className="inline-flex items-center px-2.5 py-1 mr-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
              기간: {getPeriodLabel()}
            </span>
            {selectedVarieties.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 mr-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                <span className="font-semibold">품종:</span>
                {selectedVarieties.map((v, i) => (
                  <span key={v} className="inline-flex items-center gap-0.5">
                    {i > 0 && <span className="text-blue-300">·</span>}
                    {v}
                    <button onClick={() => removeVarietyChip(v)} className="text-blue-400 hover:text-blue-700 transition-colors ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </span>
            )}
            {selectedMillingTypes.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 mr-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                <span className="font-semibold">도정:</span>
                {selectedMillingTypes.map((t, i) => (
                  <span key={t} className="inline-flex items-center gap-0.5">
                    {i > 0 && <span className="text-purple-300">·</span>}
                    {t}
                    <button onClick={() => removeMillingTypeChip(t)} className="text-purple-400 hover:text-purple-700 transition-colors ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </span>
            )}
            {appliedFarmers.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 mr-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                <span className="font-semibold">생산자:</span>
                {appliedFarmers.map((name, i) => (
                  <span key={name} className="inline-flex items-center gap-0.5">
                    {i > 0 && <span className="text-emerald-300">·</span>}
                    {name}
                    <button onClick={() => removeFarmerChip(name)} className="text-emerald-400 hover:text-emerald-700 transition-colors ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>

        {/* 모바일: 항상 표시 선택값 칩 */}
        <div className="md:hidden px-4 py-2 flex flex-wrap gap-1.5 min-h-[2.5rem]">
          <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
            기간: {getPeriodLabel()}
          </span>
          {selectedVarieties.map(v => (
            <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
              {v}
              <button onClick={() => removeVarietyChip(v)} className="text-blue-400 hover:text-blue-700 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {selectedMillingTypes.map(t => (
            <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
              {t}
              <button onClick={() => removeMillingTypeChip(t)} className="text-purple-400 hover:text-purple-700 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {appliedFarmers.map(name => (
            <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
              {name}
              <button onClick={() => removeFarmerChip(name)} className="text-emerald-400 hover:text-emerald-700 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* ── 필터 팝업 (모바일) ── */}
      <MillingFilterSheet
        show={showFilter}
        onClose={() => setShowFilter(false)}
        mainTab={mainTab}
        quickPeriod={quickPeriod}
        cropYear={cropYear}
        cropYearOptions={cropYearOptions}
        from={from}
        to={to}
        onQuickPeriod={handleQuickPeriod}
        onCropYear={handleCropYear}
        onCustomDateChange={(newFrom, newTo) => {
          handleCustomDate(newFrom, newTo)
          setQuickPeriod('custom')
        }}
        varietyOptions={varietyOptions}
        selectedVarieties={selectedVarieties}
        onToggleVariety={toggleVariety}
        millingTypeOptions={millingTypeOptions}
        selectedMillingTypes={selectedMillingTypes}
        onToggleMillingType={toggleMillingType}
        farmerInput={farmerInput}
        onFarmerInputChange={setFarmerInput}
        onReset={() => { handleReset(); setShowFilter(false) }}
        onSearch={() => { handleSearch(); setShowFilter(false) }}
      />

      {/* ── 차트 + 요약 카드 ── */}
      <div className="flex flex-col gap-2 md:flex-row md:gap-4 md:items-stretch">
        {/* 차트 */}
        <div className="h-[260px] md:h-auto md:flex-1 md:min-w-0">
          {mainTab === 'period' && (
            <MillingChart data={data.chartData} groupBy={data.groupBy} />
          )}
          {mainTab === 'variety' && (
            <MultiSeriesChart data={varietyChartData} title="품종별" />
          )}
          {mainTab === 'millingType' && (
            <MultiSeriesChart data={millingTypeChartData} title="도정구분별" />
          )}
        </div>
        {/* 카드: 모바일 차트 아래 / PC 오른쪽 */}
        <div className="md:w-48 md:shrink-0">
          <SummaryCards summary={data.summary} />
        </div>
      </div>

      {/* ── 테이블 ── */}
      <MillingTable data={data.tableData} />
    </div>
  )
}
