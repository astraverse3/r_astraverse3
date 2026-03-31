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
    <div className="grid grid-cols-2 gap-2 md:flex md:flex-col md:gap-3 md:h-full">
      {cards.map(card => (
        <div
          key={card.key}
          className={`bg-gradient-to-br ${card.gradient} rounded-xl md:rounded-2xl px-3 py-2 md:px-4 md:py-3 shadow-sm border border-slate-100 flex-1 flex items-center justify-between md:flex-col md:items-stretch md:justify-center`}
        >
          {/* 모바일: 레이블 왼쪽, 값 오른쪽 한 줄 / PC: 기존 상하 배치 */}
          <div className="flex items-center gap-1 md:mb-2">
            <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full shrink-0" style={card.dotStyle} />
            <span className="text-xs font-bold text-slate-500">
              {card.label}
            </span>
          </div>
          <div className="flex items-baseline gap-0.5 md:justify-end md:gap-1">
            <span className="text-base font-bold leading-none md:text-2xl" style={card.valueStyle}>
              {card.format(summary[card.key] as number)}
            </span>
            <span className="text-[10px] font-semibold text-slate-400 md:text-xs md:text-slate-500">
              {card.unit}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
