import { getMillingLogs } from '@/app/actions/milling'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Plus, Info } from 'lucide-react'
import { AddPackagingDialog } from './add-packaging-dialog'
import { CloseBatchButton } from './close-batch-button'
import { MillingStockListDialog } from './stock-list-dialog'

export default async function MillingListPage() {
    const result = await getMillingLogs()
    const logs = result.success && result.data ? result.data : []
    return (
        <div className="container mx-auto space-y-6 md:space-y-12 px-2 md:px-4 max-w-6xl animate-in fade-in duration-1000">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 md:gap-6 border-l-4 border-primary pl-4 md:pl-6 py-1 md:py-2">
                <div className="space-y-0.5 md:space-y-1">
                    <h1 className="text-3xl md:text-6xl font-black tracking-tighter text-stone-900 italic leading-none">
                        도정 <span className="text-stone-300 not-italic">일지</span>
                    </h1>
                    <p className="text-stone-500 font-medium tracking-tight text-[10px] md:text-sm flex items-center gap-2">
                        <span className="w-4 md:w-8 h-px bg-stone-300"></span>
                        도정 작업 현황 및 생산 내역 관리
                    </p>
                </div>
                <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl md:rounded-2xl px-6 md:px-8 h-10 md:h-14 font-black italic tracking-tight shadow-xl transition-all active:scale-95 group w-full md:w-auto">
                    <Link href="/milling/new" className="flex items-center gap-2 text-sm md:text-base">
                        <Plus className="h-5 w-5 md:h-6 md:w-6 transition-transform group-hover:rotate-90" />
                        새 도정 시작
                    </Link>
                </Button>
            </div>

            <Card className="border-none bg-white/40 shadow-xl md:shadow-2xl backdrop-blur-sm rounded-2xl md:rounded-3xl overflow-hidden">
                <CardHeader className="bg-stone-900 p-4 md:p-8">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-white font-bold tracking-tight flex items-center gap-2 italic text-sm md:text-xl">
                            작업 내역 <span className="text-stone-500 font-normal not-italic text-xs md:text-base">RECENT ACTIVITIES</span>
                        </CardTitle>
                        <Badge variant="outline" className="text-stone-400 border-stone-800 font-mono text-[9px] md:text-xs">
                            {logs.length} BATCHES
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-stone-50 border-b border-stone-100 divide-x divide-stone-100">
                                    <TableHead className="py-3 md:py-6 px-3 md:px-6 font-black text-stone-400 text-[9px] md:text-[10px] tracking-widest">일자</TableHead>
                                    <TableHead className="px-3 md:px-6 font-black text-stone-400 text-[9px] md:text-[10px] tracking-widest">품종</TableHead>
                                    <TableHead className="text-right px-3 md:px-6 font-black text-stone-400 text-[9px] md:text-[10px] tracking-widest">톤백</TableHead>
                                    <TableHead className="text-right px-3 md:px-6 font-black text-stone-400 text-[9px] md:text-[10px] tracking-widest">투입량(kG)</TableHead>
                                    <TableHead className="text-right px-3 md:px-6 font-black text-stone-400 text-[9px] md:text-[10px] tracking-widest">생산량(kG)</TableHead>
                                    <TableHead className="text-center px-3 md:px-6 font-black text-stone-400 text-[9px] md:text-[10px] tracking-widest">수율</TableHead>
                                    <TableHead className="px-3 md:px-6 font-black text-stone-400 text-[9px] md:text-[10px] tracking-widest text-right">관리</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="divide-y divide-stone-50">
                                {logs.length > 0 ? (
                                    logs.map((log: any) => {
                                        const totalRiceKg = log.outputs.reduce((sum: number, o: any) => sum + o.totalWeight, 0)
                                        const yieldRate = log.totalInputKg > 0 ? (totalRiceKg / log.totalInputKg) * 100 : 0
                                        const varieties = [...new Set((log.stocks || []).map((s: any) => s.variety))].join(', ')
                                        const tonbagCount = (log.stocks || []).length

                                        return (
                                            <TableRow key={log.id} className="group hover:bg-stone-50 transition-all duration-300 ease-out divide-x divide-stone-50">
                                                <TableCell className="py-3 md:py-6 px-3 md:px-6">
                                                    <div className="flex flex-col gap-1 md:gap-2">
                                                        <div className="font-mono text-stone-900 font-bold whitespace-nowrap text-xs md:text-sm">
                                                            {new Date(log.date).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                                                        </div>
                                                        {log.isClosed ? (
                                                            <Badge className="w-fit text-[8px] md:text-[9px] bg-stone-100 text-stone-400 border-none font-black tracking-widest uppercase py-0 px-1 md:px-2 rounded-full">마감</Badge>
                                                        ) : (
                                                            <Badge className="w-fit text-[8px] md:text-[9px] bg-primary/10 text-primary border-none font-black tracking-widest uppercase py-0 px-1 md:px-2 rounded-full animate-pulse">진행</Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-3 md:px-6 text-xs md:text-sm font-bold">
                                                    <MillingStockListDialog stocks={log.stocks || []} varieties={varieties} />
                                                </TableCell>
                                                <TableCell className="text-right px-3 md:px-6 font-mono font-bold text-stone-900 italic text-xs md:text-sm">
                                                    {tonbagCount}
                                                </TableCell>
                                                <TableCell className="text-right px-3 md:px-6 font-mono font-bold text-stone-900 text-xs md:text-sm">
                                                    {log.totalInputKg.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right px-3 md:px-6 font-mono font-black text-stone-900 group-hover:text-primary transition-colors text-xs md:text-sm">
                                                    {totalRiceKg > 0 ? totalRiceKg.toLocaleString() : '-'}
                                                </TableCell>
                                                <TableCell className="text-center px-3 md:px-6">
                                                    {totalRiceKg > 0 ? (
                                                        <div className="inline-flex items-center justify-center w-10 h-10 md:w-14 md:h-14 rounded-full border border-stone-100 font-black text-[10px] md:text-sm italic shadow-inner bg-white group-hover:border-primary/20 group-hover:text-primary transition-all">
                                                            {Math.round(yieldRate)}<span className="text-[7px] md:text-[8px]">%</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-stone-200 uppercase font-black text-[8px] md:text-[9px] tracking-tighter italic">N/A</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right px-3 md:px-6">
                                                    <div className="flex justify-end items-center gap-1 md:gap-3">
                                                        {!log.isClosed && <CloseBatchButton batchId={log.id} />}
                                                        <AddPackagingDialog
                                                            batchId={log.id}
                                                            batchTitle={log.title}
                                                            isClosed={log.isClosed}
                                                            initialOutputs={log.outputs}
                                                        />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-48 md:h-64 text-center">
                                            <div className="flex flex-col items-center gap-2 md:gap-4 py-8 md:py-12">
                                                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-stone-50 flex items-center justify-center">
                                                    <Info className="h-6 w-6 md:h-8 md:w-8 text-stone-200" />
                                                </div>
                                                <p className="font-bold text-stone-300 uppercase tracking-widest text-[10px] md:text-sm italic">내역이 없습니다</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
