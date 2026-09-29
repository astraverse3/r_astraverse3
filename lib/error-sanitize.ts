const SENSITIVE_PATTERNS = [
    /prisma/i,
    /\bP\d{4}\b/,           // Prisma error codes
    /DATABASE_URL/i,
    /postgres(ql)?:\/\//i,
    /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i,
    /at .+\(.+:\d+:\d+\)/,  // stack trace
    /C:\\|\/home\/|\/usr\/|\/tmp\//, // file system paths
    /pg_dump|psql/i,
]

// lib/auth-guard.ts가 던지는 오류. instanceof 대신 name으로 가린다 —
// auth-guard를 import하면 next-auth·prisma가 딸려와 이 파일을 테스트할 수 없다.
const GUARD_MESSAGES = new Map<string, string>([
    ['AuthError', '로그인이 만료됐어요. 새로고침 후 다시 로그인해 주세요.'],
    ['ForbiddenError', '이 작업을 할 권한이 없어요.'],
])

/** 권한·세션 오류면 그 이유를, 아니면 fallback을 돌려준다. 다른 오류 메시지는 노출하지 않는다. */
export function guardErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) return GUARD_MESSAGES.get(error.name) ?? fallback
    return fallback
}

export function sanitizeErrorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof Error)) return fallback
    const guardMsg = GUARD_MESSAGES.get(error.name)
    if (guardMsg) return guardMsg
    const msg = error.message || ''
    if (!msg) return fallback
    for (const p of SENSITIVE_PATTERNS) {
        if (p.test(msg)) return fallback
    }
    return msg
}
