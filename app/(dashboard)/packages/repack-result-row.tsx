'use client'

import { Minus, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PACKAGE_TYPE_REMAINDER, PACKAGE_TYPE_TONBAG } from '@/lib/repack'
import type { RepackLotOption } from '@/app/actions/repack'

/** 오류를 어느 필드에 표시할지 — 다이얼로그와 공유한다 */
export type ResultFieldKey = 'spec' | 'weight' | 'count' | 'lot' | 'packaging'

/** 만들어질 규격 1줄 — 입력 중이라 수치는 문자열로 들고 있다가 제출할 때 숫자로 바꾼다. */
export type ResultDraft = {
    key: string
    packageType: string
    weightPerUnit: string
    count: string
    packagingId: number | null
    /** 출처를 승계할 소스 행 id (결정 #43 §3.4). 0 = 아직 안 고름 */
    inheritFromPackageId: number
}

/**
 * 규격 버튼 한 번 = 이 한 줄 (결정 #45).
 * 로트는 직전 줄에서 물려받는다 (결정 #47) — 첫 줄은 0이라 사람이 고른다.
 */
export const makeResultDraft = (
    key: string,
    spec: { label: string; weight: number | null },
    lotPackageId: number,
): ResultDraft => ({
    key,
    packageType: spec.label,
    weightPerUnit: spec.weight === null ? '' : String(spec.weight),
    count: '1',
    // 잔량·톤백은 SKU를 부여하지 않는다 — 포장지를 비워둔다
    packagingId: null,
    inheritFromPackageId: lotPackageId,
})

interface Props {
    draft: ResultDraft
    index: number
    packagings: { id: number; name: string; active: boolean }[]
    lotOptions: RepackLotOption[]
    onChange: (next: ResultDraft) => void
    onRemove: () => void
    /** 이 줄에서 막힌 이유 — 다이얼로그의 blockingReason과 같은 판정이다 */
    error?: { field: ResultFieldKey; message: string } | null
}

/**
 * 결과 1줄 = 화면 1행 (결정 #46).
 *   [규격뱃지] [포장지] [⊖ 개수 ⊕] [자루당kg] [로트] [삭제]
 * 규격은 상단 버튼으로 정해져 들어오므로 여기서는 뱃지로 보여주기만 한다.
 */
