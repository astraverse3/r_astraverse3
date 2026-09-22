'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { describeElement, record, recordRoute, flushTrace, stackHint } from '@/lib/nav-trace'

/**
 * 네비게이션 덫 — 전역 리스너. UI가 없다(화면에 아무것도 그리지 않는다).
 *
 * 🔴 **원인이 확정되면 걷어낸다.** 계획서 `docs/plan/plan-네비게이션-덫.md` §7.
 *
 * 🔴 **이벤트를 절대 삼키지 않는다** — 덫이 증상을 가려버리면 잡을 게 없어진다(§8.2).
 * 모든 리스너는 `passive: true` + capture, 핸들러 안에서는 읽기만 한다.
 */
export function NavTrace() {
    const pathname = usePathname()
    const prevPath = useRef<string | null>(null)

    // 눌린 요소 기록 — 「무엇을 눌렀나」가 용의자 A·B·C를 가르는 핵심.
    useEffect(() => {
        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as HTMLElement | null
            record('pointer', describeElement(toDescribable(target)), Math.round(e.clientX), Math.round(e.clientY))
        }

        // 뒤로가기가 들어왔는지 — **pointer 기록 없이 이것만 있으면 용의자 D**.
        // 🔴 capture로 등록한다 — bubble로 붙였더니 Next가 popstate를 먼저 처리해
        // 화면 갱신(route 기록)이 111ms 앞서버렸다(2026-09-16 실측). 원인이 결과보다 뒤에 찍히면
        // 경로 변경 줄에 「직전 뒤로가기」를 못 박는다.
        const onPopState = () => {
            record('popstate', `현재 ${location.pathname}`)
            flushTrace() // 이 직후 화면이 바뀌므로 즉시 내린다
        }

        // reloadOnOnline(기본 켜짐)이 전체 새로고침을 일으킬 수 있는 시점
        const onOnline = () => {
            record('online', '네트워크 복귀')
            flushTrace()
        }

        const onVisibility = () => {
            record('visibility', document.visibilityState)
            flushTrace() // 앱이 숨겨질 때 확실히 저장
        }

        /*
         * 🔴 **클라이언트 라우팅이 지나가는 목을 지킨다** — 호출 지점을 미리 고르지 않는다.
         *
         * 2026-09-22 실측: 튄 2건의 직전 신호가 `<input 입력칸>`(8.3초 전)·`<span>`(1.0초 전)이라
         * **용의자 A·B·C 어느 것도 아니었다.** 하나씩 계측하는 방식은 계측 안 한 자리로 빠져나간다.
         * Next App Router는 어떤 경로로 옮겨가든 history API를 거치므로 여기서 감싸면 구멍이 없다.
         *
         * 🔴 **원본을 반드시 부르고 반환값을 그대로 넘긴다**(원칙 1) — 삼키면 앱이 멈춘다.
         * 🔴 기록이 실패해도 라우팅은 진행된다(원칙 2) — record는 try 안에 둔다.
         */
        const origPush = history.pushState
        const origReplace = history.replaceState
        // `this`를 쓰지 않는다 — 쓰면 React Compiler가 이 함수를 건너뛴다. history.pushState는
        // 늘 history에 묶여 호출되므로 수신자를 직접 적어도 동작이 같다.
        const watch = (name: string, orig: typeof history.pushState) =>
            (...args: Parameters<typeof history.pushState>) => {
                try {
                    const url = args[2]
                    record('push', `history.${name} → ${url ?? '(url 없음)'} · ${stackHint(new Error().stack)}`)
                } catch {
                    // 무시 — 덫이 앱을 방해하지 않는다
                }
                return orig.apply(history, args)
            }
        history.pushState = watch('pushState', origPush)
        history.replaceState = watch('replaceState', origReplace)

        window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true })
        window.addEventListener('popstate', onPopState, { capture: true })
        window.addEventListener('online', onOnline)
        document.addEventListener('visibilitychange', onVisibility)

        // 이번 로드가 새로고침인지 일반 진입인지 — reloadOnOnline 발동 여부를 사후에 안다
        try {
            const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
            record('load', `${location.pathname} · ${nav?.type ?? 'unknown'}`)
        } catch {
            record('load', location.pathname)
        }

        // 조용해지면 내려쓴다 — 매 이벤트마다 localStorage를 때리지 않기 위해(§4.2)
        const idle = setInterval(flushTrace, 1000)

        return () => {
            window.removeEventListener('pointerdown', onPointerDown, { capture: true })
            window.removeEventListener('popstate', onPopState, { capture: true })
            window.removeEventListener('online', onOnline)
            document.removeEventListener('visibilitychange', onVisibility)
            clearInterval(idle)
            history.pushState = origPush
            history.replaceState = origReplace
            flushTrace()
        }
    }, [])

    // 경로 변경 — 덫이 노리는 바로 그 사건
    useEffect(() => {
        const from = prevPath.current
        prevPath.current = pathname
        if (from === null || from === pathname) return
        recordRoute(from, pathname)
        flushTrace()
    }, [pathname])

    return null
}

/**
 * DOM 요소를 `describeElement`가 읽는 순수 구조로 옮긴다.
 * 여기서 **입력칸의 값은 애초에 꺼내지 않는다** — `textContent`는 버튼 라벨용이고,
 * `input`은 `describeElement`가 값 대신 종류만 남기도록 먼저 걸러낸다(§4.1).
 */
function toDescribable(el: HTMLElement | null, depth = 0): Parameters<typeof describeElement>[0] {
    // 🔴 깊이 제한이 **두 곳**에 있었다(여기와 `describeElement`의 maxDepth) — 한쪽만 풀면
    // 효과가 없다. 3단계로는 행 전체를 감싼 링크가 `<span>`으로 뭉개져, 2026-09-22 기록의
    // 「직전 `<span>`」이 링크였는지조차 가릴 수 없었다.
    if (!el || depth > 12) return null
    return {
        tagName: el.tagName,
        isContentEditable: el.isContentEditable,
        trace: el.dataset?.trace ?? null,
        // getAttribute를 쓴다 — `el.href`는 절대 URL이라 로그가 길어진다
        href: el.getAttribute?.('href') ?? null,
        text: el.textContent,
        parent: toDescribable(el.parentElement, depth + 1),
    }
}
