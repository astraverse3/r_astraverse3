import type { StockStatisticsData } from '@/app/actions/stock-statistics'
import { formatKg } from './utils'

export function StockSummaryCards({ summary }: { summary: StockStatisticsData['summary'] }) {
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
