// 사용자 역할 — 가입 승인제(백로그 §83)의 단일 원천.
//
// 의존성 없는 순수 모듈이다(auth-guard를 import하면 next-auth·prisma가 딸려와 테스트할 수 없다).
// 🔴 스키마는 안 바꿨다 — `User.role`은 String이고 기본값은 여전히 "USER"다. 새 사용자는
//    카카오 `profile()`(auth.ts)이 PENDING을 직접 넣어 만든다. 사용자를 만드는 경로는 그것뿐이다.

export const USER_ROLE = {
    ADMIN: 'ADMIN',
    USER: 'USER',
    /** 첫 로그인 · 관리자 승인 대기 */
    PENDING: 'PENDING',
    /** DB에서 지워진 사용자의 남은 세션 — **토큰 전용 값, DB엔 저장하지 않는다**(auth.ts jwt 콜백) */
    REVOKED: 'REVOKED',
} as const

/**
 * 앱을 쓸 수 있는 역할인가 — **허용 목록**이다. PENDING·REVOKED뿐 아니라 모르는 값·빈 값도 막는다.
 * 서버 가드(`requireSession`)·대시보드 레이아웃·`/pending`이 모두 이 함수를 쓴다.
 */
export function isApprovedRole(role: string | null | undefined): boolean {
    return role === USER_ROLE.ADMIN || role === USER_ROLE.USER
}
