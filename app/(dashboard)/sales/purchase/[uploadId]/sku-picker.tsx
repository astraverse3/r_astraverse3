'use client'

// 발주서에 추가할 제품(SKU) 고르기 — 검색 목록 (계획서 `plan-발주서-건상세-수정추가.md` 2단계)
//
// 품종→도정→규격→포장지 단계 셀렉트를 쓰지 않는다(D2e 결정 P — 단마다 막다른 골목이 생긴다).
// SKU가 100개 안쪽이라 전부 펼치고 글자로 거르는 게 빠르고 안 틀린다.
// 목록은 서버가 **매처 검증을 통과한 SKU만** 준다(`listAddableSkus`) — 여기서 고른 건 반드시 추가된다.
// 열 때마다 새로 읽는다 — 제품유형 관리에서 방금 등록한 SKU가 바로 보여야 한다.

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { listAddableSkus, type AddableSku } from '@/app/actions/purchase-order-add'
import { settle } from '@/lib/settle-action'

/** 검색 키 — 공백·가운뎃점 무시, 소문자(`10KG` = `10kg`) */
const key = (s: string) => s.replace(/[\s·]/g, '').toLowerCase()

export function SkuPicker({
    value,
    onChange,
    disabled,
}: {
    value: number | null
    onChange: (sku: AddableSku) => void
    disabled?: boolean
}) {
    const [skus, setSkus] = useState<AddableSku[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [query, setQuery] = useState('')

    useEffect(() => {
        let alive = true
        settle(listAddableSkus()).then((r) => {
            if (!alive) return
            if (r.success) setSkus(r.data)
            else setError(r.error)
        })
        return () => {
            alive = false
        }
    }, [])

    const shown = useMemo(() => {
        if (!skus) return []
        const tokens = query.split(/\s+/).map(key).filter(Boolean)
        if (tokens.length === 0) return skus
        return skus.filter((s) => {
            const hay = key(`${s.name}${s.spec}${s.packaging}`)
            return tokens.every((t) => hay.includes(t))
        })
    }, [skus, query])

    return (
        <div className="flex flex-col gap-1.5">
            <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="품종·규격·포장지로 찾기 (예: 서농 현미 5kg)"
                disabled={disabled}
                className="h-10 text-[14px] sm:h-9"
                aria-label="제품 찾기"
            />
            <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-card">
                {error ? (
                    <p className="px-3 py-2.5 text-[12px] text-red-600">{error}</p>
                ) : !skus ? (
                    <p className="px-3 py-2.5 text-[12px] text-slate-500">불러오는 중…</p>
                ) : shown.length === 0 ? (
                    <p className="px-3 py-2.5 text-[12px] leading-relaxed text-slate-500">
                        맞는 제품이 없어요. 없는 제품은 <b className="text-slate-700">관리자 메뉴 › 제품유형 관리</b>에서
                        먼저 등록해 주세요.
                    </p>
                ) : (
                    shown.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => onChange(s)}
                            className={cn(
                                'flex w-full items-baseline gap-2 border-b border-slate-100 px-3 py-2 text-left last:border-b-0',
                                value === s.id ? 'bg-primary/10' : 'hover:bg-slate-50',
                            )}
                        >
                            <span
                                className={cn(
                                    'min-w-0 flex-1 truncate text-[13px] font-semibold',
                                    value === s.id ? 'text-primary' : 'text-slate-800',
                                )}
                            >
                                {s.name} {s.spec}
                            </span>
                            <span className="shrink-0 text-[12px] text-slate-500">{s.packaging}</span>
                        </button>
                    ))
                )}
            </div>
        </div>
    )
}
