import type { SalesBreakdownRow } from '@/lib/sales-stats'
import { SALES_CHANNEL_COLOR, SALES_SINGLE_COLOR } from '@/components/statistics/sales-colors'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatKg } from './utils'

/**
 * 탭(채널·거래처·품종·제품)별 표 — 비중 칸에 가로 막대를 같이 그린다.
 * 막대 길이는 1위 대비(가장 긴 줄이 꽉 찬다), 숫자는 기간 전체 대비 %.
 * 채널·거래처 줄은 채널 색, 품종·제품 줄은 채널이 섞여 한 색.
 */
export function SalesBreakdownTable({ rows, column }: { rows: SalesBreakdownRow[]; column: string }) {
  if (rows.length === 0) {
    return <div className="py-10 text-center text-sm text-slate-500">이 기간에 판매가 없어요</div>
  }
  const maxKg = rows[0].kg // kg 많은 순으로 온다(salesBreakdown)
  return (
    <div className="overflow-x-auto">
      <Table className="w-full text-xs" style={{ minWidth: '640px' }}>
        <TableHeader>
          <TableRow className="border-b border-slate-200 bg-slate-50">
            <TableHead className="w-12 text-right">순위</TableHead>
            <TableHead className="text-left">{column}</TableHead>
            <TableHead className="text-right">판매량 (kg)</TableHead>
            <TableHead className="text-right">개수</TableHead>
            <TableHead className="text-right">주문</TableHead>
            <TableHead className="w-[32%] text-left">비중</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => {
            const color = r.channel ? SALES_CHANNEL_COLOR[r.channel] : SALES_SINGLE_COLOR
            return (
              <TableRow key={r.key} className="border-b border-slate-50">
                <TableCell className="py-2.5 px-3 text-right tabular-nums text-slate-500">{i + 1}</TableCell>
                <TableCell className="py-2.5 px-3 font-medium text-slate-700">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{r.label}</span>
                    {r.sub && (
                      <span className="flex items-center gap-1 shrink-0 text-[11px] font-normal text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                        {r.sub}
                      </span>
                    )}
                  </span>
                </TableCell>
                <TableCell className="py-2.5 px-3 text-right font-semibold tabular-nums text-slate-800 whitespace-nowrap">
                  {formatKg(r.kg)}
                </TableCell>
                <TableCell className="py-2.5 px-3 text-right tabular-nums text-slate-600 whitespace-nowrap">
                  {r.count.toLocaleString('ko-KR')}
                </TableCell>
                <TableCell className="py-2.5 px-3 text-right tabular-nums text-slate-600 whitespace-nowrap">
                  {r.orders.toLocaleString('ko-KR')}
                </TableCell>
                <TableCell className="py-2.5 px-3">
                  <span className="flex items-center gap-2">
                    <span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${maxKg > 0 ? (r.kg / maxKg) * 100 : 0}%`, backgroundColor: color }}
                      />
                    </span>
                    <span className="w-12 text-right tabular-nums text-slate-600">{r.share.toFixed(1)}%</span>
                  </span>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
