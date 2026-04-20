import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

// /admin/* 경로별 필요 권한 매핑 (ADMIN은 모든 경로 통과)
// permission === null 인 경우 ADMIN 전용
const ADMIN_ROUTE_PERMISSIONS: Array<{ prefix: string; permission: string | null }> = [
    { prefix: "/admin/varieties", permission: "VARIETY_MANAGE" },
    { prefix: "/admin/farmers", permission: "FARMER_MANAGE" },
    { prefix: "/admin/users", permission: "USER_MANAGE" },
    { prefix: "/admin/notices", permission: "NOTICE_MANAGE" },
    { prefix: "/admin/logs", permission: "SYSTEM_MANAGE" },
    { prefix: "/admin/backup", permission: "SYSTEM_MANAGE" },
    { prefix: "/admin/settings", permission: null },
]

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token
        const pathname = req.nextUrl.pathname

        // 로그인 상태에서 /login 진입 시 홈으로
        if (pathname === "/login") {
            return NextResponse.redirect(new URL("/", req.url))
        }

        // /admin/* 경로별 권한 체크
        if (pathname.startsWith("/admin")) {
            // @ts-ignore
            const role = token?.role as string | undefined
            // @ts-ignore
            const permissions = (token?.permissions as string[] | undefined) || []

            // ADMIN은 모든 관리 경로 통과
            if (role === "ADMIN") return

            // 매핑 테이블에서 가장 구체적인 prefix 매칭 탐색
            const matched = ADMIN_ROUTE_PERMISSIONS.find(r => pathname.startsWith(r.prefix))

            if (matched) {
                // ADMIN 전용 경로인데 ADMIN이 아님 → 홈으로
                if (matched.permission === null) {
                    return NextResponse.redirect(new URL("/", req.url))
                }
                // 필요한 권한 미보유 → 홈으로
                if (!permissions.includes(matched.permission)) {
                    return NextResponse.redirect(new URL("/", req.url))
                }
            }
            // 매칭 없는 /admin 하위(/admin 루트 등)는 세션만 있으면 통과
        }
    },
    {
        callbacks: {
            authorized: ({ req, token }) => {
                if (req.nextUrl.pathname.startsWith("/login")) {
                    return true
                }
                return !!token
            },
        },
        pages: {
            signIn: "/login",
        },
    }
)

export const config = {
    // 미들웨어를 적용할 경로 설정
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api/auth (auth endpoints)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (images, manifest, sw.js, etc)
         */
        "/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.json|icon-.*|logo-.*|sw\\.js|workbox-.*).*)",
    ],
}
