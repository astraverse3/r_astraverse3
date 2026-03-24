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

// 데이터 최대값 기준 nice ticks 계산 (0 포함 count개)
function computeKgTicks(maxVal: number, count = 5): number[] {
  if (maxVal <= 0) return Array.from({ length: count }, (_, i) => i * 25)
  const rawStep = maxVal / (count - 1)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const step = Math.ceil(rawStep / magnitude) * magnitude
  return Array.from({ length: count }, (_, i) => i * step)
}

type Props = {
  data: ChartDataPoint[]
  groupBy: GroupBy
}

const COLOR_INPUT  = 'rgba(0, 162, 232, 0.18)'  // 투입량 — 연한 파랑
const COLOR_OUTPUT = '#00a2e8'                    // 생산량 — 진한 파랑
const COLOR_YIELD  = '#f89c1e'                    // 수율 — 주황

// 투입량 막대 + 생산량 막대를 하나의 SVG로 겹쳐서 그리는 커스텀 Shape
function OverlappingBar(props: any) {
  const { x, y, width, height, payload } = props
  if (!payload || height <= 0) return null

  const r = 4  // border-radius
  const inputW = width
  const outputW = width  // 생산량 막대 폭 동일
  const offsetX = 0

  // 생산량 막대 높이 = 투입량 대비 비율로 계산
  const ratio = payload.inputKg > 0 ? payload.outputKg / payload.inputKg : 0
  const outputH = Math.max(height * ratio, 0)
  const outputY = y + height - outputH

  const gradId = `outGrad-${x}`

  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#33c9ff" stopOpacity={1} />
          <stop offset="100%" stopColor="#007cb3" stopOpacity={1} />
        </linearGradient>
      </defs>
      {/* 배경: 투입량 (연한 파랑) */}
      <rect
        x={x}
        y={y}
        width={inputW}
        height={height}
        rx={r}
        ry={r}
        fill={COLOR_INPUT}
      />
      {/* 전경: 생산량 (그라데이션) */}
      {outputH > 0 && (
        <rect
          x={x + offsetX}
          y={outputY}
          width={outputW}
          height={outputH}
          rx={r}
          ry={r}
          fill={`url(#${gradId})`}
        />
      )}
    </g>
  )
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]?.payload as ChartDataPoint | undefined
  if (!item) return null

  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg p-3 text-sm min-w-[160px]">
      <p className="font-semibold text-slate-700 mb-2">{item.tooltipLabel}</p>
      <div className="flex justify-between gap-4 text-slate-600">
        <span style={{ color: COLOR_OUTPUT }}>투입량</span>
        <span className="font-medium">{item.inputKg.toLocaleString('ko-KR', { maximumFractionDigits: 1 })} kg</span>
      </div>
      <div className="flex justify-between gap-4 text-slate-600">
        <span style={{ color: COLOR_OUTPUT }}>생산량</span>
        <span className="font-medium">{item.outputKg.toLocaleString('ko-KR', { maximumFractionDigits: 1 })} kg</span>
      </div>
      <div className="flex justify-between gap-4 text-slate-600">
        <span style={{ color: COLOR_YIELD }}>수율</span>
        <span className="font-medium">{item.yieldRate.toFixed(1)}%</span>
      </div>
    </div>
  )
}

const GROUP_BY_LABEL: Record<GroupBy, string> = {
  day: '일별',
  week: '주별',
  month: '월별',
}

export function MillingChart({ data, groupBy }: Props) {
  const isEmpty = data.length === 0
  const maxKg = data.reduce((m, d) => Math.max(m, d.inputKg), 0)
  const kgTicks = computeKgTicks(maxKg)

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3 className="text-sm font-semibold text-slate-700">
          {GROUP_BY_LABEL[groupBy]} 투입/생산량 및 수율
        </h3>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: COLOR_INPUT }} />
            투입량
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-3 rounded-sm inline-block" style={{ backgroundColor: COLOR_OUTPUT }} />
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
            <ComposedChart data={data} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="kg"
                orientation="left"
                ticks={kgTicks}
                domain={[0, kgTicks[kgTicks.length - 1]]}
                tick={{ fontSize: 12, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => v === 0 ? '0' : v.toLocaleString()}
              />
              <YAxis
                yAxisId="rate"
                orientation="right"
                domain={[50, 90]}
                ticks={[50, 60, 70, 80, 90]}
                tick={{ fontSize: 12, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />

              {/* 왼쪽 Y축 기준 수평 그리드라인 */}
              {kgTicks.map(v => (
                <ReferenceLine
                  key={v}
                  yAxisId="kg"
                  y={v}
                  stroke="#94a3b8"
                  strokeOpacity={0.2}
                  strokeWidth={1}
                />
              ))}

              {/* 투입량 기준 막대 — 커스텀 Shape으로 생산량도 함께 렌더링 */}
              <Bar
                yAxisId="kg"
                dataKey="inputKg"
                name="투입/생산량"
                shape={<OverlappingBar />}
                maxBarSize={44}
              />

              {/* 수율 라인 */}
              <Line
                yAxisId="rate"
                type="monotone"
                dataKey="yieldRate"
                name="수율"
                stroke={COLOR_YIELD}
                strokeWidth={2.5}
                dot={{ r: 4, fill: COLOR_YIELD, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
