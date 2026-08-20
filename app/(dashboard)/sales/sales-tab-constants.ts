// 판매관리 탭 상수 — **서버·클라이언트 공용이라 'use client' 파일에 두면 안 된다.**
//
// 이전에는 이 상수들이 `sales-tabs.tsx`('use client')에 있었고 서버 컴포넌트 page.tsx가
// 거기서 import했다. Next.js는 클라이언트 모듈의 export를 서버에서 가져갈 때 실제 값이 아니라
// **클라이언트 참조(함수)** 로 바꾸기 때문에 `tab === 'product'` 비교가 항상 false가 되어
// 두 탭 모두 렌더되지 않았다(2026-08-20 발견 — /sales 본문이 통째로 빈 화면).

export const SALES_TABS = [
    { value: 'product', label: '제품판매' },
    { value: 'release', label: '원물출고' },
] as const

export type SalesTabValue = (typeof SALES_TABS)[number]['value']

/** 기본 탭 = 제품판매. tab 파라미터가 없거나 알 수 없는 값이면 이 탭. */
export const DEFAULT_SALES_TAB: SalesTabValue = 'product'

export const VALID_SALES_TABS: SalesTabValue[] = ['product', 'release']

export function resolveSalesTab(raw: unknown): SalesTabValue {
    return typeof raw === 'string' && (VALID_SALES_TABS as string[]).includes(raw)
        ? (raw as SalesTabValue)
        : DEFAULT_SALES_TAB
}
