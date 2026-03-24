'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { Calendar, RefreshCw, ChevronDown } from 'lucide-react'
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
  { key: 'custom',   label: '' },   // 아이콘 버튼
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
    cropYear?: number; quick?: QuickPeriod
  }) {
    const resolvedFrom    = overrides?.from          ?? from
    const resolvedTo      = overrides?.to            ?? to
    const resolvedVars    = overrides?.varieties     ?? selectedVarieties
    const resolvedTypes   = overrides?.millingTypes  ?? selectedMillingTypes
    const resolvedCropYear= overrides?.cropYear      ?? (overrides?.quick === 'cropYear' ? cropYear : undefined)
    const resolvedGroupBy = overrides?.groupBy       ?? resolveGroupBy(new Date(resolvedFrom), new Date(resolvedTo))

    startTransition(async () => {
      const result = await getMillingStatistics({
        from: new Date(resolvedFrom),
        to: new Date(resolvedTo),
        groupBy: resolvedGroupBy,
        varieties: resolvedVars.length ? resolvedVars : undefined,
        millingTypes: resolvedTypes.length ? resolvedTypes : undefined,
        cropYear: resolvedCropYear,
      })
      setData(result)
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
    const newFrom = format(r.from, 'yyyy-MM-dd')
    const newTo   = format(r.to,   'yyyy-MM-dd')
    setQuickPeriod(key)
    setFrom(newFrom)
    setTo(newTo)
    setShowCustomDate(false)
    fetch({ from: newFrom, to: newTo, groupBy: r.groupBy, quick: key,
      cropYear: key === 'cropYear' ? cropYear : undefined })
  }

  // ── 연산 변경 ─────────────────────────────────────
  function handleCropYear(year: number) {
    setCropYear(year)
    if (quickPeriod === 'cropYear') {
      const r = resolveQuickPeriod('cropYear', year)
      const newFrom = format(r.from, 'yyyy-MM-dd')
      const newTo   = format(r.to,   'yyyy-MM-dd')
      setFrom(newFrom); setTo(newTo)
      fetch({ from: newFrom, to: newTo, groupBy: r.groupBy, cropYear: year })
    }
  }

  // ── 날짜 직접 입력 ────────────────────────────────
  function handleCustomDate(newFrom: string, newTo: string) {
    setFrom(newFrom); setTo(newTo)
    const groupBy = resolveGroupBy(new Date(newFrom), new Date(newTo))
    fetch({ from: newFrom, to: newTo, groupBy })
  }

  // ── 품종 멀티셀렉트 ──────────────────────────────
  function toggleVariety(name: string) {
    const next = selectedVarieties.includes(name)
      ? selectedVarieties.filter(v => v !== name)
      : [...selectedVarieties, name]
    setSelectedVarieties(next)
    fetch({ varieties: next })
  }

  // ── 도정구분 멀티셀렉트 ──────────────────────────
  function toggleMillingType(type: string) {
    const next = selectedMillingTypes.includes(type)
      ? selectedMillingTypes.filter(t => t !== type)
      : [...selectedMillingTypes, type]
    setSelectedMillingTypes(next)
    fetch({ millingTypes: next })
  }

  // ── 연산 년도 목록 (현재 연도 기준 ±2) ───────────
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

            {/* 연산 년도 선택 (연산 칩 선택 시 노출) */}
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

            {/* 날짜 직접 입력 인라인 */}
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
                품종 {selectedVarieties.length > 0 && <span className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">{selectedVarieties.length}</span>}
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
                      onClick={() => { setSelectedVarieties([]); fetch({ varieties: [] }) }}
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
                도정구분 {selectedMillingTypes.length > 0 && <span className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">{selectedMillingTypes.length}</span>}
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
                      onClick={() => { setSelectedMillingTypes([]); fetch({ millingTypes: [] }) }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-400 hover:bg-slate-50 border-t border-slate-50 mt-1"
                    >
                      전체 해제
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
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
