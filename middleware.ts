import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

// 보호할 라우트와 공개 라우트 설정
export default withAuth(
    function middleware(req) {
        // 사용자가 로그인한 상태에서 로그인 페이지로 가려고 하면 대시보드로 리다이렉트
        if (req.nextUrl.pathname === "/login") {
            return NextResponse.redirect(new URL("/", req.url))
        }
    },
    {
        callbacks: {
            authorized: ({ req, token }) => {
                // /login 경로는 누구나 접근 가능
                if (req.nextUrl.pathname.startsWith("/login")) {
                    return true
                }
                // 그 외의 모든 경로는 로그인(토큰 존재) 상태여야 접근 가능
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
