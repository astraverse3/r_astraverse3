'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { Calendar, RefreshCw, ChevronDown, Search, X } from 'lucide-react'
import { SummaryCards } from '@/components/statistics/SummaryCards'
import { MillingChart } from '@/components/statistics/MillingChart'
import { MillingTable } from '@/components/statistics/MillingTable'
import { getMillingStatistics } from '@/app/actions/statistics'
import type { MillingStatisticsData, QuickPeriod, GroupBy } from '@/app/actions/statistics'
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

// ── 컴포넌트 ──────────────────────────────────────
export function MillingStatsClient({
  initialData,
  varietyOptions,
  millingTypeOptions,
  currentCropYear,
}: Props) {
  const [data, setData] = useState(initialData)
  const [mainTab, setMainTab] = useState<MainTab>('period')
  const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>('1m')
  const [cropYear, setCropYear] = useState(currentCropYear)
  const [from, setFrom] = useState(() => {
    const r = resolveQuickPeriod('1m')
    return format(r.from, 'yyyy-MM-dd')
  })
  const [to, setTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [showCustomDate, setShowCustomDate] = useState(false)
  const [selectedVarieties, setSelectedVarieties] = useState<string[]>([])
  const [selectedMillingTypes, setSelectedMillingTypes] = useState<string[]>(['백미'])
  const [showVarietyDrop, setShowVarietyDrop] = useState(false)
  const [showTypeDrop, setShowTypeDrop] = useState(false)
  const varietyRef = useRef<HTMLDivElement>(null)
  const typeRef = useRef<HTMLDivElement>(null)

  // 생산자 검색
  const [farmerInput, setFarmerInput] = useState('')
  const [appliedFarmers, setAppliedFarmers] = useState<string[]>([])

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
  function fetch(overrides?: {
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

  // ── 검색 버튼 ─────────────────────────────────────
  // 모든 필터를 반영하여 한 번에 fetch
  function handleSearch() {
    const terms = farmerInput.split(',').map(s => s.trim()).filter(Boolean)
    setAppliedFarmers(terms)
    fetch({ farmers: terms })
  }

  // ── 초기화 ────────────────────────────────────────
  function handleReset() {
    const r = resolveQuickPeriod('1m')
    const newFrom = format(r.from, 'yyyy-MM-dd')
    const newTo   = format(r.to,   'yyyy-MM-dd')
    setQuickPeriod('1m')
    setFrom(newFrom)
    setTo(newTo)
    setCropYear(currentCropYear)
    setShowCustomDate(false)
    setSelectedVarieties([])
    setSelectedMillingTypes(['백미'])
    setFarmerInput('')
    setAppliedFarmers([])
    fetch({ from: newFrom, to: newTo, groupBy: r.groupBy, varieties: [], millingTypes: ['백미'], farmers: [] })
  }

  // ── 빠른기간 선택 (상태만 변경, fetch 없음) ──────
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
  }

  // ── 연산 변경 (상태만 변경, fetch 없음) ──────────
  function handleCropYear(year: number) {
    setCropYear(year)
    if (quickPeriod === 'cropYear') {
      const r = resolveQuickPeriod('cropYear', year)
      setFrom(format(r.from, 'yyyy-MM-dd'))
      setTo(format(r.to, 'yyyy-MM-dd'))
    }
  }

  // ── 날짜 직접 입력 (상태만 변경, fetch 없음) ─────
  function handleCustomDate(newFrom: string, newTo: string) {
    setFrom(newFrom)
    setTo(newTo)
  }

  // ── 품종 멀티셀렉트 (상태만 변경, fetch 없음) ────
  function toggleVariety(name: string) {
    setSelectedVarieties(prev =>
      prev.includes(name) ? prev.filter(v => v !== name) : [...prev, name]
    )
  }

  // ── 도정구분 멀티셀렉트 (상태만 변경, fetch 없음) ─
  function toggleMillingType(type: string) {
    setSelectedMillingTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  // ── 칩 제거 → 즉시 fetch ──────────────────────────
  function removeVarietyChip(name: string) {
    const next = selectedVarieties.filter(v => v !== name)
    setSelectedVarieties(next)
    fetch({ varieties: next })
  }

  function removeMillingTypeChip(type: string) {
    const next = selectedMillingTypes.filter(t => t !== type)
    setSelectedMillingTypes(next)
    fetch({ millingTypes: next })
  }

  function removeFarmerChip(name: string) {
    const next = appliedFarmers.filter(n => n !== name)
    setAppliedFarmers(next)
    fetch({ farmers: next })
  }

  // ── 기간 레이블 ───────────────────────────────────
  function getPeriodLabel(): string {
    if (quickPeriod === 'cropYear') return `${cropYear}년산`
    if (quickPeriod === 'custom') return `${from} ~ ${to}`
    return QUICK_PERIODS.find(p => p.key === quickPeriod)?.label ?? quickPeriod
  }

  // ── 연산 년도 목록 ────────────────────────────────
  const cropYearOptions = [
    currentCropYear - 1,
    currentCropYear,
    currentCropYear + 1,
  ].filter(y => y >= 2020)

  // ── 렌더 ─────────────────────────────────────────
  return (
    <div className="w-full flex flex-col gap-4">

      {/* ── 상단 탭 + 필터 바 ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">

        {/* 메인 탭 */}
        <div className="flex border-b border-slate-100 rounded-t-2xl overflow-hidden">
          {MAIN_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setMainTab(tab.key)}
              className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                mainTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
          {isPending && (
            <div className="ml-auto flex items-center pr-4">
              <RefreshCw className="w-3.5 h-3.5 text-slate-300 animate-spin" />
            </div>
          )}
        </div>

        {/* 기간별 탭 서브 필터 */}
        {mainTab === 'period' && (
          <>
            {/* 검색 조건 행 */}
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
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-20 min-w-[140px]">
                    {varietyOptions.map(v => (
                      <button
                        key={v}
                        onClick={() => toggleVariety(v)}
                        className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 ${
                          selectedVarieties.includes(v) ? 'text-blue-600 font-semibold' : 'text-slate-600'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                          selectedVarieties.includes(v) ? 'bg-blue-500 border-blue-500' : 'border-slate-300'
                        }`}>
                          {selectedVarieties.includes(v) && <span className="text-white text-[8px]">✓</span>}
                        </span>
                        {v}
                      </button>
                    ))}
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

            {/* 적용된 검색 조건 칩 행 */}
            <div className="px-4 py-2 border-t border-slate-50 flex flex-wrap items-center gap-1.5 min-h-[2.5rem]">

              {/* 기간 (항상 표시, X 없음) */}
              <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                기간: {getPeriodLabel()}
              </span>

              {/* 품종 칩 */}
              {selectedVarieties.map(v => (
                <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                  품종: {v}
                  <button onClick={() => removeVarietyChip(v)} className="ml-0.5 text-blue-400 hover:text-blue-700 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {/* 도정구분 칩 */}
              {selectedMillingTypes.map(t => (
                <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                  도정: {t}
                  <button onClick={() => removeMillingTypeChip(t)} className="ml-0.5 text-purple-400 hover:text-purple-700 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {/* 생산자 칩 */}
              {appliedFarmers.map(name => (
                <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                  생산자: {name}
                  <button onClick={() => removeFarmerChip(name)} className="ml-0.5 text-emerald-400 hover:text-emerald-700 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── 차트 + 요약 카드 ── */}
      <div className="flex gap-4 items-stretch">
        <div className="flex-1 min-w-0">
          <MillingChart
            data={data.chartData}
            groupBy={data.groupBy}
          />
        </div>
        <div className="w-48 shrink-0">
          <SummaryCards summary={data.summary} />
        </div>
      </div>

      {/* ── 테이블 ── */}
      <MillingTable data={data.tableData} />
    </div>
  )
}
