'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

export type MultiSelectOption<T extends string | number> = {
  id: T
  label: string
}

type Props<T extends string | number> = {
  options: MultiSelectOption<T>[]
  selected: T[]
  onToggle: (id: T) => void
  placeholder: string
  /** 활성(선택값 있음) 시 트리거 버튼에 적용되는 클래스. 기본: 파랑 */
  activeClass?: string
  /** 최대 선택 개수. 초과 시 미선택 옵션이 비활성화된다 */
  maxSelect?: number
  /** maxSelect 안내 텍스트 (옵션 목록 상단에 표시) */
  maxSelectHint?: string
  /** 지정 시 옵션 목록 하단에 "전체 해제" 버튼이 노출된다 */
  onClearAll?: () => void
  /** 드롭다운 최소 너비 (px). 기본 160 */
  minWidth?: number
  /** 선택된 항목이 없을 때 placeholder 뒤에 붙는 텍스트. 예: "(전체)" */
  emptyLabel?: string
}

export function MultiSelectDropdown<T extends string | number>({
  options,
  selected,
  onToggle,
  placeholder,
  activeClass = 'bg-blue-50 text-blue-600',
  maxSelect,
  maxSelectHint,
  onClearAll,
  minWidth = 160,
  emptyLabel,
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isActive = selected.length > 0

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 pl-3 pr-2 py-1.5 text-xs font-semibold rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer whitespace-nowrap transition-colors ${
          isActive ? activeClass : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
      >
        {isActive
          ? `${placeholder} (${selected.length})`
          : emptyLabel ? `${placeholder} ${emptyLabel}` : placeholder}
        <ChevronDown className="w-3 h-3 ml-0.5" />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-20 bg-white rounded-xl shadow-lg border border-slate-100 py-1 max-h-[280px] overflow-y-auto"
          style={{ minWidth }}
        >
          {maxSelect !== undefined && maxSelectHint && (
            <p className="px-3 pt-1.5 pb-1 text-[10px] text-slate-400">
              {maxSelectHint}
            </p>
          )}

          {options.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-400">항목 없음</p>
          )}

          {options.map(opt => {
            const isSelected = selected.includes(opt.id)
            const isDisabled =
              maxSelect !== undefined && !isSelected && selected.length >= maxSelect

            return (
              <label
                key={String(opt.id)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs whitespace-nowrap ${
                  isDisabled
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-700 hover:bg-slate-50 cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => !isDisabled && onToggle(opt.id)}
                  className="w-3.5 h-3.5 rounded accent-blue-500 shrink-0"
                />
                {opt.label}
              </label>
            )
          })}

          {onClearAll && selected.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-50 border-t border-slate-50 mt-1"
            >
              전체 해제
            </button>
          )}
        </div>
      )}
    </div>
  )
}
