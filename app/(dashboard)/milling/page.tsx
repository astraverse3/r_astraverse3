import { getMillingLogs, GetMillingLogsParams } from '@/app/actions/milling'
import { getVarieties } from '@/app/actions/admin' // Import for variety filter
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { MillingTableRow } from './milling-table-row'
import { MillingFilters } from './milling-filters'
import { ActiveMillingFilters } from './active-milling-filters'
import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

export default async function MillingListPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const resolvedParams = await searchParams

    // Parse params
    const filters: GetMillingLogsParams = {
        status: typeof resolvedParams.status === 'string' ? resolvedParams.status : undefined,
        variety: typeof resolvedParams.variety === 'string' ? resolvedParams.variety : undefined,
        millingType: typeof resolvedParams.millingType === 'string' ? resolvedParams.millingType : undefined,
        keyword: typeof resolvedParams.keyword === 'string' ? resolvedParams.keyword : undefined,
        yieldRate: typeof resolvedParams.yieldRate === 'string' ? resolvedParams.yieldRate : undefined,
    }

    const result = await getMillingLogs(filters)
    const logs = result.success && result.data ? result.data : []

    // Fetch varieties
    const varietyResult = await getVarieties()
    const varieties = (varietyResult.success && varietyResult.data ? varietyResult.data : []) as { id: number; name: string }[]

    return (
        <div className="grid grid-cols-1 gap-1 pb-24">
            {/* Header */}
            <section className="flex flex-col gap-2 pt-2 px-1">
                <div className="flex items-center justify-end gap-2">
                    <MillingFilters varieties={varieties} />
                    <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg h-8 text-xs font-bold px-3">
                        <Link href="/milling/new" className="flex items-center gap-1.5">
                            <Plus className="h-3.5 w-3.5" />
                            작업 등록
                        </Link>
                    </Button>
                </div>
                <ActiveMillingFilters />
            </section>

            {/* Dense Table */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-slate-50">
                            <TableHead className="py-2 px-2 text-center text-xs font-bold text-slate-500 w-[50px]">날짜</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[40px]">상태</TableHead>
                            <TableHead className="py-2 px-1 text-xs font-bold text-slate-500 w-[60px] md:w-auto">품종</TableHead>
                            <TableHead className="py-2 px-1 text-right text-xs font-bold text-slate-500">톤백</TableHead>
                            <TableHead className="py-2 px-1 text-right text-xs font-bold text-slate-500">투입</TableHead>
                            <TableHead className="py-2 px-1 text-right text-xs font-bold text-slate-500">생산</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500">수율</TableHead>
                            <TableHead className="py-2 px-1 text-left text-xs font-bold text-slate-500 w-[50px] md:w-auto">비고</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.length > 0 ? (
                            logs.map((log: any) => (
                                <MillingTableRow key={log.id} log={log} />
                            ))
                        ) : (
                            <TableRow>
                                <TableHead colSpan={8} className="h-32 text-center text-xs text-slate-400 font-medium">
                                    {Object.keys(filters).length > 0 ? '검색 결과가 없습니다.' : '등록된 작업이 없습니다.'}
                                </TableHead>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </section>
        </div>
    )
}
