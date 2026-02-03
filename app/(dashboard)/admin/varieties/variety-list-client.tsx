'use client'

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
                        varieties.map((variety, index) => (
                            <TableRow key={variety.id} className="hover:bg-slate-50">
                                <TableCell className="py-2 px-1 w-[40px] text-center">
                                    <Checkbox
                                        checked={selectedIds.has(variety.id)}
                                        onCheckedChange={(checked) => handleSelectOne(variety.id, checked as boolean)}
                                    />
                                </TableCell>
                                <TableCell className="text-center font-medium text-slate-600">
                                    {index + 1}
                                </TableCell>
                                <TableCell className="font-medium text-slate-800">
                                    {variety.name}
                                </TableCell>
                                <TableCell className="text-slate-600 text-sm">
                                    {variety.type === 'URUCHI' ? '메벼' : variety.type === 'GLUTINOUS' ? '찰벼' : variety.type === 'INDICA' ? '인디카' : '기타'}
                                </TableCell>
                                <TableCell className="text-center">
                                    <VarietyDialog
                                        mode="edit"
                                        variety={variety}
                                    />
                                </TableCell>
                            </TableRow>
                        ))
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
