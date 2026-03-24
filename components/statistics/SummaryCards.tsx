import type { StatsSummary } from '@/app/actions/statistics'

type Props = {
  summary: StatsSummary
}

function formatKg(value: number) {
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 1 })
}

const cards = [
  {
    key: 'totalInputKg' as const,
    label: '총 투입량',
    unit: 'kg',
    color: '#00a2e8',
    dotStyle: { backgroundColor: '#00a2e8' },
    valueStyle: { color: '#00a2e8' },
    format: formatKg,
  },
  {
    key: 'totalOutputKg' as const,
    label: '총 생산량',
    unit: 'kg',
    color: '#8dc540',
    dotStyle: { backgroundColor: '#8dc540' },
    valueStyle: { color: '#7db037' },
    format: formatKg,
  },
  {
    key: 'avgYieldRate' as const,
    label: '평균 수율',
    unit: '%',
    color: '#f89c1e',
    dotStyle: { backgroundColor: '#f89c1e' },
    valueStyle: { color: '#cc7b0c' },
    format: (v: number) => v.toFixed(1),
  },
  {
    key: 'millingCount' as const,
    label: '도정 건수',
    unit: '건',
    color: '#94a3b8',
    dotStyle: { backgroundColor: '#94a3b8' },
    valueStyle: { color: '#475569' },
    format: (v: number) => v.toLocaleString('ko-KR'),
  },
]

export function SummaryCards({ summary }: Props) {
  return (
    <div className="flex flex-col gap-3 h-full">
      {cards.map(card => (
        <div
          key={card.key}
          className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-slate-100 flex-1 flex flex-col justify-center"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-2 h-2 rounded-full" style={card.dotStyle} />
            <span className="text-xs font-bold text-slate-600">
              {card.label}
            </span>
          </div>
          <div className="flex items-baseline justify-end gap-1">
            <span className="text-2xl font-bold leading-none" style={card.valueStyle}>
              {card.format(summary[card.key] as number)}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {card.unit}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
