'use client'

// 발주서에 추가할 제품(SKU) 고르기 — 주문 추가 창 · 건 상세 품목 추가가 함께 쓴다
// (계획서 `plan-발주서-건상세-수정추가.md` 2단계 · 모양은 작업지시 ⑧ P1, `plan-품목고르기-디자인.md`)
//
// 고르기 전 = 검색칸. 결과는 **검색칸에 들어가거나 글자가 있을 때만** 최대 5줄 펼친다(처음엔 안 보인다).
// 고른 뒤 = `[✓ 품목 · 포장지 … 바꾸기] [− n +] [action]` 한 줄.
//
// 품종→도정→규격→포장지 단계 셀렉트를 쓰지 않는다(D2e 결정 P — 단마다 막다른 골목이 생긴다).
// 목록은 서버가 **매처 검증을 통과한 SKU만** 준다(`listAddableSkus`) — 여기서 고른 건 반드시 추가된다.
// 열 때마다 새로 읽는다 — 제품유형 관리에서 방금 등록한 SKU가 바로 보여야 한다.
//
// 🔴 결과 줄은 `onMouseDown`에서 `preventDefault` — 검색칸 포커스가 먼저 빠지면 목록이 닫혀 클릭이 허공에 떨어진다.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { listAddableSkus, type AddableSku } from '@/app/actions/purchase-order-add'
import { MAX_ORDER_QTY } from '@/lib/purchase-order-edit'
import { settle } from '@/lib/settle-action'
import { QtyStepper } from './qty-stepper'

/** 검색 키 — 공백·가운뎃점 무시, 소문자(`10KG` = `10kg`) */
const key = (s: string) => s.replace(/[\s·]/g, '').toLowerCase()

type Props = {
    value: AddableSku | null
    /** null = 「바꾸기」(검색 상태로) */
    onChange: (sku: AddableSku | null) => void
    /** 이미 주문에 있는 productTypeId — 「이미 있음」으로 보이고 고를 수 없다 */
    taken?: number[]
    qty: string
    onQty: (v: string) => void
    /** 수량 옆 버튼(건 상세의 「추가」) */
    action?: ReactNode
    autoFocus?: boolean
    disabled?: boolean
}

