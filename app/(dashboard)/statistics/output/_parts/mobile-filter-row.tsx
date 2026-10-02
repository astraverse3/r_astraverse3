import type { ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { SALES_PERIOD_PRESETS, type SalesPeriodPreset } from '@/lib/sales-period'
import { shortPeriodText } from './utils'

type Props = {
  preset: SalesPeriodPreset
  from: string
  to: string
  today: string
  /** 걸린 조건 종류 수 — 원물출고 탭은 기간만이라 0 */
  count: number
  onOpen: () => void
  excel: ReactNode
}

/**
 * 모바일 필터 카드 한 줄 — 「기간 라벨 · 날짜 · [조건 N] · 엑셀」(작업지시 ⑪ A-3).
 * 조건은 시트에서 고른다. 적용 조건 칩 줄은 모바일에 두지 않는다.
 */
export function MobileFilterRow({ preset, from, to, today, count, onOpen, excel }: Props) {
  const label = SALES_PERIOD_PRESETS.find(p => p.key === preset)?.label
  return (
    <div className="md:hidden px-3 py-2.5 flex items-center gap-2">
      <span className="shrink-0 text-xs font-semibold text-slate-700">{label}</span>
      <span className="min-w-0 truncate text-xs tabular-nums text-slate-500">{shortPeriodText(from, to, today)}</span>
      <button
        type="button"
        onClick={onOpen}
        className="ml-auto shrink-0 flex items-center gap-1 h-8 px-2.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        조건
        {count > 0 && (
          <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-white text-[11px] tabular-nums flex items-center justify-center">
            {count}
          </span>
        )}
      </button>
      <div className="shrink-0 flex">{excel}</div>
    </div>
  )
}
