// 권한 상수 정의
//
// 권한 매트릭스(단일 진실 원천): docs/permission-matrix.md
// 권한 변경 시 매트릭스 문서를 먼저 갱신한 뒤 코드 수정.
//
// 2-way 비즈니스 권한 (권한 단순화, 2026-06-22):
//   - SUPPLY_MANAGE    = 원물·마스터 (원물 입고·잡곡 매입 + 품종·생산자 마스터)
//   - OPERATION_MANAGE = 가공·판매   (도정·포장 + 출고·판매·발주서·제품유형)
// 구 키 STOCK/MILLING/SALES/VARIETY/FARMER_MANAGE 폐기 → 위 2개로 통합.
// 구 USER/SYSTEM_MANAGE 폐기 → ADMIN role 전용(사용자·백업·로그·설정).

// 업무 권한: 페이지 조회는 누구나 가능, 등록/수정/삭제만 제어
export const BUSINESS_PERMISSIONS = {
    SUPPLY_MANAGE: { code: 'SUPPLY_MANAGE', label: '원물·마스터 관리', description: '원물 입고·잡곡 매입 + 품종·생산자 마스터 등록/수정/삭제' },
    OPERATION_MANAGE: { code: 'OPERATION_MANAGE', label: '가공·판매 관리', description: '도정·포장 + 출고·판매·발주서 차감·제품유형 등록/수정/삭제' },
} as const

// 관리 권한: 페이지 접근 자체를 제어 (사용자·시스템은 ADMIN role 전용 → 키 없음)
export const ADMIN_PERMISSIONS = {
    NOTICE_MANAGE: { code: 'NOTICE_MANAGE', label: '공지사항 관리', description: '대시보드 전광판 공지 등록/수정/삭제' },
} as const

// 전체 권한 목록
export const ALL_PERMISSIONS = {
    ...BUSINESS_PERMISSIONS,
    ...ADMIN_PERMISSIONS,
} as const

export type PermissionCode = keyof typeof ALL_PERMISSIONS

// 권한 체크 헬퍼
export function hasPermission(
    user: { role?: string; permissions?: string[] } | null | undefined,
    permission: PermissionCode
): boolean {
    if (!user) return false
    // ADMIN은 모든 권한 자동 보유
    if (user.role === 'ADMIN') return true
    return user.permissions?.includes(permission) ?? false
}

// 여러 권한 중 하나라도 있으면 true
export function hasAnyPermission(
    user: { role?: string; permissions?: string[] } | null | undefined,
    permissions: PermissionCode[]
): boolean {
    if (!user) return false
    if (user.role === 'ADMIN') return true
    return permissions.some(p => user.permissions?.includes(p))
}
