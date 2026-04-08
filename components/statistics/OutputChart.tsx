'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from 'recharts'
import type { ByPackageTypeRow, ByMonthRow, ByDestinationRow } from '@/app/actions/output-statistics'

export const PKG_LABEL: Record<string, string> = {
  '20kg':   '20kg',
  '10kg':   '10kg',
  '5kg':    '5kg',
  'Tonbag': '톤백',
}

// ── 색상 팔레트 — 스펙트럼 전체를 고르게 분포 ───────────────────────────
// 잔량은 고정 회색, 나머지는 순서대로 팔레트 할당

const PALETTE = [
  '#3b82f6', // blue-500
  '#06b6d4', // cyan-500
  '#14b8a6', // teal-500
  '#22c55e', // green-500
  '#eab308', // yellow-500
  '#f97316', // orange-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f43f5e', // rose-500
]

const RESERVED: Record<string, string> = {
  '잔량': '#94a3b8', // 회색 고정
}

// 팔레트 인덱스는 잔량 제외한 실제 순서로 계산
function pkgColor(type: string, paletteIndex: number): string {
  return RESERVED[type] ?? PALETTE[paletteIndex % PALETTE.length]
}

const DEFAULT_PKG_COLOR = '#94a3b8'
const PKG_COLORS: Record<string, string> = RESERVED

// ── 유틸 ──────────────────────────────────────────────────────────────────

function formatKg(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}t`
  return `${v.toLocaleString('ko-KR')}kg`
}

// ── 1. 규격별 도넛 + 우측 바 리스트 ─────────────────────────────────────

type PieTooltipProps = { active?: boolean; payload?: any[] }
function PieTooltip({ active, payload }: PieTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as ByPackageTypeRow
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs min-w-[140px]">
      <p className="font-semibold text-slate-700 mb-1.5">{PKG_LABEL[d.packageType] ?? d.packageType}</p>
      <div className="flex justify-between gap-4 py-0.5">
        <span className="text-slate-500">생산량</span>
        <span className="font-medium text-slate-700">{d.totalWeight.toLocaleString('ko-KR')} kg</span>
      </div>
      <div className="flex justify-between gap-4 py-0.5">
        <span className="text-slate-500">포장수</span>
        <span className="font-medium text-slate-700">{d.count.toLocaleString('ko-KR')} 개</span>
      </div>
      <div className="flex justify-between gap-4 py-0.5 border-t border-slate-100 mt-1 pt-1">
        <span className="text-slate-500">비율</span>
        <span className="font-semibold text-slate-700">{d.percentage.toFixed(1)}%</span>
      </div>
    </div>
  )
}

const DONUT_SIZE = 300

export function PackageTypePieChart({ data }: { data: ByPackageTypeRow[] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-sm text-slate-400 py-16">
        데이터가 없습니다
      </div>
    )
  }

  const totalKg    = data.reduce((s, d) => s + d.totalWeight, 0)
  const totalCount = data.reduce((s, d) => s + d.count, 0)

  // 비율 내림차순 정렬
  const sortedData = [...data].sort((a, b) => b.percentage - a.percentage)

  // 잔량 제외한 항목에만 팔레트 순서 부여
  let paletteIdx = 0
  const pieData = sortedData.map(d => {
    const isReserved = d.packageType in RESERVED
    const color = pkgColor(d.packageType, isReserved ? 0 : paletteIdx)
    if (!isReserved) paletteIdx++
    return {
      ...d,
      name: PKG_LABEL[d.packageType] ?? d.packageType,
      value: d.totalWeight,
      color,
    }
  })

  const centerLabel =
    totalKg >= 1000
      ? `${(totalKg / 1000).toFixed(1)}t`
      : `${totalKg.toLocaleString('ko-KR')}kg`

  return (
    /* 모바일: 세로(차트→리스트), PC: 가로(좌우 50%) */
    <div className="flex flex-col md:flex-row md:items-center py-1 px-2 gap-4 md:gap-0">

      {/* ── 도넛 ── */}
      <div className="w-full md:w-1/2 flex justify-center">
        <div className="relative w-[220px] h-[220px] md:w-[300px] md:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius="52%"
                outerRadius="82%"
                paddingAngle={2}
                dataKey="value"
                isAnimationActive={false}
                startAngle={90}
                endAngle={-270}
              >
                {pieData.map(entry => (
                  <Cell key={entry.packageType} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* 도넛 중앙 텍스트 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            <span className="text-2xl font-bold text-slate-800 tabular-nums leading-tight">{centerLabel}</span>
            <span className="text-[10px] text-slate-400 font-medium mt-0.5">총 생산량</span>
            <span className="text-[11px] text-slate-500 font-medium">{totalCount.toLocaleString()}개</span>
          </div>
        </div>
      </div>

      {/* ── 리스트: 모바일 2열 그리드, PC 1열 ── */}
      <div className="w-full md:w-1/2 grid grid-cols-2 md:flex md:flex-col gap-x-3 gap-y-[10px] px-3 pb-3 md:px-0 md:pb-0">
        {pieData.map(d => {
          const label = d.name
          const color = d.color
          return (
            <div key={d.packageType} className="flex items-center gap-1.5 md:gap-2 min-w-0">
              {/* 규격명 */}
              <span className="text-xs font-bold w-8 md:w-10 text-right shrink-0" style={{ color }}>{label}</span>
              {/* 바 */}
              <div className="flex-1 md:w-14 md:flex-none h-[5px] md:h-[6px] bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${d.percentage}%`, backgroundColor: color }}
                />
              </div>
              {/* % */}
              <span
                className="text-xs font-bold tabular-nums w-7 text-right shrink-0"
                style={{ color }}
              >
                {d.percentage.toFixed(0)}%
              </span>
              {/* 중량 (PC만) */}
              <span className="hidden md:inline text-xs font-semibold text-slate-600 tabular-nums w-14 text-right shrink-0">
                {formatKg(d.totalWeight)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 2. 월별 비교 바차트 (세로) ────────────────────────────────────────────

type BarTooltipProps = { active?: boolean; payload?: any[]; label?: string }
function MonthlyTooltip({ active, payload, label }: BarTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs min-w-[160px]">
      <p className="font-semibold text-slate-700 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.fill }} />
            {p.name}
          </span>
          <span className="font-medium text-slate-700">{p.value.toLocaleString('ko-KR')} kg</span>
        </div>
      ))}
    </div>
  )
}

