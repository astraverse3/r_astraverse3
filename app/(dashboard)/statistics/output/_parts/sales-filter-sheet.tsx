'use client'

import type { ReactNode } from 'react'
import { RotateCcw, Search, X } from 'lucide-react'
import type { MultiSelectOption } from '@/components/statistics/MultiSelectDropdown'
import { SALES_CHANNELS, SALES_CHANNEL_LABEL } from '@/lib/sales-stats'
import { SALES_PERIOD_PRESETS, type SalesPeriodPreset } from '@/lib/sales-period'
import { CATEGORY_OPTIONS, periodText, toggleIn, type SalesDraft } from './utils'

const DATE_INPUT =
  'px-2 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 border-0 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200'

type Props = {
  show: boolean
  onClose: () => void
  preset: SalesPeriodPreset
  from: string
  to: string
  onPreset: (preset: SalesPeriodPreset) => void
  onDates: (patch: { from?: string; to?: string }) => void
  isPending: boolean
  onReset: () => void
  onSearch: () => void
  /** 기간 아래 조건(곡종·채널·품종) — 원물출고 탭은 기간만이라 없다 */
  children?: ReactNode
}

/**
 * 모바일 검색 조건 시트 — 재고분석(stock-filter-sheet.tsx)과 같은 모양(작업지시 ⑪ A-3).
 * 🔴 바닥 오프셋은 그 시트를 베끼지 않았다: 그쪽 `3.5rem+8px`는 탭바(60px + mb-4 + safe)와 12px 겹친다(백로그 §36).
 * 여기는 탭바 위 8px — `60px + 1rem + safe + 8px`. max-h도 같은 값으로 맞춘다(오프셋만 고치면 시트가 화면 밖으로 자란다).
 */
export function SalesFilterSheet({ show, onClose, preset, from, to, onPreset, onDates, isPending, onReset, onSearch, children }: Props) {
  if (!show) return null
  return (
    <div className="md:hidden">
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed left-3 right-3 z-50 bottom-[calc(60px+1rem+env(safe-area-inset-bottom)+8px)] max-h-[calc(100dvh-52px-60px-1rem-env(safe-area-inset-bottom)-16px)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <h3 className="text-sm font-bold text-slate-800">검색 조건</h3>
          <button type="button" onClick={onClose} aria-label="닫기" className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3.5">
          <SheetSection label="기간">
            {SALES_PERIOD_PRESETS.map(p => (
              <SheetChip key={p.key} on={preset === p.key} onClick={() => onPreset(p.key)}>
                {p.label}
              </SheetChip>
            ))}
            {preset === 'custom' ? (
              <span className="basis-full mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                <input type="date" value={from} max={to} onChange={e => onDates({ from: e.target.value })} aria-label="시작일" className={DATE_INPUT} />
                ~
                <input type="date" value={to} min={from} onChange={e => onDates({ to: e.target.value })} aria-label="종료일" className={DATE_INPUT} />
              </span>
            ) : (
              <span className="basis-full mt-0.5 text-xs text-slate-500 tabular-nums">{periodText(from, to)}</span>
            )}
          </SheetSection>
          {children}
        </div>

        <div className="px-4 py-3 border-t border-slate-100 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onReset}
            disabled={isPending}
            className="h-11 px-4 flex items-center gap-1 rounded-lg bg-slate-100 text-slate-600 text-[13px] font-semibold disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            초기화
          </button>
          <button
            type="button"
            onClick={onSearch}
            disabled={isPending}
            className="flex-1 h-11 flex items-center justify-center gap-1 rounded-lg bg-blue-500 text-white text-[13px] font-semibold disabled:opacity-50"
          >
            <Search className="w-3.5 h-3.5" />
            검색
          </button>
        </div>
      </div>
    </div>
  )
}

type ConditionProps = {
  draft: SalesDraft
  onChange: (patch: Partial<SalesDraft>) => void
  varietyOptions: MultiSelectOption<number>[]
}

/** 판매 탭 조건 — PC 필터 줄(sales-filter-bar.tsx)과 같은 셋: 곡종 · 채널 · 품종(기간 안에 팔린 것) */
export function SalesConditionSections({ draft, onChange, varietyOptions }: ConditionProps) {
  return (
    <>
      <SheetSection label="곡종">
        {CATEGORY_OPTIONS.map(o => (
          <SheetChip key={o.id} on={draft.categories.includes(o.id)} onClick={() => onChange({ categories: toggleIn(draft.categories, o.id) })}>
            {o.label}
          </SheetChip>
        ))}
      </SheetSection>
      <SheetSection label="채널">
        {SALES_CHANNELS.map(c => (
          <SheetChip key={c} on={draft.channels.includes(c)} onClick={() => onChange({ channels: toggleIn(draft.channels, c) })}>
            {SALES_CHANNEL_LABEL[c]}
          </SheetChip>
        ))}
      </SheetSection>
      {varietyOptions.length > 0 && (
        <SheetSection label="품종">
          {varietyOptions.map(v => (
            <SheetChip key={v.id} on={draft.varietyIds.includes(v.id)} onClick={() => onChange({ varietyIds: toggleIn(draft.varietyIds, v.id) })}>
              {v.label}
            </SheetChip>
          ))}
        </SheetSection>
      )}
    </>
  )
}

export function SheetSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

export function SheetChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
        on ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  )
}
