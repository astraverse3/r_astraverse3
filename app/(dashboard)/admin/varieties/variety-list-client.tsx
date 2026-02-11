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
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
                        <GroupedVarietyRows
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
    )
}

function GroupedVarietyRows({ varieties, selectedIds, onSelectOne }: {
    varieties: Variety[],
    selectedIds: Set<number>,
    onSelectOne: (id: number, checked: boolean) => void
}) {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

    const toggleGroup = (key: string) => {
        const newSet = new Set(expandedGroups)
        if (newSet.has(key)) {
            newSet.delete(key)
        } else {
            newSet.add(key)
        }
        setExpandedGroups(newSet)
    }

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

        // Sort groups by type (custom order: Uruchi -> Glutinous -> Others)
        const typeOrder: Record<string, number> = { 'URUCHI': 1, 'GLUTINOUS': 2, 'INDICA': 3, 'OTHER': 4 }

        return Object.values(grouped).sort((a, b) => {
            return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99)
        })
    }, [varieties])

    // Auto-expand removed as per user request (default collapsed)


    return (
        <>
            {groups.map(group => {
                const isExpanded = expandedGroups.has(group.key)
                return (
                    <Fragment key={group.key}>
                        <TableRow
                            className="bg-slate-100 hover:bg-slate-200 cursor-pointer border-y border-slate-200 font-bold text-slate-900 shadow-sm h-10"
                            onClick={() => toggleGroup(group.key)}
                        >
                            <TableCell></TableCell>
                            <TableCell className="text-center">
                                <div className="flex items-center justify-center">
                                    {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                                </div>
                            </TableCell>
                            <TableCell className="text-sm">{group.label}</TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-center text-sm text-slate-600">{group.count}개</TableCell>
                        </TableRow>
                        {isExpanded && group.items.map((variety, index) => (
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
                                    <VarietyDialog mode="edit" variety={variety} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </Fragment>
                )
            })}
        </>
    )
}
