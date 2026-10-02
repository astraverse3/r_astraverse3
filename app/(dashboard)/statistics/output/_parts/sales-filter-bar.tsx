'use client'

import { ChevronDown, RotateCcw, Search, X } from 'lucide-react'
import { MultiSelectDropdown, type MultiSelectOption } from '@/components/statistics/MultiSelectDropdown'
import { SALES_CHANNELS, SALES_CHANNEL_LABEL, type SalesChannel } from '@/lib/sales-stats'
import { SALES_PERIOD_PRESETS, type SalesPeriodPreset } from '@/lib/sales-period'
import { CATEGORY_OPTIONS, periodText, toggleIn, type PeriodDraft, type SalesDraft } from './utils'

const CHANNEL_OPTIONS: MultiSelectOption<SalesChannel>[] = SALES_CHANNELS.map(c => ({ id: c, label: SALES_CHANNEL_LABEL[c] }))

const DATE_INPUT =
  'px-2 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 border-0 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200'

type BarProps = {
  draft: SalesDraft
  onChange: (patch: Partial<SalesDraft>) => void
  onPreset: (preset: SalesPeriodPreset) => void
  varietyOptions: MultiSelectOption<number>[]
  isPending: boolean
  onReset: () => void
  onSearch: () => void
}

/** PC 인라인 필터 — 재고분석(stock-stats-client.tsx)과 같은 틀. 조회는 「검색」을 눌러야 한다 */
export function SalesFilterBar({ draft, onChange, onPreset, varietyOptions, isPending, onReset, onSearch }: BarProps) {
  return (
    <div className="px-4 py-3 flex flex-wrap items-center gap-2">
      <PeriodPicker period={draft} onPreset={onPreset} onDates={onChange} />

      <MultiSelectDropdown
        options={CATEGORY_OPTIONS}
        selected={draft.categories}
        onToggle={id => onChange({ categories: toggleIn(draft.categories, id) })}
        placeholder="곡종"
        activeClass="bg-amber-50 text-amber-700"
        emptyLabel="(전체)"
        minWidth={120}
      />
      <MultiSelectDropdown
        options={CHANNEL_OPTIONS}
        selected={draft.channels}
        onToggle={id => onChange({ channels: toggleIn(draft.channels, id) })}
        placeholder="채널"
        activeClass="bg-blue-50 text-blue-600"
        emptyLabel="(전체)"
        minWidth={140}
      />
      <MultiSelectDropdown
        options={varietyOptions}
        selected={draft.varietyIds}
        onToggle={id => onChange({ varietyIds: toggleIn(draft.varietyIds, id) })}
        placeholder="품종"
        activeClass="bg-green-50 text-green-700"
        emptyLabel="(전체)"
        minWidth={140}
      />

      <SearchButtons isPending={isPending} onReset={onReset} onSearch={onSearch} />
    </div>
  )
}

type PeriodPickerProps = {
  period: PeriodDraft
  onPreset: (preset: SalesPeriodPreset) => void
  onDates: (patch: { from?: string; to?: string }) => void
}

/** 기간 프리셋 + (직접 지정이면) 날짜 두 칸 — 판매·원물출고 탭 공용 */
export function PeriodPicker({ period, onPreset, onDates }: PeriodPickerProps) {
  return (
    <>
      <div className="relative">
        <select
          value={period.preset}
          onChange={e => onPreset(e.target.value as SalesPeriodPreset)}
          aria-label="기간"
          className="appearance-none pl-3 pr-8 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 border-0 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
        >
          {SALES_PERIOD_PRESETS.map(p => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
      </div>

      {period.preset === 'custom' ? (
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <input type="date" value={period.from} max={period.to} onChange={e => onDates({ from: e.target.value })} aria-label="시작일" className={DATE_INPUT} />
          ~
          <input type="date" value={period.to} min={period.from} onChange={e => onDates({ to: e.target.value })} aria-label="종료일" className={DATE_INPUT} />
        </span>
      ) : (
        <span className="text-xs text-slate-500 tabular-nums">{periodText(period.from, period.to)}</span>
      )}
    </>
  )
}

type SearchButtonsProps = { isPending: boolean; onReset: () => void; onSearch: () => void }

export function SearchButtons({ isPending, onReset, onSearch }: SearchButtonsProps) {
  return (
    <div className="ml-auto flex items-center gap-1.5">
      <button
        type="button"
        onClick={onReset}
        disabled={isPending}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-50"
      >
        <RotateCcw className="w-3 h-3" />
        초기화
      </button>
      <button
        type="button"
        onClick={onSearch}
        disabled={isPending}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
      >
        <Search className="w-3 h-3" />
        검색
      </button>
    </div>
  )
}

type ChipsProps = {
  applied: SalesDraft
  varietyName: (id: number) => string
  onRemove: (patch: Partial<SalesDraft>) => void
}

const CHIP = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors'
export const CHIPS_ROW = 'px-4 py-2 border-t border-slate-50 flex flex-wrap items-center gap-1.5 min-h-[2.5rem]'

/** 조회에 쓰인 기간 — 늘 보인다 */
export function PeriodChip({ period }: { period: PeriodDraft }) {
  const label = SALES_PERIOD_PRESETS.find(p => p.key === period.preset)?.label
  return (
    <span className={`${CHIP} bg-slate-100 text-slate-600`}>
      {period.preset === 'custom' ? '' : `${label} · `}
      {periodText(period.from, period.to)}
    </span>
  )
}

/** 조회에 쓰인 조건 — 기간은 늘 보이고, 나머지는 눌러서 빼면 바로 다시 조회한다 */
export function SalesAppliedChips({ applied, varietyName, onRemove }: ChipsProps) {
  return (
    <div className={CHIPS_ROW}>
      <PeriodChip period={applied} />
      {applied.categories.map(c => (
        <button key={c} type="button" onClick={() => onRemove({ categories: applied.categories.filter(x => x !== c) })} className={`${CHIP} bg-amber-50 text-amber-700 hover:bg-amber-100`}>
          {CATEGORY_OPTIONS.find(o => o.id === c)?.label}
          <X className="w-3 h-3" />
        </button>
      ))}
      {applied.channels.map(c => (
        <button key={c} type="button" onClick={() => onRemove({ channels: applied.channels.filter(x => x !== c) })} className={`${CHIP} bg-blue-50 text-blue-700 hover:bg-blue-100`}>
          {SALES_CHANNEL_LABEL[c]}
          <X className="w-3 h-3" />
        </button>
      ))}
      {applied.varietyIds.map(id => (
        <button key={id} type="button" onClick={() => onRemove({ varietyIds: applied.varietyIds.filter(x => x !== id) })} className={`${CHIP} bg-green-50 text-green-700 hover:bg-green-100`}>
          {varietyName(id)}
          <X className="w-3 h-3" />
        </button>
      ))}
    </div>
  )
}
