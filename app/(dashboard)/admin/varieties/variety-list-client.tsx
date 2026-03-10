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
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-slate-50">
                            <TableHead className="w-[40px] py-2 px-1 text-center">
                                <Checkbox
                                    checked={selectedIds.size === varieties.length && varieties.length > 0}
                                    onCheckedChange={handleSelectAll}
                                />
                            </TableHead>
                            <TableHead className="w-[60px] text-center font-bold text-slate-500">No</TableHead>
                            <TableHead className="font-bold text-slate-500">품종명</TableHead>
                            <TableHead className="font-bold text-slate-500">곡종</TableHead>
                            <TableHead className="w-[100px] text-center font-bold text-slate-500">수정</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {varieties.length > 0 ? (
                            <FlatVarietyRows
                                varieties={varieties}
                                selectedIds={selectedIds}
                                onSelectOne={handleSelectOne}
                            />
                        ) : (
                            <TableRow>
                                <TableHead colSpan={5} className="h-32 text-center text-slate-400 font-medium">
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

function MobileVarietyGroups({ varieties, selectedIds, onSelectOne }: {
    varieties: Variety[],
    selectedIds: Set<number>,
    onSelectOne: (id: number, checked: boolean) => void
}) {
    const { data: session } = useSession()
    // @ts-ignore
    const canManage = hasPermission(session?.user, 'VARIETY_MANAGE')

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
                        variety.type === 'INDICA' ? '인디카' : '기타'
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

        // Sort groups by type
        const typeOrder: Record<string, number> = { 'URUCHI': 1, 'GLUTINOUS': 2, 'INDICA': 3, 'OTHER': 4 }

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
                                    <Checkbox
                                        checked={selectedIds.has(variety.id)}
                                        onCheckedChange={(checked) => onSelectOne(variety.id, checked as boolean)}
                                        className="h-4 w-4"
                                    />
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

function FlatVarietyRows({ varieties, selectedIds, onSelectOne }: {
    varieties: Variety[],
    selectedIds: Set<number>,
    onSelectOne: (id: number, checked: boolean) => void
}) {
    const { data: session } = useSession()
    // @ts-ignore
    const canManage = hasPermission(session?.user, 'VARIETY_MANAGE')

    // Sort varieties by type then name
    const sortedVarieties = useMemo(() => {
        const typeOrder: Record<string, number> = { 'URUCHI': 1, 'GLUTINOUS': 2, 'INDICA': 3, 'OTHER': 4 }
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
                    <TableCell className="py-2 px-1 w-[40px] text-center">
                        <Checkbox
                            checked={selectedIds.has(variety.id)}
                            onCheckedChange={(checked) => onSelectOne(variety.id, checked as boolean)}
                        />
                    </TableCell>
                    <TableCell className="text-center font-medium text-slate-600 text-xs">{index + 1}</TableCell>
                    <TableCell className="font-medium text-slate-800 text-sm">{variety.name}</TableCell>
                    <TableCell className="text-slate-500 text-xs">
                        {variety.type === 'URUCHI' ? '메벼' : variety.type === 'GLUTINOUS' ? '찰벼' : variety.type === 'INDICA' ? '인디카' : '기타'}
                    </TableCell>
                    <TableCell className="text-center">
                        {canManage && <VarietyDialog mode="edit" variety={variety} />}
                    </TableCell>
                </TableRow>
            ))}
        </>
    )
}
