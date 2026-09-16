'use client'

import { useMemo, useState } from 'react'
import { VarietyRowMenu } from './variety-row-menu'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'
import {
    VARIETY_TYPE_ORDER,
    getVarietyTypeLabel,
    getVarietyTypeOrder,
    sortByVarietyType,
} from '@/lib/variety-labels'

interface Variety {
    id: number
    name: string
    type: string
    aliases: string[]
}

const ALL = '__ALL__'

export function VarietyListClient({ varieties, q, onResetSearch }: {
    varieties: Variety[]
    /** 검색어 — 입력칸은 상단 줄(등록 버튼 옆)에 있다 */
    q: string
    onResetSearch: () => void
}) {
    const { data: session } = useSession()
    const canManage = hasPermission(session?.user, 'SUPPLY_MANAGE')

    const [typeFilter, setTypeFilter] = useState<string>(ALL)

    // 🔴 칩 개수는 **검색과 무관한 전체 기준**이다.
    //    검색할 때마다 배지 숫자가 요동치면 읽을 수 없다.
    const chips = useMemo(() => {
        const counted = Object.keys(VARIETY_TYPE_ORDER)
            .map(type => ({
                type,
                label: getVarietyTypeLabel(type),
                count: varieties.filter(v => v.type === type).length,
            }))
            .filter(c => c.count > 0) // 0개 곡종 칩은 만들지 않는다
            .sort((a, b) => getVarietyTypeOrder(a.type) - getVarietyTypeOrder(b.type))
        return [{ type: ALL, label: '전체', count: varieties.length }, ...counted]
    }, [varieties])

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase()
        return varieties.filter(v => {
            if (typeFilter !== ALL && v.type !== typeFilter) return false
            if (needle === '') return true
            // 별칭도 검색 대상 — 발주서에서 「가바」를 보고 들어온 사람이 서농22호를 찾는 주 경로
            return v.name.toLowerCase().includes(needle)
                || v.aliases.some(a => a.toLowerCase().includes(needle))
        })
    }, [varieties, q, typeFilter])

    const isFiltered = typeFilter !== ALL || q.trim() !== ''
    const resetFilters = () => {
        setTypeFilter(ALL)
        onResetSearch()
    }

    return (
        <>
            {/* 곡종 필터 칩 — 단일 선택, 기본 「전체」. URL·localStorage에 남기지 않는다.
                🔴 위아래 8px인 것은 부모 grid의 `gap-1`(4px)이 더해져 시안의 12px가 되기 때문이다 */}
            <div className="flex flex-wrap gap-1.5 px-1 pt-2 pb-2">
                {chips.map(chip => {
                    const active = typeFilter === chip.type
                    return (
                        <button
                            key={chip.type}
                            type="button"
                            onClick={() => setTypeFilter(chip.type)}
                            aria-pressed={active}
                            className={
                                'inline-flex h-[30px] items-center gap-1 rounded-full border px-3 text-[12.5px] font-semibold transition-colors '
                                + (active
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')
                            }
                        >
                            {chip.label}
                            <span
                                className={
                                    'text-[11px] tabular-nums '
                                    + (active ? 'text-primary-foreground/70' : 'text-slate-400')
                                }
                            >
                                {chip.count}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* Desktop View */}
            <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <Table className="table-fixed">
                    {canManage ? (
                        <colgroup>
                            <col className="w-[8%]" /><col className="w-[32%]" /><col className="w-[30%]" />
                            <col className="w-[22%]" /><col className="w-[8%]" />
                        </colgroup>
                    ) : (
                        <colgroup>
                            <col className="w-[9%]" /><col className="w-[31%]" /><col className="w-[33%]" />
                            <col className="w-[27%]" />
                        </colgroup>
                    )}
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-transparent">
                            <TableHead className="text-center">No</TableHead>
                            <TableHead>품종명</TableHead>
                            <TableHead>별칭</TableHead>
                            <TableHead>곡종</TableHead>
                            {canManage && <TableHead />}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length > 0 ? (
                            <FlatVarietyRows varieties={filtered} allVarieties={varieties} canManage={canManage} />
                        ) : (
                            <TableRow>
                                <TableCell colSpan={canManage ? 5 : 4} className="h-32 text-center text-slate-400 font-medium">
                                    <EmptyMessage isFiltered={isFiltered} onReset={resetFilters} />
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile View */}
            <div className="block sm:hidden space-y-3">
                {filtered.length > 0 ? (
                    <MobileVarietyGroups varieties={filtered} allVarieties={varieties} canManage={canManage} />
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-400">
                        <EmptyMessage isFiltered={isFiltered} onReset={resetFilters} />
                    </div>
                )}
            </div>
        </>
    )
}

function EmptyMessage({ isFiltered, onReset }: { isFiltered: boolean; onReset: () => void }) {
    if (!isFiltered) return <>등록된 품종이 없어요.</>
    return (
        <span className="inline-flex flex-col items-center gap-1">
            <span>조건에 맞는 결과가 없어요. 필터를 바꿔보세요.</span>
            <button type="button" onClick={onReset} className="text-primary font-semibold hover:underline">
                전체 보기
            </button>
        </span>
    )
}

/**
 * 별칭 칩 나열 (결정 Y) — 🔴 한눈에 보이는 게 이번 작업의 절반이다.
 * 잘못 학습된 별칭은 목록에서 보여야 발견된다. 권한과 무관하게 모두에게 보인다.
 */
function AliasChips({ aliases, className }: { aliases: string[]; className?: string }) {
    if (aliases.length === 0) {
        return <span className="text-slate-300">—</span>
    }
    return (
        <div className={className ?? 'flex flex-wrap gap-1'}>
            {aliases.map(alias => (
                <span
                    key={alias}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
                >
                    {alias}
                </span>
            ))}
        </div>
    )
}

function MobileVarietyGroups({ varieties, allVarieties, canManage }: {
    varieties: Variety[],
    allVarieties: Variety[],
    canManage: boolean
}) {
    const groups = useMemo(() => {
        const grouped: Record<string, { key: string, type: string, label: string, items: Variety[] }> = {}

        varieties.forEach(variety => {
            const key = variety.type
            if (!grouped[key]) {
                grouped[key] = { key, type: variety.type, label: getVarietyTypeLabel(variety.type), items: [] }
            }
            grouped[key].items.push(variety)
        })

        // Sort items by name within group
        Object.values(grouped).forEach(group => {
            group.items.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
        })

        // 🔴 곡종 순서는 `lib/variety-labels.ts` 한 곳에서만 정한다
        //    (BLACK이 빠져 있어 흑미가 매입 뒤로 밀려 있었다 — 2026-09-16 해소)
        return Object.values(grouped).sort(
            (a, b) => getVarietyTypeOrder(a.type) - getVarietyTypeOrder(b.type)
        )
    }, [varieties])

    return (
        <div className="space-y-4">
            {groups.map(group => (
                <div key={group.key} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    {/* Header */}
                    <div className="bg-slate-50 border-b border-slate-100 flex items-center justify-between px-3 py-2.5">
                        <span className="font-bold text-[13px] text-slate-800">{group.label}</span>
                        <Badge variant="secondary" className="bg-slate-200/60 text-slate-600 text-[10px] px-1.5 py-0">
                            {group.items.length}개
                        </Badge>
                    </div>

                    {/* Items */}
                    <div className="divide-y divide-slate-100">
                        {group.items.map(variety => (
                            <div key={variety.id} className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-slate-50/50">
                                {/* 별칭은 품종명 아래 줄로 — 옆에 붙이면 이름이 밀려 잘린다 */}
                                <div className="min-w-0">
                                    <span className="font-medium text-[13px] text-slate-700">{variety.name}</span>
                                    {variety.aliases.length > 0 && (
                                        <AliasChips aliases={variety.aliases} className="flex flex-wrap gap-1 mt-1" />
                                    )}
                                </div>
                                {canManage && <VarietyRowMenu variety={variety} varieties={allVarieties} />}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

function FlatVarietyRows({ varieties, allVarieties, canManage }: {
    varieties: Variety[],
    allVarieties: Variety[],
    canManage: boolean
}) {
    // 🔴 곡종 순 → 이름순. 순서는 `lib/variety-labels.ts` 단일 원천
    const sortedVarieties = useMemo(() => sortByVarietyType(varieties), [varieties])

    return (
        <>
            {sortedVarieties.map((variety, index) => (
                <TableRow key={variety.id} className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                    <TableCell className="text-center font-mono tabular-nums text-slate-400">{index + 1}</TableCell>
                    <TableCell className="truncate font-semibold text-slate-900">{variety.name}</TableCell>
                    <TableCell><AliasChips aliases={variety.aliases} /></TableCell>
                    <TableCell className="truncate text-slate-500">{getVarietyTypeLabel(variety.type)}</TableCell>
                    {canManage && (
                        <TableCell className="text-center">
                            <VarietyRowMenu variety={variety} varieties={allVarieties} />
                        </TableCell>
                    )}
                </TableRow>
            ))}
        </>
    )
}
