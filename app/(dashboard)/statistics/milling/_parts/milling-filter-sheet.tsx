'use client'

import { X, Search } from 'lucide-react'
import type { QuickPeriod } from '@/app/actions/statistics'
import {
  QUICK_PERIODS,
  MAX_VARIETY_SELECT,
  type MainTab,
} from './constants'

type Props = {
  show: boolean
  onClose: () => void

  mainTab: MainTab

  quickPeriod: QuickPeriod
  cropYear: number
  cropYearOptions: number[]
  from: string
  to: string
  onQuickPeriod: (key: QuickPeriod) => void
  onCropYear: (year: number) => void
  onCustomDateChange: (from: string, to: string) => void

  varietyOptions: string[]
  selectedVarieties: string[]
  onToggleVariety: (v: string) => void

  millingTypeOptions: string[]
  selectedMillingTypes: string[]
  onToggleMillingType: (t: string) => void

  farmerInput: string
  onFarmerInputChange: (v: string) => void

  onReset: () => void
  onSearch: () => void
}

export function MillingFilterSheet({
  show,
  onClose,
  mainTab,
  quickPeriod,
  cropYear,
  cropYearOptions,
  from,
  to,
  onQuickPeriod,
  onCropYear,
  onCustomDateChange,
  varietyOptions,
  selectedVarieties,
  onToggleVariety,
  millingTypeOptions,
  selectedMillingTypes,
  onToggleMillingType,
  farmerInput,
  onFarmerInputChange,
  onReset,
  onSearch,
}: Props) {
  if (!show) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+8px)] left-3 right-3 z-50 bg-white rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-52px-3.5rem-env(safe-area-inset-bottom)-16px)] overflow-hidden sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-y-1/2 sm:-translate-x-1/2 sm:w-[480px] sm:max-h-[80dvh]">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-sm font-bold text-slate-800">검색 조건</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 flex flex-col gap-4">

          {/* 기간 */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">기간</p>
            {/* 빠른기간 버튼 (custom 제외) */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {QUICK_PERIODS.filter(p => p.key !== 'custom').map(p => (
                <button
                  key={p.key}
                  onClick={() => onQuickPeriod(p.key)}
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
                    onClick={() => onCropYear(y)}
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
                  onChange={e => onCustomDateChange(e.target.value, to)}
                  className="bg-slate-100 border-0 rounded-lg px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400">종료일</span>
                <input
                  type="date"
                  value={to}
                  onChange={e => onCustomDateChange(from, e.target.value)}
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
                    onClick={() => !isDisabled && onToggleVariety(v)}
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
                  onClick={() => onToggleMillingType(t)}
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
              onChange={e => onFarmerInputChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onSearch() }}
              placeholder="생산자명 (쉼표로 구분)"
              className="w-full bg-slate-100 border-0 rounded-lg px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
          <button
            onClick={onReset}
            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors"
          >
            초기화
          </button>
          <button
            onClick={onSearch}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors"
          >
            <Search className="w-4 h-4" />
            검색
          </button>
        </div>
      </div>
    </>
  )
}
