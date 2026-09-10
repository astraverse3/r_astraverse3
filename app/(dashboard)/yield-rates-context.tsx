'use client'

import { createContext, useContext, ReactNode } from 'react'
import { DEFAULT_YIELD_RATES } from '@/lib/settings-constants'

// 관리자 설정(`/admin/settings`)의 도정구분별 수율 기준값을 화면에 공급한다.
//
// 기준값을 쓰는 자리(대시보드 최근내역 · 도정목록 PC/모바일 · 통계 테이블)가 전부
// 클라이언트 컴포넌트라 DB를 직접 못 읽는다. 페이지마다 props로 내리면 /milling이
// page → wrapper → list-client → row/card로 4단계가 되므로, 소비 화면이 모두 속한
// (dashboard) layout에서 **서버에서 한 번만** 읽어 Provider로 내려준다.

const YieldRatesContext = createContext<Record<string, number>>(DEFAULT_YIELD_RATES)

export function YieldRatesProvider({
    rates,
    children,
}: {
    rates: Record<string, number>
    children: ReactNode
}) {
    return (
        <YieldRatesContext.Provider value={rates}>
            {children}
        </YieldRatesContext.Provider>
    )
}

/**
 * 도정구분별 수율 기준값을 읽는다.
 * Provider 밖에서 호출되면 기본 상수를 돌려준다 — 통계 컴포넌트가 (dashboard) 그룹
 * 밖에서 재사용되더라도 색이 깨지지 않고 하드코딩 시절과 같은 기준으로 동작한다.
 */
export function useYieldRates(): Record<string, number> {
    return useContext(YieldRatesContext)
}
