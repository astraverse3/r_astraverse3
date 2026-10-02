import type { SalesSummary } from '@/lib/sales-stats'
import { formatKg } from './utils'

// 재고분석 요약 카드(stock-summary-cards.tsx)와 같은 틀. 색 띠·점은 뺐다(작업지시 ⑪ A-1 ①) —
// 판매량 파랑·개수 초록·주문 노랑이 옆 차트의 택배·서울급식·해남급식과 겹쳐 채널을 뜻하는 것처럼 읽혔다.
// 빈 기간이면 값을 연하게(0) — 「없다」는 말은 차트 자리 한 곳에서만 한다(A-1 ④)
export function SalesSummaryCards({ summary, empty }: { summary: SalesSummary; empty: boolean }) {
  const cards = [
    { label: '판매량', value: formatKg(summary.kg), unit: 'kg' },
    { label: '판매 개수', value: summary.count.toLocaleString('ko-KR'), unit: '개' },
    { label: '주문', value: summary.orders.toLocaleString('ko-KR'), unit: '건' },
    { label: '거래처', value: summary.customers.toLocaleString('ko-KR'), unit: '곳' },
  ]
  const valueTone = empty ? 'text-slate-300' : 'text-slate-800'

  return (
    // 모바일은 숫자 먼저(order-first) — 요약 → 차트 → 목록(작업지시 ⑪ A-3). PC는 차트 오른쪽 그대로
    <div className="order-first md:order-none grid grid-cols-2 gap-2 md:flex md:flex-col md:gap-3 md:w-48 md:shrink-0">
      {cards.map(card => (
        <div key={card.label} className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-100 overflow-hidden md:flex-1 md:min-h-0">
          {/* 모바일: 컴팩트 가로 */}
          <div className="md:hidden px-3 py-2.5 flex items-center justify-between gap-1.5 min-w-0">
            <p className="text-xs font-medium text-slate-500 shrink-0">{card.label}</p>
            <div className="flex items-baseline gap-0.5 min-w-0">
              <span className={`text-sm font-bold tabular-nums truncate ${valueTone}`}>{card.value}</span>
              <span className="text-xs font-medium text-slate-500 shrink-0">{card.unit}</span>
            </div>
          </div>
          {/* PC: 상하 */}
          <div className="hidden md:flex md:flex-col md:justify-center md:h-full md:px-4 md:py-3">
            <span className="text-xs font-bold text-slate-500 mb-2">{card.label}</span>
            <div className="flex items-baseline justify-end gap-1">
              <span className={`text-2xl font-bold leading-none tabular-nums ${valueTone}`}>{card.value}</span>
              <span className="text-xs font-semibold text-slate-500">{card.unit}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
