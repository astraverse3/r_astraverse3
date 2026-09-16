'use client'

import { useMemo, useState } from 'react'
import { X, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { validateAlias, type AliasVariety } from '@/lib/variety-alias'

interface Props {
    /** 현재 칩 목록(저장 전 상태) */
    aliases: string[]
    onChange: (next: string[]) => void
    /** 편집 중인 품종. name은 다이얼로그에서 수정 중인 값이 들어온다 */
    target: { id: number; name: string }
    /** 전체 품종 목록 — 다른 품종과의 충돌 검사에 쓴다 */
    varieties: AliasVariety[]
}

/**
 * 품종 별칭 편집기 — 칩(태그) 방식 (계획서 결정 W).
 *
 * 쉼표 한 줄보다 나은 이유: 개별 삭제가 명확하고, 거절 사유를 그 입력에 붙여 보여줄 수 있다.
 * 검증은 `lib/variety-alias.ts` 하나만 쓴다 — 서버 액션도 같은 함수로 전수 재검증한다(결정 X).
 */
export function AliasEditor({ aliases, onChange, target, varieties }: Props) {
    const [draft, setDraft] = useState('')
    const [error, setError] = useState<string | null>(null)

    // 다이얼로그를 연 시점의 별칭 — 하나라도 사라졌으면 경고를 띄운다(리스크 §6)
    const initial = useMemo(() => aliases, []) // eslint-disable-line react-hooks/exhaustive-deps
    const removed = initial.some((a) => !aliases.includes(a))

    const handleAdd = () => {
        const verdict = validateAlias(draft, { ...target, aliases }, varieties)
        if (!verdict.ok) {
            setError(verdict.message)
            return
        }
        onChange([...aliases, verdict.value])
        setDraft('')
        setError(null)
    }

    const handleRemove = (value: string) => {
        onChange(aliases.filter((a) => a !== value))
        setError(null)
    }

    return (
        <div className="space-y-2">
            <Label htmlFor={`alias-${target.id}`}>별칭</Label>
            <p className="text-[11px] text-slate-500 leading-relaxed">
                발주서 품목명이 이 품종을 다른 이름으로 부를 때 등록합니다. 예: 「가바」 → 서농22호
            </p>

            {aliases.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {aliases.map((alias) => (
                        <span
                            key={alias}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 pl-2.5 pr-1 py-0.5 text-xs text-slate-700"
                        >
                            {alias}
                            <button
                                type="button"
                                onClick={() => handleRemove(alias)}
                                className="rounded-full p-0.5 text-slate-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                                title={`${alias} 삭제`}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <div className="flex gap-2">
                <Input
                    id={`alias-${target.id}`}
                    value={draft}
                    onChange={(e) => {
                        setDraft(e.target.value)
                        if (error) setError(null)
                    }}
                    onKeyDown={(e) => {
                        // form 안이라 Enter가 저장으로 새지 않게 막는다
                        if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAdd()
                        }
                    }}
                    placeholder="예: 가바"
                    className="flex-1 min-w-0"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAdd} disabled={!draft.trim()}>
                    <Plus className="h-4 w-4 mr-1" />
                    추가
                </Button>
            </div>

            {error && <p className="text-[11px] text-red-600">{error}</p>}

            {removed && (
                <p className="text-[11px] text-amber-600">
                    별칭을 지우면 그 이름으로 오던 발주서 품목은 다음 업로드부터 매칭실패로 돌아갑니다.
                </p>
            )}
        </div>
    )
}
