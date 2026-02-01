import Link from 'next/link'
import { ChevronLeft, Pencil } from 'lucide-react'
import { getVarieties } from '@/app/actions/admin'
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

export default async function VarietyPage() {
    const result = await getVarieties()
    const varieties = (result.success && result.data ? result.data : []) as { id: number; name: string; type: string }[]

    return (
        <div className="space-y-6 pb-20">
            {/* Header with Back Button */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Link href="/admin" className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-xl font-bold text-slate-800">품종 관리</h1>
                </div>
                <VarietyDialog mode="create" />
            </div>

            {/* Variety List Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-slate-50">
                            <TableHead className="w-[60px] text-center font-bold text-slate-500">No</TableHead>
                            <TableHead className="font-bold text-slate-500">품종명</TableHead>
                            <TableHead className="font-bold text-slate-500">곡종</TableHead>
                            <TableHead className="w-[100px] text-center font-bold text-slate-500">관리</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {varieties.length > 0 ? (
                            varieties.map((variety, index) => (
                                <TableRow key={variety.id} className="hover:bg-slate-50">
                                    <TableCell className="text-center font-medium text-slate-600">
                                        {index + 1}
                                    </TableCell>
                                    <TableCell className="font-medium text-slate-800">
                                        {variety.name}
                                    </TableCell>
                                    <TableCell className="text-slate-600 text-sm">
                                        {variety.type === 'URUCHI' ? '메벼' : variety.type === 'GLUTINOUS' ? '찰벼' : '기타'}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <VarietyDialog
                                                mode="edit"
                                                variety={variety}
                                                trigger={
                                                    <button className="p-2 text-slate-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-colors" title="수정">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                }
                                            />
                                            <DeleteVarietyButton id={variety.id} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableHead colSpan={3} className="h-32 text-center text-slate-400 font-medium">
                                    등록된 품종이 없습니다.
                                </TableHead>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <p className="text-xs text-slate-400 text-center px-4">
                * 등록된 품종은 재고 관리 및 도정 기록 시 선택할 수 있습니다.
            </p>
        </div>
    )
}
