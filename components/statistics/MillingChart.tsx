'use client'

import { useEffect, useState } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { ChartDataPoint, GroupBy } from '@/app/actions/statistics'

// 최대 kg 기준으로 t 단위에서 보기 좋은 눈금 계산 (kg 값으로 반환)
function computeTonTicks(maxKg: number, count = 5): number[] {
  if (maxKg <= 0) return Array.from({ length: count }, (_, i) => i * 1000)
  const maxTon   = Math.max(maxKg / 1000, 0.1)
  const rawStep  = maxTon / (count - 1)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const step     = Math.ceil(rawStep / magnitude) * magnitude
  return Array.from({ length: count }, (_, i) => Math.round(i * step * 1000))
}

// 데이터 없는 포인트의 수율을 좌우 실제 값의 선형 보간으로 채움
function interpolateYield(points: ChartDataPoint[]): ChartDataPoint[] {
  const result = points.map(p => ({ ...p }))

  for (let i = 0; i < result.length; i++) {
    if (result[i].hasData) continue

    let leftVal: number | null = null
    for (let l = i - 1; l >= 0; l--) {
      if (result[l].hasData) { leftVal = result[l].yieldRate; break }
    }
    let rightVal: number | null = null
    for (let r = i + 1; r < result.length; r++) {
      if (result[r].hasData) { rightVal = result[r].yieldRate; break }
    }

    if (leftVal !== null && rightVal !== null) {
      result[i].yieldRate = Math.round(((leftVal + rightVal) / 2) * 10) / 10
    } else if (leftVal !== null) {
      result[i].yieldRate = leftVal
    } else if (rightVal !== null) {
      result[i].yieldRate = rightVal
    }
  }

  return result
}

function realYieldSeries(points: ChartDataPoint[]): (number | null)[] {
  return points.map(p => p.hasData ? p.yieldRate : null)
}

function interpYieldSeries(points: ChartDataPoint[]): (number | null)[] {
  return points.map((p, i, arr) => {
    if (!p.hasData) return p.yieldRate
    const adjInterp =
      (i > 0 && !arr[i - 1].hasData) ||
      (i < arr.length - 1 && !arr[i + 1].hasData)
    return adjInterp ? p.yieldRate : null
  })
}

type Props = {
  data: ChartDataPoint[]
  groupBy: GroupBy
}

const COLOR_INPUT  = 'rgba(0, 162, 232, 0.18)'
const COLOR_OUTPUT = '#00a2e8'
const COLOR_YIELD  = '#f89c1e'

function OverlappingBar(props: any) {
  const { x, y, width, height, payload } = props
  if (!payload || height <= 0) return null

  const r       = 4
  const ratio   = payload.inputKg > 0 ? payload.outputKg / payload.inputKg : 0
  const outputH = Math.max(height * ratio, 0)
  const outputY = y + height - outputH
  const gradId  = `outGrad-${x}`

  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#33c9ff" stopOpacity={1} />
          <stop offset="100%" stopColor="#007cb3" stopOpacity={1} />
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={width} height={height} rx={r} ry={r} fill={COLOR_INPUT} />
      {outputH > 0 && (
        <rect x={x} y={outputY} width={width} height={outputH} rx={r} ry={r} fill={`url(#${gradId})`} />
      )}
    </g>
  )
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]?.payload as ChartDataPoint | undefined
  if (!item) return null

  const fmt = (kg: number) =>
    `${(kg / 1000).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t`

  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg p-3 text-sm min-w-[140px]">
      <p className="font-semibold text-slate-700 mb-2">{item.tooltipLabel}</p>
      {!item.hasData && (
        <p className="text-[10px] text-slate-400 mb-1.5">※ 보간값</p>
      )}
      <div className="flex justify-between gap-4 text-slate-600">
        <span style={{ color: COLOR_OUTPUT }}>투입량</span>
        <span className="font-medium">{fmt(item.inputKg)}</span>
      </div>
      <div className="flex justify-between gap-4 text-slate-600">
        <span style={{ color: COLOR_OUTPUT }}>생산량</span>
        <span className="font-medium">{fmt(item.outputKg)}</span>
      </div>
      <div className="flex justify-between gap-4 text-slate-600">
        <span style={{ color: COLOR_YIELD }}>수율</span>
        <span className="font-medium">{item.yieldRate.toFixed(1)}%</span>
      </div>
    </div>
  )
}

