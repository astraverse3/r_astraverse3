'use client'

import { useState, useTransition, useMemo } from 'react'
import { ChevronDown, RotateCcw, Search, X, SlidersHorizontal, RefreshCw } from 'lucide-react'
import { StockChart } from '@/components/statistics/StockChart'
import { MultiSelectDropdown, type MultiSelectOption } from '@/components/statistics/MultiSelectDropdown'
import {
  getStockStatistics,
  getStockGroupOptions,
  getStockVarietyOptions,
} from '@/app/actions/stock-statistics'
import type {
  StockStatisticsData,
  GroupOption,
  VarietyOption,
} from '@/app/actions/stock-statistics'
import {
  type StockTab,
  CERT_TYPE_OPTIONS,
  MAX_CHART_ITEMS,
  toChartItems,
} from './_parts/utils'
import { StockSummaryCards } from './_parts/stock-summary-cards'
import { ChartLegend, FarmerTable, GroupTable, VarietyTable } from './_parts/stock-tables'
import { StockFilterSheet } from './_parts/stock-filter-sheet'

type Props = {
  initialData: StockStatisticsData
  productionYears: number[]
  groupOptions: GroupOption[]
  varietyOptions: VarietyOption[]
  initYear: number
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────

export function StockStatsClient({
  initialData,
  productionYears,
  groupOptions: initGroupOptions,
  varietyOptions: initVarietyOptions,
  initYear,
}: Props) {
  const [data, setData]                             = useState(initialData)
  const [year, setYear]                             = useState(initYear)
  const [selectedCertTypes, setSelectedCertTypes]   = useState<string[]>([])
  const [selectedGroupIds, setSelectedGroupIds]     = useState<number[]>([])
  const [groupOptions, setGroupOptions]             = useState(initGroupOptions)
  const [varietyOptions, setVarietyOptions]         = useState(initVarietyOptions)
  const [selectedVarietyIds, setSelectedVarietyIds] = useState<number[]>([])
  const [farmerNameInput, setFarmerNameInput]       = useState('')
  const [activeTab, setActiveTab]                   = useState<StockTab>('variety')
  const [showFilter, setShowFilter]                 = useState(false)
  const [isPending, startTransition]                = useTransition()

  // ── 드롭다운 옵션 변환 (MultiSelectDropdown 형식) ─────────────────────
  const certDropdownOptions = useMemo<MultiSelectOption<string>[]>(
    () => CERT_TYPE_OPTIONS.map(c => ({ id: c, label: c })),
    [],
  )
  const groupDropdownOptions = useMemo<MultiSelectOption<number>[]>(
    () => groupOptions.map(g => ({ id: g.id, label: g.name })),
    [groupOptions],
  )
  const varietyDropdownOptions = useMemo<MultiSelectOption<number>[]>(
    () => varietyOptions.map(v => ({ id: v.id, label: v.name })),
    [varietyOptions],
  )

  // 연산 변경 시 옵션만 새로 로드 (데이터 조회는 검색 버튼으로)
  function handleYearChange(newYear: number) {
    setYear(newYear)
    setSelectedCertTypes([])
    setSelectedGroupIds([])
    setSelectedVarietyIds([])
    startTransition(async () => {
      const [newGroups, newVarieties] = await Promise.all([
        getStockGroupOptions(newYear),
        getStockVarietyOptions(newYear),
      ])
      setGroupOptions(newGroups)
      setVarietyOptions(newVarieties)
    })
  }

  // 인증구분 토글 시 작목반 리셋 + 옵션 갱신
  function handleCertTypeToggle(certType: string) {
    const newCertTypes = selectedCertTypes.includes(certType)
      ? selectedCertTypes.filter(c => c !== certType)
      : [...selectedCertTypes, certType]
    setSelectedCertTypes(newCertTypes)
    setSelectedGroupIds([])
    setSelectedVarietyIds([])
    startTransition(async () => {
      const [newGroups, newVarieties] = await Promise.all([
        getStockGroupOptions(year, newCertTypes.length ? newCertTypes : undefined),
        getStockVarietyOptions(year, undefined, newCertTypes.length ? newCertTypes : undefined),
      ])
      setGroupOptions(newGroups)
      setVarietyOptions(newVarieties)
    })
  }

  // 작목반 토글 시 품종 옵션 갱신
  function handleGroupToggle(groupId: number) {
    const newGroupIds = selectedGroupIds.includes(groupId)
      ? selectedGroupIds.filter(g => g !== groupId)
      : [...selectedGroupIds, groupId]
    setSelectedGroupIds(newGroupIds)
    setSelectedVarietyIds([])
    startTransition(async () => {
      const newVarieties = await getStockVarietyOptions(
        year,
        newGroupIds.length ? newGroupIds : undefined,
        selectedCertTypes.length ? selectedCertTypes : undefined,
      )
      setVarietyOptions(newVarieties)
    })
  }

  function handleVarietyToggle(id: number) {
    setSelectedVarietyIds(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    )
  }

  // 칩 삭제 핸들러 (옵션 갱신 + 즉시 fetch)
  function removeChipCertType(certType: string) {
    const newCertTypes = selectedCertTypes.filter(c => c !== certType)
    setSelectedCertTypes(newCertTypes)
    setSelectedGroupIds([])
    setSelectedVarietyIds([])
    startTransition(async () => {
      const [newData, newGroups, newVarieties] = await Promise.all([
        getStockStatistics({
          productionYear: year,
          certTypes: newCertTypes.length ? newCertTypes : undefined,
        }),
        getStockGroupOptions(year, newCertTypes.length ? newCertTypes : undefined),
        getStockVarietyOptions(year, undefined, newCertTypes.length ? newCertTypes : undefined),
      ])
      setData(newData)
      setGroupOptions(newGroups)
      setVarietyOptions(newVarieties)
    })
  }

  function removeChipGroup(groupId: number) {
    const newGroupIds = selectedGroupIds.filter(g => g !== groupId)
    setSelectedGroupIds(newGroupIds)
    setSelectedVarietyIds([])
    startTransition(async () => {
      const [newData, newVarieties] = await Promise.all([
        getStockStatistics({
          productionYear: year,
          certTypes: selectedCertTypes.length ? selectedCertTypes : undefined,
          groupIds: newGroupIds.length ? newGroupIds : undefined,
        }),
        getStockVarietyOptions(
          year,
          newGroupIds.length ? newGroupIds : undefined,
          selectedCertTypes.length ? selectedCertTypes : undefined,
        ),
      ])
      setData(newData)
      setVarietyOptions(newVarieties)
    })
  }

  function removeChipVariety(id: number) {
    const newIds = selectedVarietyIds.filter(v => v !== id)
    setSelectedVarietyIds(newIds)
    startTransition(async () => {
      const newData = await getStockStatistics({
        productionYear: year,
        certTypes: selectedCertTypes.length ? selectedCertTypes : undefined,
        groupIds: selectedGroupIds.length ? selectedGroupIds : undefined,
        varietyIds: newIds.length ? newIds : undefined,
        farmerNames: parseFarmerNames().length ? parseFarmerNames() : undefined,
      })
      setData(newData)
    })
  }

  function removeChipFarmer() {
    setFarmerNameInput('')
    startTransition(async () => {
      const newData = await getStockStatistics({
        productionYear: year,
        certTypes: selectedCertTypes.length ? selectedCertTypes : undefined,
        groupIds: selectedGroupIds.length ? selectedGroupIds : undefined,
        varietyIds: selectedVarietyIds.length ? selectedVarietyIds : undefined,
      })
      setData(newData)
    })
  }

  function parseFarmerNames() {
    return farmerNameInput.split(',').map(s => s.trim()).filter(Boolean)
  }

  function handleSearch() {
    const farmerNames = parseFarmerNames()
    startTransition(async () => {
      const newData = await getStockStatistics({
        productionYear: year,
        certTypes: selectedCertTypes.length ? selectedCertTypes : undefined,
        groupIds: selectedGroupIds.length ? selectedGroupIds : undefined,
        varietyIds: selectedVarietyIds.length ? selectedVarietyIds : undefined,
        farmerNames: farmerNames.length ? farmerNames : undefined,
      })
      setData(newData)
    })
  }

  function handleReset() {
    const resetYear = productionYears[0] ?? initYear
    setYear(resetYear)
    setSelectedCertTypes([])
    setSelectedGroupIds([])
    setSelectedVarietyIds([])
    setFarmerNameInput('')
    startTransition(async () => {
      const [newData, newGroups, newVarieties] = await Promise.all([
        getStockStatistics({ productionYear: resetYear }),
        getStockGroupOptions(resetYear),
        getStockVarietyOptions(resetYear),
      ])
      setData(newData)
      setGroupOptions(newGroups)
      setVarietyOptions(newVarieties)
    })
  }

  // 탭 전환 시 필터 리셋 (연산은 유지, 필터가 비어있으면 fetch 스킵)
  function handleTabChange(newTab: StockTab) {
    setActiveTab(newTab)

    const hasFilters =
      selectedCertTypes.length > 0 ||
      selectedGroupIds.length > 0 ||
      selectedVarietyIds.length > 0 ||
      farmerNameInput.trim().length > 0

    if (!hasFilters) return

    setSelectedCertTypes([])
    setSelectedGroupIds([])
    setSelectedVarietyIds([])
    setFarmerNameInput('')
    startTransition(async () => {
      const [newData, newGroups, newVarieties] = await Promise.all([
        getStockStatistics({ productionYear: year }),
        getStockGroupOptions(year),
        getStockVarietyOptions(year),
      ])
      setData(newData)
      setGroupOptions(newGroups)
      setVarietyOptions(newVarieties)
    })
  }

  // 차트 데이터 변환 (data가 바뀔 때만 재계산)
  const farmerChartItems = useMemo(() => toChartItems(
    data.byFarmer.map(r => ({
      name: r.farmerName,
      consumed: r.consumedKg,
      available: r.availableKg,
      released: r.releasedKg,
      total: r.totalKg,
    })),
  ), [data.byFarmer])

  const groupChartItems = useMemo(() => toChartItems(
    data.byGroup.map(r => ({
      name: r.groupName,
      consumed: r.consumedKg,
      available: r.availableKg,
      released: r.totalKg - r.consumedKg - r.availableKg,
      total: r.totalKg,
    })),
  ), [data.byGroup])

  const varietyChartItems = useMemo(() => toChartItems(
    data.byVariety.map(r => ({
      name: r.varietyName,
      consumed: r.consumedKg,
      available: r.availableKg,
      released: r.totalKg - r.consumedKg - r.availableKg,
      total: r.totalKg,
    })),
  ), [data.byVariety])

  const TABS: { key: StockTab; label: string }[] = [
    { key: 'variety', label: '품종별' },
    { key: 'group',   label: '작목반별' },
    { key: 'farmer',  label: '생산자별' },
  ]

  // barSize=14 기준 아이템당 높이 (barCategoryGap=30% → band ≈ 20px gap + 14px bar = 34px)
  const ITEM_H = 34
  // 스크롤 영역 최대 높이: 10개 분량
  const CHART_SCROLL_MAX_H = 10 * ITEM_H

  const activeItems =
    activeTab === 'farmer'  ? farmerChartItems :
    activeTab === 'group'   ? groupChartItems  : varietyChartItems
  const chartContentHeight = Math.max(activeItems.length * ITEM_H, ITEM_H * 3)

  const hasActiveFilters =
    selectedCertTypes.length > 0 || selectedGroupIds.length > 0 || selectedVarietyIds.length > 0 || farmerNameInput.trim().length > 0

  const activeFilterCount = [
    year !== (productionYears[0] ?? initYear),
    selectedCertTypes.length > 0,
    selectedGroupIds.length > 0,
    selectedVarietyIds.length > 0,
    farmerNameInput.trim().length > 0,
  ].filter(Boolean).length

  return (
    <div className="w-full flex flex-col gap-2 px-1.5 sm:px-0 sm:gap-4">

      {/* ── 탭 + 필터 카드 ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">

        {/* 탭 바 */}
        <div className="flex border-b border-slate-100 rounded-t-2xl overflow-hidden">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1 pr-2">
            {isPending && <RefreshCw className="w-3.5 h-3.5 text-slate-300 animate-spin" />}
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
            {/* 연산 선택 */}
            <div className="relative">
              <select
                value={year}
                onChange={e => handleYearChange(Number(e.target.value))}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 border-0 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
              >
                {productionYears.map(y => (
                  <option key={y} value={y}>{y}년산</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>

            {/* 인증구분 멀티셀렉트 */}
            <MultiSelectDropdown
              options={certDropdownOptions}
              selected={selectedCertTypes}
              onToggle={handleCertTypeToggle}
              placeholder="인증구분"
              activeClass="bg-teal-50 text-teal-700"
              emptyLabel="(전체)"
              minWidth={140}
            />

            {/* 작목반 멀티셀렉트 */}
            <MultiSelectDropdown
              options={groupDropdownOptions}
              selected={selectedGroupIds}
              onToggle={handleGroupToggle}
              placeholder="작목반"
              activeClass="bg-blue-50 text-blue-600"
              emptyLabel="(전체)"
              minWidth={140}
            />

            {/* 품종 멀티셀렉트 */}
            <MultiSelectDropdown
              options={varietyDropdownOptions}
              selected={selectedVarietyIds}
              onToggle={handleVarietyToggle}
              placeholder="품종"
              activeClass="bg-green-50 text-green-700"
              emptyLabel="(전체)"
              minWidth={140}
            />

            {/* 생산자 텍스트 검색 */}
            <input
              type="text"
              value={farmerNameInput}
              onChange={e => setFarmerNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="생산자 (쉼표로 구분)"
              className={`pl-3 pr-3 py-1.5 text-xs font-semibold rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-200 w-44 ${
                farmerNameInput.trim() ? 'bg-purple-50 text-purple-700 placeholder:text-purple-300' : 'bg-slate-100 text-slate-700 placeholder:text-slate-400'
              }`}
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
              <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                {year}년산
              </span>
              {selectedCertTypes.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleCertTypeToggle(c)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-medium hover:bg-teal-100 transition-colors"
                >
                  {c}
                  <X className="w-3 h-3" />
                </button>
              ))}
              {selectedGroupIds.map(id => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleGroupToggle(id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium hover:bg-blue-100 transition-colors"
                >
                  {groupOptions.find(g => g.id === id)?.name ?? '작목반'}
                  <X className="w-3 h-3" />
                </button>
              ))}
              {selectedVarietyIds.map(id => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleVarietyToggle(id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium hover:bg-green-100 transition-colors"
                >
                  {varietyOptions.find(v => v.id === id)?.name ?? '품종'}
                  <X className="w-3 h-3" />
                </button>
              ))}
              {farmerNameInput.trim() && (
                <button
                  type="button"
                  onClick={() => setFarmerNameInput('')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium hover:bg-purple-100 transition-colors"
                >
                  생산자: {farmerNameInput.trim()}
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* 모바일: 항상 표시 칩 */}
        <div className="md:hidden px-4 py-2 flex flex-wrap gap-1.5 min-h-[2.5rem]">
          <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
            {year}년산
          </span>
          {selectedCertTypes.map(c => (
            <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-medium">
              {c}
              <button onClick={() => removeChipCertType(c)}><X className="w-3 h-3" /></button>
            </span>
          ))}
          {selectedGroupIds.map(id => (
            <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
              {groupOptions.find(g => g.id === id)?.name ?? '작목반'}
              <button onClick={() => removeChipGroup(id)}><X className="w-3 h-3" /></button>
            </span>
          ))}
          {selectedVarietyIds.map(id => (
            <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
              {varietyOptions.find(v => v.id === id)?.name ?? '품종'}
              <button onClick={() => removeChipVariety(id)}><X className="w-3 h-3" /></button>
            </span>
          ))}
          {farmerNameInput.trim() && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
              생산자: {farmerNameInput.trim()}
              <button onClick={() => removeChipFarmer()}><X className="w-3 h-3" /></button>
            </span>
          )}
        </div>
      </div>

      {/* ── 필터 팝업 (모바일) ── */}
      <StockFilterSheet
        show={showFilter}
        onClose={() => setShowFilter(false)}
        productionYears={productionYears}
        year={year}
        onYearChange={handleYearChange}
        selectedCertTypes={selectedCertTypes}
        onCertTypeToggle={handleCertTypeToggle}
        groupOptions={groupOptions}
        selectedGroupIds={selectedGroupIds}
        onGroupToggle={handleGroupToggle}
        varietyOptions={varietyOptions}
        selectedVarietyIds={selectedVarietyIds}
        onVarietyToggle={handleVarietyToggle}
        farmerNameInput={farmerNameInput}
        onFarmerNameChange={setFarmerNameInput}
        onReset={() => { handleReset(); setShowFilter(false) }}
        onSearch={() => { handleSearch(); setShowFilter(false) }}
      />

      {/* ── 차트 + 서머리 카드 (PC: 가로, 모바일: 세로) ── */}
      <div className="flex flex-col md:flex-row gap-2 md:gap-3 md:items-stretch">

        {/* 차트 (최대 10개 스크롤 영역) */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {activeTab === 'farmer'  && `생산자별 상위 ${Math.min(farmerChartItems.length, MAX_CHART_ITEMS)}개`}
              {activeTab === 'group'   && '작목반별 현황'}
              {activeTab === 'variety' && '품종별 현황'}
            </p>
            <ChartLegend />
          </div>
          <div
            className="overflow-y-auto px-4 pb-3"
            style={{ maxHeight: CHART_SCROLL_MAX_H }}
          >
            <div style={{ height: chartContentHeight }}>
              {activeTab === 'farmer'  && <StockChart data={farmerChartItems}  height={chartContentHeight} />}
              {activeTab === 'group'   && <StockChart data={groupChartItems}   height={chartContentHeight} truncateLabels />}
              {activeTab === 'variety' && <StockChart data={varietyChartItems} height={chartContentHeight} />}
            </div>
          </div>
        </div>

        {/* 서머리 카드 (모바일: 2x2, PC: 수직 1열) */}
        <StockSummaryCards summary={data.summary} />
      </div>

      {/* ── 테이블 ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-2">
        {activeTab === 'farmer'  && <FarmerTable  rows={data.byFarmer}  />}
        {activeTab === 'group'   && <GroupTable   rows={data.byGroup}   />}
        {activeTab === 'variety' && <VarietyTable rows={data.byVariety} />}
      </div>

    </div>
  )
}
