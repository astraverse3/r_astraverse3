'use client'

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { REPACK_SPECS, PACKAGE_TYPE_REMAINDER, PACKAGE_TYPE_TONBAG } from '@/lib/repack'
import type { RepackLotOption } from '@/app/actions/repack'

/** 오류를 어느 필드에 표시할지 — 다이얼로그와 공유한다 */
export type ResultFieldKey = 'spec' | 'weight' | 'count' | 'lot'

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

export const emptyResultDraft = (key: string, defaultLotPackageId: number): ResultDraft => ({
    key,
    packageType: '',
    weightPerUnit: '',
    count: '1',
    packagingId: null,
    inheritFromPackageId: defaultLotPackageId,
})

interface Props {
    draft: ResultDraft
    index: number
    packagings: { id: number; name: string; active: boolean }[]
    lotOptions: RepackLotOption[]
    onChange: (next: ResultDraft) => void
    onRemove: () => void
    canRemove: boolean
    /** 이 줄에서 막힌 이유 — 다이얼로그의 blockingReason과 같은 판정이다 */
    error?: { field: ResultFieldKey; message: string } | null
}

export function RepackResultRow({
    draft,
    index,
    packagings,
    lotOptions,
    onChange,
    onRemove,
    canRemove,
    error,
}: Props) {
    const isRemainder = draft.packageType === PACKAGE_TYPE_REMAINDER
    const isTonbag = draft.packageType === PACKAGE_TYPE_TONBAG
    // 톤백·잔량은 자루마다 중량이 달라 사람이 직접 넣는다
    const weightEditable = isRemainder || isTonbag || !draft.packageType

    const pickSpec = (label: string, weight: number | null) => {
        onChange({
            ...draft,
            packageType: label,
            weightPerUnit: weight === null ? '' : String(weight),
            // 잔량은 SKU를 부여하지 않는다 — 포장지를 비운다
            packagingId: label === PACKAGE_TYPE_REMAINDER ? null : draft.packagingId,
        })
    }

    const lineKg = (Number(draft.weightPerUnit) || 0) * (Number(draft.count) || 0)

    const bad = (f: ResultFieldKey) => error?.field === f
    const fieldCls = (f: ResultFieldKey) =>
        bad(f) ? 'border-red-300 focus-visible:ring-red-400' : ''

    return (
        <div
            className={`flex flex-col gap-2 rounded-lg border p-2.5 ${
                error ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-white'
            }`}
        >
            <div className="flex items-center justify-between gap-2">
                <span className={`text-[11px] font-bold ${error ? 'text-red-600' : 'text-slate-400'}`}>
                    {index + 1}번째 줄
                </span>
                <div className="flex items-center gap-2">
                    {error ? (
                        <span className="text-[11px] font-semibold text-red-600">{error.message}</span>
                    ) : (
                        lineKg > 0 && (
                            <span className="text-[11.5px] tabular-nums text-slate-500">
                                {lineKg.toLocaleString()}kg
                            </span>
                        )
                    )}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-slate-400 hover:text-red-600 disabled:opacity-30"
                        onClick={onRemove}
                        disabled={!canRemove}
                        aria-label={`${index + 1}번째 줄 삭제`}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* 규격 템플릿 — 모바일 터치 34px */}
            <div className="flex flex-wrap gap-1">
                {REPACK_SPECS.map(s => (
                    <button
                        key={s.label}
                        type="button"
                        onClick={() => pickSpec(s.label, s.weight)}
                        className={`rounded-md border px-2 py-2 text-[11.5px] transition-colors sm:py-1 ${
                            draft.packageType === s.label
                                ? 'border-primary bg-primary/10 font-bold text-primary'
                                : bad('spec')
                                  ? 'border-red-200 text-slate-600 hover:bg-white'
                                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label className="flex flex-col gap-1">
                    <span className="text-[10.5px] font-bold text-slate-400">자루당 kg</span>
                    <Input
                        type="number"
                        inputMode="decimal"
                        step="0.001"
                        min="0"
                        value={draft.weightPerUnit}
                        disabled={!weightEditable}
                        onChange={e => onChange({ ...draft, weightPerUnit: e.target.value })}
                        className={`h-10 text-[12.5px] tabular-nums sm:h-8 ${fieldCls('weight')}`}
                        placeholder={weightEditable ? '직접 입력' : ''}
                    />
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-[10.5px] font-bold text-slate-400">개수</span>
                    <Input
                        type="number"
                        inputMode="numeric"
                        step="1"
                        min="1"
                        value={draft.count}
                        onChange={e => onChange({ ...draft, count: e.target.value })}
                        className={`h-10 text-[12.5px] tabular-nums sm:h-8 ${fieldCls('count')}`}
                    />
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-[10.5px] font-bold text-slate-400">포장지</span>
                    <select
                        value={draft.packagingId ?? ''}
                        disabled={isRemainder || isTonbag}
                        onChange={e =>
                            onChange({
                                ...draft,
                                packagingId: e.target.value ? Number(e.target.value) : null,
                            })
                        }
                        className="h-10 rounded-md border border-slate-200 bg-white px-2 text-[12.5px] disabled:bg-slate-50 disabled:text-slate-400 sm:h-8"
                    >
                        <option value="">
                            {isRemainder ? '없음(잔량)' : isTonbag ? '톤백 고정' : '선택'}
                        </option>
                        {packagings
                            .filter(p => p.active)
                            .map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                    </select>
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-[10.5px] font-bold text-slate-400">로트 승계</span>
                    <select
                        value={draft.inheritFromPackageId || ''}
                        onChange={e =>
                            onChange({ ...draft, inheritFromPackageId: Number(e.target.value) || 0 })
                        }
                        disabled={lotOptions.length <= 1}
                        className={`h-10 rounded-md border bg-white px-2 text-[12.5px] disabled:bg-slate-50 disabled:text-slate-500 sm:h-8 ${fieldCls('lot') || 'border-slate-200'}`}
                    >
                        {/* 로트가 여럿이면 기본 선택을 두지 않는다 — 무심코 넘어가면 안 된다 */}
                        {lotOptions.length > 1 && <option value="">선택</option>}
                        {lotOptions.map(o => (
                            <option key={o.packageId} value={o.packageId}>
                                {o.producer} · {o.lotNo ?? '매입(로트 없음)'} · {o.kg.toLocaleString()}kg
                            </option>
                        ))}
                    </select>
                </label>
            </div>
        </div>
    )
}
