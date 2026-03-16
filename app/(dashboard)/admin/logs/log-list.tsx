'use client'

import { useState, useEffect } from 'react'
import { getAuditLogs, exportAuditLogs, GetAuditLogsParams } from '@/app/actions/audit'
import { format } from 'date-fns'
import { Download, Search, RefreshCcw, ChevronLeft, ChevronRight, Activity, CalendarClock, User as UserIcon, Monitor, Smartphone, Globe, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

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

    // 기본 조회 기간: 오늘부터 5일 전
    const defaultStartDate = new Date()
    defaultStartDate.setDate(defaultStartDate.getDate() - 5)

    const [filters, setFilters] = useState<GetAuditLogsParams>({
        action: 'ALL',
        entity: 'ALL',
        page: 1,
        pageSize: 50,
        startDate: defaultStartDate,
        endDate: new Date()
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
            case 'CREATE': return 'bg-emerald-50 text-emerald-600 border-emerald-100'
            case 'UPDATE': return 'bg-blue-50 text-blue-600 border-blue-100'
            case 'DELETE': return 'bg-red-50 text-red-600 border-red-100'
            case 'LOGIN': return 'bg-slate-100 text-slate-600 border-slate-200'
            case 'EXPORT': return 'bg-purple-50 text-purple-600 border-purple-100'
            case 'IMPORT': return 'bg-amber-50 text-amber-600 border-amber-100'
            default: return 'bg-slate-100 text-slate-600 border-slate-200'
        }
    }

    const ENTITY_NAMES: Record<string, string> = {
        'Stock': '재고관리',
        'MillingBatch': '도정관리',
        'MillingOutputPackage': '도정관리',
        'Farmer': '생산자 관리',
        'Variety': '품종 관리',
        'User': '사용자 관리',
        'Notice': '공지사항 관리',
        'ProducerGroup': '작목반 관리',
        'Release': '출고관리',
        'StockRelease': '출고관리',
        'System': '시스템/기타'
    }

    const getEntityName = (entity: string) => ENTITY_NAMES[entity] || entity

    const parseUserAgent = (ua: string | null) => {
        if (!ua) return { type: 'Unknown', icon: Globe }
        const lowerUA = ua.toLowerCase()
        if (lowerUA.includes('mobile') || lowerUA.includes('android') || lowerUA.includes('iphone') || lowerUA.includes('ipad')) {
            return { type: 'Mobile', icon: Smartphone }
        }
        return { type: 'PC', icon: Monitor }
    }

    return (
        <div className="space-y-3">
            {/* Header / Filters Section */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 px-1 sm:px-0">
                <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-[#00a2e8]">총 {pagination.total}건</span>
                </div>
                
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
                    <div className="flex items-center gap-1">
                        <input
                            type="date"
                            className="h-9 px-3 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#00a2e8]/20 focus:border-[#00a2e8] transition-all text-slate-600 font-medium"
                            value={filters.startDate ? format(filters.startDate, 'yyyy-MM-dd') : ''}
                            onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value ? new Date(e.target.value) : undefined }))}
                        />
                        <span className="text-slate-400 text-xs">~</span>
                        <input
                            type="date"
                            className="h-9 px-3 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#00a2e8]/20 focus:border-[#00a2e8] transition-all text-slate-600 font-medium"
                            value={filters.endDate ? format(filters.endDate, 'yyyy-MM-dd') : ''}
                            onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value ? new Date(e.target.value) : undefined }))}
                        />
                    </div>

                    <Select
                        value={filters.action}
                        onValueChange={(v) => setFilters(prev => ({ ...prev, action: v }))}
                    >
                        <SelectTrigger className="w-full sm:w-[130px] h-9 text-sm font-medium bg-white">
                            <SelectValue placeholder="모든 작업" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">모든 작업</SelectItem>
                            <SelectItem value="CREATE">등록 (CREATE)</SelectItem>
                            <SelectItem value="UPDATE">수정 (UPDATE)</SelectItem>
                            <SelectItem value="DELETE">삭제 (DELETE)</SelectItem>
                            <SelectItem value="LOGIN">로그인</SelectItem>
                            <SelectItem value="EXPORT">내보내기</SelectItem>
                            <SelectItem value="IMPORT">가져오기</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select
                        value={filters.entity}
                        onValueChange={(v) => setFilters(prev => ({ ...prev, entity: v }))}
                    >
                        <SelectTrigger className="w-full sm:w-[130px] h-9 text-sm font-medium bg-white">
                            <SelectValue placeholder="모든 대상" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">모든 대상</SelectItem>
                            <SelectItem value="Stock">재고관리</SelectItem>
                            <SelectItem value="MillingBatch">도정관리</SelectItem>
                            <SelectItem value="Farmer">생산자 관리</SelectItem>
                            <SelectItem value="Variety">품종 관리</SelectItem>
                            <SelectItem value="User">사용자 관리</SelectItem>
                            <SelectItem value="Notice">공지사항 관리</SelectItem>
                            <SelectItem value="StockRelease">출고관리</SelectItem>
                            <SelectItem value="System">시스템/기타</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex items-center gap-1.5 mt-1 sm:mt-0">
                        <button
                            onClick={handleSearch}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 h-8 px-3 sm:px-4 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-sm"
                        >
                            <Search className="w-4 h-4" />
                            <span className="hidden sm:inline">검색</span>
                        </button>
                        <button
                            onClick={() => {
                                setFilters({ action: 'ALL', entity: 'ALL', page: 1, pageSize: 50, startDate: defaultStartDate, endDate: new Date() })
                                fetchLogs({ action: 'ALL', entity: 'ALL', page: 1, pageSize: 50, startDate: defaultStartDate, endDate: new Date() })
                            }}
                            className="flex items-center justify-center h-8 w-8 text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-sm shrink-0"
                            title="초기화"
                        >
                            <RefreshCcw className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={exporting || loading}
                            className="flex items-center justify-center h-8 w-8 border border-slate-200 bg-slate-50 text-slate-500 hover:bg-[#8dc540]/20 hover:text-[#7db037] hover:border-[#8dc540]/50 rounded-md transition-colors shrink-0 disabled:opacity-50"
                            title="엑셀 다운로드"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="block lg:hidden space-y-3">
                {loading ? (
                    <div className="p-12 text-center text-slate-400 text-sm animate-pulse flex flex-col items-center gap-2">
                        <Activity className="w-6 h-6" />
                        로그 불러오는 중...
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm">
                        조회된 로그가 없습니다.
                    </div>
                ) : (
                    logs.map((log) => {
                        const ua = parseUserAgent(log.userAgent);
                        const UAIcon = ua.icon;
                        return (
                        <div key={log.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/50">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={`text-[9px] py-0 px-1.5 h-4 font-bold uppercase rounded border shadow-none ${getActionColor(log.action)}`}>
                                        {log.action}
                                    </Badge>
                                    <span className="text-[11px] font-bold text-slate-600">
                                        {ENTITY_NAMES[log.entity] || log.entity}
                                    </span>
                                </div>
                                <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                                    <CalendarClock className="w-3 h-3" />
                                    <span suppressHydrationWarning>{format(new Date(log.createdAt), 'MM/dd HH:mm:ss')}</span>
                                </span>
                            </div>

                            <div className="px-3 py-3 space-y-2">
                                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                    {log.description}
                                </p>
                                {log.details && Object.keys(log.details).length > 0 && (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <button className="inline-flex items-center justify-center h-5 w-5 bg-slate-100 hover:bg-[#00a2e8]/10 text-slate-400 hover:text-[#00a2e8] rounded ml-1.5 transition-colors align-middle" title="상세 내역 보기">
                                                <FileText className="w-3 h-3" />
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[300px] p-3 bg-white border border-slate-200 shadow-xl" align="start">
                                            <div className="text-xs font-bold text-slate-600 mb-2 border-b border-slate-100 pb-1.5">상세 변경 내역</div>
                                            <pre className="text-xs text-slate-500 font-mono whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">
                                                {JSON.stringify(log.details, null, 2)}
                                            </pre>
                                        </PopoverContent>
                                    </Popover>
                                )}
                            </div>

                            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50/30">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                                        <UserIcon className="w-3 h-3 text-slate-500" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-bold text-slate-700 leading-none">{log.userName}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 ml-auto">
                                    <UAIcon className="w-3 h-3 text-slate-400" />
                                    <div className="text-[10px] text-slate-500 font-mono">
                                        {log.ip === '::1' ? 'localhost' : (log.ip || 'INTERNAL')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )})
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="text-center px-5 py-3 w-[160px]">일시</th>
                            <th className="text-center px-5 py-3 border-l border-slate-100 w-[120px]">작업자</th>
                            <th className="text-center px-5 py-3 border-l border-slate-100 w-[100px]">구분</th>
                            <th className="text-center px-5 py-3 border-l border-slate-100 w-[120px]">대상</th>
                            <th className="text-left px-5 py-3 border-l border-slate-100">내역</th>
                            <th className="text-center px-5 py-3 border-l border-slate-100 w-[150px]">IP</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="text-center py-16 text-slate-400 text-sm">
                                    <div className="flex items-center justify-center gap-2">
                                        <Activity className="w-4 h-4 animate-pulse" />
                                        <span>로그 불러오는 중...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : logs.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-16">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <Search className="w-8 h-8 text-slate-200" />
                                        <span className="text-sm font-medium text-slate-400">조회된 로그가 없습니다.</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            logs.map((log) => {
                                const ua = parseUserAgent(log.userAgent);
                                const UAIcon = ua.icon;
                                return (
                                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-5 py-3.5 whitespace-nowrap text-center">
                                        <span className="text-[13px] font-bold text-slate-700">
                                            {format(new Date(log.createdAt), 'yyyy.MM.dd')}{' '}
                                        </span>
                                        <span className="text-[11px] text-slate-400 font-medium">
                                            {format(new Date(log.createdAt), 'HH:mm:ss')}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5 border-l border-slate-100">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 shadow-sm shrink-0">
                                                <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                                            </div>
                                            <div className="flex flex-col min-w-0 items-center text-center">
                                                <span className="text-xs font-bold text-slate-700 truncate leading-tight">{log.userName}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5 border-l border-slate-100 text-center">
                                        <Badge variant="outline" className={`text-[10px] py-0 px-2 h-5 font-bold uppercase rounded border shadow-sm ${getActionColor(log.action)}`}>
                                            {log.action}
                                        </Badge>
                                    </td>
                                    <td className="px-5 py-3.5 border-l border-slate-100 text-center">
                                        <span className="text-[13px] font-bold text-slate-700">
                                            {ENTITY_NAMES[log.entity] || log.entity}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5 border-l border-slate-100 text-[13px] text-slate-600 leading-relaxed font-medium text-left">
                                        <div className="flex items-center gap-2">
                                            <span className="flex-1">{log.description}</span>
                                            {log.details && Object.keys(log.details).length > 0 && (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="inline-flex items-center justify-center h-5 w-5 bg-slate-100 hover:bg-[#00a2e8]/10 text-slate-400 hover:text-[#00a2e8] rounded transition-colors" title="상세 내역 보기">
                                                            <FileText className="w-3 h-3" />
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[300px] p-3 bg-white border border-slate-200 shadow-xl" align="start">
                                                        <div className="text-xs font-bold text-slate-600 mb-2 border-b border-slate-100 pb-1.5">상세 변경 내역</div>
                                                        <pre className="text-xs text-slate-500 font-mono whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">
                                                            {JSON.stringify(log.details, null, 2)}
                                                        </pre>
                                                    </PopoverContent>
                                                </Popover>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5 border-l border-slate-100 text-left">
                                        <div className="flex items-center justify-start gap-1.5">
                                            <div title={ua.type} className="flex items-center justify-center">
                                                <UAIcon className="w-3.5 h-3.5 text-slate-400" />
                                            </div>
                                            <div className="text-[11px] text-slate-500 font-mono tracking-tight">
                                                {log.ip === '::1' ? 'localhost' : (log.ip || 'INTERNAL')}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )})
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-400 hidden sm:inline-block">
                        페이지 {pagination.page} / {pagination.totalPages}
                    </span>
                    <div className="flex items-center gap-1.5 ml-auto">
                        <button
                            onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, (prev.page || 1) - 1) }))}
                            disabled={pagination.page <= 1}
                            className="flex items-center justify-center h-8 px-3 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition-colors shadow-sm"
                        >
                            <ChevronLeft className="w-3.5 h-3.5 mr-1" /> 이전
                        </button>
                        <button
                            onClick={() => setFilters(prev => ({ ...prev, page: Math.min(pagination.totalPages, (prev.page || 1) + 1) }))}
                            disabled={pagination.page >= pagination.totalPages}
                            className="flex items-center justify-center h-8 px-3 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition-colors shadow-sm"
                        >
                            다음 <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
