'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { MillingTableRow } from './milling-table-row'
import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

interface MillingListClientProps {
    logs: any[]
    filters: any
    selectedIds: Set<number>
    onSelectionChange: (ids: Set<number>) => void
}

export function MillingListClient({ logs, filters, selectedIds, onSelectionChange }: MillingListClientProps) {
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            onSelectionChange(new Set(logs.map(l => l.id)))
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
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-slate-50">
                        <TableHead className="w-[50px] py-4 px-3 text-center">
                            <Checkbox
                                checked={selectedIds.size === logs.length && logs.length > 0}
                                onCheckedChange={handleSelectAll}
                            />
                        </TableHead>
                        <TableHead className="py-4 px-3 text-center text-sm font-bold text-slate-500 w-[100px]">날짜</TableHead>
                        <TableHead className="py-4 px-3 text-center text-sm font-bold text-slate-500 w-[80px]">상태</TableHead>
                        <TableHead className="py-4 px-3 text-sm font-bold text-slate-500 md:w-[220px]">품종</TableHead>
                        <TableHead className="py-4 px-3 text-right text-sm font-bold text-slate-500 w-[80px]">톤백</TableHead>
                        <TableHead className="py-4 px-3 text-right text-sm font-bold text-slate-500 w-[100px]">투입</TableHead>
                        <TableHead className="py-4 px-3 text-right text-sm font-bold text-slate-500 w-[100px]">생산</TableHead>
                        <TableHead className="py-4 px-3 text-center text-sm font-bold text-slate-500 w-[80px]">수율</TableHead>
                        <TableHead className="py-4 px-3 text-left text-sm font-bold text-slate-500 w-[50px] md:w-auto">비고</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {logs.length > 0 ? (
                        logs.map((log: any) => (
                            <MillingTableRow
                                key={log.id}
                                log={log}
                                selected={selectedIds.has(log.id)}
                                onSelect={(checked) => handleSelectOne(log.id, checked)}
                            />
                        ))
                    ) : (
                        <TableRow>
                            <TableHead colSpan={9} className="h-32 text-center text-xs text-slate-400 font-medium">
                                {Object.keys(filters).length > 0 ? '검색 결과가 없습니다.' : '등록된 작업이 없습니다.'}
                            </TableHead>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </section>
    )
}
