'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { Calendar, RefreshCw, ChevronDown, X } from 'lucide-react'
import { SummaryCards } from '@/components/statistics/SummaryCards'
import { MultiSeriesChart } from '@/components/statistics/MultiSeriesChart'
import {
  getMillingStatistics,
  getMillingStatsByMillingType,
} from '@/app/actions/statistics'
import type {
  MultiSeriesChartData,
  StatsSummary,
  QuickPeriod,
  GroupBy,
} from '@/app/actions/statistics'
import { resolveQuickPeriod, resolveGroupBy } from '@/lib/statistics-utils'

// ── 상수 ──────────────────────────────────────────
const QUICK_PERIODS: { key: QuickPeriod; label: string }[] = [
  { key: 'cropYear', label: '연산' },
  { key: '1y',       label: '1년' },
  { key: '6m',       label: '6개월' },
  { key: '3m',       label: '3개월' },
  { key: '1m',       label: '1개월' },
  { key: '1w',       label: '1주' },
  { key: 'custom',   label: '' },
]

const DEFAULT_VARIETIES = ['백옥찰', '서농22호', '천지향1세', '천지향5세', '새청무', '하이아미']

// ── 타입 ──────────────────────────────────────────
type Props = {
  initialChartData: MultiSeriesChartData
  initialSummary: StatsSummary
  varietyOptions: string[]
  millingTypeOptions: string[]
  currentCropYear: number
}

