'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SALES_CHANNELS, SALES_CHANNEL_LABEL, type SalesChannel, type SalesTrendBucket } from '@/lib/sales-stats'
import { SALES_CHANNEL_COLOR } from './sales-colors'
import type { ChartTooltipProps } from './chart-tooltip'

/** 축 눈금 — 1톤 넘으면 톤으로 */
function formatAxisKg(v: number): string {
  if (v >= 1000) return `${(v / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}톤`
  return v.toLocaleString('ko-KR')
}

const kg = (v: number) => `${v.toLocaleString('ko-KR', { maximumFractionDigits: 1 })} kg`

type Row = { key: string; tooltipLabel: string; total: number } & Record<SalesChannel, number>

function TrendTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as Row
  // 위에 쌓인 것부터 — 막대에서 보이는 순서와 같게
  const items = [...payload].reverse().filter(p => p.value > 0)
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs min-w-[170px]">
      <p className="font-semibold text-slate-700 mb-1.5">{row.tooltipLabel}</p>
      {items.map(p => (
        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.fill }} />
            {p.name}
          </span>
          <span className="font-medium text-slate-700 tabular-nums">{kg(p.value)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 pt-1 mt-1 border-t border-slate-100">
        <span className="text-slate-500">합계</span>
        <span className="font-semibold text-slate-800 tabular-nums">{kg(row.total)}</span>
      </div>
    </div>
  )
}

/** 판매량에 나온 채널만 — 순서는 고정(SALES_CHANNELS) */
export function presentChannels(data: SalesTrendBucket[]): SalesChannel[] {
  return SALES_CHANNELS.filter(c => data.some(b => b.byChannel[c] > 0))
}

export function SalesChannelLegend({ channels }: { channels: SalesChannel[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
      {channels.map(c => (
        <span key={c} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: SALES_CHANNEL_COLOR[c] }} />
          {SALES_CHANNEL_LABEL[c]}
        </span>
      ))}
    </div>
  )
}

/** 판매량 추이 — 칸(일·주·월)마다 채널별로 쌓은 막대. 축은 kg 하나 */
export function SalesTrendChart({ data, height = 260 }: { data: SalesTrendBucket[]; height?: number }) {
  const channels = presentChannels(data)
  if (channels.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-slate-500" style={{ height }}>
        이 기간에 판매가 없어요
      </div>
    )
  }
  const rows: Row[] = data.map(b => ({ key: b.key, tooltipLabel: b.tooltipLabel, total: b.total, ...b.byChannel }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }} barCategoryGap="25%" maxBarSize={36}>
        <XAxis
          dataKey="key"
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={12}
        />
        <YAxis
          tickFormatter={formatAxisKg}
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
        <Tooltip content={<TrendTooltip />} cursor={{ fill: '#f1f5f9' }} />
        {/* 흰 테두리 1px씩 = 쌓인 칸 사이 2px 틈 */}
        {channels.map(c => (
          <Bar
            key={c}
            dataKey={c}
            name={SALES_CHANNEL_LABEL[c]}
            stackId="sales"
            fill={SALES_CHANNEL_COLOR[c]}
            stroke="#ffffff"
            strokeWidth={1}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
