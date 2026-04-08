'use client'

import { useState, useTransition, useMemo } from 'react'
import { ChevronDown, RotateCcw, Search, X, SlidersHorizontal, RefreshCw } from 'lucide-react'
import { StockChart } from '@/components/statistics/StockChart'
import type { StockChartItem } from '@/components/statistics/StockChart'
import {
  getStockStatistics,
  getStockGroupOptions,
  getStockVarietyOptions,
} from '@/app/actions/stock-statistics'

const CERT_TYPE_OPTIONS = ['유기농', '무농약', '일반'] as const
import type {
  StockStatisticsData,
  FarmerStockRow,
  GroupStockRow,
  VarietyStockRow,
  GroupOption,
  VarietyOption,
} from '@/app/actions/stock-statistics'

// ── 타입 ──────────────────────────────────────────────────────────────────

type StockTab = 'farmer' | 'group' | 'variety'

type Props = {
  initialData: StockStatisticsData
  productionYears: number[]
  groupOptions: GroupOption[]
  varietyOptions: VarietyOption[]
  initYear: number
}

// ── 유틸 ──────────────────────────────────────────────────────────────────

function formatKg(v: number) {
  return v.toLocaleString('ko-KR', { maximumFractionDigits: 1 })
}

const MAX_CHART_ITEMS = 20

function toChartItems(
  rows: { name: string; consumed: number; available: number; released: number; total: number }[],
): StockChartItem[] {
  // 기타 집계 없이 상위 MAX_CHART_ITEMS개만 표시 (기타가 너무 커서 왜곡되는 문제 방지)
  return rows.slice(0, MAX_CHART_ITEMS).map(r => ({
    name: r.name,
    consumed: r.consumed,
    available: r.available,
    released: r.released,
    total: r.total,
  }))
}

// ── 멀티셀렉트 드롭다운 ───────────────────────────────────────────────────

type MultiOption<T extends string | number> = { id: T; name: string }

