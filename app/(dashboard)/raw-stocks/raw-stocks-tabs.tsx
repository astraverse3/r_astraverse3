'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Wheat, Sprout, type LucideIcon } from 'lucide-react'

export type RawStockTab = 'rice' | 'misc'

interface RawStocksTabsProps {
    activeTab: RawStockTab
}

type TabSpec = {
    value: RawStockTab
    label: string
    Icon: LucideIcon
}

const TABS: TabSpec[] = [
    { value: 'rice', label: '벼', Icon: Wheat },
    { value: 'misc', label: '잡곡', Icon: Sprout },
]

/**
 * 벼/잡곡 탭 — 핸드오프 §4.1 F안 (애니메이션 하이라이트).
 *  - 활성: 텍스트 진해짐 + 폰트 14px, 아이콘 scale-110·strokeWidth=2.4
 *  - 비활성: 텍스트 13px·아이콘 scale-100·strokeWidth=1.8
 *  - 슬라이드 바는 항상 absolute로 존재하되 opacity transition으로 토글
 *  - 탭 전환 시 도메인-특화 필터 모두 리셋 (벼/잡곡 의미 다름)
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
        <div className="flex items-center gap-1 border-b border-slate-200 pb-0">
            {TABS.map(({ value, label, Icon }) => {
                const on = activeTab === value
                return (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setTab(value)}
                        className={`relative inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold transition-all duration-200 ${
                            on ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <Icon
                            className={`w-3.5 h-3.5 transition-transform duration-300 ${on ? 'scale-110' : 'scale-100'}`}
                            strokeWidth={on ? 2.4 : 1.8}
                        />
                        <span className={`transition-all ${on ? 'text-[14px]' : 'text-[13px]'}`}>{label}</span>
                        <span
                            className={`absolute left-2 right-2 bottom-[-1px] h-[2.5px] rounded-full transition-all ${
                                on ? 'bg-slate-900 opacity-100' : 'bg-transparent opacity-0'
                            }`}
                        />
                    </button>
                )
            })}
        </div>
    )
}
