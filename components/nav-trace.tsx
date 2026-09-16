'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { describeElement, record, recordRoute, flushTrace } from '@/lib/nav-trace'

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
    if (!el || depth > 3) return null
    return {
        tagName: el.tagName,
        isContentEditable: el.isContentEditable,
        trace: el.dataset?.trace ?? null,
        text: el.textContent,
        parent: toDescribable(el.parentElement, depth + 1),
    }
}
