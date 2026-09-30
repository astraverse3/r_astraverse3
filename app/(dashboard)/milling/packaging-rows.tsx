'use client'

// 포장 다이얼로그의 행 — PC·모바일 각각 편집 / 읽기 전용 두 벌. 백로그 §87 T3 · `docs/plan/plan-포장다이얼로그-모바일B안.md`
//
// 🔴 **표시만 한다.** 상태·저장·diff는 전부 다이얼로그(`add-packaging-dialog.tsx`)에 있고, 여기는 받은 핸들러를 부를 뿐이다.
// 9/1 포장 소실 사고의 무대라 로직을 여기로 옮기지 말 것.
//
// PC와 모바일 행은 CSS(`hidden sm:block` / `sm:hidden`)로 가른다 → **같은 행이 DOM에 두 벌** 있다.
// `data-count-index`·`data-weight-index`로 입력칸을 찾는 쪽은 **보이는 것**을 골라야 한다(다이얼로그의 포커스 effect).

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Minus, Trash2, Loader2 } from 'lucide-react'
import type { MillingOutputInput } from '@/app/actions/milling'
import { PKG_REMAINDER, PKG_TONBAG } from './packaging-constants'

export type PackagingOption = { id: number; name: string }
export type PackagingsState = 'loading' | 'ready' | 'failed'

export type RowHandlers = {
    updateCount: (index: number, delta: number) => void
    setCount: (index: number, count: number) => void
    setWeight: (index: number, weight: number) => void
    setPackaging: (index: number, packagingId: number | null) => void
    remove: (index: number) => void
}

export type PackagingRowProps = {
    o: MillingOutputInput
    /** `outputs` 전체에서의 위치 — 핸들러와 포커스 대상(`data-*-index`)이 이걸로 찾는다 */
    i: number
    /** `!isClosed && canManage` */
    editable: boolean
    packagings: PackagingOption[]
    packagingsState: PackagingsState
    /** 새 줄의 기본 포장지 추천을 기다리는 중 */
    suggesting: boolean
    on: RowHandlers
}

/** 포장지 칸이 아직 못 그리는 상태 — 목록이 안 왔거나, 새 줄의 추천을 기다린다 */
function packagingPending({ o, packagingsState, suggesting }: PackagingRowProps) {
    return packagingsState !== 'ready' || (o.packagingId == null && suggesting)
}

function packagingName(o: MillingOutputInput, packagings: PackagingOption[]) {
    return packagings.find(p => p.id === o.packagingId)?.name
}

/** 톤백·잔량은 단중이 곧 무게(자루마다 · 자투리마다 다르다), 그 외는 단중 × 수량 */
function isWeighed(o: MillingOutputInput) {
    return o.packageType === PKG_TONBAG || o.packageType === PKG_REMAINDER
}

const SELECT_CHEVRON = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
} as const

// 칸 폭 — 헤더와 행이 **한 쌍**으로 같이 쓴다. `minmax(0,1fr)`는 쓰지 않는다(콤마 든 임의값은 CSS가 안 생긴다) — 1fr 칸에 min-w-0
// PC(작업지시 ⑤): 편집 = 규격 · 포장지 · 스테퍼 · 중량 · 삭제 / 읽기 = 규격 · 포장지 · 수량 · 중량
const DESKTOP_EDIT_COLS = 'grid-cols-[52px_1fr_104px_76px_28px]'
const DESKTOP_READ_COLS = 'grid-cols-[52px_1fr_64px_76px]'
// 모바일(작업지시 ④ C안): 편집 = 규격+포장지 · 스테퍼 · 중량 · 삭제 / 읽기 = 규격+포장지 · 수량 · 중량
const MOBILE_EDIT_COLS = 'grid-cols-[1fr_108px_64px_28px]'
const MOBILE_READ_COLS = 'grid-cols-[1fr_52px_56px]'

// ── 컬럼 헤더 ──────────────────────────────────────────────

