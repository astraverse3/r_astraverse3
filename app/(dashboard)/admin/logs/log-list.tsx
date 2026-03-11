'use client'

import { useState, useEffect } from 'react'
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select'
import { getAuditLogs, exportAuditLogs, GetAuditLogsParams } from '@/app/actions/audit'
import { format } from 'date-fns'
import { Download, Search, RefreshCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

export function LogList() {
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [exporting, setExporting] = useState(false)
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 50,
        total: 0,
        totalPages: 0
    })

    const [filters, setFilters] = useState<GetAuditLogsParams>({
        action: 'ALL',
        entity: 'ALL',
        page: 1,
        pageSize: 50
    })

    const fetchLogs = async (currentFilters = filters) => {
        setLoading(true)
        try {
            const res = await getAuditLogs(currentFilters)
            if (res.success && res.data) {
                setLogs(res.data)
                if (res.pagination) {
                    setPagination(res.pagination)
                }
            } else {
                toast.error(res.error || 'Failed to fetch logs')
            }
        } catch (error) {
            toast.error('로그를 불러오는 중 오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchLogs()
    }, [filters.page])

    const handleSearch = () => {
        setFilters(prev => ({ ...prev, page: 1 }))
        fetchLogs({ ...filters, page: 1 })
    }

    const handleExport = async () => {
        setExporting(true)
        try {
            const res = await exportAuditLogs({
                action: filters.action,
                entity: filters.entity,
                startDate: filters.startDate,
                endDate: filters.endDate
            })
            if (res.success && res.data) {
                const link = document.createElement('a')
                link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.data}`
                link.download = res.fileName || 'audit_logs.xlsx'
                link.click()
                toast.success('엑셀 다운로드가 완료되었습니다.')
            } else {
                toast.error(res.error || 'Export failed')
            }
        } catch (error) {
            toast.error('엑셀 생성 중 오류가 발생했습니다.')
        } finally {
            setExporting(false)
        }
    }

    const getActionColor = (action: string) => {
        switch (action) {
            case 'CREATE': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
            case 'UPDATE': return 'bg-blue-50 text-blue-700 border-blue-200'
            case 'DELETE': return 'bg-red-50 text-red-700 border-red-200'
            case 'LOGIN': return 'bg-slate-50 text-slate-700 border-slate-200'
            case 'EXPORT': return 'bg-purple-50 text-purple-700 border-purple-200'
            case 'IMPORT': return 'bg-amber-50 text-amber-700 border-amber-200'
            default: return 'bg-gray-50 text-gray-700'
        }
    }

    return (
        <div className="space-y-6">
            {/* Filter Section */}
            <Card className="border-slate-200/60 shadow-md shadow-slate-200/20 bg-white/80 backdrop-blur-md overflow-visible">
                <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row items-stretch md:items-end gap-4">
                        <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 flex-1">
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-400 ml-1 flex items-center gap-1.5 uppercase">
                                    <Search className="w-3 h-3" />
                                    작업 유형
                                </label>
                                <Select 
                                    value={filters.action} 
                                    onValueChange={(v) => setFilters(prev => ({ ...prev, action: v }))}
                                >
                                    <SelectTrigger className="h-10 bg-slate-50 border-slate-200 focus:ring-blue-500 rounded-xl transition-all">
                                        <SelectValue placeholder="모든 작업" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="ALL">모든 작업</SelectItem>
                                        <SelectItem value="CREATE">등록 (CREATE)</SelectItem>
                                        <SelectItem value="UPDATE">수정 (UPDATE)</SelectItem>
                                        <SelectItem value="DELETE">삭제 (DELETE)</SelectItem>
                                        <SelectItem value="LOGIN">로그인</SelectItem>
                                        <SelectItem value="EXPORT">엑셀 내보내기</SelectItem>
                                        <SelectItem value="IMPORT">엑셀 가져오기</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-400 ml-1 flex items-center gap-1.5 uppercase">
                                    <div className="w-3 h-3 rounded-sm border border-slate-400" />
                                    대상 관리
                                </label>
                                <Select 
                                    value={filters.entity} 
                                    onValueChange={(v) => setFilters(prev => ({ ...prev, entity: v }))}
                                >
                                    <SelectTrigger className="h-10 bg-slate-50 border-slate-200 focus:ring-blue-500 rounded-xl transition-all">
                                        <SelectValue placeholder="모든 대상" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="ALL">모든 대상</SelectItem>
                                        <SelectItem value="Stock">재고 (Stock)</SelectItem>
                                        <SelectItem value="MillingBatch">도정 (Milling)</SelectItem>
                                        <SelectItem value="Farmer">생산자 (Farmer)</SelectItem>
                                        <SelectItem value="Variety">품종 (Variety)</SelectItem>
                                        <SelectItem value="User">사용자 (User)</SelectItem>
                                        <SelectItem value="Notice">공지사항 (Notice)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button 
                                onClick={handleSearch} 
                                className="h-10 px-6 gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg shadow-slate-200 transition-all font-bold text-sm min-w-[100px]"
                            >
                                <Search className="w-4 h-4" />
                                검색
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={() => {
                                    setFilters({ action: 'ALL', entity: 'ALL', page: 1, pageSize: 50 })
                                    fetchLogs({ action: 'ALL', entity: 'ALL', page: 1, pageSize: 50 })
                                }} 
                                className="h-10 w-10 border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                                title="초기화"
                            >
                                <RefreshCcw className="w-4 h-4 text-slate-400" />
                            </Button>
                            <div className="hidden lg:block w-px h-8 bg-slate-200 mx-2" />
                            <Button 
                                onClick={handleExport} 
                                disabled={exporting || loading}
                                className="h-10 gap-2 bg-[#00a2e8] hover:bg-[#008cc9] text-white rounded-xl shadow-lg shadow-[#00a2e8]/20 transition-all font-bold text-sm"
                            >
                                <Download className="w-4 h-4" />
                                {exporting ? '생성 중...' : '엑셀 추출'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Content Section */}
            <div className="bg-white/50 backdrop-blur-md border border-slate-200/60 rounded-2xl shadow-xl shadow-slate-200/40 overflow-hidden">
                {/* Desktop View (Table) */}
                <div className="hidden md:block overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50/80">
                            <TableRow className="hover:bg-transparent border-b-slate-200/60">
                                <TableHead className="w-[180px] text-[11px] font-black text-slate-400 uppercase tracking-tighter pl-6 py-4">일시</TableHead>
                                <TableHead className="w-[140px] text-[11px] font-black text-slate-400 uppercase tracking-tighter py-4">작업자</TableHead>
                                <TableHead className="w-[100px] text-[11px] font-black text-slate-400 uppercase tracking-tighter py-4">작업</TableHead>
                                <TableHead className="w-[120px] text-[11px] font-black text-slate-400 uppercase tracking-tighter py-4">관리 대상</TableHead>
                                <TableHead className="text-[11px] font-black text-slate-400 uppercase tracking-tighter py-4">변경 내역 및 설명</TableHead>
                                <TableHead className="w-[120px] text-[11px] font-black text-slate-400 uppercase tracking-tighter pr-6 text-right py-4">IP</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-64 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-8 h-8 border-4 border-[#00a2e8]/20 border-t-[#00a2e8] rounded-full animate-spin" />
                                            <span className="text-sm font-bold text-slate-400 tracking-tighter uppercase">Loading activities...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-64 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Search className="w-8 h-8 text-slate-200" />
                                            <span className="text-sm font-bold text-slate-300 tracking-tighter uppercase">No logs found</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id} className="hover:bg-blue-50/30 transition-colors border-b-slate-100 group">
                                        <TableCell className="pl-6 text-xs text-slate-400 font-medium tabular-nums">
                                            {format(new Date(log.createdAt), 'yyyy-MM-dd')}
                                            <div className="text-[10px] font-bold text-slate-300 group-hover:text-[#00a2e8] transition-colors">{format(new Date(log.createdAt), 'HH:mm:ss')}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-[13px] font-black text-slate-700 tracking-tight">{log.userName}</div>
                                            <div className="text-[10px] text-slate-400 font-medium">{log.userEmail}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`text-[10px] py-0 px-2 h-5 font-black uppercase rounded-md border-0 shadow-sm ${getActionColor(log.action)}`}>
                                                {log.action}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs font-bold text-slate-600">
                                            {log.entity}
                                            {log.entityId && <span className="ml-1 text-[10px] font-black opacity-30 tracking-widest text-[#00a2e8]">#{log.entityId}</span>}
                                        </TableCell>
                                        <TableCell className="text-[13px] text-slate-600 whitespace-pre-wrap leading-relaxed py-4 max-w-md">
                                            {log.description}
                                        </TableCell>
                                        <TableCell className="pr-6 text-[10px] text-slate-300 font-bold tracking-widest text-right tabular-nums">
                                            {log.ip || 'INTERNAL'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Mobile View (Cards) */}
                <div className="md:hidden divide-y divide-slate-100">
                    {loading ? (
                        <div className="p-12 text-center flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-[#00a2e8]/20 border-t-[#00a2e8] rounded-full animate-spin" />
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading...</span>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center gap-2">
                            <Search className="w-8 h-8 text-slate-200" />
                            <span className="text-xs font-black text-slate-300 uppercase tracking-widest">No matching activities</span>
                        </div>
                    ) : (
                        logs.map((log) => (
                            <div key={log.id} className="p-4 bg-white active:bg-slate-50 transition-colors">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="text-[13px] font-black text-slate-800 flex items-center gap-2">
                                            {log.userName}
                                            <Badge variant="outline" className={`text-[9px] py-0 px-1.5 h-4 font-black uppercase rounded border-0 shadow-sm ${getActionColor(log.action)}`}>
                                                {log.action}
                                            </Badge>
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-bold tabular-nums">
                                            {format(new Date(log.createdAt), 'MM/dd HH:mm:ss')}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-black text-[#00a2e8] tracking-widest uppercase opacity-60">
                                            {log.entity}
                                        </div>
                                        {log.entityId && <div className="text-[9px] font-bold text-slate-300 tracking-tighter">#{log.entityId}</div>}
                                    </div>
                                </div>
                                <div className="bg-slate-50/80 border border-slate-100/50 rounded-lg p-3 text-[12px] text-slate-600 leading-relaxed font-medium">
                                    {log.description}
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                    <div className="text-[9px] text-slate-300 font-bold tracking-widest">{log.userEmail}</div>
                                    <div className="text-[9px] text-slate-300 font-bold tracking-widest uppercase flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                        {log.ip || 'INTERNAL'}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Pagination (Responsive) */}
                {pagination.totalPages > 1 && (
                    <div className="p-4 sm:px-6 sm:py-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between bg-slate-50/50 gap-4">
                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest order-2 sm:order-1">
                            Showing <strong className="text-slate-600">{Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.total)}-{Math.min(pagination.page * pagination.pageSize, pagination.total)}</strong> 
                            <span className="mx-1.5 opacity-30">|</span> 
                            Total <strong className="text-slate-600">{pagination.total}</strong> entries
                        </div>
                        <div className="flex gap-2 order-1 sm:order-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-3 border-slate-200 rounded-xl bg-white shadow-sm hover:bg-slate-50 text-slate-600 transition-all font-bold"
                                disabled={pagination.page <= 1}
                                onClick={() => setFilters(prev => ({ ...prev, page: prev.page! - 1 }))}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                            </Button>
                            <div className="flex items-center px-4 h-9 text-xs font-black text-[#00a2e8] bg-white rounded-xl border border-slate-100 shadow-sm tabular-nums tracking-tighter">
                                {pagination.page} <span className="mx-2 opacity-20 text-slate-400">/</span> {pagination.totalPages}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-3 border-slate-200 rounded-xl bg-white shadow-sm hover:bg-slate-50 text-slate-600 transition-all font-bold"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => setFilters(prev => ({ ...prev, page: prev.page! + 1 }))}
                            >
                                Next <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Mobile Export FAB (Optional, but let's keep the header button for now) */}
            <div className="md:hidden flex justify-center pt-2">
                 <Button 
                    onClick={handleExport} 
                    disabled={exporting || loading}
                    className="w-full h-11 gap-2 bg-[#00a2e8] hover:bg-[#008cc9] text-white rounded-xl shadow-xl shadow-[#00a2e8]/20 transition-all font-black text-[13px] uppercase tracking-wider"
                >
                    <Download className="w-5 h-5" />
                    {exporting ? '생성 중...' : '활동 로그 엑셀 다운로드'}
                </Button>
            </div>
        </div>
    )
}