// ── 컴포넌트 ──────────────────────────────────────
export function MillingTypeStatsClient({
  initialChartData,
  initialSummary,
  varietyOptions,
  millingTypeOptions,
  currentCropYear,
}: Props) {
  const [chartData, setChartData]   = useState<MultiSeriesChartData>(initialChartData)
  const [summary, setSummary]       = useState<StatsSummary>(initialSummary)

  const [quickPeriod, setQuickPeriod]   = useState<QuickPeriod>('6m')
  const [cropYear, setCropYear]         = useState(currentCropYear)
  const [from, setFrom] = useState(() => {
    const r = resolveQuickPeriod('6m')
    return format(r.from, 'yyyy-MM-dd')
  })
  const [to, setTo] = useState(() => {
    const r = resolveQuickPeriod('6m')
    return format(r.to, 'yyyy-MM-dd')
  })
  const [showCustomDate, setShowCustomDate] = useState(false)

  const initVarieties = DEFAULT_VARIETIES.filter(v => varietyOptions.includes(v))
  const [selectedVarieties, setSelectedVarieties]       = useState<string[]>(initVarieties)
  const [selectedMillingTypes, setSelectedMillingTypes] = useState<string[]>(millingTypeOptions)

  const [showVarietyDrop, setShowVarietyDrop]   = useState(false)
  const [showTypeDrop, setShowTypeDrop]         = useState(false)
  const varietyRef = useRef<HTMLDivElement>(null)
  const typeRef    = useRef<HTMLDivElement>(null)

  const [isPending, startTransition] = useTransition()

  // 외부 클릭 시 드롭다운 닫기
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

  // ── 데이터 fetch ─────────────────────────────────
  function fetchData(overrides?: {
    from?: string
    to?: string
    groupBy?: GroupBy
    varieties?: string[]
    millingTypes?: string[]
    cropYear?: number
  }) {
    const resolvedFrom  = overrides?.from         ?? from
    const resolvedTo    = overrides?.to           ?? to
    const resolvedVars  = overrides?.varieties    ?? selectedVarieties
    const resolvedTypes = overrides?.millingTypes ?? selectedMillingTypes
    const resolvedGroupBy = overrides?.groupBy
      ?? resolveGroupBy(new Date(resolvedFrom), new Date(resolvedTo))

    const fromDate = new Date(resolvedFrom)
    const toDate   = new Date(resolvedTo)

    startTransition(async () => {
      const [chart, stats] = await Promise.all([
        getMillingStatsByMillingType({
          from: fromDate,
          to: toDate,
          groupBy: resolvedGroupBy,
          millingTypes: resolvedTypes.length ? resolvedTypes : millingTypeOptions,
          varieties: resolvedVars.length ? resolvedVars : undefined,
          cropYear: overrides?.cropYear,
        }),
        getMillingStatistics({
          from: fromDate,
          to: toDate,
          groupBy: resolvedGroupBy,
          millingTypes: resolvedTypes.length ? resolvedTypes : undefined,
          varieties: resolvedVars.length ? resolvedVars : undefined,
          cropYear: overrides?.cropYear,
        }),
      ])
      setChartData(chart)
      setSummary(stats.summary)
    })
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
    fetchData({
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
      fetchData({
        from: format(r.from, 'yyyy-MM-dd'),
        to: format(r.to, 'yyyy-MM-dd'),
        cropYear: year,
      })
    }
  }

  // ── 날짜 직접 입력 (조회 버튼 없이 직접 fetch) ────
  function handleCustomDate(newFrom: string, newTo: string) {
    setFrom(newFrom)
    setTo(newTo)
    if (newFrom && newTo) {
      fetchData({ from: newFrom, to: newTo })
    }
  }

  // ── 품종 토글 → 즉시 fetch ─────────────────────────
  function toggleVariety(name: string) {
    const next = selectedVarieties.includes(name)
      ? selectedVarieties.filter(v => v !== name)
      : [...selectedVarieties, name]
    setSelectedVarieties(next)
    fetchData({ varieties: next })
  }

  // ── 도정구분 토글 → 즉시 fetch ────────────────────
  function toggleMillingType(type: string) {
    const next = selectedMillingTypes.includes(type)
      ? selectedMillingTypes.filter(t => t !== type)
      : [...selectedMillingTypes, type]
    setSelectedMillingTypes(next)
    fetchData({ millingTypes: next })
  }

  // ── 칩 제거 ────────────────────────────────────────
  function removeVarietyChip(name: string) {
    const next = selectedVarieties.filter(v => v !== name)
    setSelectedVarieties(next)
    fetchData({ varieties: next })
  }

  function removeMillingTypeChip(type: string) {
    const next = selectedMillingTypes.filter(t => t !== type)
    setSelectedMillingTypes(next)
    fetchData({ millingTypes: next })
  }

  // ── 초기화 ────────────────────────────────────────
  function handleReset() {
    const r = resolveQuickPeriod('6m')
    const newFrom = format(r.from, 'yyyy-MM-dd')
    const newTo   = format(r.to, 'yyyy-MM-dd')
    const newVars = DEFAULT_VARIETIES.filter(v => varietyOptions.includes(v))
    const newTypes = millingTypeOptions

    setQuickPeriod('6m')
    setFrom(newFrom)
    setTo(newTo)
    setCropYear(currentCropYear)
    setShowCustomDate(false)
    setSelectedVarieties(newVars)
    setSelectedMillingTypes(newTypes)

    fetchData({ from: newFrom, to: newTo, groupBy: r.groupBy, varieties: newVars, millingTypes: newTypes })
  }

  // ── 기간 레이블 ───────────────────────────────────
  function getPeriodLabel(): string {
    if (quickPeriod === 'cropYear') return `${cropYear}년산`
    if (quickPeriod === 'custom')   return `${from} ~ ${to}`
    return QUICK_PERIODS.find(p => p.key === quickPeriod)?.label ?? quickPeriod
  }

  const cropYearOptions = [
    currentCropYear - 1,
    currentCropYear,
    currentCropYear + 1,
  ].filter(y => y >= 2020)

  // ── 렌더 ─────────────────────────────────────────
  return (
    <div className="w-full flex flex-col gap-4">

      {/* ── 필터 바 ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">

        {/* 타이틀 + 로딩 */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-slate-50">
          <span className="text-sm font-bold text-slate-700">도정구분별 분석</span>
          {isPending && <RefreshCw className="w-3.5 h-3.5 text-slate-300 animate-spin" />}
        </div>

        {/* 검색 조건 */}
        <div className="px-4 py-3 flex flex-wrap items-center gap-2">

          {/* 빠른기간 버튼 */}
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
                {varietyOptions.map(v => {
                  const isSelected = selectedVarieties.includes(v)
                  return (
                    <button
                      key={v}
                      onClick={() => toggleVariety(v)}
                      className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 ${
                        isSelected ? 'text-blue-600 font-semibold hover:bg-slate-50' : 'text-slate-600 hover:bg-slate-50'
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
                <div className="border-t border-slate-50 mt-1 flex">
                  <button
                    onClick={() => { setSelectedVarieties(varietyOptions); fetchData({ varieties: varietyOptions }) }}
                    className="flex-1 px-4 py-2 text-xs text-slate-400 hover:bg-slate-50"
                  >
                    전체 선택
                  </button>
                  <button
                    onClick={() => { setSelectedVarieties([]); fetchData({ varieties: [] }) }}
                    className="flex-1 px-4 py-2 text-xs text-slate-400 hover:bg-slate-50"
                  >
                    전체 해제
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 도정구분 드롭다운 */}
          <div className="relative" ref={typeRef}>
            <button
              onClick={() => { setShowTypeDrop(t => !t); setShowVarietyDrop(false) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedMillingTypes.length > 0
                  ? 'bg-purple-50 text-purple-600'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              도정구분 {selectedMillingTypes.length > 0 && (
                <span className="bg-purple-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {selectedMillingTypes.length}
                </span>
              )}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showTypeDrop && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-20 min-w-[140px]">
                {millingTypeOptions.map(t => {
                  const isSelected = selectedMillingTypes.includes(t)
                  return (
                    <button
                      key={t}
                      onClick={() => toggleMillingType(t)}
                      className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 ${
                        isSelected ? 'text-purple-600 font-semibold hover:bg-slate-50' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-purple-500 border-purple-500' : 'border-slate-300'
                      }`}>
                        {isSelected && <span className="text-white text-[8px]">✓</span>}
                      </span>
                      {t}
                    </button>
                  )
                })}
                <div className="border-t border-slate-50 mt-1 flex">
                  <button
                    onClick={() => { setSelectedMillingTypes(millingTypeOptions); fetchData({ millingTypes: millingTypeOptions }) }}
                    className="flex-1 px-4 py-2 text-xs text-slate-400 hover:bg-slate-50"
                  >
                    전체 선택
                  </button>
                  <button
                    onClick={() => { setSelectedMillingTypes([]); fetchData({ millingTypes: [] }) }}
                    className="flex-1 px-4 py-2 text-xs text-slate-400 hover:bg-slate-50"
                  >
                    전체 해제
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 초기화 */}
          <button
            onClick={handleReset}
            className="ml-auto px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-colors"
          >
            초기화
          </button>
        </div>

        {/* 적용 조건 칩 */}
        <div className="px-4 py-2 border-t border-slate-50 flex flex-wrap items-center gap-1.5 min-h-[2.5rem]">
          <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
            기간: {getPeriodLabel()}
          </span>
          {selectedVarieties.map(v => (
            <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
              품종: {v}
              <button onClick={() => removeVarietyChip(v)} className="ml-0.5 text-blue-400 hover:text-blue-700 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {selectedMillingTypes.map(t => (
            <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
              도정: {t}
              <button onClick={() => removeMillingTypeChip(t)} className="ml-0.5 text-purple-400 hover:text-purple-700 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* ── 차트 + 요약 카드 ── */}
      <div className="flex gap-4 items-stretch">
        <div className="flex-1 min-w-0">
          <MultiSeriesChart data={chartData} title="도정구분별" />
        </div>
        <div className="w-48 shrink-0">
          <SummaryCards summary={summary} />
        </div>
      </div>
    </div>
  )
}
