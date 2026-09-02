'use client'

// 차감 이력 다이얼로그 (계획서 D6 · 시안 #2)
//
// 🔴 되돌리기 가능 여부는 **`MovementRow.cancellable`만** 본다 — 서버가 같은 규칙으로
// 거부한다. `fromRepack`/`fromOrder`는 막힌 이유의 **문구를 고르는 용도로만** 쓴다.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { History, Loader2, Lock, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { cancelMovement, listMovements, type MovementRow } from '@/app/actions/package-movement'
import type { PackageRow } from '@/app/actions/packages'
import { shortLot } from './deduct-dialog'
import { REPACK_CANCEL_BLOCKED } from '@/lib/package-guard'
import { MOVEMENT_TYPE_LABEL } from '@/lib/movement-label'

const ORDER_CANCEL_BLOCKED = '발주서 차감은 발주서 상세에서 취소해주세요.'

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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* 기본 grid를 flex로 — 이유는 deduct-dialog 주석 참조 */}
            <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[600px] [&>button]:text-slate-400">
                <DialogHeader className="shrink-0 flex-row items-start gap-2.5 space-y-0 border-b border-slate-100 px-4 py-3.5 sm:px-5 sm:py-4">
                    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <History className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                        <DialogTitle className="text-[15px] font-bold text-slate-900">
                            차감 이력
                        </DialogTitle>
                        <DialogDescription className="mt-0.5 truncate text-[12px]">
                            {row ? (
                                <>
                                    {row.variety} · {row.spec}
                                    {row.lot && (
                                        <span
                                            title={row.lot}
                                            className="mx-1.5 rounded border border-slate-200 bg-slate-100 px-1.5 py-[1px] font-mono text-[10px] text-slate-500"
                                        >
                                            {shortLot(row.lot)}
                                        </span>
                                    )}{' '}
                                    · {row.qty.toLocaleString()}개 중{' '}
                                    <b className="tabular-nums text-slate-700">
                                        {deductedCount.toLocaleString()}개
                                    </b>{' '}
                                    차감
                                </>
                            ) : (
                                '차감 이력을 봅니다.'
                            )}
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-1.5 sm:px-5">
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
                        items.map(mv => (
                            <div
                                key={mv.id}
                                className="border-t border-slate-100 py-3 first:border-t-0"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-baseline gap-2.5">
                                            <span className="shrink-0 self-center rounded border border-slate-200 bg-white px-1.5 py-[1px] text-[11px] text-slate-500">
                                                {MOVEMENT_TYPE_LABEL[mv.type]}
                                            </span>
                                            <b className="text-[13px] tabular-nums text-slate-900">
                                                {mv.count.toLocaleString()}개
                                            </b>
                                            <span className="text-[12px] tabular-nums text-slate-500">
                                                {mv.occurredAt}
                                            </span>
                                        </div>
                                        {(mv.customer || mv.note || mv.createdName) && (
                                            <div className="mt-1.5 truncate text-[11.5px] text-slate-500">
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
                                            </div>
                                        )}
                                    </div>
                                    {mv.cancellable && canCancel && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 shrink-0 gap-1.5"
                                            disabled={cancellingId !== null}
                                            onClick={() => void undo(mv)}
                                        >
                                            {cancellingId === mv.id ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Undo2 className="h-3.5 w-3.5" />
                                            )}
                                            되돌리기
                                        </Button>
                                    )}
                                </div>
                                {!mv.cancellable && (
                                    <div className="mt-2.5 flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11.5px] leading-relaxed text-slate-600">
                                        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                        <span>
                                            {mv.fromRepack ? REPACK_CANCEL_BLOCKED : ORDER_CANCEL_BLOCKED}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="flex shrink-0 justify-end border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-11 w-full bg-white sm:h-8 sm:w-auto"
                        onClick={() => onOpenChange(false)}
                    >
                        닫기
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
