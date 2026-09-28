'use client'

// 검토 게이트의 건 선택 목록 (M1-6) — 폰 목록 `작업필요 n건 검토`로 열었을 때만 뜬다.
//
// 기본은 **전부 체크**다(빼는 UI). 발주처가 소수로 반복되므로 그룹 헤더의 「그룹 해제」가 개별 체크를 대신한다.
// 목록·건상세에는 체크박스를 두지 않는다 — 고르는 건 여기서만(핸드오프 §7).
//
// 🔴 **여기는 그리기만 한다.** 묶기·요약·「일괄 대상 없음」 사유는 `buildGateGroups`(순수)가,
//    빼고 난 뒤의 차감량은 게이트가 서버에 다시 묻는다(FIFO라 한 건을 빼면 그 재고가 뒤 건으로 간다).

import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { GateGroup, GateSkip, GateState } from '@/lib/purchase-order-gate'

const fmt = (n: number) => n.toLocaleString()

const SKIP_LABEL: Record<GateSkip, string> = {
    bulk: '톤백만 · 품목을 눌러 자루 선택',
    unmatched: '매칭실패만 · 아래 안내 참고',
    mixed: '톤백·매칭실패만 · 일괄 대상 없음',
    none: '차감할 품목 없음',
}

export function GateOrderPicker({
    groups,
    excluded,
    states,
    onToggle,
    onToggleGroup,
}: {
    groups: GateGroup[]
    excluded: ReadonlySet<number>
    /**
     * 이번 미리보기에서 건마다 어떻게 되나(`gateStateOf`). **지금 체크 상태로 계산한 값일 때만** 준다 —
     * 다시 계산하는 중이면 null이라 표시를 거둔다(옛 상태를 새 선택에 붙이지 않게).
     * 🔴 행에 kg을 적지 않는다 — kg은 위 합계 한 곳이다(`gateStateOf` 주석).
     */
    states: ReadonlyMap<number, GateState> | null
    onToggle: (orderId: number) => void
    /** `include`면 그 id들을 다시 넣고, 아니면 뺀다 */
    onToggleGroup: (orderIds: number[], include: boolean) => void
}) {
    // 이름 없는 그룹 하나뿐이면 헤더는 같은 말의 반복이다
    const showHeader = groups.length > 1 || groups[0]?.label !== null
    return (
        <div className="overflow-hidden rounded-lg border border-slate-200">
            {groups.map((g, gi) => {
                const ids = g.rows.filter((r) => r.skip === null).map((r) => r.orderId)
                const allOut = ids.length > 0 && ids.every((id) => excluded.has(id))
                return (
                    <div key={g.key} className={cn(gi > 0 && 'border-t border-slate-200')}>
                        {showHeader && (
                            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5">
                                <span className="truncate text-[11.5px] font-bold text-slate-500">
                                    {g.label ?? '미지정'}
                                </span>
                                <span className="shrink-0 text-[11px] text-slate-400">· {fmt(g.rows.length)}건</span>
                                {ids.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => onToggleGroup(ids, allOut)}
                                        className="ml-auto h-8 shrink-0 rounded-md px-2 text-[12px] font-semibold text-primary hover:bg-primary/10"
                                    >
                                        {allOut ? '그룹 선택' : '그룹 해제'}
                                    </button>
                                )}
                            </div>
                        )}
                        {g.rows.map((r) => {
                            const out = excluded.has(r.orderId)
                            const body = (
                                <>
                                    {/* 🔴 min-w-0 — 없으면 긴 수령인명이 칸의 하한이 되어 kg을 밀어낸다 */}
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[13px] font-semibold text-foreground">
                                            {r.name}
                                        </span>
                                        <span className="block truncate text-[11.5px] text-slate-500">
                                            {r.summary ?? SKIP_LABEL[r.skip ?? 'none']}
                                        </span>
                                    </span>
                                    {/* 정상은 적지 않는다 — 예외만 적어야 재고없음이 묻히지 않는다 */}
                                    {r.skip === null && !out && states?.get(r.orderId) === 'none' && (
                                        <span className="shrink-0 rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-semibold text-orange-700">
                                            재고없음
                                        </span>
                                    )}
                                    {r.skip === null && !out && states?.get(r.orderId) === 'partial' && (
                                        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                                            일부 부족
                                        </span>
                                    )}
                                </>
                            )
                            return r.skip === null ? (
                                // 🔴 터치 영역은 label 자체의 패딩으로 — absolute 오버레이는 클릭을 삼킨다
                                <label
                                    key={r.orderId}
                                    className={cn(
                                        'flex min-h-11 cursor-pointer items-center gap-3 border-t border-slate-100 px-3 py-2 first:border-t-0 active:bg-slate-50',
                                        out && 'opacity-45',
                                    )}
                                >
                                    <Checkbox
                                        checked={!out}
                                        onCheckedChange={() => onToggle(r.orderId)}
                                        className="size-5 rounded-[5px] bg-card"
                                        aria-label={`${r.name} 포함`}
                                    />
                                    {body}
                                </label>
                            ) : (
                                // 일괄로 할 게 없는 건 — 눌러도 아무 일이 없는 체크박스를 주지 않는다
                                <div
                                    key={r.orderId}
                                    className="flex min-h-11 items-center gap-3 border-t border-slate-100 px-3 py-2 first:border-t-0"
                                >
                                    <span className="size-5 shrink-0" />
                                    {body}
                                </div>
                            )
                        })}
                    </div>
                )
            })}
        </div>
    )
}
