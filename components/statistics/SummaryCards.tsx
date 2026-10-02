import type { StatsSummary } from '@/app/actions/statistics'

type Props = {
  summary: StatsSummary
}

function formatKg(value: number) {
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 1 })
}

// 색 띠·점·값 색은 뺐다(백로그 §97 · 작업지시 ⑪) — 투입 파랑·생산 초록·수율 주황이 옆 차트 계열 색과 같아
// 카드가 차트 범례처럼 읽혔다. 도정 0건이면 값을 연하게 — 「없다」는 차트 자리 한 곳에서만 말한다
const cards = [
  { key: 'totalInputKg' as const, label: '총 투입량', unit: 'kg', format: formatKg },
  { key: 'totalOutputKg' as const, label: '총 생산량', unit: 'kg', format: formatKg },
  { key: 'avgYieldRate' as const, label: '평균 수율', unit: '%', format: (v: number) => v.toFixed(1) },
  { key: 'millingCount' as const, label: '도정 건수', unit: '건', format: (v: number) => v.toLocaleString('ko-KR') },
]

export function SummaryCards({ summary }: Props) {
  const valueTone = summary.millingCount === 0 ? 'text-slate-300' : 'text-slate-800'
  return (
    <div className="grid grid-cols-2 gap-2 md:flex md:flex-col md:gap-3 md:h-full">
      {cards.map(card => (
        <div
          key={card.key}
          className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex-1 md:min-h-0"
        >
          {/* 모바일: 컴팩트 가로 레이아웃 */}
          <div className="md:hidden px-3 py-2.5 flex items-center justify-between gap-1.5 min-w-0">
            <p className="text-xs font-medium text-slate-500 shrink-0">{card.label}</p>
            <div className="flex items-baseline gap-0.5 min-w-0">
              <span className={`text-sm font-bold tabular-nums truncate ${valueTone}`}>
                {card.format(summary[card.key] as number)}
              </span>
              <span className="text-xs font-medium text-slate-500 shrink-0">{card.unit}</span>
            </div>
          </div>
          {/* PC: 상하 레이아웃 */}
          <div className="hidden md:flex md:flex-col md:justify-center md:h-full md:px-4 md:py-3">
            <span className="text-xs font-bold text-slate-500 mb-2">{card.label}</span>
            <div className="flex items-baseline justify-end gap-1">
              <span className={`text-2xl font-bold leading-none tabular-nums ${valueTone}`}>
                {card.format(summary[card.key] as number)}
              </span>
              <span className="text-xs font-semibold text-slate-500">{card.unit}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
