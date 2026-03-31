'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { Calendar, RefreshCw, ChevronDown, Search, X, SlidersHorizontal } from 'lucide-react'
import { SummaryCards } from '@/components/statistics/SummaryCards'
import { MillingChart } from '@/components/statistics/MillingChart'
import { MultiSeriesChart } from '@/components/statistics/MultiSeriesChart'
import { MillingTable } from '@/components/statistics/MillingTable'
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

// ── 타입 ──────────────────────────────────────────
type MainTab = 'period' | 'variety' | 'millingType'

type Props = {
  initialData: MillingStatisticsData
  varietyOptions: string[]
  millingTypeOptions: string[]
  currentCropYear: number
}

// ── 상수 ──────────────────────────────────────────
const MAIN_TABS: { key: MainTab; label: string }[] = [
  { key: 'period',      label: '기간별' },
  { key: 'variety',     label: '품종별' },
  { key: 'millingType', label: '도정구분별' },
]

const QUICK_PERIODS: { key: QuickPeriod; label: string }[] = [
  { key: 'cropYear', label: '연산' },
  { key: '1y',       label: '1년' },
  { key: '6m',       label: '6개월' },
  { key: '3m',       label: '3개월' },
  { key: '1m',       label: '1개월' },
  { key: '1w',       label: '1주' },
  { key: 'custom',   label: '' },
]

