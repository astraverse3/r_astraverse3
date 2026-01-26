import { getMillingLogs } from '@/app/actions/milling'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Plus, Info, Calendar, Weight, Activity, CheckCircle2 } from 'lucide-react'
import { AddPackagingDialog } from './add-packaging-dialog'
import { CloseBatchButton } from './close-batch-button'
import { MillingStockListDialog } from './stock-list-dialog'

export default async function MillingListPage() {
    const result = await getMillingLogs()
    const logs = result.success && result.data ? result.data : []
    return (
        <div className="grid grid-cols-1 gap-6 pb-24">
            {/* Header */}
            <section className="flex items-center justify-between pt-2">
                <h1 className="text-xl font-bold text-slate-800">도정 관리</h1>
                <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg shadow-blue-500/20">
                    <Link href="/milling/new" className="flex items-center gap-1.5 text-xs font-bold">
                        <Plus className="h-4 w-4" />
                        작업 등록
                    </Link>
                </Button>
            </section>

            {/* List */}
            <section className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="flex flex-col divide-y divide-slate-100">
                    {logs.length > 0 ? (
                        logs.map((log: any) => {
                            const totalRiceKg = log.outputs.reduce((sum: number, o: any) => sum + o.totalWeight, 0)
                            const yieldRate = log.totalInputKg > 0 ? (totalRiceKg / log.totalInputKg) * 100 : 0
                            const varieties = [...new Set((log.stocks || []).map((s: any) => s.variety))].join(', ')
                            const tonbagCount = (log.stocks || []).length

                            return (
                                <div key={log.id} className="p-4 flex flex-col gap-3 hover:bg-slate-50 transition-colors">
                                    {/* Top Row: Date & Status */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1.5 text-slate-500">
                                                <Calendar className="w-3.5 h-3.5" />
                                                <span className="text-xs font-bold font-mono">
                                                    {new Date(log.date).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                                                </span>
                                            </div>
                                            {log.isClosed ? (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold">
                                                    마감
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold animate-pulse">
                                                    진행중
                                                </span>
                                            )}
                                        </div>
                                        {/* Yield Badge (if closed) */}
                                        {totalRiceKg > 0 && (
                                            <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                                <Activity className="w-3 h-3" />
                                                <span className="text-xs font-bold">수율 {Math.round(yieldRate)}%</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Main Info */}
                                    <div className="flex items-start justify-between">
                                        <div className="flex flex-col gap-0.5">
                                            <h3 className="text-base font-bold text-slate-800">{log.title}</h3>
                                            <div className="flex items-center gap-2">
                                                <MillingStockListDialog stocks={log.stocks || []} varieties={varieties} />
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-xs text-slate-400 font-medium">투입</span>
                                                <span className="text-sm font-bold text-slate-700">{log.totalInputKg.toLocaleString()} kg</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom Actions */}
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-1">
                                        <div className="flex items-center gap-1 text-slate-500">
                                            <Weight className="w-3.5 h-3.5" />
                                            <span className="text-xs font-medium">백미: <span className="text-slate-900 font-bold">{totalRiceKg > 0 ? totalRiceKg.toLocaleString() : '-'}</span> kg</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!log.isClosed && <CloseBatchButton batchId={log.id} />}
                                            <AddPackagingDialog
                                                batchId={log.id}
                                                batchTitle={log.title}
                                                isClosed={log.isClosed}
                                                initialOutputs={log.outputs}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    ) : (
                        <div className="p-12 text-center text-slate-400 text-sm">
                            작업 내역이 없습니다.
                        </div>
                    )}
                </div>
            </section>
        </div>
    )
}