function MultiSelectDropdown<T extends string | number>({
  options,
  selected,
  onToggle,
  placeholder,
  colorClass,
}: {
  options: MultiOption<T>[]
  selected: T[]
  onToggle: (id: T) => void
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

function StockSummaryCards({ summary }: { summary: StockStatisticsData['summary'] }) {
  const stockRate = summary.totalKg > 0
    ? Math.round((summary.availableKg / summary.totalKg) * 1000) / 10
    : 0

  const cards = [
    {
      label: '총 입고량',
      value: formatKg(summary.totalKg),
      unit: 'kg',
      accent: '#00a2e8',
      valueColor: '#00a2e8',
    },
    {
      label: '도정완료',
      value: formatKg(summary.consumedKg),
      unit: 'kg',
      accent: '#8dc540',
      valueColor: '#7db037',
    },
    {
      label: '미처리 재고',
      value: formatKg(summary.availableKg),
      unit: 'kg',
      accent: '#f89c1e',
      valueColor: '#cc7b0c',
    },
    {
      label: '재고율',
      value: stockRate.toFixed(1),
      unit: '%',
      accent: '#94a3b8',
      valueColor: '#475569',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 md:flex md:flex-col md:gap-3 md:w-48 md:shrink-0">
      {cards.map(card => (
        <div key={card.label} className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-100 overflow-hidden md:flex-1 md:min-h-0">
          {/* 공통: 상단 컬러 띠 */}
          <div className="h-[3px]" style={{ backgroundColor: card.accent }} />
          {/* 모바일: 컴팩트 가로 레이아웃 */}
          <div className="md:hidden px-3 py-2.5 flex items-center justify-between gap-1.5 min-w-0">
            <p className="text-xs font-medium text-slate-400 shrink-0">{card.label}</p>
            <div className="flex items-baseline gap-0.5 min-w-0">
              <span className="text-sm font-bold tabular-nums truncate" style={{ color: card.valueColor }}>
                {card.value}
              </span>
              <span className="text-xs font-medium text-slate-400 shrink-0">{card.unit}</span>
            </div>
          </div>
          {/* PC: 상하 레이아웃 */}
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

// ── 재고율 뱃지 ───────────────────────────────────────────────────────────

function StockRateBadge({ rate }: { rate: number }) {
  // 재고율이 낮을수록 좋음 (처리 완료)
  const color =
    rate <= 20 ? '#7db037' :
    rate <= 50 ? '#cc7b0c' :
    '#ef4444'
  return (
    <span className="text-xs font-semibold" style={{ color }}>
      {rate.toFixed(1)}%
    </span>
  )
}

// ── 인증 뱃지 ─────────────────────────────────────────────────────────────

function CertBadge({ certType }: { certType: string }) {
  const style =
    certType === '유기농' ? 'bg-green-100 text-green-700' :
    certType === '무농약' ? 'bg-blue-100 text-blue-700' :
    'bg-slate-100 text-slate-500'
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${style}`}>{certType}</span>
  )
}

// ── 테이블: 생산자별 ──────────────────────────────────────────────────────

function FarmerTable({ rows }: { rows: FarmerStockRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" style={{ minWidth: '560px' }}>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="text-left py-2.5 px-3 font-semibold text-slate-500 text-xs whitespace-nowrap">생산자명</th>
            <th className="text-left py-2.5 px-3 font-semibold text-slate-500 text-xs whitespace-nowrap">작목반</th>
            <th className="text-right py-2.5 px-3 font-semibold text-slate-500 text-xs whitespace-nowrap">총 입고 (kg)</th>
            <th className="text-right py-2.5 px-3 font-semibold text-slate-500 text-xs whitespace-nowrap">도정완료 (kg)</th>
            <th className="text-right py-2.5 px-3 font-semibold text-slate-500 text-xs whitespace-nowrap">직접출고 (kg)</th>
            <th className="text-right py-2.5 px-3 font-semibold text-slate-500 text-xs whitespace-nowrap">미처리 (kg)</th>
            <th className="text-right py-2.5 px-3 font-semibold text-slate-500 text-xs whitespace-nowrap">재고율</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.farmerId} className={`border-b border-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
              <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">{r.farmerName}</td>
              <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">{r.groupName}</td>
              <td className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">{formatKg(r.totalKg)}</td>
              <td className="py-2.5 px-3 text-right whitespace-nowrap" style={{ color: '#7db037' }}>{formatKg(r.consumedKg)}</td>
              <td className="py-2.5 px-3 text-right whitespace-nowrap" style={{ color: '#7c3aed' }}>{formatKg(r.releasedKg)}</td>
              <td className="py-2.5 px-3 text-right whitespace-nowrap" style={{ color: '#cc7b0c' }}>{formatKg(r.availableKg)}</td>
              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                <StockRateBadge rate={r.stockRate} />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="py-8 text-center text-slate-400 text-sm">데이터가 없습니다</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── 테이블: 작목반별 ──────────────────────────────────────────────────────

function GroupTable({ rows }: { rows: GroupStockRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" style={{ minWidth: '620px' }}>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="text-left py-2.5 px-3 font-semibold text-slate-500 text-xs whitespace-nowrap">작목반명</th>
            <th className="text-left py-2.5 px-3 font-semibold text-slate-500 text-xs whitespace-nowrap">인증</th>
            <th className="text-right py-2.5 px-3 font-semibold text-slate-500 text-xs whitespace-nowrap">생산자수</th>
            <th className="text-right py-2.5 px-3 font-semibold text-slate-500 text-xs whitespace-nowrap">총 입고 (kg)</th>
            <th className="text-right py-2.5 px-3 font-semibold text-slate-500 text-xs whitespace-nowrap">도정완료 (kg)</th>
            <th className="text-right py-2.5 px-3 font-semibold text-slate-500 text-xs whitespace-nowrap">직접출고 (kg)</th>
            <th className="text-right py-2.5 px-3 font-semibold text-slate-500 text-xs whitespace-nowrap">미처리 (kg)</th>
            <th className="text-right py-2.5 px-3 font-semibold text-slate-500 text-xs whitespace-nowrap">재고율</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.groupId} className={`border-b border-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
              <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">{r.groupName}</td>
              <td className="py-2.5 px-3 whitespace-nowrap">
                <CertBadge certType={r.certType} />
              </td>
              <td className="py-2.5 px-3 text-right text-slate-600 whitespace-nowrap">{r.farmerCount}명</td>
              <td className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">{formatKg(r.totalKg)}</td>
              <td className="py-2.5 px-3 text-right whitespace-nowrap" style={{ color: '#7db037' }}>{formatKg(r.consumedKg)}</td>
              <td className="py-2.5 px-3 text-right whitespace-nowrap" style={{ color: '#7c3aed' }}>{formatKg(r.releasedKg)}</td>
              <td className="py-2.5 px-3 text-right whitespace-nowrap" style={{ color: '#cc7b0c' }}>{formatKg(r.availableKg)}</td>
              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                <StockRateBadge rate={r.stockRate} />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="py-8 text-center text-slate-400 text-sm">데이터가 없습니다</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── 테이블: 품종별 ────────────────────────────────────────────────────────

function VarietyTable({ rows }: { rows: VarietyStockRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" style={{ minWidth: '480px' }}>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="text-left py-2.5 px-3 font-semibold text-slate-500 text-xs whitespace-nowrap">품종명</th>
            <th className="text-right py-2.5 px-3 font-semibold text-slate-500 text-xs whitespace-nowrap">총 입고 (kg)</th>
            <th className="text-right py-2.5 px-3 font-semibold text-slate-500 text-xs whitespace-nowrap">도정완료 (kg)</th>
            <th className="text-right py-2.5 px-3 font-semibold text-slate-500 text-xs whitespace-nowrap">직접출고 (kg)</th>
            <th className="text-right py-2.5 px-3 font-semibold text-slate-500 text-xs whitespace-nowrap">미처리 (kg)</th>
            <th className="text-right py-2.5 px-3 font-semibold text-slate-500 text-xs whitespace-nowrap">재고율</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.varietyId} className={`border-b border-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
              <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">{r.varietyName}</td>
              <td className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">{formatKg(r.totalKg)}</td>
              <td className="py-2.5 px-3 text-right whitespace-nowrap" style={{ color: '#7db037' }}>{formatKg(r.consumedKg)}</td>
              <td className="py-2.5 px-3 text-right whitespace-nowrap" style={{ color: '#7c3aed' }}>{formatKg(r.releasedKg)}</td>
              <td className="py-2.5 px-3 text-right whitespace-nowrap" style={{ color: '#cc7b0c' }}>{formatKg(r.availableKg)}</td>
              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                <StockRateBadge rate={r.stockRate} />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">데이터가 없습니다</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── 차트 범례 ─────────────────────────────────────────────────────────────

function ChartLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-slate-500">
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#8dc540' }} />
        도정완료
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#8b5cf6' }} />
        직접출고
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#f89c1e' }} />
        미처리
      </span>
    </div>
  )
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
              onClick={() => setActiveTab(tab.key)}
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
            <MultiSelectDropdown<string>
              options={CERT_TYPE_OPTIONS.map(c => ({ id: c, name: c }))}
              selected={selectedCertTypes}
              onToggle={handleCertTypeToggle}
              placeholder="인증구분"
              colorClass="bg-teal-50 text-teal-700"
            />

            {/* 작목반 멀티셀렉트 */}
            <MultiSelectDropdown<number>
              options={groupOptions}
              selected={selectedGroupIds}
              onToggle={handleGroupToggle}
              placeholder="작목반"
              colorClass="bg-blue-50 text-blue-600"
            />

            {/* 품종 멀티셀렉트 */}
            <MultiSelectDropdown
              options={varietyOptions}
              selected={selectedVarietyIds}
              onToggle={handleVarietyToggle}
              placeholder="품종"
              colorClass="bg-green-50 text-green-700"
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
      {showFilter && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowFilter(false)} />
          <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+8px)] left-3 right-3 z-50 bg-white rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-52px-3.5rem-env(safe-area-inset-bottom)-16px)] overflow-hidden sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-y-1/2 sm:-translate-x-1/2 sm:w-[480px] sm:max-h-[80dvh]">

            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
              <h3 className="text-sm font-bold text-slate-800">검색 조건</h3>
              <button onClick={() => setShowFilter(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
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
                      onClick={() => handleYearChange(y)}
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
                      onClick={() => handleCertTypeToggle(c)}
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
                          onChange={() => handleGroupToggle(g.id)}
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
                          onChange={() => handleVarietyToggle(v.id)}
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
                  onChange={e => setFarmerNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { handleSearch(); setShowFilter(false) } }}
                  placeholder="생산자명 (쉼표로 구분)"
                  className="w-full bg-slate-100 border-0 rounded-lg px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
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
