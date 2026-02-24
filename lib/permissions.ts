// 권한 상수 정의

// 업무 권한: 페이지 조회는 누구나 가능, 등록/수정/삭제만 제어
export const BUSINESS_PERMISSIONS = {
    STOCK_MANAGE: { code: 'STOCK_MANAGE', label: '재고 관리', description: '입고 등록/수정/삭제, 출고' },
    MILLING_MANAGE: { code: 'MILLING_MANAGE', label: '도정 관리', description: '도정 등록/수정/삭제' },
    VARIETY_MANAGE: { code: 'VARIETY_MANAGE', label: '품종 관리', description: '품종 등록/수정/삭제' },
    FARMER_MANAGE: { code: 'FARMER_MANAGE', label: '생산자 관리', description: '생산자 등록/수정/삭제' },
} as const

// 관리 권한: 페이지 접근 자체를 제어
export const ADMIN_PERMISSIONS = {
    USER_MANAGE: { code: 'USER_MANAGE', label: '사용자 관리', description: '사용자 목록, 권한 변경' },
    SYSTEM_MANAGE: { code: 'SYSTEM_MANAGE', label: '시스템 관리', description: '백업/복구' },
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
