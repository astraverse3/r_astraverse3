'use client'

import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts'

export type StockChartItem = {
  name: string
  consumed: number   // 도정완료 (kg)
  available: number  // 미처리 (kg)
  released: number   // 직접출고 (kg)
  total: number      // 합계 (레이블 표시용)
}

type Props = {
  data: StockChartItem[]
  height?: number
  truncateLabels?: boolean
}

const COLORS = {
  consumed:  '#8dc540',
  available: '#f89c1e',
  released:  '#8b5cf6',
}

// barSize 고정값 (막대 두께)
const BAR_SIZE = 14

function formatKg(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}t`
  return `${v}kg`
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0)
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs min-w-[160px]">
      <p className="font-semibold text-slate-700 mb-1.5 truncate max-w-[200px]">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.fill }} />
            {p.name}
          </span>
          <span className="font-medium text-slate-700">{p.value.toLocaleString('ko-KR')} kg</span>
        </div>
      ))}
      <div className="border-t border-slate-100 mt-1.5 pt-1 flex justify-between font-semibold text-slate-600">
        <span>합계</span>
        <span>{total.toLocaleString('ko-KR')} kg</span>
      </div>
    </div>
  )
}

// 작목반별 전용: 4자 후 … 처리, 클릭 시 전체 표시
function TruncatedTick({
  x, y, payload,
  expandedLabel,
  onToggle,
}: {
  x?: number
  y?: number
  payload?: { value: string }
  expandedLabel: string | null
  onToggle: (name: string) => void
}) {
  const name = payload?.value ?? ''
  const isExpanded = expandedLabel === name
  const display = (!isExpanded && name.length > 4) ? name.slice(0, 4) + '…' : name

  return (
    <g transform={`translate(${x},${y})`} onClick={() => onToggle(name)} style={{ cursor: 'pointer' }}>
      <text x={-4} y={0} dy={4} textAnchor="end" fill="#334155" fontSize={11}>
        {display}
      </text>
    </g>
  )
}

export function StockChart({ data, height = 360, truncateLabels = false }: Props) {
  const [expandedLabel, setExpandedLabel] = useState<string | null>(null)

  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>
        데이터가 없습니다
      </div>
    )
  }

  // Y축 너비: truncateLabels=true면 고정 68px (4자+…), 아니면 이름 길이 기준
  const yAxisWidth = truncateLabels
    ? 68
    : Math.min(Math.max(Math.max(...data.map(d => d.name.length)) * 10, 60), 150)

  // Y축 tick: truncateLabels=true면 커스텀, 아니면 기본 recharts tick
  const yAxisTick = truncateLabels
    ? (props: any) => (
        <TruncatedTick
          {...props}
          expandedLabel={expandedLabel}
          onToggle={(name) => setExpandedLabel(prev => prev === name ? null : name)}
        />
      )
    : { fontSize: 11, fill: '#475569' }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 48, left: 0, bottom: 4 }}
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
          tick={yAxisTick}
          axisLine={false}
          tickLine={false}
        />
        <CartesianGrid horizontal={false} stroke="#cbd5e1" strokeDasharray="3 3" />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
        <Bar dataKey="consumed" name="도정완료" stackId="a" fill={COLORS.consumed} radius={[0, 0, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="released" name="직접출고" stackId="a" fill={COLORS.released} radius={[0, 0, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="available" name="미처리" stackId="a" fill={COLORS.available} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList
            dataKey="total"
            position="right"
            formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? formatKg(v) : '')}
            style={{ fontSize: 11, fill: '#64748b' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
