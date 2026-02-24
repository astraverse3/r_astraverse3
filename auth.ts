import { NextAuthOptions } from "next-auth"
import KakaoProvider from "next-auth/providers/kakao"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

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
                    role: "USER"
                } as any
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
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                session.user.id = token.id as string
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                session.user.role = token.role as string || "USER"
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                session.user.department = (token.department as string | null) || null
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                session.user.position = (token.position as string | null) || null
            }
            return session
        },
        async jwt({ token, user }) {
            if (user) {
                // 최초 로그인 시 기본 세팅
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                token.id = String(user.id)
                token.role = user.role
                token.department = user.department || null
                token.position = user.position || null
            }

            // 매 요청마다 DB에서 최신 역할/정보 동기화
            if (token.id) {
                const dbUser = await prisma.user.findUnique({
                    where: { id: String(token.id) },
                    select: { role: true, department: true, position: true }
                })
                if (dbUser) {
                    token.role = dbUser.role
                    token.department = dbUser.department || null
                    token.position = dbUser.position || null
                }
            }

            return token
        }
    },
    debug: true,
}
