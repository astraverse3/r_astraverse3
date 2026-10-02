'use client'

import { StockBar, StockName, STOCK_PARTS } from './stock-tables'
import { formatKg, stockRateTone, type StockListRow } from './utils'

type Props = {
  rows: StockListRow[]
  /** 펼친 줄 — 한 번에 한 줄 */
  openKey: string | null
  onToggle: (key: string) => void
}

/**
 * 재고분석 모바일 두 줄 목록(작업지시 ⑫ A-1) — 판매분석 목록(sales-breakdown-list.tsx)과 같은 그리드.
 * 1줄: 순위 · 이름(생산자=작목반 / 작목반=인증) · 총 입고. 2줄: 세 갈래 막대(길이 = 그 줄 총 입고 100%) · [N명 · ]재고 N%.
 * 재고율은 숫자로도 보인다 — 주황 칸 길이가 같은 값이라 색만으로 판정하지 않는다.
 * 줄 전체를 누르면 세 갈래 kg를 펼친다.
 */
export function StockListMobile({ rows, openKey, onToggle }: Props) {
  return (
    <div>
      {rows.map((r, i) => {
        const open = openKey === r.key
        return (
          <div key={r.key} className={`border-b border-slate-100 last:border-b-0 ${open ? 'bg-slate-50' : ''}`}>
            <button
              type="button"
              onClick={() => onToggle(r.key)}
              aria-expanded={open}
              className="w-full text-left px-3 py-2.5 grid grid-cols-[20px_minmax(0,1fr)_auto] items-baseline gap-x-2"
            >
              <span className="text-right text-xs tabular-nums text-slate-500">{i + 1}</span>
              <StockName row={r} name="text-[13px] font-semibold text-slate-800" sub="text-[11px] text-slate-500" />
              <span className="text-[13px] font-bold tabular-nums text-slate-800 whitespace-nowrap">
                {formatKg(r.totalKg)}
                <span className="ml-0.5 text-[11px] font-medium text-slate-500">kg</span>
              </span>
              <span className="col-start-2 col-span-2 mt-1.5 flex items-center gap-2">
                <StockBar row={r} />
                <span className="text-[11px] tabular-nums text-slate-500 whitespace-nowrap">
                  {r.farmerCount != null && <>{r.farmerCount}명 · </>}
                  재고 <b className={`font-bold ${stockRateTone(r.stockRate)}`}>{r.stockRate.toFixed(1)}%</b>
                </span>
              </span>
            </button>
            {open && (
              <div className="px-3 pb-3 pl-[42px] grid grid-cols-3 gap-1.5">
                {STOCK_PARTS.map(p => (
                  <div key={p.key} className="bg-white rounded-lg border border-slate-200 px-2 py-1.5 min-w-0">
                    <p className="flex items-center gap-1 text-[11px] text-slate-500">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: p.color }} />
                      {p.label}
                    </p>
                    <p className="text-[13px] font-bold tabular-nums text-slate-800 truncate">
                      {formatKg(r[p.key])}
                      <span className="ml-0.5 text-[11px] font-medium text-slate-500">kg</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