export function RepackResultRow({
    draft,
    index,
    packagings,
    lotOptions,
    onChange,
    onRemove,
    error,
}: Props) {
    const isRemainder = draft.packageType === PACKAGE_TYPE_REMAINDER
    const isTonbag = draft.packageType === PACKAGE_TYPE_TONBAG
    // 톤백·잔량은 자루마다 중량이 달라 사람이 직접 넣는다
    const weightEditable = isRemainder || isTonbag
    // 로트가 1종이면 고를 게 없다 — 열 자체를 그리지 않는다
    const showLot = lotOptions.length > 1

    const count = Number(draft.count) || 0
    const lineKg = (Number(draft.weightPerUnit) || 0) * count

    const bad = (f: ResultFieldKey) => error?.field === f
    const fieldCls = (f: ResultFieldKey) =>
        bad(f) ? 'border-red-300 focus-visible:ring-red-400' : 'border-slate-200'

    const step = (delta: number) =>
        onChange({ ...draft, count: String(Math.max(1, count + delta)) })

    const lotSelect = (
        <select
            value={draft.inheritFromPackageId || ''}
            onChange={e => onChange({ ...draft, inheritFromPackageId: Number(e.target.value) || 0 })}
            className={`h-9 w-full min-w-0 truncate rounded-md border bg-white px-1.5 text-[11.5px] text-slate-600 sm:h-7 ${fieldCls('lot')}`}
            aria-label="로트 승계"
        >
            {/* 아직 안 고른 줄만 빈 선택이 남는다 — 무심코 넘어가면 안 된다 */}
            <option value="">로트 선택</option>
            {lotOptions.map(o => (
                <option key={o.packageId} value={o.packageId}>
                    {o.producer} · {o.lotNo ?? '매입(로트 없음)'}
                </option>
            ))}
        </select>
    )

    return (
        <div
            className={`flex flex-col gap-1.5 rounded-lg border px-2 py-1.5 ${
                error ? 'border-red-200 bg-red-50/40' : 'border-slate-100 bg-white'
            }`}
        >
            {/* 모바일 5열(로트 제외) / 데스크탑 6열.
                로트는 display:none이면 grid 아이템에서 빠지므로 열 수가 저절로 맞는다.
                데스크탑에서 남는 폭은 포장지가 아니라 로트가 가져간다 — 포장지 이름은
                가장 긴 게 8자('땅끝에서보냅니다')지만 로트번호는 251119-11-15100914-391 꼴이다 */}
            <div className="grid grid-cols-[46px_1fr_84px_58px_24px] items-center gap-1.5 sm:grid-cols-[52px_128px_84px_62px_minmax(0,1fr)_24px]">
                {/* 1. 규격 — 상단 버튼으로 정해진 값. 잔량은 노랑 */}
                <span
                    className={`truncate rounded px-1 py-0.5 text-center text-[11px] font-bold ${
                        isRemainder ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                    }`}
                >
                    {draft.packageType}
                </span>

                {/* 2. 포장지 — 잔량=없음, 톤백=고정 */}
                {isRemainder || isTonbag ? (
                    <span className="truncate pl-0.5 text-[11px] text-slate-400">
                        {isRemainder ? '—' : '포장지: 톤백'}
                    </span>
                ) : (
                    <select
                        value={draft.packagingId ?? ''}
                        onChange={e =>
                            onChange({
                                ...draft,
                                packagingId: e.target.value ? Number(e.target.value) : null,
                            })
                        }
                        className={`h-9 w-full min-w-0 truncate rounded-md border bg-white px-1.5 text-[11.5px] text-slate-600 sm:h-7 ${fieldCls('packaging')}`}
                        aria-label="포장지"
                    >
                        <option value="">포장지 미지정</option>
                        {packagings
                            .filter(p => p.active)
                            .map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                    </select>
                )}

                {/* 3. 개수 stepper */}
                <div className="flex items-center justify-center">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 rounded-full text-slate-400 hover:text-slate-700"
                        onClick={() => step(-1)}
                        aria-label="개수 줄이기"
                    >
                        <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        data-count-index={index}
                        value={draft.count}
                        onChange={e => onChange({ ...draft, count: e.target.value })}
                        onFocus={e => e.target.select()}
                        className={`h-6 w-9 border-none px-0 text-center text-[12.5px] font-bold tabular-nums shadow-none ${
                            bad('count') ? 'text-red-600' : ''
                        }`}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 rounded-full text-slate-400 hover:text-slate-700"
                        onClick={() => step(1)}
                        aria-label="개수 늘리기"
                    >
                        <Plus className="h-3 w-3" />
                    </Button>
                </div>

                {/* 4. 자루당 kg — 톤백·잔량만 입력, 나머지는 줄 합계를 보여준다 */}
                {weightEditable ? (
                    <div className="flex items-center gap-0.5">
                        <Input
                            type="number"
                            inputMode="decimal"
                            step="0.001"
                            min="0"
                            data-weight-index={index}
                            value={draft.weightPerUnit}
                            onChange={e => onChange({ ...draft, weightPerUnit: e.target.value })}
                            onFocus={e => e.target.select()}
                            className={`h-7 w-full px-1 text-right text-[11.5px] tabular-nums ${fieldCls('weight')}`}
                            placeholder="kg"
                        />
                        <span className="shrink-0 text-[9px] text-slate-400">kg</span>
                    </div>
                ) : (
                    <span className="whitespace-nowrap text-right text-[12px] font-bold tabular-nums text-slate-700">
                        {lineKg.toLocaleString()}
                        <span className="ml-px text-[9px] font-normal text-slate-400">kg</span>
                    </span>
                )}

                {/* 5. 로트 — 데스크탑만 이 자리. 모바일은 아래 줄로 내려간다 */}
                {showLot && <div className="hidden sm:block">{lotSelect}</div>}

                {/* 6. 삭제 */}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mx-auto h-6 w-6 rounded-full text-slate-300 hover:bg-red-50 hover:text-red-500"
                    onClick={onRemove}
                    aria-label={`${draft.packageType} 줄 삭제`}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* 모바일 전용 로트 줄 — 데스크탑 폭에는 6열이 들어가지만 모바일은 안 들어간다 */}
            {showLot && <div className="sm:hidden">{lotSelect}</div>}

            {error && (
                <p className="px-0.5 text-[11px] font-semibold text-red-600">{error.message}</p>
            )}
        </div>
    )
}
