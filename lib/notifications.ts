// 헤더 알림(종) 1단계 — 작업지시 ⑥ · 백로그 §83 2단계
//
// 🔴 저장하지 않는다. 요청 때마다 지금 상태를 보고 계산하고, 해결되면 저절로 사라진다(읽음 개념 없음).
//    저장형 알림·쪽지는 백로그 §90.
// 대시보드 레이아웃(서버)에서만 부른다 — 'use server' 액션이 아니다. 클라이언트가 직접 부를 입구를 만들지 않는다.
// 클라이언트(header-bell)는 타입만 가져간다.

import { countPendingUsers } from '@/app/actions/user'
import { USER_ROLE } from '@/lib/user-role'

/** 알림 한 종류. 새 종류는 kind를 늘린다 */
export type HeaderNotification = { kind: 'pending-users'; count: number; href: string }

export type HeaderNotifications = {
    /** 알림이 하나라도 **있을 수 있는** 사람인가 — false면 종을 안 그린다(1단계는 ADMIN만) */
    eligible: boolean
    /** count가 0인 항목은 넣지 않는다 */
    items: HeaderNotification[]
}

export async function getHeaderNotifications(role: string | undefined): Promise<HeaderNotifications> {
    if (role !== USER_ROLE.ADMIN) return { eligible: false, items: [] }

    // 실패하면 0 — 헤더 뱃지 하나 때문에 화면 전체를 깨뜨리지 않는다(countPendingUsers가 삼킨다)
    const pending = await countPendingUsers()
    const items: HeaderNotification[] = []
    if (pending > 0) items.push({ kind: 'pending-users', count: pending, href: '/admin/users' })
    return { eligible: true, items }
}
