'use client'

import { useState, useMemo, Fragment } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { VarietyDialog } from './variety-dialog'
import { DeleteVarietyButton } from './delete-button'
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

interface Variety {
    id: number
    name: string
    type: string
}

interface VarietyListClientProps {
    varieties: Variety[]
    selectedIds: Set<number>
    onSelectionChange: (ids: Set<number>) => void
}

export function VarietyListClient({ varieties, selectedIds, onSelectionChange }: VarietyListClientProps) {
    const { data: session } = useSession()
    // @ts-ignore
    const canManage = hasPermission(session?.user, 'SUPPLY_MANAGE')

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            onSelectionChange(new Set(varieties.map(v => v.id)))
        } else {
            onSelectionChange(new Set())
        }
    }

    const handleSelectOne = (id: number, checked: boolean) => {
        const newSet = new Set(selectedIds)
        if (checked) {
            newSet.add(id)
        } else {
            newSet.delete(id)
        }
        onSelectionChange(newSet)
    }

    return (
        <>
            {/* Desktop View */}
            <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <Table className="table-fixed">
                    {canManage ? (
                        <colgroup>
                            <col className="w-[6%]" /><col className="w-[8%]" /><col className="w-[38%]" />
                            <col className="w-[34%]" /><col className="w-[14%]" />
                        </colgroup>
                    ) : (
                        <colgroup>
                            <col className="w-[9%]" /><col className="w-[46%]" /><col className="w-[45%]" />
                        </colgroup>
                    )}
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-transparent">
                            {canManage && (
                                <TableHead className="px-1 text-center">
                                    <Checkbox
                                        checked={selectedIds.size === varieties.length && varieties.length > 0}
                                        onCheckedChange={handleSelectAll}
                                    />
                                </TableHead>
                            )}
                            <TableHead className="text-center">No</TableHead>
                            <TableHead>품종명</TableHead>
                            <TableHead>곡종</TableHead>
                            {canManage && (
                                <TableHead className="text-center">수정</TableHead>
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {varieties.length > 0 ? (
                            <FlatVarietyRows
                                varieties={varieties}
                                selectedIds={selectedIds}
                                onSelectOne={handleSelectOne}
                                canManage={canManage}
                            />
                        ) : (
                            <TableRow>
                                <TableHead colSpan={canManage ? 5 : 3} className="h-32 text-center text-slate-400 font-medium">
                                    등록된 품종이 없습니다.
                                </TableHead>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile View */}
            <div className="block sm:hidden space-y-3">
                {varieties.length > 0 ? (
                    <MobileVarietyGroups
                        varieties={varieties}
                        selectedIds={selectedIds}
                        onSelectOne={handleSelectOne}
                        canManage={canManage}
                    />
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-400">
                        등록된 품종이 없습니다.
                    </div>
                )}
            </div>
        </>
    )
}

function MobileVarietyGroups({ varieties, selectedIds, onSelectOne, canManage }: {
    varieties: Variety[],
    selectedIds: Set<number>,
    onSelectOne: (id: number, checked: boolean) => void,
    canManage: boolean
}) {
    const groups = useMemo(() => {
        const grouped: Record<string, {
            key: string,
            type: string,
            label: string,
            count: number,
            items: Variety[]
        }> = {}

        varieties.forEach(variety => {
            const key = variety.type
            if (!grouped[key]) {
                const label = variety.type === 'URUCHI' ? '메벼' :
                    variety.type === 'GLUTINOUS' ? '찰벼' :
                        variety.type === 'INDICA' ? '인디카' :
                            variety.type === 'BLACK' ? '흑미' :
                                variety.type === 'MISC_GRAIN' ? '잡곡' :
                                    variety.type === 'PURCHASED' ? '매입' : '기타'
                grouped[key] = {
                    key,
                    type: variety.type,
                    label,
                    count: 0,
                    items: []
                }
            }
            grouped[key].items.push(variety)
            grouped[key].count += 1
        })

        // Sort items by name within group
        Object.values(grouped).forEach(group => {
            group.items.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
        })

        // Sort groups by type — 매입은 끝, 잡곡은 기타 앞
        const typeOrder: Record<string, number> = { 'URUCHI': 1, 'GLUTINOUS': 2, 'INDICA': 3, 'MISC_GRAIN': 4, 'OTHER': 5, 'PURCHASED': 6 }

        return Object.values(grouped).sort((a, b) => {
            return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99)
        })
    }, [varieties])

    return (
        <div className="space-y-4">
            {groups.map(group => (
                <div key={group.key} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    {/* Header */}
                    <div className="bg-slate-50 border-b border-slate-100 flex items-center justify-between px-3 py-2.5">
                        <span className="font-bold text-[13px] text-slate-800">{group.label}</span>
                        <Badge variant="secondary" className="bg-slate-200/60 text-slate-600 text-[10px] px-1.5 py-0">
                            {group.count}개
                        </Badge>
                    </div>

                    {/* Items */}
                    <div className="divide-y divide-slate-100">
                        {group.items.map(variety => (
                            <div key={variety.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-50/50">
                                <div className="flex items-center gap-3">
                                    {canManage && (
                                        <Checkbox
                                            checked={selectedIds.has(variety.id)}
                                            onCheckedChange={(checked) => onSelectOne(variety.id, checked as boolean)}
                                            className="h-4 w-4"
                                        />
                                    )}
                                    <span className="font-medium text-[13px] text-slate-700">{variety.name}</span>
                                </div>
                                {canManage && (
                                    <VarietyDialog mode="edit" variety={variety} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

function FlatVarietyRows({ varieties, selectedIds, onSelectOne, canManage }: {
    varieties: Variety[],
    selectedIds: Set<number>,
    onSelectOne: (id: number, checked: boolean) => void,
    canManage: boolean
}) {
    // Sort varieties by type then name — 매입은 끝, 잡곡은 기타 앞
    const sortedVarieties = useMemo(() => {
        const typeOrder: Record<string, number> = { 'URUCHI': 1, 'GLUTINOUS': 2, 'INDICA': 3, 'MISC_GRAIN': 4, 'OTHER': 5, 'PURCHASED': 6 }
        return [...varieties].sort((a, b) => {
            const typeDiff = (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99)
            if (typeDiff !== 0) return typeDiff
            return a.name.localeCompare(b.name, 'ko')
        })
    }, [varieties])

    return (
        <>
            {sortedVarieties.map((variety, index) => (
                <TableRow key={variety.id} className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                    {canManage && (
                        <TableCell className="px-1 text-center">
                            <Checkbox
                                checked={selectedIds.has(variety.id)}
                                onCheckedChange={(checked) => onSelectOne(variety.id, checked as boolean)}
                            />
                        </TableCell>
                    )}
                    <TableCell className="text-center font-mono tabular-nums text-slate-400">{index + 1}</TableCell>
                    <TableCell className="truncate font-semibold text-slate-900">{variety.name}</TableCell>
                    <TableCell className="truncate text-slate-500">
                        {variety.type === 'URUCHI' ? '메벼'
                            : variety.type === 'GLUTINOUS' ? '찰벼'
                                : variety.type === 'INDICA' ? '인디카'
                                    : variety.type === 'BLACK' ? '흑미'
                                        : variety.type === 'MISC_GRAIN' ? '잡곡'
                                            : variety.type === 'PURCHASED' ? '매입'
                                                : '기타'}
                    </TableCell>
                    {canManage && (
                        <TableCell className="text-center">
                            <VarietyDialog mode="edit" variety={variety} />
                        </TableCell>
                    )}
                </TableRow>
            ))}
        </>
    )
}
