import { SALES_CHANNEL_COLOR, SALES_SINGLE_COLOR } from '@/components/statistics/sales-colors'
import { ShowAllRow, type BreakdownProps } from './sales-breakdown-table'
import { formatKg } from './utils'

/**
 * 모바일 — 6칸 표가 360에 안 들어가서 두 줄 목록으로 편다(작업지시 ⑪ A-3).
 * 1줄: 순위 · 이름(거래처면 채널 점) · kg / 2줄: 비중 막대 · 「N개 · 주문 N · %」.
 * 막대·색·접기 규칙은 PC 표(sales-breakdown-table.tsx)와 같다.
 */
export function SalesBreakdownList({ rows, hidden, onShowAll }: Omit<BreakdownProps, 'column'>) {
  const maxKg = rows[0]?.kg ?? 0
  return (
    <div>
      {rows.map((r, i) => {
        const color = r.channel ? SALES_CHANNEL_COLOR[r.channel] : SALES_SINGLE_COLOR
        return (
          <div
            key={r.key}
            className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-baseline gap-x-2 px-3 py-2.5 border-b border-slate-100 last:border-b-0"
          >
            <span className="text-right text-xs tabular-nums text-slate-500">{i + 1}</span>
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="truncate text-[13px] font-semibold text-slate-800">{r.label}</span>
              {r.sub && (
                <span className="flex items-center gap-1 shrink-0 text-[11px] text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                  {r.sub}
                </span>
              )}
            </span>
            <span className="text-[13px] font-bold tabular-nums text-slate-800 whitespace-nowrap">
              {formatKg(r.kg)}
              <span className="ml-0.5 text-[11px] font-medium text-slate-500">kg</span>
            </span>
            <span className="col-start-2 col-span-2 mt-1.5 flex items-center gap-2">
              <span className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${maxKg > 0 ? (r.kg / maxKg) * 100 : 0}%`, backgroundColor: color }}
                />
              </span>
              <span className="text-[11px] tabular-nums text-slate-500 whitespace-nowrap">
                {r.count.toLocaleString('ko-KR')}개 · 주문 {r.orders.toLocaleString('ko-KR')} ·{' '}
                <b className="font-semibold text-slate-700">{r.share.toFixed(1)}%</b>
              </span>
            </span>
          </div>
        )
      })}
      <ShowAllRow hidden={hidden} onShowAll={onShowAll} />
    </div>
  )
}
