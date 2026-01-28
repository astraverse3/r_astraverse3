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
import { Edit, Trash2, ShieldCheck, MoreHorizontal } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { deleteFarmer, type FarmerFormData } from '@/app/actions/admin'
import { AddFarmerDialog } from './add-farmer-dialog'
import { ManageCertificationsDialog } from './manage-certifications-dialog'

interface Farmer {
    id: number
    name: string
    phone: string | null
    certifications: {
        id: number
        certType: string
        certNo: string
        personalNo: string | null
    }[]
}

export function FarmerList({ farmers }: { farmers: Farmer[] }) {
    const [editingFarmer, setEditingFarmer] = useState<Farmer | null>(null)
    const [managingCertFarmer, setManagingCertFarmer] = useState<Farmer | null>(null)

    const handleDelete = async (id: number) => {
        if (!confirm('정말 삭제하시겠습니까? 관련 재고가 있으면 삭제할 수 없습니다.')) return
        const result = await deleteFarmer(id)
        if (!result.success) {
            alert(result.error)
        }
    }

    return (
        <div className="rounded-md border bg-white shadow-sm">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50">
                        <TableHead className="w-[80px]">ID</TableHead>
                        <TableHead>생산자명</TableHead>
                        <TableHead>연락처</TableHead>
                        <TableHead>인증 정보</TableHead>
                        <TableHead className="text-right">관리</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {farmers.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                등록된 생산자가 없습니다.
                            </TableCell>
                        </TableRow>
                    ) : (
                        farmers.map((farmer) => (
                            <TableRow key={farmer.id}>
                                <TableCell className="font-mono text-xs text-slate-500">{farmer.id}</TableCell>
                                <TableCell className="font-bold">{farmer.name}</TableCell>
                                <TableCell className="text-slate-600 text-sm">{farmer.phone || '-'}</TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {farmer.certifications.length > 0 ? (
                                            farmer.certifications.map(cert => (
                                                <Badge key={cert.id} variant="secondary" className="text-[10px] font-normal border-slate-200">
                                                    {cert.certType} {cert.certNo}
                                                </Badge>
                                            ))
                                        ) : (
                                            <span className="text-xs text-slate-400">인증 없음</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>작업</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => setManagingCertFarmer(farmer)}>
                                                <ShieldCheck className="mr-2 h-4 w-4" /> 인증 관리
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setEditingFarmer(farmer)}>
                                                <Edit className="mr-2 h-4 w-4" /> 정보 수정
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(farmer.id)}>
                                                <Trash2 className="mr-2 h-4 w-4" /> 삭제
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
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

            {/* Manage Cert Dialog */}
            {managingCertFarmer && (
                <ManageCertificationsDialog
                    farmer={managingCertFarmer}
                    open={!!managingCertFarmer}
                    onOpenChange={(open) => !open && setManagingCertFarmer(null)}
                />
            )}
        </div>
    )
}
