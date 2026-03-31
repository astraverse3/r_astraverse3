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
import type { MultiSeriesChartData, GroupBy } from '@/app/actions/statistics'

// 시리즈별 색상 팔레트
const PALETTE = [
  { input: 'rgba(0,162,232,0.18)',   output: '#00a2e8', yield: '#007cb3' },
  { input: 'rgba(34,197,94,0.18)',   output: '#22c55e', yield: '#16a34a' },
  { input: 'rgba(139,92,246,0.18)',  output: '#8b5cf6', yield: '#7c3aed' },
  { input: 'rgba(248,156,30,0.18)',  output: '#f89c1e', yield: '#d97706' },
  { input: 'rgba(239,68,68,0.18)',   output: '#ef4444', yield: '#dc2626' },
]

function getMaxBarSize(count: number): number {
  const sizes: Record<number, number> = { 1: 40, 2: 28, 3: 20, 4: 16, 5: 13 }
  return sizes[count] ?? 13
}

function computeTonTicks(maxKg: number, count = 5): number[] {
  if (maxKg <= 0) return Array.from({ length: count }, (_, i) => i * 1000)
  const maxTon    = Math.max(maxKg / 1000, 0.1)
  const rawStep   = maxTon / (count - 1)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const step      = Math.ceil(rawStep / magnitude) * magnitude
  return Array.from({ length: count }, (_, i) => Math.round(i * step * 1000))
}

// 시리즈별 수율 보간 처리
function interpolateSeriesYield(
  periods: MultiSeriesChartData['periods'],
  seriesName: string
): { real: (number | null)[]; interp: (number | null)[] } {
  const yieldKey   = `${seriesName}_yield`
  const hasDataKey = `${seriesName}_hasData`

  // 보간된 수율 배열 생성
  const yields = periods.map(p => ({
    val:     p[yieldKey] as number,
    hasData: p[hasDataKey] as boolean,
  }))

  const interpolated = yields.map((item, i, arr) => {
    if (item.hasData) return item.val

    let leftVal: number | null = null
    for (let l = i - 1; l >= 0; l--) {
      if (arr[l].hasData) { leftVal = arr[l].val; break }
    }
    let rightVal: number | null = null
    for (let r = i + 1; r < arr.length; r++) {
      if (arr[r].hasData) { rightVal = arr[r].val; break }
    }

    if (leftVal !== null && rightVal !== null) return Math.round(((leftVal + rightVal) / 2) * 10) / 10
    if (leftVal  !== null) return leftVal
    if (rightVal !== null) return rightVal
    return item.val
  })

  // 실선: 실제 데이터 포인트만
  const real = yields.map((item, i) => item.hasData ? interpolated[i] : null)

  // 점선: 보간 포인트 + 인접 실제 포인트
  const interp = yields.map((item, i, arr) => {
    if (!item.hasData) return interpolated[i]
    const adjInterp =
      (i > 0 && !arr[i - 1].hasData) ||
      (i < arr.length - 1 && !arr[i + 1].hasData)
    return adjInterp ? interpolated[i] : null
  })

  return { real, interp }
}

function makeOverlappingBar(inputColor: string, outputColor: string, seriesName: string) {
  return function OverlappingBar(props: any) {
    const { x, y, width, height, payload } = props
    if (!payload || height <= 0) return null

    const inputKg  = (payload[`${seriesName}_input`]  as number) ?? 0
    const outputKg = (payload[`${seriesName}_output`] as number) ?? 0

    const r       = 3
    const ratio   = inputKg > 0 ? outputKg / inputKg : 0
    const outputH = Math.max(height * ratio, 0)
    const outputY = y + height - outputH
    const gradId  = `msGrad-${seriesName.replace(/\s/g, '')}-${x}`

    return (
      <g>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={outputColor} stopOpacity={0.85} />
            <stop offset="100%" stopColor={outputColor} stopOpacity={1} />
          </linearGradient>
        </defs>
        <rect x={x} y={y} width={width} height={height} rx={r} ry={r} fill={inputColor} />
        {outputH > 0 && (
          <rect x={x} y={outputY} width={width} height={outputH} rx={r} ry={r} fill={`url(#${gradId})`} />
        )}
      </g>
    )
  }
}

