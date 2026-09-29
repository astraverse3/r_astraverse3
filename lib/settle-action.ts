// 서버 액션 호출이 reject될 때 — 세션 만료(middleware가 액션 POST를 로그인으로 돌린다) ·
// 배포 직후 열려 있던 탭(「Server Action을 찾을 수 없음」) · 폰 네트워크 끊김 · try 없는 액션의 throw.
// 🔴 서버를 아무리 고쳐도 앞의 셋은 reject로 온다. 받는 쪽에 catch가 없으면 로딩이 영영 안 풀린다.

export const CONNECTION_ERROR = '서버와 연결이 끊겼어요. 새로고침 후 다시 시도해 주세요.'

export type SettledFailure = { success: false; error: string }

/**
 * reject를 실패 결과로 바꾼다 — 호출부의 기존 `!res.success` 분기가 그대로 받는다.
 * `{ success, error }` 모양을 돌려주는 액션에만 쓴다(숫자·목록을 바로 주는 액션은 `.catch`로 따로).
 */
export function settle<T>(promise: Promise<T>): Promise<T | SettledFailure> {
    return promise.catch((error: unknown) => {
        console.error('[settle] action rejected:', error)
        return { success: false as const, error: CONNECTION_ERROR }
    })
}
