import { getServerSession, Session } from 'next-auth'
import { authOptions } from '@/auth'
import { isApprovedRole } from '@/lib/user-role'

export class AuthError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'AuthError'
    }
}

export class ForbiddenError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ForbiddenError'
    }
}

export async function requireSession(): Promise<Session> {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
        throw new AuthError('Unauthorized')
    }
    // 승인 대기(PENDING)·삭제된 사용자(REVOKED)는 세션이 있어도 막는다(백로그 §83).
    // requirePermission·requireAdmin도 여기를 거치므로 **모든 서버 액션이 자동으로 막힌다**
    if (!isApprovedRole(session.user.role)) {
        throw new AuthError('Pending approval')
    }
    return session
}

export async function requireAdmin(): Promise<Session> {
    const session = await requireSession()
    if (session.user.role !== 'ADMIN') {
        throw new ForbiddenError('Forbidden: Admin only')
    }
    return session
}

export async function requirePermission(permission: string): Promise<Session> {
    const session = await requireSession()
    const role = session.user.role as string
    const permissions = (session.user.permissions as string[]) || []

    if (role === 'ADMIN') return session
    if (!permissions.includes(permission)) {
        throw new ForbiddenError(`Forbidden: missing permission "${permission}"`)
    }
    return session
}
