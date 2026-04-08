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
    gradient: 'from-sky-100/70 to-white',
    dotStyle: { backgroundColor: '#00a2e8' },
    valueStyle: { color: '#00a2e8' },
    format: formatKg,
  },
  {
    key: 'totalOutputKg' as const,
    label: '총 생산량',
    unit: 'kg',
    gradient: 'from-green-100/70 to-white',
    dotStyle: { backgroundColor: '#8dc540' },
    valueStyle: { color: '#7db037' },
    format: formatKg,
  },
  {
    key: 'avgYieldRate' as const,
    label: '평균 수율',
    unit: '%',
    gradient: 'from-amber-100/70 to-white',
    dotStyle: { backgroundColor: '#f89c1e' },
    valueStyle: { color: '#cc7b0c' },
    format: (v: number) => v.toFixed(1),
  },
  {
    key: 'millingCount' as const,
    label: '도정 건수',
    unit: '건',
    gradient: 'from-slate-100/80 to-white',
    dotStyle: { backgroundColor: '#94a3b8' },
    valueStyle: { color: '#475569' },
    format: (v: number) => v.toLocaleString('ko-KR'),
  },
]

export function SummaryCards({ summary }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 md:flex md:flex-col md:gap-2 md:h-full">
      {cards.map(card => (
        <div
          key={card.key}
          className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex-1 md:min-h-0"
        >
          <div className="h-[3px]" style={card.dotStyle} />
          <div className="px-3 py-2.5 flex items-center justify-between gap-1.5 min-w-0">
            <p className="text-xs font-medium text-slate-400 shrink-0">{card.label}</p>
            <div className="flex items-baseline gap-0.5 min-w-0">
              <span className="text-sm font-bold tabular-nums truncate" style={card.valueStyle}>
                {card.format(summary[card.key] as number)}
              </span>
              <span className="text-xs font-medium text-slate-400 shrink-0">{card.unit}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
