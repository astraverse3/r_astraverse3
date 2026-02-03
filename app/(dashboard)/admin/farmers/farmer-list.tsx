'use client'

import { useState } from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2, MoreHorizontal } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { deleteFarmer } from '@/app/actions/admin'
import { AddFarmerDialog } from './add-farmer-dialog'

interface Farmer {
    id: number
    name: string
    farmerNo: string
    items: string | null
    phone: string | null
    groupId: number
    group: {
        id: number
        code: string
        name: string
        certNo: string
        certType: string
        cropYear: number
    }
}

export function FarmerList({ farmers, selectedIds, onSelectionChange }: {
    farmers: Farmer[]
    selectedIds: Set<number>
    onSelectionChange: (ids: Set<number>) => void
}) {
    const [editingFarmer, setEditingFarmer] = useState<Farmer | null>(null)

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            onSelectionChange(new Set(farmers.map(f => f.id)))
        } else {
            onSelectionChange(new Set())
        }
    }

    const handleSelectOne = (id: number, checked: boolean) => {
        const newSelected = new Set(selectedIds)
        if (checked) {
            newSelected.add(id)
        } else {
            newSelected.delete(id)
        }
        onSelectionChange(newSelected)
    }



    return (
        <div className="rounded-md border bg-white shadow-sm">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50">
                        <TableHead className="w-[40px]">
                            <Checkbox
                                checked={selectedIds.size === farmers.length && farmers.length > 0}
                                onCheckedChange={handleSelectAll}
                            />
                        </TableHead>
                        <TableHead>년도</TableHead>
                        <TableHead>작목반번호</TableHead>
                        <TableHead>작목반</TableHead>
                        <TableHead>인증번호</TableHead>
                        <TableHead>생산자번호</TableHead>
                        <TableHead>생산자명</TableHead>
                        <TableHead>품목</TableHead>
                        <TableHead>연락처</TableHead>
                        <TableHead className="text-center">수정</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {farmers.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                                등록된 생산자가 없습니다.
                            </TableCell>
                        </TableRow>
                    ) : (
                        farmers.map((farmer) => (
                            <TableRow key={farmer.id}>
                                <TableCell>
                                    <Checkbox
                                        checked={selectedIds.has(farmer.id)}
                                        onCheckedChange={(checked) => handleSelectOne(farmer.id, checked as boolean)}
                                    />
                                </TableCell>
                                <TableCell className="font-mono text-center text-slate-500">{farmer.group.cropYear}</TableCell>
                                <TableCell className="font-mono text-center">{farmer.group.code}</TableCell>
                                <TableCell>
                                    <span className="font-bold text-slate-800">{farmer.group.name}</span>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="font-normal border-slate-200">
                                        {farmer.group.certType} {farmer.group.certNo}
                                    </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-center">{farmer.farmerNo}</TableCell>
                                <TableCell className="font-bold text-slate-900">{farmer.name}</TableCell>
                                <TableCell className="text-slate-600 text-sm">{farmer.items || '-'}</TableCell>
                                <TableCell className="text-slate-600 text-sm">{farmer.phone || '-'}</TableCell>
                                <TableCell className="text-center">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setEditingFarmer(farmer)}
                                    >
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            {/* Edit Dialog */}
            {editingFarmer && (
                <AddFarmerDialog
                    farmer={editingFarmer}
                    open={!!editingFarmer}
                    onOpenChange={(open) => !open && setEditingFarmer(null)}
                />
            )}
        </div>
    )
}