export function MonthlyBarChart({ data, height = 320 }: { data: ByMonthRow[]; height?: number }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>
        데이터가 없습니다
      </div>
    )
  }

  const chartData = data.map(d => ({
    ...d,
    month: d.month.slice(0, 7),  // 'YYYY-MM' 형식 그대로
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
        barSize={18}
        barCategoryGap="35%"
      >
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatKg}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
        <Tooltip content={<MonthlyTooltip />} cursor={{ fill: '#f1f5f9' }} />
        <Bar dataKey="productionKg" name="생산량" fill="#00a2e8" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="releaseKg"    name="출고량" fill="#8dc540" radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── 3. 출고처별 가로 바차트 ───────────────────────────────────────────────

function DestTooltip({ active, payload, label }: BarTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs min-w-[160px]">
      <p className="font-semibold text-slate-700 mb-1.5 truncate max-w-[200px]">{label}</p>
      <div className="flex items-center justify-between gap-4 py-0.5">
        <span className="flex items-center gap-1.5 text-slate-500">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
          출고량
        </span>
        <span className="font-medium text-slate-700">{d.value.toLocaleString('ko-KR')} kg</span>
      </div>
    </div>
  )
}

const BAR_SIZE = 14
const ITEM_H = 34

export function DestinationBarChart({ data, height }: { data: ByDestinationRow[]; height?: number }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-sm text-slate-400" style={{ height: height ?? 200 }}>
        데이터가 없습니다
      </div>
    )
  }

  const chartData = data.map(d => ({ name: d.destination, value: d.releaseKg }))
  const yAxisWidth = Math.min(Math.max(Math.max(...data.map(d => d.destination.length)) * 10, 60), 150)
  const contentHeight = height ?? Math.max(data.length * ITEM_H, ITEM_H * 3)

  return (
    <ResponsiveContainer width="100%" height={contentHeight}>
      <BarChart
        layout="vertical"
        data={chartData}
        margin={{ top: 4, right: 56, left: 0, bottom: 4 }}
        barSize={BAR_SIZE}
        barCategoryGap="30%"
      >
        <XAxis
          type="number"
          tickFormatter={formatKg}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={yAxisWidth}
          tick={{ fontSize: 11, fill: '#334155' }}
          axisLine={false}
          tickLine={false}
        />
        <CartesianGrid horizontal={false} stroke="#cbd5e1" strokeDasharray="3 3" />
        <Tooltip content={<DestTooltip />} cursor={{ fill: '#f1f5f9' }} />
        <Bar dataKey="value" name="출고량" fill="#8dc540" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? formatKg(v) : '')}
            style={{ fontSize: 11, fill: '#64748b' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export { ITEM_H, PKG_COLORS }