const DEFAULT_PERIOD_VARIETIES    = ['하이아미', '서농22호', '천지향1세', '새청무']
const DEFAULT_VARIETIES           = ['서농22호', '천지향1세', '하이아미']
const DEFAULT_MILLINGTYPE_VARIETIES = ['백옥찰', '서농22호', '천지향1세', '천지향5세', '새청무', '하이아미']
const MAX_VARIETY_SELECT       = 5

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
  const [showVarietyDrop, setShowVarietyDrop]       = useState(false)
  const [showTypeDrop, setShowTypeDrop]             = useState(false)
  const varietyRef = useRef<HTMLDivElement>(null)
  const typeRef    = useRef<HTMLDivElement>(null)

  // 생산자 검색
  const [farmerInput, setFarmerInput]       = useState('')
  const [appliedFarmers, setAppliedFarmers] = useState<string[]>([])

  // 필터 팝업 (모바일 전용)
  const [showFilter, setShowFilter] = useState(false)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (varietyRef.current && !varietyRef.current.contains(e.target as Node)) {
        setShowVarietyDrop(false)
      }
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) {
        setShowTypeDrop(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const [isPending, startTransition] = useTransition()

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
  function handleTabChange(tab: MainTab) {
    setMainTab(tab)
    setFarmerInput('')
    setAppliedFarmers([])

    if (tab === 'variety') {
      // 품종 기본값 적용 후 fetch
      const vars = selectedVarieties.length > 0 ? selectedVarieties : DEFAULT_VARIETIES
      if (selectedVarieties.length === 0) setSelectedVarieties(DEFAULT_VARIETIES)
      fetchVariety({ varieties: vars, farmers: [] })
    } else if (tab === 'millingType') {
      // 도정구분 전체 + 품종 6개 기본값 적용 후 fetch
      const allTypes = millingTypeOptions
      const vars = DEFAULT_MILLINGTYPE_VARIETIES.filter(v => varietyOptions.includes(v))
      setSelectedMillingTypes(allTypes)
      setSelectedVarieties(vars)
      fetchMillingType({ millingTypes: allTypes, varieties: vars, farmers: [] })
    } else {
      // period 탭 전환 시 초기화 후 fetch
      fetchPeriod({ farmers: [] })
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
            <div className="relative" ref={varietyRef}>
              <button
                onClick={() => { setShowVarietyDrop(v => !v); setShowTypeDrop(false) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  selectedVarieties.length > 0
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                품종 {selectedVarieties.length > 0 && (
                  <span className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                    {selectedVarieties.length}
                  </span>
                )}
                <ChevronDown className="w-3 h-3" />
              </button>
              {showVarietyDrop && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-20 min-w-[160px]">
                  {mainTab === 'variety' && (
                    <p className="px-4 pt-1.5 pb-1 text-[10px] text-slate-400">
                      최대 {MAX_VARIETY_SELECT}개 선택
                    </p>
                  )}
                  {varietyOptions.map(v => {
                    const isSelected = selectedVarieties.includes(v)
                    const isDisabled = mainTab === 'variety' && !isSelected && selectedVarieties.length >= MAX_VARIETY_SELECT
                    return (
                      <button
                        key={v}
                        onClick={() => !isDisabled && toggleVariety(v)}
                        disabled={isDisabled}
                        className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 ${
                          isDisabled
                            ? 'text-slate-300 cursor-not-allowed'
                            : isSelected
                              ? 'text-blue-600 font-semibold hover:bg-slate-50'
                              : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300'
                        }`}>
                          {isSelected && <span className="text-white text-[8px]">✓</span>}
                        </span>
                        {v}
                      </button>
                    )
                  })}
                  {selectedVarieties.length > 0 && (
                    <button
                      onClick={() => setSelectedVarieties([])}
                      className="w-full text-left px-4 py-2 text-xs text-slate-400 hover:bg-slate-50 border-t border-slate-50 mt-1"
                    >
                      전체 해제
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 도정구분 드롭다운 */}
            <div className="relative" ref={typeRef}>
              <button
                onClick={() => { setShowTypeDrop(t => !t); setShowVarietyDrop(false) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  selectedMillingTypes.length > 0
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                도정구분 {selectedMillingTypes.length > 0 && (
                  <span className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                    {selectedMillingTypes.length}
                  </span>
                )}
                <ChevronDown className="w-3 h-3" />
              </button>
              {showTypeDrop && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-20 min-w-[140px]">
                  {millingTypeOptions.map(t => (
                    <button
                      key={t}
                      onClick={() => toggleMillingType(t)}
                      className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 ${
                        selectedMillingTypes.includes(t) ? 'text-blue-600 font-semibold' : 'text-slate-600'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                        selectedMillingTypes.includes(t) ? 'bg-blue-500 border-blue-500' : 'border-slate-300'
                      }`}>
                        {selectedMillingTypes.includes(t) && <span className="text-white text-[8px]">✓</span>}
                      </span>
                      {t}
                    </button>
                  ))}
                  {selectedMillingTypes.length > 0 && (
                    <button
                      onClick={() => setSelectedMillingTypes([])}
                      className="w-full text-left px-4 py-2 text-xs text-slate-400 hover:bg-slate-50 border-t border-slate-50 mt-1"
                    >
                      전체 해제
                    </button>
                  )}
                </div>
              )}
            </div>

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

      {/* ── 필터 팝업 ── */}
      {showFilter && (
        <>
          {/* 배경 오버레이 */}
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setShowFilter(false)}
          />
          {/* 패널: 모바일 바텀시트 / PC 중앙 모달 */}
          <div className="fixed bottom-0 left-3 right-3 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[85dvh] sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-y-1/2 sm:-translate-x-1/2 sm:w-[480px] sm:rounded-2xl sm:max-h-[80dvh]">

            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <h3 className="text-sm font-bold text-slate-800">검색 조건</h3>
              <button
                onClick={() => setShowFilter(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

              {/* 기간 */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">기간</p>
                {/* 빠른기간 버튼 (custom 제외) */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {QUICK_PERIODS.filter(p => p.key !== 'custom').map(p => (
                    <button
                      key={p.key}
                      onClick={() => handleQuickPeriod(p.key)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                        quickPeriod === p.key
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {p.key === 'cropYear' ? `'${String(cropYear).slice(2)}년산` : p.label}
                    </button>
                  ))}
                </div>
                {/* 연산 년도 선택 */}
                {quickPeriod === 'cropYear' && (
                  <div className="flex items-center gap-1 mb-3">
                    {cropYearOptions.map(y => (
                      <button
                        key={y}
                        onClick={() => handleCropYear(y)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
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
                {/* 날짜 직접 입력 — 항상 2열 표시 */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400">시작일</span>
                    <input
                      type="date"
                      value={from}
                      onChange={e => { handleCustomDate(e.target.value, to); setQuickPeriod('custom') }}
                      className="bg-slate-100 border-0 rounded-lg px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400">종료일</span>
                    <input
                      type="date"
                      value={to}
                      onChange={e => { handleCustomDate(from, e.target.value); setQuickPeriod('custom') }}
                      className="bg-slate-100 border-0 rounded-lg px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                </div>
              </div>

              {/* 품종 */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  품종
                  {mainTab === 'variety' && (
                    <span className="ml-1 font-normal normal-case text-slate-400">(최대 {MAX_VARIETY_SELECT}개)</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {varietyOptions.map(v => {
                    const isSelected = selectedVarieties.includes(v)
                    const isDisabled = mainTab === 'variety' && !isSelected && selectedVarieties.length >= MAX_VARIETY_SELECT
                    return (
                      <button
                        key={v}
                        onClick={() => !isDisabled && toggleVariety(v)}
                        disabled={isDisabled}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                          isDisabled
                            ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                            : isSelected
                              ? 'bg-blue-500 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {v}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 도정구분 */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">도정구분</p>
                <div className="flex flex-wrap gap-1.5">
                  {millingTypeOptions.map(t => (
                    <button
                      key={t}
                      onClick={() => toggleMillingType(t)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                        selectedMillingTypes.includes(t)
                          ? 'bg-purple-500 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* 생산자 */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">생산자</p>
                <input
                  type="text"
                  value={farmerInput}
                  onChange={e => setFarmerInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { handleSearch(); setShowFilter(false) } }}
                  placeholder="생산자명 (쉼표로 구분)"
                  className="w-full bg-slate-100 border-0 rounded-lg px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
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