export function PackagingRowsHeader({ editable }: { editable: boolean }) {
    const cls = 'text-[11px] font-semibold text-slate-500'
    return (
        <>
            {editable ? (
                <div className={`hidden sm:grid ${DESKTOP_EDIT_COLS} gap-1.5 px-3 pt-2 pb-0.5`}>
                    <span className={`${cls} text-center`}>규격</span>
                    <span className={`${cls} pl-1`}>포장지</span>
                    <span className={`${cls} text-center`}>수량</span>
                    <span className={`${cls} text-right pr-1`}>중량(kg)</span>
                    <span />
                </div>
            ) : (
                <div className={`hidden sm:grid ${DESKTOP_READ_COLS} gap-1.5 px-3 pt-2 pb-0.5`}>
                    <span className={`${cls} text-center`}>규격</span>
                    <span className={`${cls} pl-1`}>포장지</span>
                    <span className={`${cls} text-right`}>수량</span>
                    <span className={`${cls} text-right`}>중량(kg)</span>
                </div>
            )}
            {editable ? (
                <div className={`sm:hidden grid ${MOBILE_EDIT_COLS} gap-1 px-2 pt-2 pb-0.5`}>
                    <span className={cls}>규격 · 포장지</span>
                    <span className={`${cls} text-center`}>수량</span>
                    <span className={`${cls} text-right`}>중량(kg)</span>
                    <span />
                </div>
            ) : (
                <div className={`sm:hidden grid ${MOBILE_READ_COLS} gap-2 px-3 pt-2 pb-0.5`}>
                    <span className={cls}>규격 · 포장지</span>
                    <span className={`${cls} text-right`}>수량</span>
                    <span className={`${cls} text-right`}>중량(kg)</span>
                </div>
            )}
        </>
    )
}

// ── PC 행 (작업지시 ⑤) ──────────────────────────────────────
//
// 마우스 화면이라 누르는 곳은 32px. 글자 12~14px · slate. 잔량은 모바일처럼 스테퍼 자리가 kg 입력이다.

function DesktopSpecBadge({ o }: { o: MillingOutputInput }) {
    return (
        <span className={`rounded py-0.5 text-center text-[12px] font-semibold ${o.packageType === PKG_REMAINDER ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-700'}`}>
            {o.packageType}
        </span>
    )
}

const DESKTOP_INPUT = 'h-8 rounded-md border-slate-300 px-2 text-right text-sm font-mono font-bold tabular-nums text-slate-900'

