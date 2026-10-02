'use client'

import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { GroupBy } from '@/app/actions/statistics'
import { SALES_CHANNELS, SALES_CHANNEL_LABEL, type SalesChannel, type SalesTrendBucket } from '@/lib/sales-stats'
import { SALES_RECORDED_SINCE } from '@/lib/sales-period'
import type { ReleaseMonthBucket } from '@/lib/raw-release-stats'
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

/** md 미만 — 도정 차트(MillingChart)와 같은 판별 */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저에서만 알 수 있는 값을 마운트 후 반영(SSR 불일치 방지)
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

/**
 * 판매량 추이 — 칸(일·주·월)마다 채널별로 쌓은 막대. 축은 kg 하나.
 * 모바일 360 폭: 일별 31칸을 그대로 두고 막대 20 · 간격 20%, 일별이면 눈금은 1·8·15·22·29만
 * (작업지시 ⑪ A-3 — 가로 스크롤은 한 달 모양이 안 보이고, 주별 강제는 PC와 모양이 달라진다)
 */
export function SalesTrendChart({ data, groupBy }: { data: SalesTrendBucket[]; groupBy: GroupBy }) {
  const isMobile = useIsMobile()
  const height = isMobile ? 180 : 260
  const channels = presentChannels(data)
  if (channels.length === 0) {
    // 「없다」는 화면에서 여기 한 곳만 말한다 — 표는 숨기고 카드는 0(작업지시 ⑪ A-1 ④)
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 text-center" style={{ height }}>
        <p className="text-sm font-semibold text-slate-600">이 기간에 판매가 없어요</p>
        <p className="text-xs text-slate-500">판매는 {SALES_RECORDED_SINCE.replaceAll('-', '.')}부터 기록되고 있어요</p>
      </div>
    )
  }
  const rows: Row[] = data.map(b => ({ key: b.key, tooltipLabel: b.tooltipLabel, total: b.total, ...b.byChannel }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={rows}
        margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
        barCategoryGap={isMobile ? '20%' : '25%'}
        maxBarSize={isMobile ? 20 : 36}
      >
        <XAxis
          dataKey="key"
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          interval={isMobile && groupBy === 'day' ? 6 : 'preserveStartEnd'}
          minTickGap={12}
        />
        <YAxis
          tickFormatter={formatAxisKg}
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          width={isMobile ? 44 : 52}
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

// ── 원물출고 탭 ──────────────────────────────────────────────────────────

/** 원물출고 막대 색 — 판매 탭 채널 색과 다른 계열(단위가 톤이라 섞어 읽지 않게, 작업지시 ⑪ A-4) */
export const RAW_RELEASE_COLOR = '#0f766e'

const ton = (kg: number) => `${(kg / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}톤`

function ReleaseTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as ReleaseMonthBucket
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{row.tooltipLabel}</p>
      <p className="tabular-nums text-slate-500">
        출고 <span className="font-semibold text-slate-800">{ton(row.kg)}</span>
      </p>
    </div>
  )
}

/**
 * 원물 출고 추이 — 월별 한 색 막대. 목적으로 판매/판매 아님을 가르지 않는다
 * (비고 칸이라 믿을 수 없다 — 사용자 2026-10-02). 계열이 하나라 범례 없이 카드 제목이 말한다
 */
export function RawReleaseChart({ data }: { data: ReleaseMonthBucket[] }) {
  const isMobile = useIsMobile()
  const height = isMobile ? 170 : 240
  if (data.every(b => b.kg === 0)) {
    return (
      <div className="flex items-center justify-center text-sm font-semibold text-slate-600" style={{ height }}>
        이 기간에 원물 출고가 없어요
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }} barCategoryGap="25%" maxBarSize={isMobile ? 22 : 40}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={8}
        />
        <YAxis
          dataKey="kg"
          tickFormatter={(v: number) => (v / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          width={isMobile ? 36 : 44}
        />
        <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
        <Tooltip content={<ReleaseTooltip />} cursor={{ fill: '#f1f5f9' }} />
        <Bar dataKey="kg" name="원물 출고" fill={RAW_RELEASE_COLOR} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
