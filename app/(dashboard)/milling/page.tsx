import { getMillingLogs } from '@/app/actions/milling'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { MillingTableRow } from './milling-table-row'
import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

export default async function MillingListPage() {
    const result = await getMillingLogs()
    const logs = result.success && result.data ? result.data : []
    return (
        <div className="grid grid-cols-1 gap-2 pb-24">
            {/* Header */}
            <section className="flex items-center justify-between pt-2 px-1">
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-slate-800">도정 관리</h1>
                    <Badge variant="secondary" className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0">
                        {logs.length}
                    </Badge>
                </div>
                <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg h-8 text-xs font-bold px-3">
                    <Link href="/milling/new" className="flex items-center gap-1.5">
                        <Plus className="h-3.5 w-3.5" />
                        작업 등록
                    </Link>
                </Button>
            </section>

            {/* Dense Table */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-slate-50">
                            <TableHead className="py-2 px-2 text-center text-xs font-bold text-slate-500 w-[80px]">날짜</TableHead>
                            <TableHead className="py-2 px-2 text-center text-xs font-bold text-slate-500 w-[50px]">상태</TableHead>
                            <TableHead className="py-2 px-2 text-xs font-bold text-slate-500">작업명/품종</TableHead>
                            <TableHead className="py-2 px-2 text-right text-xs font-bold text-slate-500">톤백</TableHead>
                            <TableHead className="py-2 px-2 text-right text-xs font-bold text-slate-500">투입</TableHead>
                            <TableHead className="py-2 px-2 text-right text-xs font-bold text-slate-500">생산</TableHead>
                            <TableHead className="py-2 px-2 text-center text-xs font-bold text-slate-500">수율</TableHead>
                            <TableHead className="py-2 px-2 text-right text-xs font-bold text-slate-500 w-[40px]">관리</TableHead>
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
                                    등록된 작업이 없습니다.
                                </TableHead>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </section>
        </div>
    )
}
