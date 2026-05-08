// 권한 상수 정의
//
// 권한 매트릭스(단일 진실 원천): docs/permission-matrix.md
// 권한 변경 시 매트릭스 문서를 먼저 갱신한 뒤 코드 수정.
//
// 3-way 비즈니스 권한 (잡곡 #9.5, 2026-05-08 그림 B 채택):
//   - STOCK_MANAGE   = 들여오기 (원물 입고 + 잡곡 매입)
//   - MILLING_MANAGE = 가공     (벼 도정/포장 + 잡곡 포장)
//   - SALES_MANAGE   = 내보내기 (출고 + 향후 판매)

// 업무 권한: 페이지 조회는 누구나 가능, 등록/수정/삭제만 제어
export const BUSINESS_PERMISSIONS = {
    STOCK_MANAGE: { code: 'STOCK_MANAGE', label: '원물 관리', description: '원물 입고 등록/수정/삭제 + 잡곡 매입 등록/수정/삭제' },
    MILLING_MANAGE: { code: 'MILLING_MANAGE', label: '도정·포장 관리', description: '벼 도정 + 벼 포장 + 잡곡 포장 등록/수정/삭제' },
    SALES_MANAGE: { code: 'SALES_MANAGE', label: '판매 관리', description: '출고 + 향후 벼/잡곡 판매 등록/수정/삭제' },
    VARIETY_MANAGE: { code: 'VARIETY_MANAGE', label: '품종 관리', description: '품종 등록/수정/삭제' },
    FARMER_MANAGE: { code: 'FARMER_MANAGE', label: '생산자 관리', description: '생산자 등록/수정/삭제' },
} as const

// 관리 권한: 페이지 접근 자체를 제어
export const ADMIN_PERMISSIONS = {
    USER_MANAGE: { code: 'USER_MANAGE', label: '사용자 관리', description: '사용자 목록, 권한 변경' },
    SYSTEM_MANAGE: { code: 'SYSTEM_MANAGE', label: '시스템 관리', description: '백업/복구' },
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
