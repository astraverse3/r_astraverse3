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
            case 'CREATE': return 'bg-green-100 text-green-700 border-green-200'
            case 'UPDATE': return 'bg-blue-100 text-blue-700 border-blue-200'
            case 'DELETE': return 'bg-red-100 text-red-700 border-red-200'
            case 'LOGIN': return 'bg-slate-100 text-slate-700 border-slate-200'
            case 'EXPORT': return 'bg-purple-100 text-purple-700 border-purple-200'
            default: return 'bg-gray-100 text-gray-700'
        }
    }

    return (
        <div className="space-y-4">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1.5 flex-1 min-w-[150px]">
                            <label className="text-xs font-semibold text-slate-500 ml-1">작업 유형</label>
                            <Select 
                                value={filters.action} 
                                onValueChange={(v) => setFilters(prev => ({ ...prev, action: v }))}
                            >
                                <SelectTrigger className="h-9 bg-white">
                                    <SelectValue placeholder="모든 작업" />
                                </SelectTrigger>
                                <SelectContent>
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

                        <div className="space-y-1.5 flex-1 min-w-[150px]">
                            <label className="text-xs font-semibold text-slate-500 ml-1">대상 관리</label>
                            <Select 
                                value={filters.entity} 
                                onValueChange={(v) => setFilters(prev => ({ ...prev, entity: v }))}
                            >
                                <SelectTrigger className="h-9 bg-white">
                                    <SelectValue placeholder="모든 대상" />
                                </SelectTrigger>
                                <SelectContent>
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

                        <div className="flex gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleSearch} 
                                className="h-9 gap-2 border-slate-300"
                            >
                                <Search className="w-4 h-4" />
                                검색
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                    setFilters({ action: 'ALL', entity: 'ALL', page: 1, pageSize: 50 })
                                    fetchLogs({ action: 'ALL', entity: 'ALL', page: 1, pageSize: 50 })
                                }} 
                                className="h-9 px-3 border-slate-300"
                                title="초기화"
                            >
                                <RefreshCcw className="w-4 h-4 text-slate-500" />
                            </Button>
                        </div>

                        <div className="ml-auto">
                            <Button 
                                size="sm" 
                                onClick={handleExport} 
                                disabled={exporting || loading}
                                className="h-9 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                <Download className="w-4 h-4" />
                                {exporting ? '생성 중...' : '엑셀 다운로드'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[180px] text-xs font-bold text-slate-600">일시</TableHead>
                                <TableHead className="w-[120px] text-xs font-bold text-slate-600">작업자</TableHead>
                                <TableHead className="w-[100px] text-xs font-bold text-slate-600">작업</TableHead>
                                <TableHead className="w-[120px] text-xs font-bold text-slate-600">대상</TableHead>
                                <TableHead className="text-xs font-bold text-slate-600">설명</TableHead>
                                <TableHead className="w-[120px] text-xs font-bold text-slate-600">IP</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-slate-400">데이터를 불러오고 있습니다...</TableCell>
                                </TableRow>
                            ) : logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-slate-400">조회된 로그가 없습니다.</TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id} className="hover:bg-slate-50 transition-colors">
                                        <TableCell className="text-xs text-slate-500 font-medium">
                                            {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                                        </TableCell>
                                        <TableCell className="text-xs font-semibold text-slate-700">
                                            {log.userName}
                                            <div className="text-[10px] text-slate-400 font-normal">{log.userEmail}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`text-[10px] py-0 px-1.5 font-bold uppercase ${getActionColor(log.action)}`}>
                                                {log.action}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs font-medium text-slate-600">
                                            {log.entity}
                                            {log.entityId && <span className="ml-1 text-[10px] text-slate-400">#{log.entityId}</span>}
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                                            {log.description}
                                        </TableCell>
                                        <TableCell className="text-[10px] text-slate-400 mono">
                                            {log.ip || '-'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {pagination.totalPages > 1 && (
                    <div className="p-4 border-t flex items-center justify-between bg-white">
                        <div className="text-xs text-slate-500">
                            총 <strong>{pagination.total}</strong>개 항목 중 {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.total)}-{Math.min(pagination.page * pagination.pageSize, pagination.total)} 표시
                        </div>
                        <div className="flex gap-1.5">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 text-slate-600"
                                disabled={pagination.page <= 1}
                                onClick={() => setFilters(prev => ({ ...prev, page: prev.page! - 1 }))}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="flex items-center px-3 text-xs font-bold text-slate-600 bg-slate-50 rounded-md border">
                                {pagination.page} / {pagination.totalPages}
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 text-slate-600"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => setFilters(prev => ({ ...prev, page: prev.page! + 1 }))}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
