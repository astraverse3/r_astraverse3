'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Wheat, Sprout, Truck } from 'lucide-react'

const TABS = [
    { value: 'rice', label: '벼', icon: Wheat, badge: '준비중' },
    { value: 'misc', label: '잡곡', icon: Sprout, badge: '준비중' },
    { value: 'release', label: '출고', icon: Truck, badge: null as string | null },
] as const

export type SalesTabValue = (typeof TABS)[number]['value']

export function SalesTabs({ activeTab }: { activeTab: SalesTabValue }) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const handleClick = (value: SalesTabValue) => {
        const params = new URLSearchParams()
        if (value !== 'release') {
            params.set('tab', value)
        }
        const qs = params.toString()
        router.push(`/sales${qs ? `?${qs}` : ''}`)
    }

    return (
        <div className="px-3 sm:px-0">
            {/* 모바일: segmented control (3탭, 배지는 칩 없이 축소) */}
            <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100 rounded-lg sm:hidden">
                {TABS.map(tab => {
                    const Icon = tab.icon
                    const active = activeTab === tab.value
                    return (
                        <button
                            key={tab.value}
                            onClick={() => handleClick(tab.value)}
                            className={`h-11 rounded-md flex items-center justify-center gap-1 transition-all ${
                                active
                                    ? 'bg-white shadow-sm font-bold text-slate-900'
                                    : 'font-semibold text-slate-500'
                            }`}
                        >
                            <Icon className="w-4 h-4 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                            <span className="text-[13px]">{tab.label}</span>
                            {tab.badge && (
                                <span className="text-[9px] font-medium text-slate-400">{tab.badge}</span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* 데스크탑: underline 탭 */}
            <div className="hidden sm:block border-b border-slate-200">
                <div className="flex items-center gap-1">
                    {TABS.map(tab => {
                        const Icon = tab.icon
                        const active = activeTab === tab.value
                        return (
                            <button
                                key={tab.value}
                                onClick={() => handleClick(tab.value)}
                                className={`relative inline-flex items-center gap-1.5 px-3.5 py-2 font-semibold transition-all duration-200 ${
                                    active
                                        ? 'text-slate-900 text-[14px]'
                                        : 'text-slate-400 hover:text-slate-600 text-[13px]'
                                }`}
                            >
                                <Icon
                                    className={`w-3.5 h-3.5 transition-transform duration-200 ${active ? 'scale-110' : ''}`}
                                    strokeWidth={1.8}
                                />
                                {tab.label}
                                {tab.badge && (
                                    <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 bg-slate-100 rounded">
                                        {tab.badge}
                                    </span>
                                )}
                                {active && (
                                    <span className="absolute left-2 right-2 bottom-[-1px] h-[2.5px] bg-slate-900 rounded-full" />
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
