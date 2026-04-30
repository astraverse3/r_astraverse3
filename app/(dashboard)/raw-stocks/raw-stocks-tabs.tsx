'use client'

import { useRouter, usePathname } from 'next/navigation'

export type RawStockTab = 'rice' | 'misc'

interface RawStocksTabsProps {
    activeTab: RawStockTab
}

/**
 * 벼/잡곡 탭 — 핸드오프 §4.1 F안 (애니메이션 하이라이트).
 *  - 활성: text-slate-900 + 폰트 살짝 커짐 + 아래 2.5px 바
 *  - 비활성: text-slate-400, hover 시 slate-600
 *  - 탭 전환 시 도메인-특화 필터 모두 리셋
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
        <div className="relative inline-flex items-end border-b border-slate-200">
            <TabButton label="벼" active={activeTab === 'rice'} onClick={() => setTab('rice')} />
            <TabButton label="잡곡" active={activeTab === 'misc'} onClick={() => setTab('misc')} />
        </div>
    )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`relative inline-flex items-center gap-1.5 px-3.5 py-2 font-semibold transition-all duration-200 ${
                active
                    ? 'text-slate-900 text-[14px]'
                    : 'text-slate-400 hover:text-slate-600 text-[13px]'
            }`}
        >
            {label}
            {active && (
                <span className="absolute left-2 right-2 bottom-[-1px] h-[2.5px] bg-slate-900 rounded-full" />
            )}
        </button>
    )
}
