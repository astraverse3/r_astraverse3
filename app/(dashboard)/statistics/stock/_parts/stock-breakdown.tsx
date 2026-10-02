'use client'

// 재고분석 탭별 표 카드 — 정렬(입고순/미처리순)·더 보기를 PC 표와 모바일 목록이 같은 상태로 쓴다(작업지시 ⑫ A-1).
// 부모가 탭마다 key를 바꿔 넘겨서, 탭을 바꾸면 처음(입고순 · 상위 20 · 다 접힘)으로 돌아간다.

import { useMemo, useState } from 'react'
import { ShowAllRow } from '@/components/statistics/ShowAllRow'
import { STAT_TABLE_CARD } from '@/components/statistics/table-styles'
import { StockListHead, StockTable } from './stock-tables'
import { StockListMobile } from './stock-list-mobile'
import { STOCK_LIMIT, STOCK_TAB_META, sortStockRows, type StockListRow, type StockSort, type StockTab } from './utils'

export function StockBreakdown({ tab, rows }: { tab: StockTab; rows: StockListRow[] }) {
  const [sort, setSort] = useState<StockSort>('total')
  const [showAll, setShowAll] = useState(false)
  // 모바일에서 펼친 줄 — 한 번에 한 줄
  const [openKey, setOpenKey] = useState<string | null>(null)
  const sorted = useMemo(() => sortStockRows(rows, sort), [rows, sort])
  const shown = showAll ? sorted : sorted.slice(0, STOCK_LIMIT)

  return (
    <div className={`${STAT_TABLE_CARD} mb-2`}>
      <StockListHead tab={tab} total={rows.length} sort={sort} onSort={setSort} />
      <div className="hidden md:block">
        <StockTable tab={tab} rows={shown} />
      </div>
      <div className="md:hidden">
        <StockListMobile rows={shown} openKey={openKey} onToggle={k => setOpenKey(o => (o === k ? null : k))} />
      </div>
      <ShowAllRow hidden={sorted.length - shown.length} onShowAll={() => setShowAll(true)} unit={STOCK_TAB_META[tab].unit} />
    </div>
  )
}
