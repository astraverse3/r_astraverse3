'use client'

import { X, Search } from 'lucide-react'
import type { GroupOption, VarietyOption } from '@/app/actions/stock-statistics'
import { CERT_TYPE_OPTIONS } from './utils'

type Props = {
  show: boolean
  onClose: () => void

  productionYears: number[]
  year: number
  onYearChange: (y: number) => void

  selectedCertTypes: string[]
  onCertTypeToggle: (c: string) => void

  groupOptions: GroupOption[]
  selectedGroupIds: number[]
  onGroupToggle: (id: number) => void

  varietyOptions: VarietyOption[]
  selectedVarietyIds: number[]
  onVarietyToggle: (id: number) => void

  farmerNameInput: string
  onFarmerNameChange: (v: string) => void

  onReset: () => void
  onSearch: () => void
}

export function StockFilterSheet({
  show,
  onClose,
  productionYears,
  year,
  onYearChange,
  selectedCertTypes,
  onCertTypeToggle,
  groupOptions,
  selectedGroupIds,
  onGroupToggle,
  varietyOptions,
  selectedVarietyIds,
  onVarietyToggle,
  farmerNameInput,
  onFarmerNameChange,
  onReset,
  onSearch,
}: Props) {
  if (!show) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+8px)] left-3 right-3 z-50 bg-white rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-52px-3.5rem-env(safe-area-inset-bottom)-16px)] overflow-hidden sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-y-1/2 sm:-translate-x-1/2 sm:w-[480px] sm:max-h-[80dvh]">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <h3 className="text-sm font-bold text-slate-800">검색 조건</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2.5 flex flex-col gap-3">

          {/* 연산 */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">연산</p>
            <div className="flex flex-wrap gap-1.5">
              {productionYears.map(y => (
                <button
                  key={y}
                  onClick={() => onYearChange(y)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    year === y ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {y}년산
                </button>
              ))}
            </div>
          </div>

          {/* 인증구분 */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">인증구분</p>
            <div className="flex flex-wrap gap-1.5">
              {CERT_TYPE_OPTIONS.map(c => (
                <button
                  key={c}
                  onClick={() => onCertTypeToggle(c)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    selectedCertTypes.includes(c) ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* 작목반 */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              작목반
              {selectedGroupIds.length > 0 && (
                <span className="ml-1.5 font-normal normal-case text-blue-500">{selectedGroupIds.length}개 선택</span>
              )}
            </p>
            {groupOptions.length === 0 ? (
              <p className="text-xs text-slate-400">항목 없음</p>
            ) : (
              <div className="max-h-[90px] overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {groupOptions.map(g => (
                  <label
                    key={g.id}
                    className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroupIds.includes(g.id)}
                      onChange={() => onGroupToggle(g.id)}
                      className="w-3.5 h-3.5 rounded accent-blue-500 shrink-0"
                    />
                    <span className="text-xs text-slate-700">{g.name}</span>
                  </label>
                ))}
              </div>
            )}
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
              <div className="max-h-[90px] overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {varietyOptions.map(v => (
                  <label
                    key={v.id}
                    className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedVarietyIds.includes(v.id)}
                      onChange={() => onVarietyToggle(v.id)}
                      className="w-3.5 h-3.5 rounded accent-green-500 shrink-0"
                    />
                    <span className="text-xs text-slate-700">{v.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 생산자 */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">생산자</p>
            <input
              type="text"
              value={farmerNameInput}
              onChange={e => onFarmerNameChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onSearch() }}
              placeholder="생산자명 (쉼표로 구분)"
              className="w-full bg-slate-100 border-0 rounded-lg px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="px-4 py-3 border-t border-slate-100 flex justify-end gap-2 shrink-0">
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
