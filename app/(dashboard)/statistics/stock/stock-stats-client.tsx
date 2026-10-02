'use client'

import { useState, useMemo } from 'react'
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
  toStockRows,
} from './_parts/utils'
import { StockSummaryCards } from './_parts/stock-summary-cards'
import { ChartLegend } from './_parts/stock-tables'
import { StockBreakdown } from './_parts/stock-breakdown'
import { StockFilterSheet } from './_parts/stock-filter-sheet'
import { StatsExcelButton } from '@/components/statistics/StatsExcelButton'
import { FILTER_ACTIVE, FILTER_CHIP, FILTER_CHIP_BUTTON, FILTER_CHIP_KEY } from '@/components/statistics/filter-chip'
import { useSafeTransition } from '@/app/(dashboard)/use-safe-transition'

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
  const [isPending, startTransition]                = useSafeTransition('통계를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.')

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

  // short = 모바일 라벨 — 「별」을 떼야 탭이 360 폭에 여유 있게 들어간다(백로그 §97 · 판매분석과 같은 규칙)
  const TABS: { key: StockTab; label: string; short: string }[] = [
    { key: 'variety', label: '품종별',   short: '품종' },
    { key: 'group',   label: '작목반별', short: '작목반' },
    { key: 'farmer',  label: '생산자별', short: '생산자' },
  ]

  // barSize=14 기준 아이템당 높이 (barCategoryGap=30% → band ≈ 20px gap + 14px bar = 34px)
  const ITEM_H = 34
  // 스크롤 영역 최대 높이: 10개 분량
  const CHART_SCROLL_MAX_H = 10 * ITEM_H

  // 표·모바일 목록 줄 — 세 탭을 한 모양으로(작업지시 ⑫ A-1)
  const stockRows = useMemo(() => toStockRows(activeTab, data), [activeTab, data])

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
              className={`px-3 md:px-5 py-3 text-[13px] md:text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="md:hidden">{tab.short}</span>
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1 pr-2">
            {isPending && <RefreshCw className="w-3.5 h-3.5 text-slate-300 animate-spin" />}
            <StatsExcelButton
              getRows={() => {
                if (activeTab === 'farmer') {
                  return data.byFarmer.map(r => ({
                    '생산자': r.farmerName,
                    '작목반': r.groupName,
                    '총 입고량(kg)': r.totalKg,
                    '도정 소진(kg)': r.consumedKg,
                    '출고(kg)': r.releasedKg,
                    '보관 중(kg)': r.availableKg,
                    '재고율(%)': r.stockRate,
                  }))
                }
                if (activeTab === 'group') {
                  return data.byGroup.map(r => ({
                    '작목반': r.groupName,
                    '인증구분': r.certType,
                    '생산자수': r.farmerCount,
                    '총 입고량(kg)': r.totalKg,
                    '도정 소진(kg)': r.consumedKg,
                    '출고(kg)': r.releasedKg,
                    '보관 중(kg)': r.availableKg,
                    '재고율(%)': r.stockRate,
                  }))
                }
                return data.byVariety.map(r => ({
                  '품종': r.varietyName,
                  '총 입고량(kg)': r.totalKg,
                  '도정 소진(kg)': r.consumedKg,
                  '출고(kg)': r.releasedKg,
                  '보관 중(kg)': r.availableKg,
                  '재고율(%)': r.stockRate,
                }))
              }}
              sheetName={
                activeTab === 'farmer' ? '생산자별'
                  : activeTab === 'group' ? '작목반별'
                  : '품종별'
              }
              fileNamePrefix={`재고분석_${year}_${activeTab}`}
            />
            <button
              onClick={() => setShowFilter(true)}
              className={`md:hidden flex items-center gap-1.5 h-8 px-2 rounded-lg border text-xs font-semibold transition-colors ${
                activeFilterCount > 0
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {activeFilterCount > 0 && (
                <span className="h-5 px-1.5 bg-primary/20 text-primary ml-0.5 rounded-full text-[10px] flex items-center">
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
              activeClass={FILTER_ACTIVE}
              emptyLabel="(전체)"
              minWidth={140}
            />

            {/* 작목반 멀티셀렉트 */}
            <MultiSelectDropdown
              options={groupDropdownOptions}
              selected={selectedGroupIds}
              onToggle={handleGroupToggle}
              placeholder="작목반"
              activeClass={FILTER_ACTIVE}
              emptyLabel="(전체)"
              minWidth={140}
            />

            {/* 품종 멀티셀렉트 */}
            <MultiSelectDropdown
              options={varietyDropdownOptions}
              selected={selectedVarietyIds}
              onToggle={handleVarietyToggle}
              placeholder="품종"
              activeClass={FILTER_ACTIVE}
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
                farmerNameInput.trim() ? 'bg-blue-50 text-blue-700 placeholder:text-blue-300' : 'bg-slate-100 text-slate-700 placeholder:text-slate-400'
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
                  className={FILTER_CHIP_BUTTON}
                >
                  <span className={FILTER_CHIP_KEY}>인증</span>
                  {c}
                  <X className="w-3 h-3" />
                </button>
              ))}
              {selectedGroupIds.map(id => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleGroupToggle(id)}
                  className={FILTER_CHIP_BUTTON}
                >
                  <span className={FILTER_CHIP_KEY}>작목반</span>
                  {groupOptions.find(g => g.id === id)?.name ?? '작목반'}
                  <X className="w-3 h-3" />
                </button>
              ))}
              {selectedVarietyIds.map(id => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleVarietyToggle(id)}
                  className={FILTER_CHIP_BUTTON}
                >
                  <span className={FILTER_CHIP_KEY}>품종</span>
                  {varietyOptions.find(v => v.id === id)?.name ?? '품종'}
                  <X className="w-3 h-3" />
                </button>
              ))}
              {farmerNameInput.trim() && (
                <button
                  type="button"
                  onClick={() => setFarmerNameInput('')}
                  className={FILTER_CHIP_BUTTON}
                >
                  <span className={FILTER_CHIP_KEY}>생산자</span>
                  {farmerNameInput.trim()}
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
            <span key={c} className={FILTER_CHIP}>
              <span className={FILTER_CHIP_KEY}>인증</span>
              {c}
              <button onClick={() => removeChipCertType(c)}><X className="w-3 h-3" /></button>
            </span>
          ))}
          {selectedGroupIds.map(id => (
            <span key={id} className={FILTER_CHIP}>
              <span className={FILTER_CHIP_KEY}>작목반</span>
              {groupOptions.find(g => g.id === id)?.name ?? '작목반'}
              <button onClick={() => removeChipGroup(id)}><X className="w-3 h-3" /></button>
            </span>
          ))}
          {selectedVarietyIds.map(id => (
            <span key={id} className={FILTER_CHIP}>
              <span className={FILTER_CHIP_KEY}>품종</span>
              {varietyOptions.find(v => v.id === id)?.name ?? '품종'}
              <button onClick={() => removeChipVariety(id)}><X className="w-3 h-3" /></button>
            </span>
          ))}
          {farmerNameInput.trim() && (
            <span className={FILTER_CHIP}>
              <span className={FILTER_CHIP_KEY}>생산자</span>
              {farmerNameInput.trim()}
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
        <StockSummaryCards summary={data.summary} empty={data.summary.totalKg === 0} />
      </div>

      {/* ── 테이블 — 비면 숨긴다(「없다」는 차트 자리 한 곳에서만, 백로그 §97) ── */}
      {stockRows.length > 0 && <StockBreakdown key={activeTab} tab={activeTab} rows={stockRows} />}

    </div>
  )
}
