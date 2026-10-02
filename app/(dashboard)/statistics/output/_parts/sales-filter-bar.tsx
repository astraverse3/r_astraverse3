'use client'

import { ChevronDown, RotateCcw, Search, X } from 'lucide-react'
import { MultiSelectDropdown, type MultiSelectOption } from '@/components/statistics/MultiSelectDropdown'
import { SALES_CHANNELS, SALES_CHANNEL_LABEL, type SalesChannel } from '@/lib/sales-stats'
import { SALES_PERIOD_PRESETS, type SalesPeriodPreset } from '@/lib/sales-period'
import { CATEGORY_OPTIONS, periodText, toggleIn, type SalesDraft } from './utils'

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
      <div className="relative">
        <select
          value={draft.preset}
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

      {draft.preset === 'custom' ? (
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <input type="date" value={draft.from} max={draft.to} onChange={e => onChange({ from: e.target.value })} aria-label="시작일" className={DATE_INPUT} />
          ~
          <input type="date" value={draft.to} min={draft.from} onChange={e => onChange({ to: e.target.value })} aria-label="종료일" className={DATE_INPUT} />
        </span>
      ) : (
        <span className="text-xs text-slate-500 tabular-nums">{periodText(draft.from, draft.to)}</span>
      )}

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
    </div>
  )
}

type ChipsProps = {
  applied: SalesDraft
  varietyName: (id: number) => string
  onRemove: (patch: Partial<SalesDraft>) => void
}

const CHIP = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors'

/** 조회에 쓰인 조건 — 기간은 늘 보이고, 나머지는 눌러서 빼면 바로 다시 조회한다 */
export function SalesAppliedChips({ applied, varietyName, onRemove }: ChipsProps) {
  const label = SALES_PERIOD_PRESETS.find(p => p.key === applied.preset)?.label
  return (
    <div className="px-4 py-2 border-t border-slate-50 flex flex-wrap items-center gap-1.5 min-h-[2.5rem]">
      <span className={`${CHIP} bg-slate-100 text-slate-600`}>
        {applied.preset === 'custom' ? '' : `${label} · `}
        {periodText(applied.from, applied.to)}
      </span>
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
