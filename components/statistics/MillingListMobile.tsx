'use client'

// 수율분석 모바일 두 줄 목록 — 작업지시 ⑫ A-2. 정렬·데이터는 PC 표(MillingTable)의 TanStack 상태를 같이 쓴다.
// 1줄: 날짜 mm-dd · 도정종류 · 품종 | 수율 배지. 2줄: 생산자 | 투입 → 생산 kg(생산만 굵게). 비고는 펼쳐서.
// 줄 전체가 터치 하나다 — 한 줄에 작은 숫자 버튼 둘을 두면 잘못 누른다. 펼치면 투입·포장 팝업 버튼(h-11).

import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react'
import type { SortingState } from '@tanstack/react-table'
import type { TableRow } from '@/app/actions/statistics'
import { getYieldLevel, YIELD_BADGE_CLASS } from '@/lib/milling-yield'
import { useYieldRates } from '@/app/(dashboard)/yield-rates-context'

const kg = (v: number) => v.toLocaleString('ko-KR', { maximumFractionDigits: 1 })

/** 「김영수 외 3명」 — PC 표와 같은 줄임 */
export function farmersSummary(farmers: string): string {
  const list = farmers.split(', ').map(s => s.trim()).filter(Boolean)
  if (list.length > 1) return `${list[0]} 외 ${list.length - 1}명`
  return list[0] ?? '-'
}

/** 모바일 정렬 칩 — 같은 칩을 다시 누르면 방향이 바뀐다. 기본은 날짜 내림차순 */
const MOBILE_SORTS = [
  { id: 'date', label: '날짜' },
  { id: 'yieldRate', label: '수율' },
  { id: 'outputKg', label: '생산량' },
] as const

export function MobileSortChips({ sorting, onSort }: { sorting: SortingState; onSort: (id: string) => void }) {
  const current = sorting[0]
  return (
    <span className="inline-flex p-0.5 rounded-lg bg-slate-100 text-xs font-semibold">
      {MOBILE_SORTS.map(s => {
        const on = current?.id === s.id
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSort(s.id)}
            className={`px-2.5 h-7 flex items-center gap-0.5 rounded-md transition-colors ${
              on ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
            }`}
          >
            {s.label}
            {on && (current.desc ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
          </button>
        )
      })}
    </span>
  )
}

type Props = {
  /** 정렬된 줄 중 보일 만큼(앞에서부터) */
  rows: TableRow[]
  openId: number | null
  onToggle: (id: number) => void
  onInput: (row: TableRow) => void
  onOutput: (row: TableRow) => void
}

export function MillingListMobile({ rows, openId, onToggle, onInput, onOutput }: Props) {
  const yieldRates = useYieldRates()
  return (
    <div>
      {rows.map(r => {
        const open = openId === r.id
        const level = r.yieldRate > 0
          ? getYieldLevel(r.yieldRate, r.millingType, yieldRates, r.stockDetails?.[0]?.varietyType)
          : null
        return (
          <div key={r.id} className={`border-b border-slate-100 last:border-b-0 ${open ? 'bg-slate-50' : ''}`}>
            <button
              type="button"
              onClick={() => onToggle(r.id)}
              aria-expanded={open}
              className="w-full text-left px-3 py-2.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1"
            >
              <span className="min-w-0 flex items-center gap-1.5">
                <span className="font-mono text-xs tabular-nums text-slate-600">{r.date.slice(5)}</span>
                <span className="shrink-0 px-1.5 py-0.5 rounded border border-primary/30 bg-primary/5 text-primary text-[11px] font-bold">
                  {r.millingType}
                </span>
                <span className="truncate text-[13px] font-semibold text-slate-800">{r.varieties}</span>
              </span>
              {level ? (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${YIELD_BADGE_CLASS[level]}`}>
                  {Math.round(r.yieldRate)}%
                </span>
              ) : (
                <span className="text-xs text-slate-400">-</span>
              )}
              <span className="truncate text-xs text-slate-500">{farmersSummary(r.farmers)}</span>
              <span className="text-xs tabular-nums text-slate-600 whitespace-nowrap">
                {kg(r.inputKg)} <span className="text-slate-500">→</span>{' '}
                <b className="font-semibold text-slate-800">{r.outputKg > 0 ? kg(r.outputKg) : '-'}</b>
                <span className="ml-0.5 text-[11px] text-slate-500">kg</span>
              </span>
            </button>
            {open && (
              <div className="px-3 pb-3 flex flex-col gap-1.5">
                {r.remarks && (
                  <p className="text-xs text-slate-600 bg-white rounded-lg border border-slate-200 px-2.5 py-2">{r.remarks}</p>
                )}
                <div className="grid grid-cols-2 gap-1.5">
                  <PopupButton label="투입 톤백" count={`${r.stockDetails.length}개`} onClick={() => onInput(r)} />
                  <PopupButton
                    label="포장 내역"
                    count={`${r.outputDetails.length}건`}
                    onClick={() => onOutput(r)}
                    disabled={r.outputDetails.length === 0}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

type PopupButtonProps = { label: string; count: string; onClick: () => void; disabled?: boolean }

// 시안은 「투입 원물 N포대」였지만 이 앱에서 원물 단위는 톤백이다(투입 팝업도 「총 N개 톤백」)
function PopupButton({ label, count, onClick, disabled }: PopupButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-11 rounded-lg border border-slate-200 bg-white px-2.5 flex items-center justify-between gap-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
    >
      <span className="min-w-0 truncate">
        {label} <span className="font-normal text-slate-500 tabular-nums">{count}</span>
      </span>
      <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-500" />
    </button>
  )
}
