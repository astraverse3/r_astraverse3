'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import {
    readTrace,
    readRouteTrace,
    clearTrace,
    clusterByRoute,
    causeOfCluster,
    isSuspectCause,
    isSuspectRoute,
    CAUSE_LABEL,
    formatEntry,
    type TraceEntry,
} from '@/lib/nav-trace'

/**
 * 네비게이션 덫 보기 화면 — 기록은 **이 폰 안에만** 있다(localStorage). 서버로 안 나간다.
 *
 * 🔴 원인이 확정되면 이 화면째 걷어낸다. `docs/plan/plan-네비게이션-덫.md` §7.
 */
export function TraceView() {
    const [entries, setEntries] = useState<TraceEntry[]>([])
    const [routes, setRoutes] = useState<TraceEntry[]>([])
    const [loaded, setLoaded] = useState(false)

    const load = () => {
        setEntries(readTrace())
        setRoutes(readRouteTrace())
        setLoaded(true)
    }

    // localStorage는 서버에서 못 읽는다 — 마운트 후에 읽어야 하이드레이션이 어긋나지 않는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(load, [])

    const clusters = clusterByRoute(entries, 5)
    // 일반 버퍼에서 이미 밀려난 경로 변경 — 별도 슬롯에만 남은 것들
    const orphanRoutes = routes.filter((r) => !entries.some((e) => e.t === r.t))

    const handleCopy = async () => {
        const text = [
            `# 네비게이션 덫 기록 (복사 시각 ${new Date().toLocaleString('ko-KR')})`,
            '',
            '## 경로 변경 (별도 보관)',
            ...routes.map(formatEntry),
            '',
            '## 전체 기록',
            ...entries.map(formatEntry),
        ].join('\n')
        try {
            await navigator.clipboard.writeText(text)
            toast.success('기록을 복사했습니다.')
        } catch {
            toast.error('복사에 실패했습니다. 화면을 캡처해 주세요.')
        }
    }

    const handleClear = async () => {
        if (!(await confirmDialog({
            description: '기록을 모두 지웁니다. 아직 원인을 못 찾았다면 지우지 마세요.',
            destructive: true,
            confirmText: '지우기',
        }))) return
        clearTrace()
        load()
        toast.success('기록을 지웠습니다.')
    }

    if (!loaded) return null

    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
                <p className="font-bold">임시 계측입니다</p>
                <p className="mt-1 leading-relaxed">
                    「원물재고에서 도정목록으로 튐」의 원인을 잡기 위한 기록이에요.
                    기록은 이 기기 안에만 저장되고 서버로 나가지 않으며, <strong>입력한 글자는 저장하지 않습니다</strong>.
                    원인이 확인되면 이 화면은 없어집니다.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={load}>새로고침</Button>
                <Button size="sm" variant="outline" onClick={handleCopy} disabled={entries.length === 0}>
                    텍스트로 복사
                </Button>
                <Button size="sm" variant="ghost" onClick={handleClear} className="text-red-500 hover:text-red-700">
                    지우기
                </Button>
                <span className="ml-auto text-xs text-slate-500 tabular-nums">
                    전체 {entries.length}건 · 경로변경 {routes.length}건
                </span>
            </div>

            {entries.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                    아직 기록이 없습니다. 앱을 평소처럼 쓰다가 화면이 튀면 여기로 와서 확인하세요.
                </p>
            )}

            {clusters.length > 0 && (
                <section className="space-y-3">
                    <h2 className="text-sm font-bold text-slate-700">화면이 바뀐 순간</h2>
                    <p className="text-xs text-slate-500">
                        굵은 줄이 <strong>경로 변경</strong>이고, 그 위아래가 앞뒤로 일어난 일이에요.
                        빨간 <strong>원인 불명</strong>·<strong>뒤로가기</strong>가 찾는 것이고,
                        <strong>클릭</strong>은 직접 눌러서 간 정상 이동입니다.
                    </p>
                    {clusters.map((c) => {
                        const cause = causeOfCluster(c)
                        const suspect = isSuspectCause(cause)
                        // 경로는 맞는데 원인이 설명되는 경우 — 정상 이동이다(빨갛게 칠하지 않는다)
                        const onSuspectPath = isSuspectRoute(
                            c.route.detail.split(' → ')[0] ?? '',
                            c.route.detail.split(' → ')[1] ?? '',
                        )
                        return (
                            <div
                                key={c.route.t}
                                className={`rounded-lg border p-3 ${suspect ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}
                            >
                                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                    <Badge
                                        variant={suspect ? 'default' : 'secondary'}
                                        className={suspect ? 'bg-red-600 text-white' : ''}
                                    >
                                        {CAUSE_LABEL[cause]}
                                    </Badge>
                                    {onSuspectPath && (
                                        <Badge variant="outline" className="border-amber-400 text-amber-700">
                                            원물재고 → 도정목록
                                        </Badge>
                                    )}
                                </div>
                                <ol className="space-y-1 font-mono text-[11px] leading-relaxed">
                                    {c.before.map((e) => (
                                        <li key={e.t} className="text-slate-500 break-all">{formatEntry(e)}</li>
                                    ))}
                                    <li className="font-bold text-slate-900 break-all">{formatEntry(c.route)}</li>
                                    {/* 뒤로가기는 화면 갱신보다 늦게 찍힌다 — 아래에 붙는다 */}
                                    {c.after.map((e) => (
                                        <li key={e.t} className="text-slate-500 break-all">↳ {formatEntry(e)}</li>
                                    ))}
                                </ol>
                            </div>
                        )
                    })}
                </section>
            )}

            {orphanRoutes.length > 0 && (
                <section className="space-y-2">
                    <h2 className="text-sm font-bold text-slate-700">오래된 경로 변경</h2>
                    <p className="text-xs text-slate-500">
                        전체 기록에서는 밀려났지만 따로 보관해 둔 것들이에요. 앞뒤 상황은 남아 있지 않습니다.
                    </p>
                    <ol className="space-y-1 rounded-lg border border-slate-200 bg-white p-3 font-mono text-[11px]">
                        {orphanRoutes.map((e) => (
                            <li key={e.t} className="break-all text-slate-600">{formatEntry(e)}</li>
                        ))}
                    </ol>
                </section>
            )}

            {entries.length > 0 && (
                <details className="rounded-lg border border-slate-200 bg-white p-3">
                    <summary className="cursor-pointer text-sm font-bold text-slate-700">전체 기록 {entries.length}건</summary>
                    <ol className="mt-2 space-y-1 font-mono text-[11px]">
                        {[...entries].reverse().map((e) => (
                            <li key={e.t} className="break-all text-slate-600">{formatEntry(e)}</li>
                        ))}
                    </ol>
                </details>
            )}
        </div>
    )
}
