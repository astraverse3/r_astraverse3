'use client'

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

    // 좌측 실제 값
    let leftVal: number | null = null
    for (let l = i - 1; l >= 0; l--) {
      if (result[l].hasData) { leftVal = result[l].yieldRate; break }
    }
    // 우측 실제 값
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

// 실선용: 실제 데이터 포인트만 (null이면 선 끊김)
function realYieldSeries(points: ChartDataPoint[]): (number | null)[] {
  return points.map(p => p.hasData ? p.yieldRate : null)
}

// 점선용: 보간 포인트 + 그 인접 실제 포인트 (나머지 null)
function interpYieldSeries(points: ChartDataPoint[]): (number | null)[] {
  return points.map((p, i, arr) => {
    if (!p.hasData) return p.yieldRate   // 보간 포인트 포함
    // 인접에 보간 포인트가 있는 실제 포인트는 연결선을 위해 포함
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
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg p-3 text-sm min-w-[160px]">
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

// 데이터 포인트 수에 따른 막대 최대 너비 계산
function computeMaxBarSize(count: number): number {
  if (count <= 0) return 44
  return Math.max(12, Math.min(56, Math.round(480 / count)))
}

// X축 눈금 레이블 포맷 (월별: "2025-04" → "2504")
function formatXTick(value: string, groupBy: GroupBy): string {
  if (groupBy === 'month') {
    const [year, month] = value.split('-')
    return `${year.slice(2)}${month}`
  }
  return value
}

export function MillingChart({ data, groupBy }: Props) {
  const isEmpty = data.length === 0

  const interpolated = interpolateYield(data)
  const realYield    = realYieldSeries(interpolated)
  const interpYield  = interpYieldSeries(interpolated)

  // recharts용 merged 데이터 (실선/점선 값을 각 포인트에 주입)
  const chartData = interpolated.map((p, i) => ({
    ...p,
    _realYield:   realYield[i],
    _interpYield: interpYield[i],
  }))

  const maxKg      = data.reduce((m, d) => Math.max(m, d.inputKg), 0)
  const tonTicks   = computeTonTicks(maxKg)
  const maxBarSize = computeMaxBarSize(data.length)

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3 className="text-sm font-semibold text-slate-700">
          {GROUP_BY_LABEL[groupBy]} 투입/생산량 및 수율
        </h3>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className={LEGEND_BOX} style={{ backgroundColor: COLOR_INPUT }} />
            투입량
          </span>
          <span className="flex items-center gap-1.5">
            <span className={LEGEND_BOX} style={{ backgroundColor: COLOR_OUTPUT }} />
            생산량
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-0.5 inline-block rounded" style={{ backgroundColor: COLOR_YIELD }} />
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
            <ComposedChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => formatXTick(v, groupBy)}
              />
              <YAxis
                yAxisId="kg"
                orientation="left"
                ticks={tonTicks}
                domain={[0, tonTicks[tonTicks.length - 1]]}
                tick={{ fontSize: 12, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(v < 1000 ? 1 : 0)}t`}
              />
              <YAxis
                yAxisId="rate"
                orientation="right"
                domain={YIELD_DOMAIN}
                ticks={YIELD_TICKS}
                tick={{ fontSize: 12, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${v}%`}
              />
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

              {/* 실선: 실제 데이터 구간 */}
              <Line
                yAxisId="rate"
                type="monotone"
                dataKey="_realYield"
                name="수율"
                stroke={COLOR_YIELD}
                strokeWidth={2.5}
                dot={{ r: 4, fill: COLOR_YIELD, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
                connectNulls={false}
                legendType="none"
              />

              {/* 점선: 보간 구간 */}
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
