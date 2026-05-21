'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Wheat, Sprout, type LucideIcon } from 'lucide-react'

export type PackageTab = 'rice' | 'misc'

interface PackagesTabsProps {
    activeTab: PackageTab
}

type TabSpec = {
    value: PackageTab
    label: string
    Icon: LucideIcon
}

const TABS: TabSpec[] = [
    { value: 'rice', label: '벼', Icon: Wheat },
    { value: 'misc', label: '잡곡', Icon: Sprout },
]

/**
 * 제품재고 벼/잡곡 탭 — 핸드오프 §4.1 F안.
 * raw-stocks-tabs와 동일 패턴이지만 탭 전환 시 도메인 필터(productionYear/varietyId 등) 모두 리셋.
 */
export function PackagesTabs({ activeTab }: PackagesTabsProps) {
    const router = useRouter()
    const pathname = usePathname()

    const setTab = (tab: PackageTab) => {
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
