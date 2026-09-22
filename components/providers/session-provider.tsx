"use client"

import { SessionProvider } from "next-auth/react"
import type { Session } from "next-auth"

// 🔴 초기 세션을 서버에서 받아 넘긴다.
// 안 넘기면 클라이언트가 마운트된 뒤 `/api/auth/session`을 네트워크로 가져올 때까지
// `useSession()`이 undefined를 준다. 그동안 `hasPermission(undefined, …)`은 false라
// **권한 있는 사용자에게도 권한 없는 화면이 먼저 그려진다**(규격 버튼·저장 푸터가 통째로 사라짐).
// 27개 화면이 useSession을 쓰는데 아무도 status==='loading'을 구분하지 않아
// 「권한 없음」과 「아직 모름」이 똑같이 그려지는 상태였다.
export function Providers({
    children,
    session,
}: {
    children: React.ReactNode
    session: Session | null
}) {
    return <SessionProvider session={session}>{children}</SessionProvider>
}