export function PackagingRowDesktop(props: PackagingRowProps) {
    const { o, i, packagings, packagingsState, on } = props
    const isRemainder = o.packageType === PKG_REMAINDER
    const isTonbag = o.packageType === PKG_TONBAG
    const weightInput = (className: string) => (
        <Input
            type="number"
            data-weight-index={i}
            value={o.weightPerUnit}
            onChange={(e) => on.setWeight(i, parseFloat(e.target.value))}
            onFocus={(e) => e.target.select()}
            aria-label={`${o.packageType} 중량(kg)`}
            className={`${DESKTOP_INPUT} ${className}`}
        />
    )

    return (
        <div className={`px-3 py-1 grid ${DESKTOP_EDIT_COLS} items-center gap-1.5`}>
            <DesktopSpecBadge o={o} />

            {/* 포장지 — 톤백=고정, 잔량=없음, 그 외 드롭다운(기본 자동) */}
            {isTonbag ? (
                <span className="min-w-0 truncate pl-1 text-[13px] text-slate-500">톤백</span>
            ) : isRemainder ? (
                <span className="min-w-0 truncate pl-1 text-[13px] text-slate-500">포장지 없음</span>
            ) : packagingPending(props) ? (
                <span className="h-8 w-full min-w-0 flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-[13px] text-slate-500 truncate">
                    {packagingsState === 'failed'
                        ? '포장지 불러오기 실패'
                        : <Loader2 className="h-3 w-3 animate-spin" aria-label="포장지 불러오는 중" />}
                </span>
            ) : (
                <select
                    value={o.packagingId ?? ''}
                    onChange={(e) => on.setPackaging(i, e.target.value ? Number(e.target.value) : null)}
                    className={`h-8 w-full min-w-0 truncate rounded-md border bg-white pl-2 pr-6 text-[13px] focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring appearance-none ${o.packagingId == null ? 'border-rose-300 text-rose-700' : 'border-slate-300 text-slate-800'}`}
                    style={SELECT_CHEVRON}
                >
                    {/* 「미지정」은 고를 수 없다(§54) — 기본 SKU가 없는 규격일 때만 이 안내가 보인다 */}
                    <option value="" disabled>포장지 선택</option>
                    {packagings.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            )}

            {/* 수량 — 잔량은 수량이 늘 1이라 스테퍼 자리가 kg 입력 */}
            {isRemainder ? (
                <div className="flex items-center justify-end gap-1">
                    {weightInput('w-[72px]')}
                    <span className="text-[11px] text-slate-500 shrink-0">kg</span>
                </div>
            ) : (
                <div className="flex h-8 items-stretch rounded-md border border-slate-300 overflow-hidden">
                    <Button variant="ghost" className="h-full w-7 shrink-0 rounded-none bg-slate-50 px-0 text-slate-600 hover:bg-slate-100" onClick={() => on.updateCount(i, -1)} aria-label="수량 빼기">
                        <Minus className="size-3.5" />
                    </Button>
                    <Input
                        type="number"
                        data-count-index={i}
                        value={o.count === 0 ? '' : o.count}
                        onChange={(e) => on.setCount(i, parseInt(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        aria-label={`${o.packageType} 수량`}
                        className="h-full min-w-0 flex-1 rounded-none border-x border-y-0 border-slate-300 bg-transparent px-0 text-center text-sm font-mono font-bold tabular-nums text-slate-900 shadow-none"
                    />
                    <Button variant="ghost" className="h-full w-7 shrink-0 rounded-none bg-slate-50 px-0 text-slate-600 hover:bg-slate-100" onClick={() => on.updateCount(i, 1)} aria-label="수량 더하기">
                        <Plus className="size-3.5" />
                    </Button>
                </div>
            )}

            {/* 중량 — 톤백은 자루마다 무게가 달라 입력, 그 외 계산값(단위는 헤더) */}
            {isTonbag ? weightInput('w-full') : (
                <span className="pr-1 text-right text-sm font-mono font-bold tabular-nums text-slate-900 truncate">
                    {(o.weightPerUnit * o.count).toLocaleString()}
                </span>
            )}

            <Button variant="ghost" className="h-8 w-7 rounded-md px-0 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => on.remove(i)} aria-label={`${o.packageType} 줄 삭제`}>
                <Trash2 className="size-[15px]" />
            </Button>
        </div>
    )
}

// ── PC 읽기 전용 행 (마감됨 · 권한 없음, 작업지시 ⑤ P7) ─────────────────

export function PackagingRowReadOnlyDesktop(props: PackagingRowProps) {
    const { o, packagings, packagingsState } = props
    const name = o.packageType === PKG_TONBAG ? '톤백'
        : o.packageType === PKG_REMAINDER ? '—'
            : packagingPending(props)
                ? (packagingsState === 'failed' ? '불러오기 실패' : <Loader2 className="inline h-3 w-3 animate-spin" aria-label="포장지 불러오는 중" />)
                : (packagingName(o, packagings) ?? '미지정')
    const weight = isWeighed(o) ? o.weightPerUnit : o.weightPerUnit * o.count

    return (
        <div className={`px-3 py-1.5 min-h-8 grid ${DESKTOP_READ_COLS} items-center gap-1.5`}>
            <DesktopSpecBadge o={o} />
            <span className="min-w-0 truncate pl-1 text-[13px] text-slate-700">{name}</span>
            <span className="text-right font-mono tabular-nums text-sm text-slate-900">
                {o.count}<span className="ml-0.5 font-sans text-[11px] text-slate-500">개</span>
            </span>
            <span className="text-right font-mono tabular-nums text-sm font-bold text-slate-900">
                {weight.toLocaleString()}
            </span>
        </div>
    )
}

// ── 모바일 편집 행 (B안 → C안 보정, 작업지시 ④) ──────────────────────
//
// `[규격+포장지 셀 1fr] [스테퍼 108] [중량 64] [삭제 28]` — 누르는 곳은 36px.
// B안(40px · 16px)은 실기기에서 다른 화면보다 한 단계 커 보였고, 50px 중량 칸에 톤백 「1086」이 잘렸다.
// 규격과 포장지를 한 셀에 합쳐 폭을 만든다(글자 축소로 넘침을 풀지 말 것).

/** 14px. ⚠️ iOS는 16px 미만 입력칸에 포커스하면 확대한다 — 지금은 layout의 `maximumScale: 1`이 막고 있다.
 *  확대를 허용하는 §86 D4를 할 때 iOS 전용 확대 처리 컴포넌트를 **같이** 넣어야 한다(작업지시 ④ C2) */
const MOBILE_INPUT = 'h-9 rounded-lg border-slate-200 px-1.5 text-right text-sm font-mono font-bold tabular-nums'

function MobileSpecCell(props: PackagingRowProps) {
    const { o, i, packagings, packagingsState, on } = props
    const isRemainder = o.packageType === PKG_REMAINDER
    const isTonbag = o.packageType === PKG_TONBAG
    const pending = !isRemainder && !isTonbag && packagingPending(props)
    const selectable = !isRemainder && !isTonbag && !pending
    const missing = selectable && o.packagingId == null

    const sub = isRemainder ? '포장지 없음'
        : pending
                ? (packagingsState === 'failed' ? '포장지 불러오기 실패' : <Loader2 className="h-3 w-3 animate-spin" aria-label="포장지 불러오는 중" />)
                : (packagingName(o, packagings) ?? '포장지 선택')

    // 톤백은 포장지가 「톤백」 고정이라 박스 없이 한 줄 — 윗줄·아랫줄에 「톤백」이 두 번 나오던 것(C1)
    if (isTonbag) {
        return (
            <div className="min-w-0 h-9 flex items-center px-2">
                <span className="text-[13px] font-semibold text-slate-800 truncate">{o.packageType}</span>
            </div>
        )
    }

    return (
        <div className={`relative min-w-0 h-9 flex flex-col justify-center rounded-lg border px-2 ${missing ? 'border-rose-300' : 'border-slate-200'} ${selectable ? 'bg-white' : 'bg-slate-50'}`}>
            <span className={`text-[13px] leading-4 font-semibold truncate ${isRemainder ? 'text-yellow-800' : 'text-slate-800'}`}>
                {o.packageType}
            </span>
            <span className={`flex items-center gap-0.5 text-[11px] leading-[14px] ${missing ? 'text-rose-700' : 'text-slate-500'}`}>
                <span className="truncate">{sub}</span>
                {selectable && <span className="shrink-0" aria-hidden>▾</span>}
            </span>
            {/* 셀 전체가 포장지 선택이다 — 투명한 네이티브 select를 덮어 폰의 선택창을 그대로 쓴다.
                덮개가 곧 컨트롤이고 셀 안에 다른 버튼이 없어 클릭을 삼킬 게 없다([[mobile_hit_area_overlay]]와 다른 경우) */}
            {selectable && (
                <select
                    aria-label={`${o.packageType} 포장지`}
                    value={o.packagingId ?? ''}
                    onChange={(e) => on.setPackaging(i, e.target.value ? Number(e.target.value) : null)}
                    // 글자 크기는 PC 브라우저가 그리는 옵션 목록 크기다(폰은 OS 선택창이라 영향 없음) — 셀 윗줄과 같은 13px
                    className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 text-[13px]"
                >
                    <option value="" disabled>포장지 선택</option>
                    {packagings.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            )}
        </div>
    )
}

export function PackagingRowMobile(props: PackagingRowProps) {
    const { o, i, on } = props
    const isRemainder = o.packageType === PKG_REMAINDER
    const isTonbag = o.packageType === PKG_TONBAG
    const weightInput = (
        <Input
            type="number"
            inputMode="decimal"
            data-weight-index={i}
            value={o.weightPerUnit}
            onChange={(e) => on.setWeight(i, parseFloat(e.target.value))}
            onFocus={(e) => e.target.select()}
            aria-label={`${o.packageType} 중량(kg)`}
            className={MOBILE_INPUT}
        />
    )

    return (
        <div className={`px-2 py-1.5 grid ${MOBILE_EDIT_COLS} items-center gap-1`}>
            <MobileSpecCell {...props} />

            {/* 잔량은 수량이 늘 1이라 스테퍼 자리가 kg 입력이다 */}
            {isRemainder ? (
                <div className="flex items-center gap-1">
                    {weightInput}
                    <span className="text-[11px] text-slate-500 shrink-0">kg</span>
                </div>
            ) : (
                <div className="flex h-9 items-stretch rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <Button variant="ghost" className="h-full w-9 shrink-0 rounded-none px-0 text-slate-600 active:bg-slate-100" onClick={() => on.updateCount(i, -1)} aria-label="수량 빼기">
                        <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                        type="number"
                        inputMode="numeric"
                        data-count-index={i}
                        value={o.count === 0 ? '' : o.count}
                        onChange={(e) => on.setCount(i, parseInt(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        aria-label={`${o.packageType} 수량`}
                        className="h-full w-9 min-w-0 flex-1 rounded-none border-x border-y-0 border-slate-200 bg-transparent px-0 text-center text-sm font-mono font-bold tabular-nums shadow-none"
                    />
                    <Button variant="ghost" className="h-full w-9 shrink-0 rounded-none px-0 text-slate-600 active:bg-slate-100" onClick={() => on.updateCount(i, 1)} aria-label="수량 더하기">
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* 톤백은 자루마다 무게가 달라 중량 칸이 입력이다 */}
            {isTonbag ? weightInput : (
                <span className="pr-1 text-right text-sm font-bold font-mono tabular-nums text-slate-900 truncate">
                    {(o.weightPerUnit * o.count).toLocaleString()}
                </span>
            )}

            <Button variant="ghost" className="h-9 w-7 px-0 text-slate-400 hover:bg-rose-50 hover:text-rose-600 active:text-rose-600" onClick={() => on.remove(i)} aria-label={`${o.packageType} 줄 삭제`}>
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    )
}

// ── 모바일 읽기 전용 행 (마감됨 · 권한 없음) ───────────────────────
//
// 누를 곳이 없어 36px · 3열. 편집 행과 열 폭을 맞추지 않는다 — 스테퍼 자리를 비워 두면 숫자가 떠 보인다.

export function PackagingRowReadOnlyMobile(props: PackagingRowProps) {
    const { o, packagings, packagingsState } = props
    const isRemainder = o.packageType === PKG_REMAINDER
    const isTonbag = o.packageType === PKG_TONBAG
    const name = isRemainder ? '—'
        : isTonbag ? '톤백'
            : packagingPending(props)
                ? (packagingsState === 'failed' ? '불러오기 실패' : <Loader2 className="inline h-3 w-3 animate-spin" aria-label="포장지 불러오는 중" />)
                : (packagingName(o, packagings) ?? '미지정')
    const weight = isWeighed(o) ? o.weightPerUnit : o.weightPerUnit * o.count

    return (
        <div className={`px-3 py-2 min-h-9 grid ${MOBILE_READ_COLS} items-center gap-2`}>
            <div className="min-w-0 flex items-center gap-2">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[12px] font-semibold ${isRemainder ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-700'}`}>
                    {o.packageType}
                </span>
                <span className="truncate text-[13px] text-slate-700">{name}</span>
            </div>
            <span className="text-right font-mono tabular-nums text-sm text-slate-900">
                {o.count}<span className="ml-0.5 font-sans text-[11px] text-slate-500">개</span>
            </span>
            <span className="text-right font-mono tabular-nums text-sm font-bold text-slate-900">
                {weight.toLocaleString()}
            </span>
        </div>
    )
}
