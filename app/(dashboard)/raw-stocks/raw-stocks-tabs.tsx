'use client'

import { useRouter, usePathname } from 'next/navigation'

export type RawStockTab = 'rice' | 'misc'

interface RawStocksTabsProps {
    activeTab: RawStockTab
}

/**
 * 벼/잡곡 탭 토글.
 * 탭 전환 시 도메인-특화 필터를 모두 리셋한다 — 벼/잡곡 필터 의미가 달라
 * 잘못된 상태로 노출될 위험이 더 큼.
 */
export function RawStocksTabs({ activeTab }: RawStocksTabsProps) {
    const router = useRouter()
    const pathname = usePathname()

    const setTab = (tab: RawStockTab) => {
        const params = new URLSearchParams()
        if (tab === 'misc') params.set('tab', 'misc')
        const qs = params.toString()
        router.push(qs ? `${pathname}?${qs}` : pathname)
    }

    return (
        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
                type="button"
                onClick={() => setTab('rice')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'rice'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                }`}
            >
                벼
            </button>
            <button
                type="button"
                onClick={() => setTab('misc')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'misc'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                }`}
            >
                잡곡
            </button>
        </div>
    )
}