const GROUP_BY_LABEL: Record<GroupBy, string> = {
  day:   '일별',
  week:  '주별',
  month: '월별',
}

const LEGEND_BOX = 'w-3 h-3 rounded-sm inline-block'

const YIELD_TICKS  = [55, 60, 65, 70, 75]
const YIELD_DOMAIN: [number, number] = [55, 75]

function computeMaxBarSize(count: number): number {
  if (count <= 0) return 44
  return Math.max(12, Math.min(56, Math.round(480 / count)))
}

function formatXTick(value: string, groupBy: GroupBy): string {
  if (groupBy === 'month') {
    const [year, month] = value.split('-')
    return `${year.slice(2)}${month}`
  }
  return value
}

export function MillingChart({ data, groupBy }: Props) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const isEmpty = data.length === 0

  const interpolated = interpolateYield(data)
  const realYield    = realYieldSeries(interpolated)
  const interpYield  = interpYieldSeries(interpolated)

  const chartData = interpolated.map((p, i) => ({
    ...p,
    _realYield:   realYield[i],
    _interpYield: interpYield[i],
  }))

  const maxKg      = data.reduce((m, d) => Math.max(m, d.inputKg), 0)
  const tonTicks   = computeTonTicks(maxKg)
  const maxBarSize = computeMaxBarSize(data.length)

  // 모바일: 마진·폰트 축소, 오른쪽 YAxis 숨김
  const margin     = isMobile ? { top: 4, right: 4, left: 0, bottom: 0 } : { top: 5, right: 16, left: 0, bottom: 5 }
  const tickFontSz = isMobile ? 10 : 12

  return (
    <div className="bg-white rounded-2xl p-3 md:p-5 shadow-sm border border-slate-100 h-full flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2 md:mb-4 shrink-0">
        <h3 className="text-xs md:text-sm font-semibold text-slate-700">
          {GROUP_BY_LABEL[groupBy]} 투입/생산량 및 수율
        </h3>
        <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span className={LEGEND_BOX} style={{ backgroundColor: COLOR_INPUT }} />
            투입
          </span>
          <span className="flex items-center gap-1">
            <span className={LEGEND_BOX} style={{ backgroundColor: COLOR_OUTPUT }} />
            생산
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 inline-block rounded" style={{ backgroundColor: COLOR_YIELD }} />
            수율
          </span>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          조회된 데이터가 없습니다
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={margin}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: tickFontSz, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => formatXTick(v, groupBy)}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="kg"
                orientation="left"
                ticks={tonTicks}
                domain={[0, tonTicks[tonTicks.length - 1]]}
                tick={{ fontSize: tickFontSz, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                width={isMobile ? 28 : 40}
                tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(v < 1000 ? 1 : 0)}t`}
              />
              {!isMobile && (
                <YAxis
                  yAxisId="rate"
                  orientation="right"
                  domain={YIELD_DOMAIN}
                  ticks={YIELD_TICKS}
                  tick={{ fontSize: tickFontSz, fill: '#94A3B8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${v}%`}
                />
              )}
              {isMobile && (
                <YAxis
                  yAxisId="rate"
                  orientation="right"
                  domain={YIELD_DOMAIN}
                  ticks={YIELD_TICKS}
                  hide
                />
              )}
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />

              {tonTicks.map(v => (
                <ReferenceLine
                  key={v}
                  yAxisId="kg"
                  y={v}
                  stroke="#94a3b8"
                  strokeOpacity={0.2}
                  strokeWidth={1}
                />
              ))}

              <Bar
                yAxisId="kg"
                dataKey="inputKg"
                name="투입/생산량"
                shape={<OverlappingBar />}
                maxBarSize={maxBarSize}
              />

              <Line
                yAxisId="rate"
                type="monotone"
                dataKey="_realYield"
                name="수율"
                stroke={COLOR_YIELD}
                strokeWidth={2.5}
                dot={{ r: isMobile ? 2 : 4, fill: COLOR_YIELD, strokeWidth: 0 }}
                activeDot={{ r: isMobile ? 4 : 6 }}
                connectNulls={false}
                legendType="none"
              />

              <Line
                yAxisId="rate"
                type="monotone"
                dataKey="_interpYield"
                name="수율(보간)"
                stroke={COLOR_YIELD}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                activeDot={false}
                connectNulls={false}
                legendType="none"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
