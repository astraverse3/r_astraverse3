'use client'

import { useState, Fragment } from 'react'
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
import { Edit, Trash2, MoreHorizontal, ChevronRight, ChevronDown } from 'lucide-react'
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
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'

interface Farmer {
    id: number
    name: string
    farmerNo: string | null
    items: string | null
    phone: string | null
    groupId: number | null
    group: {
        id: number
        code: string
        name: string
        certNo: string
        certType: string
        cropYear: number
    } | null
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
                        <GroupedFarmerRows
                            farmers={farmers}
                            selectedIds={selectedIds}
                            onSelectOne={handleSelectOne}
                            setEditingFarmer={setEditingFarmer}
                        />
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

function GroupedFarmerRows({ farmers, selectedIds, onSelectOne, setEditingFarmer }: any) {
    const { data: session } = useSession()
    // @ts-ignore
    const canManage = hasPermission(session?.user, 'FARMER_MANAGE')

    // Grouping Logic
    const groups = farmers.reduce((acc: any, farmer: Farmer) => {
        // Use Group ID as key or 'no-group'
        const key = farmer.group ? farmer.group.id.toString() : 'no-group'

        if (!acc[key]) {
            acc[key] = {
                key,
                group: farmer.group,
                items: []
            }
        }
        acc[key].items.push(farmer)
        return acc
    }, {})

    // Sort Groups (Year Desc, Code Asc) - Assuming farmers are already sorted by Action, 
    // but groups might need sorting if built from dict.
    // However, existing farmers list is already sorted by Year -> Code -> Name.
    // Iterating array and building groups: object keys order is not guaranteed. 
    // Better to iterate the flat sorted list and group adjacents, OR explicit sort.
    // Explicit sort of groups is safer.
    const sortedGroups = Object.values(groups).sort((a: any, b: any) => {
        if (!a.group && !b.group) return 0
        if (!a.group) return 1
        if (!b.group) return -1

        // Year Desc
        if (a.group.cropYear !== b.group.cropYear) return b.group.cropYear - a.group.cropYear
        // Code Asc (Numeric)
        const codeA = parseInt(a.group.code)
        const codeB = parseInt(b.group.code)
        return codeA - codeB
    }) as any[]

    return (
        <>
            {sortedGroups.map((group) => {
                return (
                    <Fragment key={group.key}>
                        {/* Farmer Rows */}
                        {group.items.map((farmer: Farmer) => (
                            <TableRow key={farmer.id} className="hover:bg-slate-50">
                                <TableCell>
                                    <Checkbox
                                        checked={selectedIds.has(farmer.id)}
                                        onCheckedChange={(checked) => onSelectOne(farmer.id, checked as boolean)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </TableCell>
                                {/* Hide redundant info if under a group header? Or keep consistent? 
                                    User said "List height/font same". 
                                    If distinct color separates group, maybe we can dim or hide repeated columns?
                                    But simplistic request: "Year, Group... showing" in header. 
                                    Rows usually show specific farmer data. 
                                    Let's keep standard display for now to avoid empty columns unless requested.
                                */}
                                <TableCell className="font-mono text-center text-slate-500 text-xs">
                                    {farmer.group?.cropYear || '-'}
                                </TableCell>
                                <TableCell className="font-mono text-center text-xs">
                                    {farmer.group?.code || '-'}
                                </TableCell>
                                <TableCell className="text-xs">
                                    <span className={farmer.group ? 'text-slate-700' : 'text-slate-500'}>
                                        {farmer.group?.name || '(작목반 없음)'}
                                    </span>
                                </TableCell>
                                <TableCell className="text-xs">
                                    {farmer.group ? `${farmer.group.certType} ${farmer.group.certNo}` : '-'}
                                </TableCell>
                                <TableCell className="font-mono text-center text-sm font-bold text-slate-700">{farmer.farmerNo}</TableCell>
                                <TableCell className="font-bold text-slate-900">{farmer.name}</TableCell>
                                <TableCell className="text-slate-600 text-sm">{farmer.items || '-'}</TableCell>
                                <TableCell className="text-slate-600 text-sm">{farmer.phone || '-'}</TableCell>
                                <TableCell className="text-center">
                                    {canManage && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => setEditingFarmer(farmer)}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </Fragment>
                )
            })}
        </>
    )
}