function CustomTooltip({ active, payload, seriesNames }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]?.payload
  if (!item) return null

  const fmt = (kg: number) =>
    `${(kg / 1000).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t`

  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg p-3 text-sm min-w-[190px]">
      <p className="font-semibold text-slate-700 mb-2">{item.tooltipLabel}</p>
      {(seriesNames as string[]).map((name, i) => {
        const color     = PALETTE[i % PALETTE.length]
        const inputKg   = (item[`${name}_input`]   as number)  ?? 0
        const outputKg  = (item[`${name}_output`]  as number)  ?? 0
        const hasData   = (item[`${name}_hasData`] as boolean) ?? false
        // 보간된 수율은 _realYield/_interpYield가 아닌 원본 yield 표시
        const yieldRate = (item[`${name}_yield`]   as number)  ?? 0
        return (
          <div key={name} className="mb-2 last:mb-0">
            <p className="text-xs font-semibold mb-0.5 flex items-center gap-1" style={{ color: color.output }}>
              {name}
              {!hasData && <span className="text-[9px] text-slate-400 font-normal">(보간)</span>}
            </p>
            <div className="flex justify-between gap-4 text-slate-500 text-xs">
              <span>투입</span><span className="font-medium">{fmt(inputKg)}</span>
            </div>
            <div className="flex justify-between gap-4 text-slate-500 text-xs">
              <span>생산</span><span className="font-medium">{fmt(outputKg)}</span>
            </div>
            <div className="flex justify-between gap-4 text-xs">
              <span style={{ color: color.yield }}>수율</span>
              <span className="font-medium" style={{ color: color.yield }}>{yieldRate.toFixed(1)}%</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatXTick(value: string, groupBy: GroupBy): string {
  if (groupBy === 'month') {
    const [year, month] = value.split('-')
    return `${year.slice(2)}${month}`
  }
  return value
}

const GROUP_BY_LABEL: Record<GroupBy, string> = {
  day:   '일별',
  week:  '주별',
  month: '월별',
}

const YIELD_TICKS: number[]         = [55, 60, 65, 70, 75]
const YIELD_DOMAIN: [number, number] = [55, 75]

type Props = {
  data: MultiSeriesChartData
  title: string
}

export function MultiSeriesChart({ data, title }: Props) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const { periods, seriesNames, groupBy } = data
  const isEmpty = periods.length === 0

  // 시리즈별 보간 계산 후 차트 데이터에 주입
  const seriesYield = seriesNames.map(name => ({
    name,
    ...interpolateSeriesYield(periods, name),
  }))

  const chartData = periods.map((p, i) => {
    const point: Record<string, any> = { ...p }
    for (const s of seriesYield) {
      point[`${s.name}_realYield`]   = s.real[i]
      point[`${s.name}_interpYield`] = s.interp[i]
    }
    return point
  })

  const maxKg = periods.reduce((m, p) => {
    for (const name of seriesNames) {
      m = Math.max(m, (p[`${name}_input`] as number) ?? 0)
    }
    return m
  }, 0)

  const tonTicks   = computeTonTicks(maxKg)
  const maxBarSize = getMaxBarSize(seriesNames.length)

  const margin     = isMobile ? { top: 4, right: 4, left: 0, bottom: 0 } : { top: 5, right: 16, left: 0, bottom: 5 }
  const tickFontSz = isMobile ? 10 : 12

  return (
    <div className="bg-white rounded-2xl p-3 md:p-5 shadow-sm border border-slate-100 h-full flex flex-col">
      <div className="flex items-start justify-between mb-2 md:mb-4 shrink-0 gap-2 flex-wrap">
        <h3 className="text-xs md:text-sm font-semibold text-slate-700">
          {GROUP_BY_LABEL[groupBy]} {title} 투입/생산량 및 수율
        </h3>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] md:text-xs md:gap-x-3 text-slate-400">
          {seriesNames.map((name, i) => {
            const color = PALETTE[i % PALETTE.length]
            return (
              <span key={name} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm inline-block" style={{ backgroundColor: color.output }} />
                {name}
              </span>
            )
          })}
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
                  allowDataOverflow
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
              <Tooltip
                content={<CustomTooltip seriesNames={seriesNames} />}
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              />

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

              {/* 시리즈별 막대 */}
              {seriesNames.map((name, i) => {
                const color = PALETTE[i % PALETTE.length]
                return (
                  <Bar
                    key={`${name}_bar`}
                    yAxisId="kg"
                    dataKey={`${name}_input`}
                    name={name}
                    shape={makeOverlappingBar(color.input, color.output, name)}
                    maxBarSize={maxBarSize}
                    background={(props: any) => {
                      const hasData = (props.payload?.[`${name}_input`] ?? 0) > 0
                      if (hasData) return <g />
                      return (
                        <rect
                          x={props.x + 1}
                          y={props.y}
                          width={Math.max(0, props.width - 2)}
                          height={props.height}
                          rx={3}
                          fill="none"
                          stroke={color.output}
                          strokeWidth={1}
                          strokeDasharray="4 3"
                          strokeOpacity={0.25}
                        />
                      )
                    }}
                  />
                )
              })}

              {/* 시리즈별 수율 실선 */}
              {seriesNames.map((name, i) => {
                const color = PALETTE[i % PALETTE.length]
                return (
                  <Line
                    key={`${name}_realLine`}
                    yAxisId="rate"
                    type="monotone"
                    dataKey={`${name}_realYield`}
                    name={`${name} 수율`}
                    stroke={color.yield}
                    strokeWidth={2}
                    dot={{ r: isMobile ? 2 : 3, fill: color.yield, strokeWidth: 0 }}
                    activeDot={{ r: isMobile ? 4 : 5 }}
                    connectNulls={false}
                    legendType="none"
                  />
                )
              })}

              {/* 시리즈별 수율 점선(보간) */}
              {seriesNames.map((name, i) => {
                const color = PALETTE[i % PALETTE.length]
                return (
                  <Line
                    key={`${name}_interpLine`}
                    yAxisId="rate"
                    type="monotone"
                    dataKey={`${name}_interpYield`}
                    name={`${name} 수율(보간)`}
                    stroke={color.yield}
                    strokeWidth={1.2}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={false}
                    connectNulls={false}
                    legendType="none"
                  />
                )
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
