import { STOCK_COLORS } from '@/components/statistics/StockChart'
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
import { STOCK_TAB_META, formatKg, stockRateTone, type StockListRow, type StockSort, type StockTab } from './utils'

// 재고분석 표 — 판매분석 틀(순위 · 상위 20 + 더 보기)에 재고의 세 갈래(작업지시 ⑫ A-1 ⑤).
// 숫자는 계열 색을 칠하지 않고(slate) 머리글 앞 차트 색 네모로 범례와 잇는다(B-2). 판정 색은 재고율 글자에만(B-3).

/** 세 갈래 — 차트와 같은 순서·색 */
export const STOCK_PARTS = [
  { key: 'consumedKg', label: '도정완료', color: STOCK_COLORS.consumed },
  { key: 'releasedKg', label: '직접출고', color: STOCK_COLORS.released },
  { key: 'availableKg', label: '미처리', color: STOCK_COLORS.available },
] as const

function CertBadge({ certType }: { certType: string }) {
  const style =
    certType === '유기농' ? 'bg-green-100 text-green-700' :
    certType === '무농약' ? 'bg-blue-100 text-blue-700' :
    'bg-slate-100 text-slate-500'
  return (
    <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${style}`}>{certType}</span>
  )
}

/** 구성 막대 — 길이 = 그 줄 총 입고 100%(1위 대비가 아니다). 칸 사이 흰 1px */
export function StockBar({ row }: { row: StockListRow }) {
  return (
    <span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden flex">
      {STOCK_PARTS.map(p => row[p.key] > 0 && (
        <span
          key={p.key}
          className="h-full border-r border-white last:border-r-0"
          style={{ width: `${row.totalKg > 0 ? (row[p.key] / row.totalKg) * 100 : 0}%`, backgroundColor: p.color }}
        />
      ))}
    </span>
  )
}

/** 범례 — 차트 카드(ChartLegend)와 모바일 목록 머리 */
export function StockLegend({ small = false }: { small?: boolean }) {
  return (
    <div className={`flex items-center ${small ? 'gap-3 text-[11px]' : 'gap-4 text-xs'} text-slate-500`}>
      {STOCK_PARTS.map(p => (
        <span key={p.key} className="flex items-center gap-1.5">
          <span className={`${small ? 'w-2 h-2' : 'w-3 h-3'} rounded-sm inline-block`} style={{ backgroundColor: p.color }} />
          {p.label}
        </span>
      ))}
    </div>
  )
}

export function ChartLegend() {
  return <StockLegend />
}

/** 이름 칸 — 생산자는 뒤에 작목반, 작목반은 뒤에 인증 */
export function StockName({ row, sub = STAT_SUB }: { row: StockListRow; sub?: string }) {
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      <span className={`truncate ${STAT_NAME}`}>{row.name}</span>
      {row.cert && <CertBadge certType={row.cert} />}
      {row.group && <span className={`truncate ${sub}`}>{row.group}</span>}
    </span>
  )
}

type HeadProps = { tab: StockTab; total: number; sort: StockSort; onSort: (s: StockSort) => void }

/** 표 카드 맨 위 도구 줄 — PC는 「총 입고 많은 순 · N명」, 모바일은 범례. 정렬 토글은 둘 다(같은 상태) */
export function StockListHead({ tab, total, sort, onSort }: HeadProps) {
  return (
    <div className="px-3 md:px-4 py-2 border-b border-slate-100 flex items-center justify-between gap-2">
      <span className="md:hidden">
        <StockLegend small />
      </span>
      <span className="hidden md:inline text-xs text-slate-500">
        {sort === 'total' ? '총 입고 많은 순' : '미처리 많은 순'} ·{' '}
        <b className="font-semibold text-slate-700 tabular-nums">
          {total.toLocaleString('ko-KR')}
          {STOCK_TAB_META[tab].unit}
        </b>
      </span>
      <span className="inline-flex p-0.5 rounded-lg bg-slate-100 text-xs font-semibold shrink-0">
        {([['total', '입고순'], ['available', '미처리순']] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => onSort(k)}
            className={`px-2.5 h-7 rounded-md transition-colors ${
              sort === k ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </span>
    </div>
  )
}

/** PC 표 — 순위 · 이름 · (생산자수) · 총 입고 · 세 갈래 · 재고율 · 구성 */
export function StockTable({ tab, rows }: { tab: StockTab; rows: StockListRow[] }) {
  const isGroup = tab === 'group'
  return (
    <div className="overflow-x-auto">
      <Table className={STAT_TABLE} style={{ minWidth: isGroup ? '860px' : '780px' }}>
        <TableHeader>
          <TableRow className={STAT_HEAD_ROW}>
            <TableHead className={`${STAT_HEAD} w-12 text-right`}>순위</TableHead>
            <TableHead className={STAT_HEAD}>{STOCK_TAB_META[tab].column}</TableHead>
            {isGroup && <TableHead className={`${STAT_HEAD} text-right`}>생산자</TableHead>}
            <TableHead className={`${STAT_HEAD} text-right`}>총 입고 (kg)</TableHead>
            {STOCK_PARTS.map(p => (
              <TableHead key={p.key} className={`${STAT_HEAD} text-right`}>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.color }} />
                  {p.label}
                </span>
              </TableHead>
            ))}
            <TableHead className={`${STAT_HEAD} text-right`}>재고율</TableHead>
            <TableHead className={`${STAT_HEAD} ${isGroup ? 'w-[18%]' : 'w-[22%]'}`}>구성</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.key}>
              <TableCell className={STAT_RANK}>{i + 1}</TableCell>
              <TableCell className="max-w-[260px]">
                <StockName row={r} />
              </TableCell>
              {isGroup && <TableCell className={STAT_NUM}>{r.farmerCount}명</TableCell>}
              <TableCell className={STAT_NUM_MAIN}>{formatKg(r.totalKg)}</TableCell>
              {STOCK_PARTS.map(p => (
                <TableCell key={p.key} className={STAT_NUM}>{formatKg(r[p.key])}</TableCell>
              ))}
              <TableCell className={`text-right tabular-nums font-semibold ${stockRateTone(r.stockRate)}`}>
                {r.stockRate.toFixed(1)}%
              </TableCell>
              <TableCell>
                <span className="flex">
                  <StockBar row={r} />
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
