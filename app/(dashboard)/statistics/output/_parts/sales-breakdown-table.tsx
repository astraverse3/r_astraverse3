import { ChevronDown } from 'lucide-react'
import type { SalesBreakdownRow } from '@/lib/sales-stats'
import { SALES_CHANNEL_COLOR, SALES_SINGLE_COLOR } from '@/components/statistics/sales-colors'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatKg } from './utils'

/**
 * 탭(채널·거래처·품종·제품)별 표 — 비중 칸에 가로 막대를 같이 그린다.
 * 막대 길이는 1위 대비(가장 긴 줄이 꽉 찬다), 숫자는 기간 전체 대비 %.
 * 채널·거래처 줄은 채널 색, 품종·제품 줄은 채널이 섞여 한 색.
 * 빈 기간에는 부모가 이 표를 숨긴다(「없다」는 차트 자리 한 곳에서만 — 작업지시 ⑪ A-1 ④).
 * 거래처 탭은 앞 20곳만 받고 나머지는 「더 보기」로 접어 둔다(visibleRows).
 */
export function SalesBreakdownTable({ rows, column, hidden, onShowAll }: BreakdownProps) {
  const maxKg = rows[0]?.kg ?? 0 // kg 많은 순으로 온다(salesBreakdown)
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
      <ShowAllRow hidden={hidden} onShowAll={onShowAll} />
    </div>
  )
}

export type BreakdownProps = {
  /** 보일 줄만(앞에서부터) — 순위는 줄 위치라 접어도 그대로 맞다 */
  rows: SalesBreakdownRow[]
  column: string
  /** 접어 둔 줄 수 */
  hidden: number
  onShowAll: () => void
}

/** 「나머지 N곳 더 보기」 — PC 표·모바일 목록 공용 */
export function ShowAllRow({ hidden, onShowAll }: { hidden: number; onShowAll: () => void }) {
  if (hidden <= 0) return null
  return (
    <button
      type="button"
      onClick={onShowAll}
      className="w-full h-11 flex items-center justify-center gap-1 border-t border-slate-100 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
    >
      나머지 {hidden.toLocaleString('ko-KR')}곳 더 보기
      <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
    </button>
  )
}
