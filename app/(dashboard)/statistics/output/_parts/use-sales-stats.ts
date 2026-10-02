'use client'

// 판매 탭 상태 — 부모(sales-stats-client.tsx)가 들고 있어서 원물출고 탭을 다녀와도 조회 조건이 남는다.
// 화면 조각(sales-panel.tsx)은 이 값을 받아 그리기만 한다.

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getSalesStatistics, type SalesStatisticsData } from '@/app/actions/sales-statistics'
import type { SalesPeriodPreset } from '@/lib/sales-period'
import { useSafeTransition } from '@/app/(dashboard)/use-safe-transition'
import { defaultDraft, withPreset, type SalesDraft } from './utils'

export function useSalesStats(initialData: SalesStatisticsData, initialDraft: SalesDraft, today: string) {
  const [data, setData] = useState(initialData)
  const [draft, setDraft] = useState(initialDraft)
  const [applied, setApplied] = useState(initialDraft)
  // 거래처 「더 보기」 — 탭을 바꾸거나 다시 조회하면 다시 접는다
  const [showAll, setShowAll] = useState(false)
  const [showSheet, setShowSheet] = useState(false)
  const [isPending, start] = useSafeTransition('판매 통계를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.')

  const varietyOptions = useMemo(
    () => data.varietyOptions.map(v => ({ id: v.id, label: v.name })),
    [data.varietyOptions],
  )

  function run(next: SalesDraft) {
    setShowSheet(false)
    start(async () => {
      const { from, to, categories, channels, varietyIds } = next
      const res = await getSalesStatistics({ from, to, categories, channels, varietyIds })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      setData(res.data)
      setApplied(next)
      setDraft(next)
      setShowAll(false)
    })
  }

  return {
    data,
    draft,
    applied,
    showAll,
    showSheet,
    isPending,
    varietyOptions,
    empty: data.summary.count === 0,
    run,
    search: () => run(draft),
    reset: () => run(defaultDraft(today)),
    change: (patch: Partial<SalesDraft>) => setDraft(d => ({ ...d, ...patch })),
    pickPreset: (preset: SalesPeriodPreset) => setDraft(d => withPreset(d, preset, today)),
    expand: () => setShowAll(true),
    collapse: () => setShowAll(false),
    openSheet: () => {
      setDraft(applied) // 시트는 지금 조회된 조건에서 시작한다
      setShowSheet(true)
    },
    closeSheet: () => setShowSheet(false),
  }
}

export type SalesStats = ReturnType<typeof useSalesStats>
