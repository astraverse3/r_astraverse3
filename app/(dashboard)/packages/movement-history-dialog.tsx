'use client'

// 차감 이력 다이얼로그 (계획서 D6 · 시안 #2)
//
// 🔴 되돌리기 가능 여부는 **`MovementRow.cancellable`만** 본다 — 서버가 같은 규칙으로
// 거부한다. `fromRepack`/`fromOrder`는 막힌 이유의 **문구를 고르는 용도로만** 쓴다.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { History, Loader2, Lock, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { triggerDataUpdate } from '@/components/last-updated'
import {
    cancelMovement,
    listMovements,
    type MovementRow,
    type RepackResultSummary,
} from '@/app/actions/package-movement'
import type { PackageRow } from '@/app/actions/packages'
import { REPACK_CANCEL_BLOCKED } from '@/lib/package-guard'
import { MOVEMENT_TYPE_LABEL } from '@/lib/movement-label'

const ORDER_CANCEL_BLOCKED = '발주서 차감은 발주서 상세에서 취소해주세요.'

/** 결과를 몇 종까지 펼칠지 — 넘으면 「외 N종」으로 접어 행 높이를 지킨다. */
const REPACK_RESULT_MAX = 3

/** `10kg × 4 · 잔량 3kg × 1` — 규격 × 개수 (`describeDeduction`과 같은 어법). */
function formatRepackResults(results: RepackResultSummary[]): string {
    const shown = results.slice(0, REPACK_RESULT_MAX).map(r => `${r.label} × ${r.count}`).join(' · ')
    const rest = results.length - REPACK_RESULT_MAX
    return rest > 0 ? `${shown} 외 ${rest}종` : shown
}

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** 이력을 볼 행 — null이면 렌더만 하고 아무것도 안 한다 */
    row: PackageRow | null
    /** 되돌리기 권한(OPERATION_MANAGE) — 이력 보기는 공개, 되돌리기만 잠근다 */
    canCancel?: boolean
    onDone?: () => void
}