export function SkuPicker(props: Props) {
    const [skus, setSkus] = useState<AddableSku[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [query, setQuery] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const refocus = useRef(false)

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

    // 「바꾸기」 뒤 검색칸으로 돌아가 포커스(지난 검색어 유지)
    useEffect(() => {
        if (props.value === null && refocus.current) {
            refocus.current = false
            inputRef.current?.focus()
        }
    }, [props.value])

    if (props.value) {
        return (
            <PickedRow
                {...props}
                sku={props.value}
                onReset={() => {
                    refocus.current = true
                    props.onChange(null)
                }}
            />
        )
    }
    return (
        <SearchBox
            skus={skus}
            error={error}
            query={query}
            onQuery={setQuery}
            inputRef={inputRef}
            taken={props.taken}
            autoFocus={props.autoFocus}
            disabled={props.disabled}
            onPick={props.onChange}
        />
    )
}

function PickedRow({ sku, qty, onQty, action, disabled, onReset }: Props & { sku: AddableSku; onReset: () => void }) {
    const n = Number(qty)
    const valid = qty !== '' && Number.isInteger(n) && n >= 1 && n <= MAX_ORDER_QTY
    return (
        <div className="flex items-center gap-2">
            <div className="flex h-10 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 pr-1 pl-3">
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-[13px]">
                    <b className="font-semibold text-slate-900">
                        {sku.name} {sku.spec}
                    </b>
                    <span className="text-slate-600"> · {sku.packaging}</span>
                </span>
                <button
                    type="button"
                    onClick={onReset}
                    disabled={disabled}
                    className="h-8 shrink-0 rounded px-2 text-[12px] font-semibold text-blue-700 hover:bg-blue-100"
                >
                    바꾸기
                </button>
            </div>
            <QtyStepper
                value={qty}
                onValue={onQty}
                min={1}
                max={MAX_ORDER_QTY}
                disabled={disabled}
                tone={valid ? 'normal' : 'invalid'}
                label={`${sku.name} ${sku.spec} 수량`}
            />
            {action}
        </div>
    )
}

function SearchBox({
    skus,
    error,
    query,
    onQuery,
    inputRef,
    taken,
    autoFocus,
    disabled,
    onPick,
}: {
    skus: AddableSku[] | null
    error: string | null
    query: string
    onQuery: (q: string) => void
    inputRef: RefObject<HTMLInputElement | null>
    taken?: number[]
    autoFocus?: boolean
    disabled?: boolean
    onPick: (sku: AddableSku) => void
}) {
    const [focused, setFocused] = useState(false)
    const [active, setActive] = useState(0)
    const listRef = useRef<HTMLDivElement>(null)
    const takenSet = useMemo(() => new Set(taken ?? []), [taken])
    const shown = useMemo(() => filterSkus(skus ?? [], query), [skus, query])
    const pickable = (i: number) => i >= 0 && i < shown.length && !takenSet.has(shown[i].id)
    // 미리 강조할 줄 — 고를 수 있는 첫 줄. 이미 있는 품목은 건너뛴다
    const firstPickable = shown.findIndex((s) => !takenSet.has(s.id))
    const activeIdx = pickable(active) ? active : firstPickable

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) =>
        handleListKey(e, { activeIdx, length: shown.length, pickable, list: listRef.current, setActive, pick: (i) => onPick(shown[i]) })

    return (
        <div className="flex flex-col gap-1.5">
            <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-[15px] w-[15px] -translate-y-1/2 text-slate-500" />
                <Input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => {
                        onQuery(e.target.value)
                        setActive(0)
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onKeyDown={onKeyDown}
                    placeholder="품종·규격·포장지로 찾기 (예: 서농 현미 5kg)"
                    autoFocus={autoFocus}
                    disabled={disabled}
                    className="h-10 pl-8 text-[14px] sm:h-9"
                    aria-label="제품 찾기"
                />
            </div>
            {(focused || query !== '') && (
                <Results listRef={listRef} skus={skus} error={error} shown={shown} takenSet={takenSet} activeIdx={activeIdx} onPick={onPick} />
            )}
        </div>
    )
}

function Results({
    listRef,
    skus,
    error,
    shown,
    takenSet,
    activeIdx,
    onPick,
}: {
    listRef: RefObject<HTMLDivElement | null>
    skus: AddableSku[] | null
    error: string | null
    shown: AddableSku[]
    takenSet: Set<number>
    activeIdx: number
    onPick: (sku: AddableSku) => void
}) {
    return (
        // 최대 5줄(줄 40px) — 넘치면 이 상자만 스크롤된다
        <div ref={listRef} className="relative max-h-[200px] overflow-y-auto rounded-md border border-slate-200 bg-card">
            {error ? (
                <p className="px-3 py-2.5 text-[12px] text-red-600">{error}</p>
            ) : !skus ? (
                <p className="px-3 py-2.5 text-[12px] text-slate-500">불러오는 중…</p>
            ) : shown.length === 0 ? (
                <p className="px-3 py-2.5 text-[12px] leading-relaxed text-slate-500">
                    맞는 제품이 없어요. 없는 제품은 <b className="text-slate-700">관리자 메뉴 › 제품유형 관리</b>에서 먼저 등록해 주세요.
                </p>
            ) : (
                shown.map((s, i) => (
                    <ResultRow
                        key={s.id}
                        sku={s}
                        idx={i}
                        taken={takenSet.has(s.id)}
                        active={i === activeIdx}
                        onPick={onPick}
                    />
                ))
            )}
        </div>
    )
}

/** 결과 한 줄 — 이미 있는 품목은 눌러도 반응 없음(aria-disabled). 서버 거부는 그대로 둔다(이중 안전장치) */
function ResultRow({
    sku,
    idx,
    taken,
    active,
    onPick,
}: {
    sku: AddableSku
    idx: number
    taken: boolean
    active: boolean
    onPick: (sku: AddableSku) => void
}) {
    return (
        <button
            type="button"
            data-idx={idx}
            aria-disabled={taken || undefined}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => !taken && onPick(sku)}
            className={cn(
                'flex h-10 w-full items-center gap-2 border-b border-slate-100 px-3 text-left last:border-b-0',
                taken ? 'cursor-default' : 'hover:bg-slate-50',
                active && 'bg-slate-50',
            )}
        >
            <span className={cn('min-w-0 flex-1 truncate text-[13px] font-semibold', taken ? 'text-slate-500' : 'text-slate-800')}>
                {sku.name} {sku.spec}
            </span>
            {taken ? (
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[12px] text-slate-500">이미 있음 · 수량에서 고치기</span>
            ) : (
                <span className="shrink-0 text-[12px] text-slate-500">{sku.packaging}</span>
            )}
        </button>
    )
}

/** 낱말마다 다 들어 있어야 한다(AND) — 「서농 현미 5kg」 */
function filterSkus(skus: AddableSku[], query: string): AddableSku[] {
    const tokens = query.split(/\s+/).map(key).filter(Boolean)
    if (tokens.length === 0) return skus
    return skus.filter((s) => {
        const hay = key(`${s.name}${s.spec}${s.packaging}`)
        return tokens.every((t) => hay.includes(t))
    })
}

/** ↑↓ = 고를 수 있는 다음 줄로 · Enter = 고르기 */
function handleListKey(
    e: KeyboardEvent<HTMLInputElement>,
    c: {
        activeIdx: number
        length: number
        pickable: (i: number) => boolean
        list: HTMLDivElement | null
        setActive: (i: number) => void
        pick: (i: number) => void
    },
) {
    if (e.key === 'Enter') {
        e.preventDefault()
        if (c.pickable(c.activeIdx)) c.pick(c.activeIdx)
        return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const next = moveActive(c.activeIdx, e.key === 'ArrowDown' ? 1 : -1, c.length, c.pickable)
    c.setActive(next)
    keepVisible(c.list, next)
}

/** ↑↓ — 고를 수 있는 다음 줄로. 끝이면 그 자리 */
function moveActive(from: number, dir: 1 | -1, length: number, pickable: (i: number) => boolean): number {
    for (let i = from + dir; i >= 0 && i < length; i += dir) if (pickable(i)) return i
    return from
}

/** 키보드로 옮긴 줄이 상자 밖이면 상자의 scrollTop만 맞춘다(바깥 패널까지 흔드는 scrollIntoView는 쓰지 않는다) */
function keepVisible(list: HTMLDivElement | null, idx: number) {
    const row = list?.querySelector<HTMLElement>(`[data-idx="${idx}"]`)
    if (!list || !row) return
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight
    }
}
