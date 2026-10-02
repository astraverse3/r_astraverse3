import type { StockStatisticsData } from '@/app/actions/stock-statistics'
import { formatKg } from './utils'

// 색 띠·점·값 색은 뺐다(백로그 §97 · 작업지시 ⑪) — 입고 파랑·도정 초록·미처리 주황이 옆 차트 계열 색과 같아
// 카드가 차트 범례처럼 읽혔다. 빈 조건이면 값을 연하게(0) — 「없다」는 차트 자리 한 곳에서만 말한다
export function StockSummaryCards({ summary, empty }: { summary: StockStatisticsData['summary']; empty: boolean }) {
  const stockRate = summary.totalKg > 0
    ? Math.round((summary.availableKg / summary.totalKg) * 1000) / 10
    : 0

  const cards = [
    { label: '총 입고량', value: formatKg(summary.totalKg), unit: 'kg' },
    { label: '도정완료', value: formatKg(summary.consumedKg), unit: 'kg' },
    { label: '미처리 재고', value: formatKg(summary.availableKg), unit: 'kg' },
    { label: '재고율', value: stockRate.toFixed(1), unit: '%' },
  ]
  const valueTone = empty ? 'text-slate-300' : 'text-slate-800'

  return (
    // 모바일은 숫자 먼저(order-first) — 요약 → 차트 → 표. PC는 차트 오른쪽 그대로
    <div className="order-first md:order-none grid grid-cols-2 gap-2 md:flex md:flex-col md:gap-3 md:w-48 md:shrink-0">
      {cards.map(card => (
        <div key={card.label} className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-100 overflow-hidden md:flex-1 md:min-h-0">
          {/* 모바일: 컴팩트 가로 레이아웃 */}
          <div className="md:hidden px-3 py-2.5 flex items-center justify-between gap-1.5 min-w-0">
            <p className="text-xs font-medium text-slate-500 shrink-0">{card.label}</p>
            <div className="flex items-baseline gap-0.5 min-w-0">
              <span className={`text-sm font-bold tabular-nums truncate ${valueTone}`}>{card.value}</span>
              <span className="text-xs font-medium text-slate-500 shrink-0">{card.unit}</span>
            </div>
          </div>
          {/* PC: 상하 레이아웃 */}
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
