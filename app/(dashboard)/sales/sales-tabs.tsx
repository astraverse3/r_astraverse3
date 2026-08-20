'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Package, Truck } from 'lucide-react'
import { SALES_TABS, DEFAULT_SALES_TAB, type SalesTabValue } from './sales-tab-constants'

// 제품판매 / 원물출고 2탭 (결정 #13). 제품판매=제품재고(MillingOutputPackage) 차감(발주서),
// 원물출고=원물(Stock) 차감(기존 출고).
// ⚠️ 탭 값·기본값은 sales-tab-constants.ts에 있다 — 여기(클라이언트 모듈)에서 export하면
//    서버 컴포넌트가 import할 때 값이 함수 참조로 바뀐다.
const ICONS: Record<SalesTabValue, typeof Package> = {
    product: Package,
    release: Truck,
}
const TABS = SALES_TABS.map((t) => ({ ...t, icon: ICONS[t.value] }))

export function SalesTabs({ activeTab }: { activeTab: SalesTabValue }) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const handleClick = (value: SalesTabValue) => {
        const params = new URLSearchParams()
        if (value !== DEFAULT_SALES_TAB) {
            params.set('tab', value)
        }
        const qs = params.toString()
        router.push(`/sales${qs ? `?${qs}` : ''}`)
    }

    // searchParams는 동일 탭 재클릭 시 라우터 push 디듀프용으로만 참조(현 미사용 방지)
    void searchParams

    return (
        <div className="px-3 sm:px-0">
            {/* 모바일: segmented control (2탭) */}
            <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-lg sm:hidden">
                {TABS.map(tab => {
                    const Icon = tab.icon
                    const active = activeTab === tab.value
                    return (
                        <button
                            key={tab.value}
                            onClick={() => handleClick(tab.value)}
                            className={`h-11 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                                active
                                    ? 'bg-white shadow-sm font-bold text-slate-900'
                                    : 'font-semibold text-slate-500'
                            }`}
                        >
                            <Icon className="w-4 h-4 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                            <span className="text-[13px]">{tab.label}</span>
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
