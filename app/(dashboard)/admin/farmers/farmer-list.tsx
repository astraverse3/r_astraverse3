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
import { Edit, Trash2, MoreHorizontal, ChevronRight, ChevronDown, Phone, BadgeCheck } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
        <>
            {/* Desktop View */}
            <div className="hidden sm:block rounded-md border bg-white shadow-sm overflow-hidden">
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
            </div>

            {/* Mobile View */}
            <div className="block sm:hidden space-y-3">
                {farmers.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-400">
                        등록된 생산자가 없습니다.
                    </div>
                ) : (
                    <MobileFarmerGroups
                        farmers={farmers}
                        selectedIds={selectedIds}
                        onSelectOne={handleSelectOne}
                        setEditingFarmer={setEditingFarmer}
                    />
                )}
            </div>

            {/* Edit Dialog */}
            {editingFarmer && (
                <AddFarmerDialog
                    farmer={editingFarmer}
                    open={!!editingFarmer}
                    onOpenChange={(open) => !open && setEditingFarmer(null)}
                />
            )}
        </>
    )
}

function MobileFarmerGroups({ farmers, selectedIds, onSelectOne, setEditingFarmer }: any) {
    const { data: session } = useSession()
    // @ts-ignore
    const canManage = hasPermission(session?.user, 'FARMER_MANAGE')

    const groups = farmers.reduce((acc: any, farmer: Farmer) => {
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

    const sortedGroups = Object.values(groups).sort((a: any, b: any) => {
        if (!a.group && !b.group) return 0
        if (!a.group) return 1
        if (!b.group) return -1
        if (a.group.cropYear !== b.group.cropYear) return b.group.cropYear - a.group.cropYear
        const codeA = parseInt(a.group.code)
        const codeB = parseInt(b.group.code)
        return codeA - codeB
    }) as any[]

    return (
        <div className="space-y-4">
            {sortedGroups.map((group) => {
                const isNoGroup = group.key === 'no-group'

                return (
                    <div key={group.key} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        {/* Group Header */}
                        {!isNoGroup && group.group && (
                            <div className="bg-slate-50 border-b border-slate-100 flex items-center justify-between px-3 py-2.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[14px] text-slate-800">
                                        <span className="font-bold">{group.group.name}</span>
                                        <span className="font-normal text-slate-500">({group.group.cropYear.toString().slice(-2)}')</span>
                                    </span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${group.group.certType === '유기농' ? 'text-[#8dc540] border-[#8dc540]/30 bg-[#8dc540]/10' :
                                        group.group.certType === '무농약' ? 'text-[#00a2e8] border-[#00a2e8]/30 bg-[#00a2e8]/10' :
                                            'text-slate-500 border-slate-200 bg-slate-50'
                                        }`}>
                                        {group.group.certType}
                                    </span>
                                    <span className="text-[11px] font-mono text-slate-500">
                                        {group.group.certNo}
                                    </span>
                                </div>
                                <div className="shrink-0 ml-2">
                                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-0 text-[11px] px-2 py-0">
                                        총 {group.items.length}명
                                    </Badge>
                                </div>
                            </div>
                        )}
                        {/* Fallback for no-group */}
                        {isNoGroup && (
                            <div className="bg-slate-50 border-b border-slate-100 flex items-center justify-between px-3 py-2.5">
                                <span className="font-bold text-[13px] text-slate-500">작목반 없음</span>
                                <Badge variant="secondary" className="bg-slate-200/60 text-slate-600 text-[10px] px-1.5 py-0">
                                    총 {group.items.length}명
                                </Badge>
                            </div>
                        )}

                        {/* Items */}
                        <div className="divide-y divide-slate-100">
                            {group.items.map((farmer: Farmer) => (
                                <div key={farmer.id} className="p-3 hover:bg-slate-50 flex items-center justify-between group transition-colors">
                                    {/* Left side: Checkbox, [Number], Name, PhoneIcon */}
                                    <div className="flex items-center gap-2.5">
                                        <Checkbox
                                            checked={selectedIds.has(farmer.id)}
                                            onCheckedChange={(checked) => onSelectOne(farmer.id, checked as boolean)}
                                            className="h-4 w-4 shrink-0"
                                        />
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[12px] font-mono text-slate-500 bg-slate-100 px-1 rounded">
                                                {farmer.farmerNo ? `[${farmer.farmerNo}]` : '[-]'}
                                            </span>
                                            <span className="font-bold text-[14px] text-slate-900 leading-none">
                                                {farmer.name}
                                            </span>

                                            {/* Phone Icon */}
                                            {farmer.phone ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="ml-1 text-[#00a2e8] hover:text-[#008cc9] bg-[#00a2e8]/10 hover:bg-[#00a2e8]/20 rounded-full p-1" title="연락처">
                                                            <Phone className="h-3 w-3" />
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-2 text-sm flex items-center justify-between gap-4">
                                                        <span className="font-bold text-slate-700">{farmer.phone}</span>
                                                        <a href={`tel:${farmer.phone}`} className="text-white bg-[#00a2e8] hover:bg-[#008cc9] text-xs px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5 font-medium shadow-sm">
                                                            <Phone className="h-3 w-3" />전화걸기
                                                        </a>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <div className="ml-1 text-slate-300 bg-slate-50 rounded-full p-1 cursor-not-allowed" title="연락처 없음">
                                                    <Phone className="h-3 w-3" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right side: Items details, Edit button */}
                                    <div className="flex items-center gap-2">
                                        {farmer.items ? (
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <button
                                                        className="text-[10px] font-medium px-2 py-0.5 rounded-full border text-violet-600 border-violet-200 bg-violet-50 hover:bg-violet-100 transition-colors"
                                                        title="품목 보기"
                                                    >
                                                        품목
                                                    </button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[180px] p-3 text-sm">
                                                    <p className="font-bold mb-1.5 text-xs text-slate-500">생산 품목</p>
                                                    <p className="text-slate-700 leading-relaxed text-xs break-keep">
                                                        {farmer.items}
                                                    </p>
                                                </PopoverContent>
                                            </Popover>
                                        ) : (
                                            <div
                                                className="text-[10px] font-medium px-2 py-0.5 rounded-full border text-slate-300 border-slate-200 bg-slate-50 cursor-not-allowed"
                                                title="품목 없음"
                                            >
                                                품목
                                            </div>
                                        )}

                                        {canManage && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-slate-400 hover:text-[#00a2e8] hover:bg-[#00a2e8]/10 shrink-0"
                                                onClick={() => setEditingFarmer(farmer)}
                                            >
                                                <Edit className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function GroupedFarmerRows({ farmers, selectedIds, onSelectOne, setEditingFarmer }: any) {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
    const { data: session } = useSession()
    // @ts-ignore
    const canManage = hasPermission(session?.user, 'FARMER_MANAGE')

    const toggleGroup = (key: string) => {
        const newSet = new Set(expandedGroups)
        if (newSet.has(key)) {
            newSet.delete(key)
        } else {
            newSet.add(key)
        }
        setExpandedGroups(newSet)
    }

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
                const isMultiFarmer = group.items.length > 1
                const isExpanded = expandedGroups.has(group.key)

                return (
                    <Fragment key={group.key}>
                        {/* Group Header (Only if > 1 items) */}
                        {isMultiFarmer && group.group && (
                            <TableRow
                                className={`group hover:bg-[#00a2e8]/16 border-y border-slate-200 font-bold text-slate-800 cursor-pointer transition-colors ${isExpanded ? 'bg-[#00a2e8]/20' : 'bg-white'}`}
                                onClick={() => toggleGroup(group.key)}
                            >
                                <TableCell></TableCell>
                                <TableCell className="text-center text-sm">
                                    <div className="flex items-center justify-center gap-1">
                                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        {group.group.cropYear}
                                    </div>
                                </TableCell>
                                <TableCell className="text-center text-sm">{group.group.code}</TableCell>
                                <TableCell className="text-sm">{group.group.name}</TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="font-normal border-slate-300 bg-white">
                                        {group.group.certType} {group.group.certNo}
                                    </Badge>
                                </TableCell>
                                <TableCell></TableCell>
                                <TableCell className="text-sm text-[#008cc9] font-bold">
                                    <div className="flex items-center gap-2">
                                        <span className="underline decoration-[#00a2e8]/40 underline-offset-4">
                                            총 {group.items.length}명
                                        </span>
                                        <span className="text-[10px] font-normal text-[#00a2e8] bg-[#00a2e8]/10 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden sm:inline-block">
                                            클릭해서 {isExpanded ? '접기' : '펼치기'}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell colSpan={3}></TableCell>
                            </TableRow>
                        )}

                        {/* Farmer Rows */}
                        {(!isMultiFarmer || isExpanded) && group.items.map((farmer: Farmer) => (
                            <TableRow key={farmer.id} className={`hover:bg-slate-50 ${isExpanded && isMultiFarmer ? 'bg-[#00a2e8]/7' : 'bg-white'}`}>
                                <TableCell>
                                    <Checkbox
                                        checked={selectedIds.has(farmer.id)}
                                        onCheckedChange={(checked) => onSelectOne(farmer.id, checked as boolean)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </TableCell>
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
