import type { SalesSummary } from '@/lib/sales-stats'
import { formatKg } from './utils'

// 재고분석 요약 카드(stock-summary-cards.tsx)와 같은 틀. 값 글자는 색 대신 본문색 —
// 색은 위 띠·점이 맡는다(색만으로 뜻을 싣지 않는다)
export function SalesSummaryCards({ summary }: { summary: SalesSummary }) {
  const cards = [
    { label: '판매량', value: formatKg(summary.kg), unit: 'kg', accent: '#2a78d6' },
    { label: '판매 개수', value: summary.count.toLocaleString('ko-KR'), unit: '개', accent: '#1baf7a' },
    { label: '주문', value: summary.orders.toLocaleString('ko-KR'), unit: '건', accent: '#eda100' },
    { label: '거래처', value: summary.customers.toLocaleString('ko-KR'), unit: '곳', accent: '#94a3b8' },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 md:flex md:flex-col md:gap-3 md:w-48 md:shrink-0">
      {cards.map(card => (
        <div key={card.label} className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-100 overflow-hidden md:flex-1 md:min-h-0">
          <div className="h-[3px]" style={{ backgroundColor: card.accent }} />
          {/* 모바일: 컴팩트 가로 */}
          <div className="md:hidden px-3 py-2.5 flex items-center justify-between gap-1.5 min-w-0">
            <p className="text-xs font-medium text-slate-500 shrink-0">{card.label}</p>
            <div className="flex items-baseline gap-0.5 min-w-0">
              <span className="text-sm font-bold tabular-nums truncate text-slate-800">{card.value}</span>
              <span className="text-xs font-medium text-slate-500 shrink-0">{card.unit}</span>
            </div>
          </div>
          {/* PC: 상하 */}
          <div className="hidden md:flex md:flex-col md:justify-center md:h-full md:px-4 md:py-3">
            <div className="flex items-center gap-1 mb-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: card.accent }} />
              <span className="text-xs font-bold text-slate-500">{card.label}</span>
            </div>
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-2xl font-bold leading-none tabular-nums text-slate-800">{card.value}</span>
              <span className="text-xs font-semibold text-slate-500">{card.unit}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
