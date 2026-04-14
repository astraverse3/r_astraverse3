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

export function sanitizeErrorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof Error)) return fallback
    const msg = error.message || ''
    if (!msg) return fallback
    for (const p of SENSITIVE_PATTERNS) {
        if (p.test(msg)) return fallback
    }
    return msg
}
