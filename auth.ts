import { NextAuthOptions, type User } from "next-auth"
import KakaoProvider from "next-auth/providers/kakao"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { USER_ROLE } from "@/lib/user-role"

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
        KakaoProvider({
            clientId: process.env.KAKAO_CLIENT_ID!,
            clientSecret: process.env.KAKAO_CLIENT_SECRET!,
            profile(profile) {
                return {
                    id: profile.id.toString(),
                    name: profile.kakao_account?.profile?.nickname,
                    email: profile.kakao_account?.email,
                    image: profile.kakao_account?.profile?.profile_image_url,
                    // 첫 로그인은 승인 대기 — 관리자가 사용자 관리에서 승인해야 쓸 수 있다(백로그 §83).
                    // 🔴 사용자를 만드는 경로는 여기뿐이라 DB 기본값("USER")은 바꾸지 않았다(마이그레이션 회피)
                    role: USER_ROLE.PENDING
                    // permissions·department·position은 DB 기본값에 맡긴다(어댑터가 사용자 생성)
                } as User
            },
        }),
    ],
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/login",
    },
    callbacks: {
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string
                // 역할이 비면 승인 안 된 것으로 본다 — 예전엔 "USER"로 채워 줬다(§83)
                session.user.role = token.role as string || USER_ROLE.PENDING
                session.user.permissions = (token.permissions as string[]) || []
                session.user.department = (token.department as string | null) || null
                session.user.position = (token.position as string | null) || null
            }
            return session
        },
        async signIn({ user }) {
            // 사용자 로그인 시도/성공 시 호출
            try {
                if (user && user.id) {
                    await prisma.auditLog.create({
                        data: {
                            action: 'LOGIN',
                            entity: 'System',
                            entityId: String(user.id),
                            userId: String(user.id),
                            userName: user.name || '알 수 없음',
                            userEmail: user.email || '',
                            description: '사용자 시스템 로그인',
                            ip: 'Internal' // NextAuth 콜백 내부에서 IP 파악이 어려우므로 Internal 처리 (또는 생략)
                        }
                    })
                }
            } catch (e) {
                console.error("Failed to record login audit:", e)
            }
            return true
        },
        async jwt({ token, user }) {
            if (user) {
                // 최초 로그인 시 기본 세팅
                token.id = String(user.id)
                token.role = user.role
                token.department = user.department || null
                token.position = user.position || null
            }

            // 매 요청마다 DB에서 최신 역할/정보 동기화
            if (token.id) {
                const dbUser = await prisma.user.findUnique({
                    where: { id: String(token.id) },
                    select: { role: true, permissions: true, department: true, position: true }
                })
                if (dbUser) {
                    token.role = dbUser.role
                    token.permissions = dbUser.permissions || []
                    token.department = dbUser.department || null
                    token.position = dbUser.position || null
                } else {
                    // 삭제된 사용자 — 예전엔 옛 역할·권한을 그대로 둬서 **계속 쓸 수 있었다**(§83 S3).
                    // REVOKED는 토큰 전용 값이다. 가드(requireSession)·레이아웃이 받아 막는다
                    token.role = USER_ROLE.REVOKED
                    token.permissions = []
                }
            }

            return token
        }
    },
    debug: process.env.NODE_ENV === 'development',
}
