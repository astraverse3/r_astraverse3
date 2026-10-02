'use client'

// 원물출고 탭 상태 — 기간을 판매 탭과 따로 든다(기본 올해, 작업지시 ⑪ A-4). 필터는 기간뿐이다.

import { useState } from 'react'
import { toast } from 'sonner'
import { getRawReleaseStatistics, type RawReleaseStatisticsData } from '@/app/actions/raw-release-statistics'
import type { SalesPeriodPreset } from '@/lib/sales-period'
import { useSafeTransition } from '@/app/(dashboard)/use-safe-transition'
import { defaultRawDraft, withPreset, type PeriodDraft } from './utils'

export function useRawReleaseStats(initialData: RawReleaseStatisticsData, initialDraft: PeriodDraft, today: string) {
  const [data, setData] = useState(initialData)
  const [draft, setDraft] = useState(initialDraft)
  const [applied, setApplied] = useState(initialDraft)
  const [showSheet, setShowSheet] = useState(false)
  const [isPending, start] = useSafeTransition('원물출고 통계를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.')

  function run(next: PeriodDraft) {
    setShowSheet(false)
    start(async () => {
      const res = await getRawReleaseStatistics({ from: next.from, to: next.to })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      setData(res.data)
      setApplied(next)
      setDraft(next)
    })
  }

  return {
    data,
    draft,
    applied,
    showSheet,
    isPending,
    empty: data.summary.releases === 0,
    search: () => run(draft),
    reset: () => run(defaultRawDraft(today)),
    changeDates: (patch: { from?: string; to?: string }) => setDraft(d => ({ ...d, ...patch })),
    pickPreset: (preset: SalesPeriodPreset) => setDraft(d => withPreset(d, preset, today)),
    openSheet: () => {
      setDraft(applied)
      setShowSheet(true)
    },
    closeSheet: () => setShowSheet(false),
  }
}

export type RawReleaseStats = ReturnType<typeof useRawReleaseStats>
