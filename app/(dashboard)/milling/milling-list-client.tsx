'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { MillingTableRow } from './milling-table-row'
import { MobileMillingCard } from './mobile-milling-card'
import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/empty-state'

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
        <>
            {/* Mobile Card View */}
            <section className="sm:hidden flex flex-col gap-2 px-1">
                {logs.length > 0 ? (
                    logs.map((log: any) => (
                        <MobileMillingCard
                            key={log.id}
                            log={log}
                            selected={selectedIds.has(log.id)}
                            onSelect={(checked) => handleSelectOne(log.id, checked)}
                        />
                    ))
                ) : (
                    <EmptyState filtered={Object.keys(filters).length > 0} emptyText="아직 등록된 도정 작업이 없어요." />
                )}
            </section>

            {/* Desktop Table View */}
            <section className="hidden sm:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <Table className="table-fixed">
                    {/* 컬럼 폭 % (합 100). 로트 컬럼이 없는 표라 24% 규칙은 해당 없음 */}
                    <colgroup>
                        <col className="w-[5%]" /><col className="w-[9%]" /><col className="w-[15%]" />
                        <col className="w-[11%]" /><col className="w-[8%]" /><col className="w-[7%]" />
                        <col className="w-[9%]" /><col className="w-[9%]" /><col className="w-[7%]" />
                        <col className="w-[14%]" /><col className="w-[6%]" />
                    </colgroup>
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-transparent">
                            <TableHead className="px-1 text-center">
                                <Checkbox
                                    checked={selectedIds.size === logs.length && logs.length > 0}
                                    onCheckedChange={handleSelectAll}
                                />
                            </TableHead>
                            <TableHead className="text-center">날짜</TableHead>
                            <TableHead>품종(원료)</TableHead>
                            <TableHead>생산자</TableHead>
                            <TableHead className="text-center">구분</TableHead>
                            <TableHead className="text-right">톤백</TableHead>
                            <TableHead className="text-right">투입</TableHead>
                            <TableHead className="text-right">생산</TableHead>
                            <TableHead className="text-center">수율</TableHead>
                            <TableHead className="text-left">비고</TableHead>
                            <TableHead className="text-center">상태</TableHead>
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
                                <TableHead colSpan={9} className="text-center">
                                    <EmptyState filtered={Object.keys(filters).length > 0} emptyText="아직 등록된 도정 작업이 없어요." />
                                </TableHead>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </section>
        </>
    )
}