export function MovementHistoryDialog({ open, onOpenChange, row, canCancel = false, onDone }: Props) {
    const router = useRouter()
    const [items, setItems] = useState<MovementRow[]>([])
    const [loading, setLoading] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [cancellingId, setCancellingId] = useState<number | null>(null)
    // 「왜 되돌리기가 없나」의 답을 **누른 사람에게만** 보여준다. 재포장 행마다 같은 두 줄을
    // 늘 뿌리면 한 번 아는 순간부터 자리만 차지한다(실기기 제보 ③-6).
    const [blockedShown, setBlockedShown] = useState<Set<number>>(new Set())

    // 다이얼로그를 닫으면 펼침 상태도 접는다 — 다음에 열 때 남아 있으면 놀란다.
    useEffect(() => {
        if (!open) setBlockedShown(new Set())
    }, [open])

    const packageId = open ? row?.id : undefined
    useEffect(() => {
        if (!packageId) return
        let alive = true
        setLoading(true)
        setLoadError(null)
        void listMovements(packageId).then(res => {
            if (!alive) return
            setLoading(false)
            if (res.success) setItems(res.data)
            else setLoadError(res.error)
        })
        return () => {
            alive = false
        }
    }, [packageId])

    const undo = async (mv: MovementRow) => {
        if (!row) return
        const ok = await confirmDialog({
            title: '차감 되돌리기',
            description: `${MOVEMENT_TYPE_LABEL[mv.type]} ${mv.count}개 (${mv.occurredAt}) 차감을 되돌릴까요?\n${row.variety} ${row.spec}의 가용 재고가 ${mv.count}개 복원됩니다.`,
            confirmText: '되돌리기',
        })
        if (!ok) return
        setCancellingId(mv.id)
        try {
            const res = await cancelMovement(mv.id)
            if (res.success) {
                toast.success(`차감을 되돌렸어요. (${mv.count}개 복원)`)
                const remaining = items.filter(m => m.id !== mv.id)
                setItems(remaining)
                triggerDataUpdate()
                router.refresh()
                onDone?.()
                // 마지막 항목까지 되돌렸으면 빈 이력만 남는다 — 토스트가 이미 알렸으니 닫는다
                if (remaining.length === 0) onOpenChange(false)
            } else {
                toast.error(res.error)
            }
        } finally {
            setCancellingId(null)
        }
    }

    // 헤더의 「N개 중 M개 차감」 — row는 열 때 스냅샷이라 되돌린 만큼 items 합으로 낸다.
    // 로드 전에는 스냅샷 기준으로 우선 보여준다.
    const deductedCount =
        loading || loadError
            ? row
                ? row.qty - row.available
                : 0
            : items.reduce((s, m) => s + m.count, 0)

    // 잔여 = 입고 − 차감. `lib/package-available.ts`의 `available`과 **같은 공식**이지만,
    // `row`는 열 때의 스냅샷이라 되돌린 뒤에도 그대로다. strip 3칸이 함께 움직여야 하므로
    // 여기서 다시 낸다. 로드 전에는 위 분기가 스냅샷 값을 쓰므로 자동으로 `row.available`과 같다.
    const remain = row ? row.qty - deductedCount : 0

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* 기본 grid를 flex로 — 이유는 deduct-dialog 주석 참조 */}
            <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[600px] [&>button]:text-slate-400">
                {/* 헤더는 3층이다 — ① 품종·규격 ② 로트 ③ 숫자 strip.
                    예전엔 이 넷이 `DialogDescription` 한 줄에 `truncate`로 들어가 있었고,
                    실기기에서 가장 중요한 숫자가 「670개 중 670…」으로 잘렸다.
                    모바일은 strip이 `flex-wrap`으로 아래 전폭에 떨어지고, 데스크탑은 우측에 선다. */}
                <DialogHeader className="shrink-0 flex-row flex-wrap items-start gap-x-2.5 gap-y-0 space-y-0 border-b border-slate-100 px-4 py-3.5 sm:flex-nowrap sm:items-center sm:px-5 sm:py-4 sm:pr-12">
                    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <History className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <DialogTitle className="text-[15px] font-bold leading-tight text-slate-900">
                            차감 이력
                        </DialogTitle>
                        <DialogDescription className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-slate-600">
                            {row ? (
                                <>
                                    <span className="font-semibold text-slate-800">{row.variety}</span>
                                    <span className="text-slate-300">·</span>
                                    <span>{row.spec}</span>
                                </>
                            ) : (
                                '차감 이력을 봅니다.'
                            )}
                        </DialogDescription>
                        {/* 로트는 이 행을 확인하러 들어온 화면의 식별자라 **자르지 않는다**.
                            축약(`shortLot`)은 좁은 표 셀용이었고, title 속성은 모바일에서 열 수 없다. */}
                        {row?.lot && (
                            <div className="mt-1 font-mono text-[11px] tabular-nums text-slate-500">
                                {row.lot}
                            </div>
                        )}
                    </div>
                    {row && (
                        <div className="mt-3 grid w-full grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-center sm:mt-0 sm:flex sm:w-auto sm:shrink-0">
                            <div className="px-2.5 py-2 sm:px-3 sm:py-1.5">
                                <div className="text-[10.5px] font-medium text-slate-500">입고</div>
                                <div className="mt-0.5 text-[14px] font-semibold tabular-nums text-slate-700 sm:mt-0 sm:text-[13.5px]">
                                    {row.qty.toLocaleString()}
                                    <span className="ml-px text-[11px] font-medium text-slate-400 sm:hidden">
                                        개
                                    </span>
                                </div>
                            </div>
                            <div className="px-2.5 py-2 sm:px-3 sm:py-1.5">
                                <div className="text-[10.5px] font-medium text-slate-500">차감</div>
                                <div className="mt-0.5 text-[14px] font-bold tabular-nums text-slate-900 sm:mt-0 sm:text-[13.5px]">
                                    {deductedCount.toLocaleString()}
                                    <span className="ml-px text-[11px] font-medium text-slate-400 sm:hidden">
                                        개
                                    </span>
                                </div>
                            </div>
                            <div className="px-2.5 py-2 sm:px-3 sm:py-1.5">
                                <div className="text-[10.5px] font-medium text-slate-500">잔여</div>
                                {/* 잔여 0은 앰버 — 「다 빠졌다」는 정상 상태다. 빨강은 오류를 뜻하므로 쓰지 않는다. */}
                                <div
                                    className={cn(
                                        'mt-0.5 text-[14px] font-semibold tabular-nums sm:mt-0 sm:text-[13.5px]',
                                        remain === 0 ? 'text-amber-700' : 'text-slate-700',
                                    )}
                                >
                                    {remain.toLocaleString()}
                                    <span className="ml-px text-[11px] font-medium text-slate-400 sm:hidden">
                                        개
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-1 sm:px-5">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-[12.5px]">이력을 불러오는 중…</span>
                        </div>
                    ) : loadError ? (
                        <p className="py-8 text-center text-[12.5px] text-slate-600">{loadError}</p>
                    ) : items.length === 0 ? (
                        <p className="py-8 text-center text-[12.5px] text-slate-500">
                            차감 이력이 없어요.
                        </p>
                    ) : (
                        items.map(mv => {
                            const hasMeta = Boolean(mv.customer || mv.note || mv.createdName)
                            // 메타 줄은 모바일(아랫줄)과 데스크탑(비고 컬럼) 두 자리에 같은 내용이 들어간다.
                            // 감싸는 클래스만 다르므로 내용은 여기서 한 번만 만든다.
                            const meta = (
                                <>
                                    {[mv.customer, mv.note].filter(Boolean).join(' · ')}
                                    {(mv.customer || mv.note) && mv.createdName && (
                                        <span className="mx-1.5 text-slate-300">|</span>
                                    )}
                                    {/* 이름만 남으면 누군지 알 수 없다 — 항상 「작업자」 라벨을 붙인다 */}
                                    {mv.createdName && (
                                        <span className="text-slate-400">
                                            작업자 <span className="text-slate-500">{mv.createdName}</span>
                                        </span>
                                    )}
                                </>
                            )
                            return (
                                <div
                                    key={mv.id}
                                    // 경계선은 아래쪽에 둔다 — 위쪽(border-t)이면 마지막 행 선이
                                    // 푸터 상단선과 겹쳐 두 줄로 보였다.
                                    className="border-b border-slate-100 py-2.5 last:border-b-0"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="min-w-0 flex-1">
                                            {/* 이력은 시간축으로 읽으므로 날짜가 첫 컬럼이다.
                                                데스크탑(600px)은 날짜 58 / 유형 52 / 수량 62 고정폭 + gap-4.
                                                수량 우측정렬은 자리수가 다른 값(42개 / 1,692개)의 끝을 맞춘다. */}
                                            <div className="flex items-center gap-2 sm:gap-4">
                                                <span className="shrink-0 font-mono text-[12px] tabular-nums text-slate-500 sm:w-[58px]">
                                                    {mv.occurredAt.slice(2)}
                                                </span>
                                                <span className="shrink-0 rounded border border-slate-200 bg-white px-1.5 py-px text-center text-[11px] text-slate-500 sm:w-[52px]">
                                                    {MOVEMENT_TYPE_LABEL[mv.type]}
                                                </span>
                                                <b className="shrink-0 text-[13.5px] font-bold tabular-nums text-slate-900 sm:w-[62px] sm:text-right">
                                                    {mv.count.toLocaleString()}개
                                                </b>
                                                {hasMeta && (
                                                    <span
                                                        title={[mv.customer, mv.note].filter(Boolean).join(' · ') || undefined}
                                                        className="hidden min-w-0 flex-1 truncate text-[11.5px] text-slate-500 sm:block"
                                                    >
                                                        {meta}
                                                    </span>
                                                )}
                                            </div>
                                            {/* ③-2 모바일은 **자르지 않는다.** 잘린 뒷부분이 `title`에만 있었는데
                                                title은 마우스 호버용이라 폰에선 열 수가 없다 — 즉 볼 방법이 없었다.
                                                ①(차감)에서 로트를 자르지 않기로 한 것과 같은 판단이다.
                                                데스크탑은 컬럼 정렬이 우선이라 한 줄 truncate + title 유지. */}
                                            {hasMeta && (
                                                <div className="mt-1 text-[11.5px] leading-relaxed text-slate-500 sm:hidden">
                                                    {meta}
                                                </div>
                                            )}
                                        </div>
                                        {/* 되돌리기와 자물쇠가 같은 자리를 쓰므로 행 높이가 일정하다.
                                            🔴 판정은 `cancellable`만 본다 — `fromRepack`은 문구 선택용. */}
                                        {/* ③-1 모바일은 아이콘만(90px → 32px) — 막힌 행의 자물쇠와 폭이 같아져
                                            행 끝이 가지런해진다. 누르면 확인 다이얼로그가 뜨므로 오탭 위험은 낮다.
                                            데스크탑은 라벨을 유지한다(발견성). */}
                                        {mv.cancellable && canCancel ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                aria-label="되돌리기"
                                                title="되돌리기"
                                                className="h-8 w-8 shrink-0 gap-1.5 bg-white p-0 sm:w-auto sm:px-3"
                                                disabled={cancellingId !== null}
                                                onClick={() => void undo(mv)}
                                            >
                                                {cancellingId === mv.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <Undo2 className="h-3.5 w-3.5" />
                                                )}
                                                <span className="hidden sm:inline">되돌리기</span>
                                            </Button>
                                        ) : !mv.cancellable ? (
                                            // ③-6 자물쇠는 이제 **버튼**이다 — 눌러야 이유가 나온다.
                                            <button
                                                type="button"
                                                aria-expanded={blockedShown.has(mv.id)}
                                                aria-label="되돌릴 수 없는 이유 보기"
                                                title={mv.fromRepack ? REPACK_CANCEL_BLOCKED : ORDER_CANCEL_BLOCKED}
                                                onClick={() =>
                                                    setBlockedShown(prev => {
                                                        const next = new Set(prev)
                                                        if (!next.delete(mv.id)) next.add(mv.id)
                                                        return next
                                                    })
                                                }
                                                className={cn(
                                                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
                                                    blockedShown.has(mv.id)
                                                        ? 'bg-slate-200 text-slate-600'
                                                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600',
                                                )}
                                            >
                                                <Lock className="h-3.5 w-3.5" />
                                            </button>
                                        ) : null}
                                    </div>
                                    {/* ③-6 늘 붙어 있던 「되돌릴 수 없다」 안내를 이 자리에서 **재포장 결과**로 바꿨다.
                                        나간 것만 있고 「그래서 뭐가 됐나」가 없어 재포장 화면을 따로 열어야 했다.
                                        데스크탑 들여쓰기 220px = 58+16+52+16+62+16(비고 컬럼 시작점). */}
                                    {mv.repackResults && mv.repackResults.length > 0 && (
                                        <div className="mt-1 text-[11.5px] leading-relaxed text-slate-600 sm:pl-[220px]">
                                            {/* 🔴 병합(소스 2행 이상)이면 이건 「이 행이 만든 것」이 아니라
                                                그 재포장 **작업 전체**의 결과다. 문구로 갈라 오해를 막는다. */}
                                            <span className="text-slate-400">
                                                {mv.repackMerged ? '합쳐서 → ' : '→ '}
                                            </span>
                                            {formatRepackResults(mv.repackResults)}
                                        </div>
                                    )}
                                    {/* 막힌 이유는 **자물쇠를 누른 사람에게만.** 한 번 알면 다시 필요 없는 문구다. */}
                                    {!mv.cancellable && blockedShown.has(mv.id) && (
                                        <div className="mt-1 text-[11px] leading-relaxed text-slate-500 sm:pl-[220px]">
                                            {mv.fromRepack ? REPACK_CANCEL_BLOCKED : ORDER_CANCEL_BLOCKED}
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>

                <div className="flex shrink-0 justify-end border-t border-slate-200 bg-slate-50 px-4 py-2.5 sm:px-5">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 bg-white px-5 sm:h-8 sm:px-4"
                        onClick={() => onOpenChange(false)}
                    >
                        닫기
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
