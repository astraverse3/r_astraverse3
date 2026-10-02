import type { SalesBreakdownRow } from '@/lib/sales-stats'
import { SALES_CHANNEL_COLOR, SALES_SINGLE_COLOR } from '@/components/statistics/sales-colors'
import { ShowAllRow } from '@/components/statistics/ShowAllRow'
import {
  STAT_HEAD,
  STAT_HEAD_ROW,
  STAT_NAME,
  STAT_NUM,
  STAT_NUM_MAIN,
  STAT_RANK,
  STAT_SUB,
  STAT_TABLE,
} from '@/components/statistics/table-styles'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatKg } from './utils'

/**
 * 탭(채널·거래처·품종·제품)별 표 — 비중 칸에 가로 막대를 같이 그린다.
 * 막대 길이는 1위 대비(가장 긴 줄이 꽉 찬다), 숫자는 기간 전체 대비 %.
 * 채널·거래처 줄은 채널 색, 품종·제품 줄은 채널이 섞여 한 색.
 * 빈 기간에는 부모가 이 표를 숨긴다(「없다」는 차트 자리 한 곳에서만 — 작업지시 ⑪ A-1 ④).
 * 거래처 탭은 앞 20곳만 받고 나머지는 「더 보기」로 접어 둔다(visibleRows).
 * 겉모양은 통계 표 공통(components/statistics/table-styles.ts, 작업지시 ⑫ C).
 */
export function SalesBreakdownTable({ rows, column, hidden, onShowAll }: BreakdownProps) {
  const maxKg = rows[0]?.kg ?? 0 // kg 많은 순으로 온다(salesBreakdown)
  return (
    <div className="overflow-x-auto">
      <Table className={STAT_TABLE} style={{ minWidth: '640px' }}>
        <TableHeader>
          <TableRow className={STAT_HEAD_ROW}>
            <TableHead className={`${STAT_HEAD} w-12 text-right`}>순위</TableHead>
            <TableHead className={STAT_HEAD}>{column}</TableHead>
            <TableHead className={`${STAT_HEAD} text-right`}>판매량 (kg)</TableHead>
            <TableHead className={`${STAT_HEAD} text-right`}>개수</TableHead>
            <TableHead className={`${STAT_HEAD} text-right`}>주문</TableHead>
            <TableHead className={`${STAT_HEAD} w-[32%]`}>비중</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => {
            const color = r.channel ? SALES_CHANNEL_COLOR[r.channel] : SALES_SINGLE_COLOR
            return (
              <TableRow key={r.key}>
                <TableCell className={STAT_RANK}>{i + 1}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={`truncate ${STAT_NAME}`}>{r.label}</span>
                    {r.sub && (
                      <span className={`flex items-center gap-1 shrink-0 ${STAT_SUB}`}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                        {r.sub}
                      </span>
                    )}
                  </span>
                </TableCell>
                <TableCell className={STAT_NUM_MAIN}>{formatKg(r.kg)}</TableCell>
                <TableCell className={STAT_NUM}>{r.count.toLocaleString('ko-KR')}</TableCell>
                <TableCell className={STAT_NUM}>{r.orders.toLocaleString('ko-KR')}</TableCell>
                <TableCell>
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
