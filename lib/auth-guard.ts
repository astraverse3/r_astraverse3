import { getServerSession, Session } from 'next-auth'
import { authOptions } from '@/auth'

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
    return session
}

export async function requireAdmin(): Promise<Session> {
    const session = await requireSession()
    // @ts-ignore
    if (session.user.role !== 'ADMIN') {
        throw new ForbiddenError('Forbidden: Admin only')
    }
    return session
}

export async function requirePermission(permission: string): Promise<Session> {
    const session = await requireSession()
    // @ts-ignore
    const role = session.user.role as string
    // @ts-ignore
    const permissions = (session.user.permissions as string[]) || []

    if (role === 'ADMIN') return session
    if (!permissions.includes(permission)) {
        throw new ForbiddenError(`Forbidden: missing permission "${permission}"`)
    }
    return session
}
